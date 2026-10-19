//! Cloud-side HIP relay for ABDM gateway callbacks.
//!
//! `POST /api/abdm/gateway/callback` is public: the gateway is not a user.
//! It is authenticated the way every HIP callback is (`hip::gateway`): the
//! gateway's RS256 JWT, verified against the gateway's published keys, and the
//! hospital named by the HFR facility ID in `X-HIP-ID` — never by a query
//! string or a dev header. The raw callback is kept in
//! `abdm_gateway_callbacks` for that hospital's on-premises server to pull
//! (signed in, with `abdm.relay.pull`, its own rows only).

use axum::{Extension, Json, extract::State, http::HeaderMap};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use super::hip::gateway::authenticate;
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use medbrains_core::permissions;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CallbackAck {
    pub id: Uuid,
    pub received_at: DateTime<Utc>,
    pub correlation_id: Option<Uuid>,
    pub callback_type: String,
}

/// Keep one verified gateway callback for the on-premises server.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for an unknown `X-HIP-ID`.
pub async fn receive_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<CallbackAck>, AppError> {
    let caller = authenticate(&state, &headers).await?;
    let correlation_id = Uuid::parse_str(&caller.request_id).ok();
    let callback_type = headers
        .get("x-hcx-api-call-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("gateway")
        .to_owned();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let row = sqlx::query_as::<_, CallbackAck>(
        "INSERT INTO abdm_gateway_callbacks \
            (tenant_id, correlation_id, callback_type, payload) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, received_at, correlation_id, callback_type",
    )
    .bind(caller.tenant_id)
    .bind(correlation_id)
    .bind(&callback_type)
    .bind(&body)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    tracing::info!(
        tenant_id = %caller.tenant_id,
        callback_type = %row.callback_type,
        callback_id = %row.id,
        "abdm gateway callback received"
    );
    Ok(Json(row))
}

/// Pending callbacks an on-prem server can pull. Returns the oldest
/// 50 unforwarded rows for the caller's own tenant — from the token, never
/// from the request, so no hospital can read another's. The on-prem server
/// PUTs `/abdm/gateway/callbacks/{id}/ack` to mark them forwarded.
pub async fn list_pending_callbacks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingCallback>>, AppError> {
    require_permission(&claims, permissions::abdm::relay::PULL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PendingCallback>(
        "SELECT id, tenant_id, received_at, correlation_id, callback_type, payload \
         FROM abdm_gateway_callbacks \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND forwarded_at IS NULL \
         ORDER BY received_at \
         LIMIT 50",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
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

/// Marks one of the caller's own tenant's callbacks forwarded. Another
/// tenant's id answers 404, the same as no such callback.
pub async fn ack_callback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::abdm::relay::PULL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let updated = sqlx::query(
        "UPDATE abdm_gateway_callbacks \
            SET forwarded_at = now(), forward_attempts = forward_attempts + 1 \
          WHERE id = $1 AND tenant_id = $2 AND forwarded_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        // Already-acked stays an idempotent `acked: 0`; only an absent row is a 404.
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM abdm_gateway_callbacks WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !exists {
            return Err(AppError::NotFound);
        }
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "acked": updated.rows_affected(),
    })))
}
