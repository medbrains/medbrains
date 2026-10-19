//! Asking ABDM where a consent request stands — v3 `consent/request/status`,
//! answered at `on-status` — for a request whose `notify` never came.
//!
//! - A doctor's "Check status" on one request, at most every
//!   [`MANUAL_EVERY_SECONDS`].
//! - A bounded check on read, no cron: opening a patient's requests asks
//!   about at most [`AUTO_PER_READ`] of them that have waited for the patient
//!   longer than [`STALE_AFTER_SECONDS`] and were not asked about in the last
//!   [`AUTO_EVERY_SECONDS`].
//!
//! The REQUEST-ID is stored on the request before the call goes out, so an
//! `on-status` that arrives first finds it. The answer is applied as `notify`
//! applies one (`grant::settle`).

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use medbrains_abdm::gateway::CONSENT_STATUS_PATH;
use medbrains_core::permissions;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    callbacks::{caller_of, connect_hiu, error_of, request_id_of},
    grant::{ANSWERS, ASKED_COLUMNS, Asked, MAX_ARTEFACTS, fetch_all, settle},
    requests::{AbdmConsentRequest, REQUEST_COLUMNS},
};
use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    routes::abdm::hip::{consent::strings, gateway::Hip},
    state::AppState,
};

/// How often a doctor may ask about one request.
const MANUAL_EVERY_SECONDS: i64 = 30;
/// Requests checked automatically per read of a patient's requests.
const AUTO_PER_READ: i64 = 3;
/// How long a request waits for the patient before it is checked on read.
const STALE_AFTER_SECONDS: i64 = 600;
/// How often one request is checked automatically.
const AUTO_EVERY_SECONDS: i64 = 900;

/// A request claimed for a status check, its REQUEST-ID already stored.
#[derive(sqlx::FromRow)]
pub(super) struct Claimed {
    consent_request_id: String,
    status_request_id: Uuid,
    hiu_id: String,
}

struct Pick {
    id: Option<Uuid>,
    patient_id: Option<Uuid>,
    stale_after: i64,
    every: i64,
    limit: i64,
}

/// Claim requests waiting for the patient: stamp the check and its
/// REQUEST-ID. Requests checked too recently are skipped.
async fn claim(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    pick: &Pick,
) -> Result<Vec<Claimed>, AppError> {
    let claimed = sqlx::query_as::<_, Claimed>(
        "UPDATE abdm_consent_requests SET status_checked_at = now(), \
                status_request_id = gen_random_uuid() \
          WHERE tenant_id = $1 AND id IN (SELECT id FROM abdm_consent_requests \
                 WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'awaiting_patient' \
                   AND consent_request_id IS NOT NULL \
                   AND ($2::uuid IS NULL OR id = $2) AND ($3::uuid IS NULL OR patient_id = $3) \
                   AND requested_at <= now() - $4::bigint * interval '1 second' \
                   AND (status_checked_at IS NULL \
                        OR status_checked_at <= now() - $5::bigint * interval '1 second') \
                 ORDER BY status_checked_at NULLS FIRST, requested_at LIMIT $6 \
                 FOR UPDATE SKIP LOCKED) \
         RETURNING consent_request_id, status_request_id, hiu_id",
    )
    .bind(tenant_id)
    .bind(pick.id)
    .bind(pick.patient_id)
    .bind(pick.stale_after)
    .bind(pick.every)
    .bind(pick.limit)
    .fetch_all(&mut **tx)
    .await?;
    Ok(claimed)
}

async fn ask(state: &AppState, tenant_id: Uuid, c: &Claimed) -> Result<(), AppError> {
    let hiu = Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        tenant_id,
        &c.hiu_id,
    )
    .await?;
    let body = json!({ "consentRequestId": c.consent_request_id });
    hiu.send_as_hiu_with_id(CONSENT_STATUS_PATH, c.status_request_id, &body)
        .await
}

/// Claim one patient's stale requests inside the read's transaction; the
/// calls go out after it commits ([`ask_later`]).
///
/// # Errors
/// A database fault.
pub(super) async fn claim_stale(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<Claimed>, AppError> {
    let pick = Pick {
        id: None,
        patient_id: Some(patient_id),
        stale_after: STALE_AFTER_SECONDS,
        every: AUTO_EVERY_SECONDS,
        limit: AUTO_PER_READ,
    };
    claim(tx, tenant_id, &pick).await
}

/// Ask about claimed requests without holding up the read. A failure is
/// logged; the next read after [`AUTO_EVERY_SECONDS`] tries again.
pub(super) fn ask_later(state: &AppState, tenant_id: Uuid, claimed: Vec<Claimed>) {
    if claimed.is_empty() {
        return;
    }
    let state = state.clone();
    tokio::spawn(async move {
        for c in &claimed {
            if let Err(e) = ask(&state, tenant_id, c).await {
                tracing::warn!(error = %e, %tenant_id, "abdm hiu: consent status check failed");
            }
        }
    });
}

/// `POST /api/abdm/consent-requests/{id}/check-status` — ask ABDM now.
/// Returns the request; its status changes when ABDM answers.
///
/// # Errors
/// 403 without `abdm.consent.request` or access to the patient; 404 for an
/// unknown request; 400 or 503 when ABDM refuses or cannot be reached.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AbdmConsentRequest>, AppError> {
    require_permission(&claims, permissions::abdm::consent::REQUEST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM abdm_consent_requests \
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let pick = Pick {
        id: Some(id),
        patient_id: None,
        stale_after: 0,
        every: MANUAL_EVERY_SECONDS,
        limit: 1,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let claimed = claim(&mut tx, claims.tenant_id, &pick).await?;
    tx.commit().await?;
    for c in &claimed {
        ask(&state, claims.tenant_id, c).await?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AbdmConsentRequest>(&format!(
        "SELECT {REQUEST_COLUMNS} FROM abdm_consent_requests r WHERE r.tenant_id = $1 AND r.id = $2"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Whether an `on-status` answer moves the request on. Only forward: a
/// request still waiting takes any answer, a granted one only its end. A
/// late answer never re-grants a consent `notify` already ended.
fn moves_on(current: &str, answer: &str) -> bool {
    match current {
        "requested" | "awaiting_patient" => true,
        "granted" => matches!(answer, "REVOKED" | "EXPIRED"),
        _ => false,
    }
}

/// `POST /api/v3/hiu/consent/request/on-status` — ABDM's answer to a check.
///
/// # Errors
/// 401 without a valid gateway JWT; 400 for an unknown status; 404 for a
/// request we did not ask about.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = caller_of(&state, &headers).await?;
    let answer = &body["consentRequest"];
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let asked = sqlx::query_as::<_, Asked>(&format!(
        "SELECT {ASKED_COLUMNS} FROM abdm_consent_requests r \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
            AND (r.status_request_id = $2 OR r.consent_request_id = $3) LIMIT 1"
    ))
    .bind(caller.tenant_id)
    .bind(request_id_of(&body))
    .bind(answer["id"].as_str())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if let Some(error) = error_of(&body) {
        tracing::warn!(error = %error, "abdm hiu: ABDM could not say where a consent request stands");
        return Ok(StatusCode::ACCEPTED);
    }
    let status = answer["status"].as_str().unwrap_or_default();
    if !ANSWERS.contains(&status) {
        return if status == "REQUESTED" {
            Ok(StatusCode::ACCEPTED)
        } else {
            Err(AppError::BadRequest("unknown consent status".to_owned()))
        };
    }
    if !moves_on(&asked.status, status) {
        return Ok(StatusCode::ACCEPTED);
    }
    let mut artefact_ids = strings(&answer["consentArtefacts"], Some("id"));
    artefact_ids.truncate(MAX_ARTEFACTS);
    let granted = settle(
        &mut tx,
        &caller,
        &asked,
        (status, answer["id"].as_str()),
        &artefact_ids,
    )
    .await?;
    tx.commit().await?;
    if !granted.is_empty() {
        let hiu = connect_hiu(&state, &caller).await?;
        fetch_all(&state, &hiu, granted).await?;
    }
    Ok(StatusCode::ACCEPTED)
}

#[cfg(test)]
mod tests {
    use super::moves_on;

    #[test]
    fn a_late_answer_never_reopens_an_ended_consent() {
        assert!(moves_on("awaiting_patient", "GRANTED"));
        assert!(moves_on("requested", "DENIED"));
        assert!(moves_on("granted", "REVOKED"));
        assert!(!moves_on("granted", "GRANTED"), "no second fetch");
        assert!(!moves_on("revoked", "GRANTED"));
        assert!(!moves_on("denied", "GRANTED"));
    }
}
