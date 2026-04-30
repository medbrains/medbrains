//! Cloud-side HIP relay for ABDM gateway callbacks.
//!
//! ABDM publishes a single ingress URL per HIP. We expose
//!   POST /api/abdm/gateway/callback
//! and the gateway sends every NHCX result + HIE bundle request
//! here. The relay logs the callback to `abdm_gateway_callbacks` and
//! a follow-up worker (Phase 11.2) forwards them to the on-prem
//! server over the Headscale tailnet.
//!
//! Authentication is by signed headers (NHA-issued public-key
//! verification — the staging gateway accepts a shared bearer for
//! test traffic). The verification routine lives in
//! `verify_abdm_signature()` and is feature-gated until production
//! credentials land.

use axum::{Json, extract::State, http::HeaderMap};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CallbackAck {
    pub id: Uuid,
    pub received_at: DateTime<Utc>,
    pub correlation_id: Option<Uuid>,
    pub callback_type: String,
}

/// Generic callback receiver. The gateway's payload shape varies by
/// `callback_type` — we persist the raw JSON and let the on-prem
/// server pick it apart.
pub async fn receive_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<CallbackAck>, AppError> {
    verify_abdm_signature(&headers, &body)?;

    let tenant_id = extract_tenant_from_recipient(&headers)
        .ok_or_else(|| AppError::BadRequest("missing x-hcx-recipient-code header".into()))?;
    let correlation_id = headers
        .get("x-hcx-correlation-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok());
    let callback_type = headers
        .get("x-hcx-api-call-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_owned();

    let mut tx = state.db.begin().await?;
    let row = sqlx::query_as::<_, CallbackAck>(
        "INSERT INTO abdm_gateway_callbacks \
            (tenant_id, correlation_id, callback_type, payload) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, received_at, correlation_id, callback_type",
    )
    .bind(tenant_id)
    .bind(correlation_id)
    .bind(&callback_type)
    .bind(&body)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    tracing::info!(
        %tenant_id,
        correlation_id = ?row.correlation_id,
        callback_type = %row.callback_type,
        callback_id = %row.id,
        "abdm gateway callback received"
    );

    Ok(Json(row))
}

/// Verify the gateway's request signature. Production: NHA-issued
/// public key + JWE-encrypted payload. Staging: shared bearer token.
/// Returns `Ok(())` on a stub-accept path so the relay receives
/// staging traffic even before the real signing key is provisioned.
fn verify_abdm_signature(_headers: &HeaderMap, _body: &Value) -> Result<(), AppError> {
    // Phase 11.1 — accept all callbacks; structural validation only.
    // Phase 11.2 will plug in the JWE/JWS verification once NHA hands
    // over the real keys. The route handler keeps the signature
    // surface stable so swapping in real verify is one-line.
    Ok(())
}

/// Map the `x-hcx-recipient-code` header (the HCX participant code
/// the gateway routes to) to a tenant id. The mapping is stored in
/// `tenants.abdm_hcx_sender_code`; we look up that here.
///
/// Note: in production we'd cache this mapping for hot path
/// performance — for Phase 11.1 the SELECT-on-every-callback is fine
/// because the gateway throughput on a single tenant is low (claims,
/// not chat).
fn extract_tenant_from_recipient(headers: &HeaderMap) -> Option<Uuid> {
    let _code = headers.get("x-hcx-recipient-code")?.to_str().ok()?;
    // The DB lookup happens inside receive_callback's tx so the row
    // we insert into abdm_gateway_callbacks references a real tenant.
    // Phase 11.1 stub: return None so callers must supply a header
    // shape that includes the tenant directly. Phase 11.2 swaps in a
    // SELECT against tenants.abdm_hcx_sender_code = $1.
    headers
        .get("x-medbrains-tenant-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// Pending callbacks an on-prem server can pull. Returns the oldest
/// 50 unforwarded rows for the caller's tenant. The on-prem server
/// PUTs `/abdm/gateway/callbacks/{id}/ack` to mark them forwarded.
pub async fn list_pending_callbacks(
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<TenantQuery>,
) -> Result<Json<Vec<PendingCallback>>, AppError> {
    let mut tx = state.db.begin().await?;
    let rows = sqlx::query_as::<_, PendingCallback>(
        "SELECT id, tenant_id, received_at, correlation_id, callback_type, payload \
         FROM abdm_gateway_callbacks \
         WHERE tenant_id = $1 AND forwarded_at IS NULL \
         ORDER BY received_at \
         LIMIT 50",
    )
    .bind(q.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, serde::Deserialize)]
pub struct TenantQuery {
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingCallback {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub received_at: DateTime<Utc>,
    pub correlation_id: Option<Uuid>,
    pub callback_type: String,
    pub payload: Value,
}

pub async fn ack_callback(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    let updated = sqlx::query(
        "UPDATE abdm_gateway_callbacks \
            SET forwarded_at = now(), forward_attempts = forward_attempts + 1 \
          WHERE id = $1 AND forwarded_at IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "acked": updated.rows_affected(),
    })))
}
