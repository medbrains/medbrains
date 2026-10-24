//! M2 context notify: once a care context is linked, tell the patient's app
//! that it holds a record (`POST /api/hiecm/hip/v3/link/context/notify`), and
//! take the gateway's answer at `/api/v3/links/context/on-notify`.
//!
//! Measured on the sandbox by OHC care-abdm (MIT, docs/findings.md):
//! - F9: ABDM needs time to index a new link. A notify 0.6 s after the link
//!   is refused ABDM-1006; 50 s later it succeeds. So `mark_linked` queues
//!   this a minute later, and an ABDM-1006 answer queues it again, later.
//! - F8: `careContext.patientReference` is our patient reference (the UHID
//!   the link sent as `patient.referenceNumber`), not the ABHA address.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{SecondsFormat, Utc};
use medbrains_abdm::gateway::LINK_CONTEXT_NOTIFY_PATH;
use medbrains_core::secrets::SecretResolver;
use serde_json::{Value, json};
use uuid::Uuid;

use super::gateway::{Hip, authenticate};
use super::linking::{error_code, load_patient};
use crate::{error::AppError, state::AppState};

/// Notifies tried per care context before the refusal is left on screen.
const MAX_NOTIFY_ATTEMPTS: i32 = 3;
/// Wait before retrying after ABDM-1006, times the attempt number.
const RETRY_SECONDS: f64 = 120.0;

#[derive(sqlx::FromRow)]
struct Context {
    patient_id: Uuid,
    reference_number: String,
    hi_types: Vec<String>,
    linked: bool,
    notified: bool,
    shareable: bool,
}

/// Send the notify for one linked care context. Nothing is sent for one not
/// (or no longer) linked, or already notified.
///
/// # Errors
/// 404 for an unknown care context; gateway refusals and outages as from [`Hip`].
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn notify_context(
    db: &sqlx::PgPool,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    care_context_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let c = sqlx::query_as::<_, Context>(
        "SELECT patient_id, reference_number, hi_types, link_status = 'linked' AS linked, \
                notified_at IS NOT NULL AS notified, \
                public.abdm_mental_health_shareable(tenant_id, patient_id, encounter_id) \
                  AS shareable \
           FROM abdm_care_contexts WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(care_context_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let patient = load_patient(&mut tx, tenant_id, c.patient_id).await?;
    tx.commit().await?;
    let (Some(address), Some(hip_id), true, false) = (
        patient.abha_address.clone(),
        patient.hip_id.clone(),
        c.linked,
        c.notified,
    ) else {
        return Ok(());
    };
    if patient.blocked_reason().is_some() || !c.shareable {
        return Ok(());
    }
    let body = json!({ "notification": {
        "patient": { "id": address },
        "careContext": { "patientReference": patient.uhid,
                         "careContextReference": c.reference_number },
        "hiTypes": c.hi_types,
        "date": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "hip": { "id": hip_id } } });
    let hip = Hip::connect(db, secrets, tenant_id, &hip_id).await?;
    let request_id = hip.send(LINK_CONTEXT_NOTIFY_PATH, None, &body).await?;
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_care_contexts SET notify_request_id = $3, \
                notify_attempts = notify_attempts + 1, notify_error = NULL \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(care_context_id)
    .bind(request_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `POST /api/v3/links/context/on-notify` — the gateway's answer. A repeat,
/// or an answer to nothing we sent, is acknowledged and changes nothing.
///
/// # Errors
/// 401 without a valid gateway JWT.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_notify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let Some(request_id) = body["response"]["requestId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
    else {
        return Ok(StatusCode::ACCEPTED);
    };
    let ok = body["error"].is_null() && body["acknowledgement"]["status"] == "SUCCESS";
    let error = (!ok).then(|| {
        medbrains_abdm::errors::describe_body(&body, "ABDM did not accept the notification")
    });
    // ABDM-1006: the link was not indexed yet — ask again later (F9).
    let retry = error_code(&body) == Some("ABDM-1006");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "WITH answered AS ( \
           UPDATE abdm_care_contexts \
              SET notified_at = CASE WHEN $3 THEN now() END, notify_error = $4 \
            WHERE tenant_id = $1 AND notify_request_id = $2 AND notified_at IS NULL \
            RETURNING id, notify_attempts) \
         INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload, \
                idempotency_key, next_retry_at) \
         SELECT $1, 'abdm_care_context', id, 'abdm.care_context.notify', \
                jsonb_build_object('care_context_id', id), \
                'ccn:' || id::text || ':' || notify_attempts, \
                now() + make_interval(secs => $6 * notify_attempts) \
           FROM answered WHERE $5 AND notify_attempts < $7 \
         ON CONFLICT (tenant_id, event_type, idempotency_key) \
            WHERE idempotency_key IS NOT NULL DO NOTHING",
    )
    .bind(caller.tenant_id)
    .bind(request_id)
    .bind(ok)
    .bind(error.as_deref())
    .bind(retry)
    .bind(RETRY_SECONDS)
    .bind(MAX_NOTIFY_ATTEMPTS)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(StatusCode::ACCEPTED)
}
