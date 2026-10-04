//! A referral's life after it is sent: accepted, declined, answered or
//! withdrawn (RFCs/RFC-MODULE-opd-referral-journey.md, slice 1).
//!
//! Accepting puts the patient in the accepting doctor's queue as a second row
//! on the same visit, with its own token; answering records the opinion and,
//! by default, puts the patient back in the referring doctor's queue ahead of
//! new arrivals. Only the visit's own queue row closes the visit.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::consultation::Referral;
use medbrains_core::encounter::OpdQueue;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct DeclineReferralRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CompleteReferralRequest {
    pub opinion: String,
    /// Send the patient back to the referring doctor (default). Off when the
    /// accepting doctor keeps the patient.
    #[serde(default = "send_back")]
    pub return_to_referrer: bool,
}

const fn send_back() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct ReferralStep {
    pub referral: Referral,
    /// The queue row this step put the patient in, if any.
    pub queue_id: Option<Uuid>,
    /// The number that row's board will call.
    pub token_number: Option<String>,
}

/// The referral, locked, if it is the caller's to act on — otherwise 404, so
/// the endpoint is not a way to learn which referrals exist.
async fn load_addressed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<Referral, AppError> {
    let referral = lock(tx, claims, id).await?;
    let to_me = referral.to_doctor_id == Some(claims.sub)
        || (referral.to_doctor_id.is_none()
            && claims.department_ids.contains(&referral.to_department_id));
    if to_me || is_bypass_role(claims) {
        Ok(referral)
    } else {
        Err(AppError::NotFound)
    }
}

async fn lock(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<Referral, AppError> {
    sqlx::query_as::<_, Referral>(
        "SELECT * FROM referrals WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

fn require_status(referral: &Referral, status: &str) -> Result<(), AppError> {
    if referral.status == status {
        Ok(())
    } else {
        Err(AppError::Conflict(format!(
            "This referral is already {}",
            referral.status
        )))
    }
}

fn required_text(value: &str, what: &str) -> Result<String, AppError> {
    let text = value.trim();
    if text.is_empty() {
        return Err(AppError::BadRequest(format!("Write the {what}")));
    }
    Ok(text.to_owned())
}

/// The token priority a referral's urgency earns in the receiving queue.
fn priority_for(urgency: &str) -> &'static str {
    match urgency {
        "emergency" => "emergency_referral",
        "urgent" => "urgent",
        _ => "normal",
    }
}

/// Where a referral puts the patient: a queue row on the visit and its token.
struct Placement<'a> {
    referral: &'a Referral,
    encounter_id: Uuid,
    department_id: Uuid,
    doctor_id: Option<Uuid>,
    kind: &'a str,
    priority: &'a str,
}

/// Put the patient in a doctor's queue as another row on the same visit, with
/// a token in the same visit number.
async fn place_in_queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    at: Placement<'_>,
) -> Result<(OpdQueue, Option<String>), AppError> {
    let queue = sqlx::query_as::<_, OpdQueue>(
        "INSERT INTO opd_queues \
           (tenant_id, encounter_id, department_id, doctor_id, token_number, kind, \
            referral_id, created_by) \
         SELECT $1, $2, $3, $4, \
                COALESCE((SELECT token_number FROM opd_queues \
                           WHERE encounter_id = $2 AND kind = 'primary' \
                             AND deleted_at IS NULL ORDER BY created_at LIMIT 1), 0), \
                $5, $6, $7 \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(at.encounter_id)
    .bind(at.department_id)
    .bind(at.doctor_id)
    .bind(at.kind)
    .bind(at.referral.id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    let visit_id = medbrains_tokens::current_visit(tx, at.referral.patient_id).await?;
    let token = medbrains_tokens::issue_token_in_tx(
        tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            visit_id,
            module: "opd",
            scope: "department",
            scope_id: Some(at.department_id),
            scope_label: None,
            priority: at.priority,
            patient_id: Some(at.referral.patient_id),
            patient_name: None,
            entity_type: Some("opd_queue"),
            entity_id: Some(queue.id),
            issued_by: Some(claims.sub),
        },
    )
    .await?;
    Ok((queue, token))
}

/// `PUT /api/opd/referrals/{id}/accept`
pub async fn accept_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReferralStep>, AppError> {
    require_permission(&claims, permissions::opd::referrals::RESPOND)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let pending = load_addressed(&mut tx, &claims, id).await?;
    require_status(&pending, "pending")?;

    let referral = sqlx::query_as::<_, Referral>(
        "UPDATE referrals SET status = 'accepted', accepted_by = $2, accepted_at = now(), \
                responded_at = now(), to_doctor_id = COALESCE(to_doctor_id, $2), \
                updated_at = now() \
          WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let placed = match referral.encounter_id {
        Some(encounter_id) => Some(
            place_in_queue(
                &mut tx,
                &claims,
                Placement {
                    referral: &referral,
                    encounter_id,
                    department_id: referral.to_department_id,
                    doctor_id: Some(claims.sub),
                    kind: "cross_consult",
                    priority: priority_for(&referral.urgency),
                },
            )
            .await?,
        ),
        None => None,
    };
    tx.commit().await?;

    if let Some((queue, _)) = &placed {
        crate::transfer::grant_new_care_team(
            &state,
            &claims,
            queue.encounter_id,
            queue.department_id,
            Some(claims.sub),
        )
        .await?;
        crate::signal_queue_changed(&state, &claims, queue);
    }
    Ok(Json(step(referral, placed)))
}

/// `PUT /api/opd/referrals/{id}/decline`
pub async fn decline_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DeclineReferralRequest>,
) -> Result<Json<ReferralStep>, AppError> {
    require_permission(&claims, permissions::opd::referrals::RESPOND)?;
    let reason = required_text(&body.reason, "reason for declining")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let pending = load_addressed(&mut tx, &claims, id).await?;
    require_status(&pending, "pending")?;
    let referral = sqlx::query_as::<_, Referral>(
        "UPDATE referrals SET status = 'declined', response_notes = $2, responded_at = now(), \
                updated_at = now() \
          WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(reason)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(step(referral, None)))
}

/// `PUT /api/opd/referrals/{id}/cancel` — the referring doctor withdraws it.
pub async fn cancel_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReferralStep>, AppError> {
    require_permission(&claims, permissions::opd::referrals::CANCEL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let pending = lock(&mut tx, &claims, id).await?;
    if pending.from_doctor_id != Some(claims.sub) && !is_bypass_role(&claims) {
        return Err(AppError::NotFound);
    }
    require_status(&pending, "pending")?;
    let referral = sqlx::query_as::<_, Referral>(
        "UPDATE referrals SET status = 'cancelled', cancelled_at = now(), updated_at = now() \
          WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(step(referral, None)))
}

/// `PUT /api/opd/referrals/{id}/complete` — the opinion is given.
pub async fn complete_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteReferralRequest>,
) -> Result<Json<ReferralStep>, AppError> {
    require_permission(&claims, permissions::opd::referrals::RESPOND)?;
    let opinion = required_text(&body.opinion, "opinion")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let accepted = load_addressed(&mut tx, &claims, id).await?;
    require_status(&accepted, "accepted")?;
    let referral = sqlx::query_as::<_, Referral>(
        "UPDATE referrals SET status = 'completed', response_notes = $2, \
                completed_at = now(), updated_at = now() \
          WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(opinion)
    .fetch_one(&mut *tx)
    .await?;

    let finished = finish_consult_row(&mut tx, &claims, id).await?;
    let returned = match (
        body.return_to_referrer,
        referral.encounter_id,
        referral.from_doctor_id,
    ) {
        (true, Some(encounter_id), Some(from_doctor)) => Some(
            place_in_queue(
                &mut tx,
                &claims,
                Placement {
                    referral: &referral,
                    encounter_id,
                    department_id: referral.from_department_id,
                    doctor_id: Some(from_doctor),
                    kind: "returned",
                    priority: "returned",
                },
            )
            .await?,
        ),
        _ => None,
    };
    tx.commit().await?;

    for queue in finished.iter().chain(returned.iter().map(|(q, _)| q)) {
        crate::signal_queue_changed(&state, &claims, queue);
    }
    Ok(Json(step(referral, returned)))
}

/// Close the accepting doctor's queue row for this referral, if still open,
/// and charge the consultation it stood for.
async fn finish_consult_row(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    referral_id: Uuid,
) -> Result<Option<OpdQueue>, AppError> {
    let row = sqlx::query_as::<_, OpdQueue>(
        "UPDATE opd_queues SET status = 'completed'::queue_status, completed_at = now(), \
                updated_at = now() \
          WHERE referral_id = $1 AND tenant_id = $2 AND kind = 'cross_consult' \
            AND deleted_at IS NULL \
            AND status IN ('waiting'::queue_status, 'called'::queue_status, \
                           'in_consultation'::queue_status) \
          RETURNING *",
    )
    .bind(referral_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(queue) = &row {
        crate::charge_consultation(tx, claims, queue).await?;
        crate::advance_queue_token(tx, claims, queue, "completed").await?;
    }
    Ok(row)
}

fn step(referral: Referral, placed: Option<(OpdQueue, Option<String>)>) -> ReferralStep {
    let (queue_id, token_number) = placed.map_or((None, None), |(q, t)| (Some(q.id), t));
    ReferralStep {
        referral,
        queue_id,
        token_number,
    }
}
