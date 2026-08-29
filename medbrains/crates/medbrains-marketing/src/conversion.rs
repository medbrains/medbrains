//! Turning an enquiry into a patient — the moment the funnel actually closes.
//!
//! # What was missing
//!
//! `mkt_contacts.patient_id` could only ever be set by passing it to
//! `create_contact`, which means somebody had to already know the patient's id
//! and type it in. There was no path from "this person enquired" to "this
//! person is now registered", so the last step of the funnel happened in the
//! registration screen with nothing linking the two — the campaign that
//! produced the patient could not be told it had.
//!
//! # Why converting is two calls, not one
//!
//! The obvious design is one button that creates a patient from the enquiry.
//! It is wrong, and the repo already carries the scar: `find_or_create_patient`
//! in public booking is commented *"Family members share phones — phone alone
//! booked into the wrong record (audit P1)"*.
//!
//! A hospital enquiry line is answered by whoever is holding the family phone.
//! A son rings about his mother, a daughter about her father, a neighbour
//! about somebody with no phone at all. Matching an enquiry to a patient by
//! number alone attaches the enquiry — and every future campaign, recall and
//! interaction — to the wrong chart. Creating a fresh patient every time
//! instead produces duplicate records for people who are already registered,
//! which splits a clinical history in half.
//!
//! Both failures are worse than asking. So [`patient_matches`] shows the desk
//! who this might be, and [`convert_contact`] does exactly what the desk chose:
//! link to an existing patient, or register a new one. There is deliberately
//! no "convert automatically".
//!
//! # Who may do it
//!
//! Both halves. Converting needs a marketing permission *and* a patients one,
//! and that is the point rather than an inconvenience: `marketing_executive`
//! holds no `patients.*` code at all, so this cannot become a way for the
//! campaign desk to create patient records. The registration desk holds both
//! already, because converting a walk-in enquiry is its job.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::funnel::{self, StageMove};

/// How many candidates the desk is shown.
///
/// A shared landline in a village can carry a lot of people. Past a handful
/// the list stops being a choice and becomes a search, and picking the wrong
/// row off a long list is the failure this endpoint exists to prevent.
const MAX_MATCHES: i64 = 10;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientMatch {
    pub patient_id: Uuid,
    pub uhid: String,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: String,
    /// True when the enquiry's name also matches, not only the number.
    ///
    /// Surfaced rather than used to auto-select: it is the difference between
    /// "this is probably them" and "this is somebody else on the same phone",
    /// and that judgement belongs to the person who just spoke to them.
    pub name_matches: bool,
}

/// `GET /api/marketing/contacts/{id}/patient-matches`
///
/// Who this enquiry might already be.
///
/// Matches on the phone number, which is deliberately loose: the point is to
/// show the desk every person who could be meant, including the ones whose
/// names do not match, because "this is the son, not the mother" is exactly
/// the distinction a silent matcher gets wrong.
///
/// # Errors
/// Returns 403 without both `marketing.contacts.view` and `patients.list`,
/// 404 if the enquiry is not in this tenant.
pub async fn patient_matches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
) -> Result<Json<Vec<PatientMatch>>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::VIEW)?;
    // Names and UHIDs of real patients cross the wall here, so the caller
    // needs the patient permission too. Marketing roles hold neither, which
    // is why they cannot open this.
    require_permission(&claims, permissions::patients::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enquiry: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT primary_phone, display_name FROM mkt_contacts \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((phone, display_name)) = enquiry else {
        return Err(AppError::NotFound);
    };

    // No number, no candidates. An empty list here means "we cannot tell",
    // and the screen says so rather than implying nobody matched.
    let Some(phone) = phone.filter(|p| !p.trim().is_empty()) else {
        tx.commit().await?;
        return Ok(Json(Vec::new()));
    };

    // The enquiry's first word, which is what the desk actually typed as a
    // name. Compared case-insensitively, and only ever to rank — never to
    // filter a candidate out.
    let first_word = display_name
        .as_deref()
        .and_then(|n| n.split_whitespace().next())
        .unwrap_or_default()
        .to_owned();

    let rows = sqlx::query_as::<_, PatientMatch>(
        "SELECT p.id AS patient_id, p.uhid, p.first_name, p.last_name, p.phone, \
                p.date_of_birth, p.gender::text AS gender, \
                (lower(p.first_name) = lower($3)) AS name_matches \
         FROM patients p \
         WHERE p.tenant_id = $1 AND p.phone = $2 AND p.is_active \
         ORDER BY (lower(p.first_name) = lower($3)) DESC, p.created_at DESC \
         LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(phone.trim())
    .bind(&first_word)
    .bind(MAX_MATCHES)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// What the desk decided.
#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ConvertRequest {
    /// This enquiry is an existing patient.
    Link { patient_id: Uuid },
    /// Nobody on file. Register them.
    Register {
        first_name: String,
        last_name: Option<String>,
        gender: Option<String>,
        date_of_birth: Option<chrono::NaiveDate>,
    },
}

#[derive(Debug, Serialize)]
pub struct ConvertResponse {
    pub contact_id: Uuid,
    pub patient_id: Uuid,
    pub uhid: String,
    /// True when this call registered somebody new.
    pub registered: bool,
}

/// `POST /api/marketing/contacts/{id}/convert`
///
/// Links the enquiry to a patient — an existing one the desk picked, or a new
/// one it asked for — and closes the enquiry in the funnel.
///
/// The stage move is part of the same transaction. A conversion that linked
/// the patient but left the enquiry sitting in "contacted" would keep it on
/// the callback list and out of the conversion count, so the desk would ring
/// somebody who had already registered.
///
/// # Errors
/// Returns 403 without `marketing.pipeline.move` plus `patients.view`
/// (linking) or `patients.create` (registering); 404 if the enquiry or the
/// chosen patient is not in this tenant; 409 if the enquiry is already linked.
pub async fn convert_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<ConvertRequest>,
) -> Result<Json<ConvertResponse>, AppError> {
    // Closing the enquiry is a pipeline move whichever branch is taken.
    require_permission(&claims, permissions::marketing::pipeline::MOVE)?;
    match &body {
        ConvertRequest::Link { .. } => require_permission(&claims, permissions::patients::VIEW)?,
        ConvertRequest::Register { .. } => {
            require_permission(&claims, permissions::patients::CREATE)?;
        }
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enquiry: Option<(Option<Uuid>, Option<String>, Option<Uuid>)> = sqlx::query_as(
        "SELECT patient_id, primary_phone, stage_id FROM mkt_contacts \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((existing_patient, phone, from_stage_id)) = enquiry else {
        return Err(AppError::NotFound);
    };

    // Converting twice would mint a second UHID for somebody already
    // registered, which is the duplicate-record failure this module exists to
    // avoid — so it is refused rather than made idempotent.
    if existing_patient.is_some() {
        return Err(AppError::Conflict(
            "this enquiry is already linked to a patient".to_owned(),
        ));
    }

    let (patient_id, uhid, registered) = match body {
        ConvertRequest::Link { patient_id } => {
            let found: Option<String> = sqlx::query_scalar(
                "SELECT uhid FROM patients WHERE id = $1 AND tenant_id = $2 AND is_active",
            )
            .bind(patient_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
            let uhid = found.ok_or(AppError::NotFound)?;
            (patient_id, uhid, false)
        }
        ConvertRequest::Register {
            first_name,
            last_name,
            gender,
            date_of_birth,
        } => {
            let first = first_name.trim();
            if first.is_empty() {
                return Err(AppError::BadRequest(
                    "a patient record needs at least a first name".to_owned(),
                ));
            }
            // A patient record needs a number, and the enquiry's is the one
            // the hospital actually reached them on.
            let Some(phone) = phone.filter(|p| !p.trim().is_empty()) else {
                return Err(AppError::BadRequest(
                    "this enquiry has no phone number, so it cannot be \
                     registered from here — take the details at the desk"
                        .to_owned(),
                ));
            };

            let uhid = medbrains_patients::generate_uhid(&mut tx, &claims.tenant_id).await?;
            let patient_id: Uuid = sqlx::query_scalar(
                "INSERT INTO patients \
                    (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
                 VALUES ($1, $2, $3, $4, COALESCE($5, 'unknown')::gender, $6, $7) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(&uhid)
            .bind(first)
            .bind(last_name.as_deref().map(str::trim).unwrap_or(""))
            .bind(gender.as_deref())
            .bind(phone.trim())
            .bind(date_of_birth)
            .fetch_one(&mut *tx)
            .await?;
            (patient_id, uhid, true)
        }
    };

    // The won stage, so the conversion is counted. Falls back to the last
    // stage in the pipeline when no stage is flagged — a tenant that has not
    // marked one should still see its conversions somewhere, not nowhere.
    let won_stage: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mkt_pipeline_stages WHERE tenant_id = $1 \
         ORDER BY is_won DESC, position DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE mkt_contacts SET patient_id = $3, stage_id = COALESCE($4, stage_id), \
                last_contacted_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(won_stage)
    .execute(&mut *tx)
    .await?;

    if let Some(to_stage_id) = won_stage {
        funnel::record_stage_move(
            &mut tx,
            &StageMove {
                tenant_id: claims.tenant_id,
                contact_id,
                from_stage_id,
                to_stage_id,
                actor_id: Some(claims.sub),
                source: funnel::source::AGENT,
                note: Some(if registered {
                    "Registered as a patient from the enquiry"
                } else {
                    "Matched to an existing patient"
                }),
            },
        )
        .await?;
    }

    // Close any callback still owed. Ringing somebody to ask whether they
    // would like to register, after they have registered, is the specific
    // embarrassment this line prevents.
    sqlx::query(
        "UPDATE mkt_tasks SET status = 'done', completed_at = now() \
         WHERE tenant_id = $1 AND contact_id = $2 AND status = 'open'",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .execute(&mut *tx)
    .await?;

    // The link itself belongs on the timeline. "Who turned this enquiry into a
    // patient, and when" is an audit question, and a column with no history
    // cannot answer it.
    sqlx::query(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, agent_id, disposition, note) \
         VALUES ($1, $2, 'conversion', 'system', 'internal', $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(claims.sub)
    .bind(if registered { "registered" } else { "linked" })
    .bind(format!("Linked to patient {uhid}"))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(ConvertResponse {
        contact_id,
        patient_id,
        uhid,
        registered,
    }))
}
