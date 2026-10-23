//! Nominated representatives (MHCA s.14) and advance directives (s.5),
//! with the one lawful route around a directive: an application to the
//! Board on a statutory ground (s.11).
//!
//! "Honour unless": while a directive is active the team must follow it
//! (s.10). It stops governing only when the patient revokes it, when the
//! Board modifies or cancels it, or — for emergency treatment alone — under
//! s.9. A pending application does not suspend it.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_authz_gate::mental_health::{
    PsychChild, require_psych_child_access, require_psych_record_access,
};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::{PsychAdvanceDirective, PsychNominatedRepresentative};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const REP_BASES: [&str; 7] = [
    "appointed_by_patient",
    "advance_directive",
    "relative",
    "care_giver",
    "board_appointed",
    "temporary_ngo",
    "legal_guardian",
];

#[derive(Debug, Deserialize)]
pub struct CreateRepresentativeRequest {
    pub full_name: String,
    pub relationship: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub basis: String,
    #[serde(default)]
    pub written_consent_received: bool,
    pub appointment_document_ref: Option<String>,
    pub appointed_on: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDirectiveRequest {
    pub made_on: Option<NaiveDate>,
    pub made_by: String,
    pub treatment_wishes: Option<String>,
    pub treatment_refusals: Option<String>,
    pub representative_preferences: Option<String>,
    pub document_ref: Option<String>,
}

pub(crate) fn non_blank(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// s.14(4): the representative consents in writing; one of the bases the
/// Act names.
fn validate_representative(body: &CreateRepresentativeRequest) -> Result<(), AppError> {
    if body.full_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Enter the representative's name".to_owned(),
        ));
    }
    if !REP_BASES.contains(&body.basis.as_str()) {
        return Err(AppError::BadRequest(
            "Choose how the representative was appointed".to_owned(),
        ));
    }
    if !body.written_consent_received {
        return Err(AppError::BadRequest(
            "A nominated representative must consent in writing to act (s.14(4))".to_owned(),
        ));
    }
    Ok(())
}

pub async fn list_representatives(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychNominatedRepresentative>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::patients::LIST)?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PsychNominatedRepresentative,
        "SELECT id, tenant_id, psych_patient_id, full_name, relationship, phone, address, basis, \
                written_consent_received, appointment_document_ref, appointed_on, revoked_at, \
                revoke_reason, recorded_by, created_at, updated_at \
           FROM psych_nominated_representatives \
          WHERE psych_patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY revoked_at NULLS FIRST, created_at DESC LIMIT 100",
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_representative(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateRepresentativeRequest>,
) -> Result<Json<PsychNominatedRepresentative>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::legal::MANAGE)?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    validate_representative(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychNominatedRepresentative,
        "INSERT INTO psych_nominated_representatives \
           (tenant_id, psych_patient_id, full_name, relationship, phone, address, basis, \
            written_consent_received, appointment_document_ref, appointed_on, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         ON CONFLICT (psych_patient_id) WHERE revoked_at IS NULL AND deleted_at IS NULL DO NOTHING \
         RETURNING id, tenant_id, psych_patient_id, full_name, relationship, phone, address, basis, \
                written_consent_received, appointment_document_ref, appointed_on, revoked_at, \
                revoke_reason, recorded_by, created_at, updated_at",
        claims.tenant_id,
        psych_patient_id,
        body.full_name.trim(),
        non_blank(body.relationship.as_ref()),
        non_blank(body.phone.as_ref()),
        non_blank(body.address.as_ref()),
        body.basis,
        body.written_consent_received,
        non_blank(body.appointment_document_ref.as_ref()),
        body.appointed_on,
        claims.sub,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "The patient already has a nominated representative; revoke that appointment first \
             (s.14(6))"
                .to_owned(),
        )
    })?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn revoke_representative(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeRequest>,
) -> Result<Json<PsychNominatedRepresentative>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::legal::MANAGE)?;
    require_psych_child_access(&state, &claims, PsychChild::NominatedRepresentative, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychNominatedRepresentative,
        "UPDATE psych_nominated_representatives SET revoked_at = now(), revoke_reason = $3 \
          WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL AND deleted_at IS NULL \
         RETURNING id, tenant_id, psych_patient_id, full_name, relationship, phone, address, basis, \
                written_consent_received, appointment_document_ref, appointed_on, revoked_at, \
                revoke_reason, recorded_by, created_at, updated_at",
        id,
        claims.tenant_id,
        non_blank(body.reason.as_ref()),
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This appointment is already revoked".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_directives(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychAdvanceDirective>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::patients::LIST)?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PsychAdvanceDirective,
        "SELECT id, tenant_id, psych_patient_id, made_on, made_by, treatment_wishes, \
                treatment_refusals, representative_preferences, document_ref, status, revoked_at, \
                recorded_by, created_at, updated_at \
           FROM psych_advance_directives \
          WHERE psych_patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY (status = 'active') DESC, created_at DESC LIMIT 100",
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// s.5: any adult may make one; s.11(4): a guardian may make one for a minor.
pub async fn create_directive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateDirectiveRequest>,
) -> Result<Json<PsychAdvanceDirective>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::legal::MANAGE)?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let wishes = non_blank(body.treatment_wishes.as_ref());
    let refusals = non_blank(body.treatment_refusals.as_ref());
    let reps = non_blank(body.representative_preferences.as_ref());
    if wishes.is_none() && refusals.is_none() && reps.is_none() {
        return Err(AppError::BadRequest(
            "Record what the directive says: how to be treated, how not to be, or who should \
             represent the patient"
                .to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let minor = sqlx::query_scalar!(
        r#"SELECT (date_part('year', age(p.date_of_birth)) < 18) AS "minor?"
             FROM psych_patients pp JOIN patients p ON p.id = pp.patient_id
            WHERE pp.id = $1 AND pp.tenant_id = $2"#,
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    match (body.made_by.as_str(), minor) {
        ("patient", Some(false)) | ("legal_guardian", Some(true)) => {}
        ("patient" | "legal_guardian", None) => {
            return Err(AppError::BadRequest(
                "Record the patient's date of birth: who may make a directive depends on whether \
                 they are a minor"
                    .to_owned(),
            ));
        }
        ("patient", Some(true)) => {
            return Err(AppError::BadRequest(
                "A minor's advance directive is made by their legal guardian (s.11(4))".to_owned(),
            ));
        }
        _ => {
            return Err(AppError::BadRequest(
                "An adult makes their own advance directive (s.5)".to_owned(),
            ));
        }
    }
    let row = sqlx::query_as!(
        PsychAdvanceDirective,
        "INSERT INTO psych_advance_directives \
           (tenant_id, psych_patient_id, made_on, made_by, treatment_wishes, treatment_refusals, \
            representative_preferences, document_ref, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT (psych_patient_id) WHERE status = 'active' AND deleted_at IS NULL DO NOTHING \
         RETURNING id, tenant_id, psych_patient_id, made_on, made_by, treatment_wishes, \
                treatment_refusals, representative_preferences, document_ref, status, revoked_at, \
                recorded_by, created_at, updated_at",
        claims.tenant_id,
        psych_patient_id,
        body.made_on,
        body.made_by,
        wishes,
        refusals,
        reps,
        non_blank(body.document_ref.as_ref()),
        claims.sub,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "An advance directive is already active; record its revocation first (s.8)".to_owned(),
        )
    })?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The patient revoked it (s.8). Only the patient may — the clinician
/// records it; a clinician who disagrees applies to the Board instead.
pub async fn revoke_directive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PsychAdvanceDirective>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::legal::MANAGE)?;
    require_psych_child_access(&state, &claims, PsychChild::AdvanceDirective, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychAdvanceDirective,
        "UPDATE psych_advance_directives SET status = 'revoked', revoked_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND deleted_at IS NULL \
         RETURNING id, tenant_id, psych_patient_id, made_on, made_by, treatment_wishes, \
                treatment_refusals, representative_preferences, document_ref, status, revoked_at, \
                recorded_by, created_at, updated_at",
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This directive is no longer active".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}
