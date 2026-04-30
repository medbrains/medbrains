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

use axum::{Json, body::Bytes, extract::State, http::HeaderMap};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use super::signature::{SignatureMode, verify_signature};
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
///
/// Note we extract the body as `Bytes` (not `Json<Value>`) so the
/// signature verifier sees the exact bytes the gateway signed —
/// re-serializing through serde would re-order keys.
pub async fn receive_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Result<Json<CallbackAck>, AppError> {
    if let Err(e) = verify_signature(&headers, &body_bytes, SignatureMode::from_env()) {
        tracing::warn!(error = %e, "abdm callback signature rejected");
        return Err(AppError::Unauthorized);
    }

    let body: Value = serde_json::from_slice(&body_bytes)
        .map_err(|e| AppError::BadRequest(format!("malformed JSON: {e}")))?;

    let tenant_id = resolve_tenant_from_recipient(&state, &headers).await?;
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

/// Resolve `x-hcx-recipient-code` → tenant id via the
/// `tenants.abdm_hcx_sender_code` column. SELECT-on-every-callback
/// is fine — gateway throughput per tenant is in claims/sec, not
/// chat/sec, and the index on the column makes it ~sub-ms.
///
/// The dev override `x-medbrains-tenant-id` header is preserved so
/// local smoke tests don't need a real HFR registration. It only
/// activates when the recipient code is missing or unknown.
async fn resolve_tenant_from_recipient(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Uuid, AppError> {
    let code = headers
        .get("x-hcx-recipient-code")
        .and_then(|v| v.to_str().ok());

    if let Some(c) = code {
        let row: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM tenants WHERE abdm_hcx_sender_code = $1 \
              AND abdm_facility_active = TRUE",
        )
        .bind(c)
        .fetch_optional(&state.db)
        .await?;
        if let Some((id,)) = row {
            return Ok(id);
        }
        tracing::warn!(
            recipient_code = c,
            "abdm callback: no active tenant matches x-hcx-recipient-code"
        );
    }

    headers
        .get("x-medbrains-tenant-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| {
            AppError::BadRequest(
                "no tenant for x-hcx-recipient-code; set abdm_hcx_sender_code on the tenant first".into(),
            )
        })
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
