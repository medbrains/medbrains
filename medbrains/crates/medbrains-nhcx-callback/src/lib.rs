//! NHCX — the gateway's callback receiver, the callback history, and
//! Settings → NHCX. Outbound messages are sent by the outbox handlers in
//! `medbrains_outbox::handlers::nhcx`.

mod apply;
mod apply_claim;
mod parse;
mod parse_claim;
mod payments;
pub mod payments_api;
pub mod receive;
pub mod settings;

use axum::routing::{get, post};
use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NhcxCallbackRow {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub received_at: chrono::DateTime<chrono::Utc>,
    pub correlation_id: Option<Uuid>,
    pub api_call_id: Option<Uuid>,
    pub sender_code: Option<String>,
    pub recipient_code: Option<String>,
    pub callback_type: Option<String>,
    pub raw_envelope: Option<Value>,
    pub decrypted_payload: Option<Value>,
    pub verification_status: String,
    pub matched_table: Option<String>,
    pub matched_id: Option<Uuid>,
    pub error_detail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListCallbacksQuery {
    pub correlation_id: Option<Uuid>,
    pub matched_id: Option<Uuid>,
    pub limit: Option<i64>,
}

/// `GET /api/integrations/nhcx/callbacks` — recent callbacks for the
/// caller's tenant. Optional filters: `correlation_id`, `matched_id`.
///
/// # Errors
/// 403 without `insurance.nhcx.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_callbacks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCallbacksQuery>,
) -> Result<Json<Vec<NhcxCallbackRow>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(100).clamp(1, 500);

    let rows = sqlx::query_as::<_, NhcxCallbackRow>(
        "SELECT id, tenant_id, received_at, correlation_id, api_call_id, \
                sender_code, recipient_code, callback_type, raw_envelope, \
                decrypted_payload, verification_status, matched_table, \
                matched_id, error_detail \
         FROM nhcx_callback_log \
         WHERE tenant_id = $1 AND deleted_at IS NULL \
           AND ($2::UUID IS NULL OR correlation_id = $2) \
           AND ($3::UUID IS NULL OR matched_id = $3) \
         ORDER BY received_at DESC \
         LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.correlation_id)
    .bind(q.matched_id)
    .bind(limit)
    .fetch_all(&mut *conn)
    .await?;

    Ok(Json(rows))
}

/// The gateway's callbacks — public: each is authenticated by the gateway's
/// JWT, not a user session. The base path is the hospital's NHCX `endpoint_url`.
pub fn public_router() -> axum::Router<AppState> {
    axum::Router::new().route(
        "/api/integrations/nhcx/hcx/v1/{resource}/{action}",
        post(receive::receive_callback),
    )
}

/// Signed-in routes: callback history, NHCX status and settings.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/integrations/nhcx/callbacks", get(list_callbacks))
        .route("/api/integrations/nhcx/status", get(settings::get_status))
        .route(
            "/api/integrations/nhcx/settings",
            get(settings::get_settings).put(settings::save_settings),
        )
        .route(
            "/api/integrations/nhcx/settings/test",
            post(settings::test_connection),
        )
        .route(
            "/api/insurance/nhcx/payments",
            get(payments_api::list_payments),
        )
        .route(
            "/api/insurance/nhcx/payments/{id}/post",
            post(payments_api::post_payment),
        )
        .route(
            "/api/billing/insurance-claims/{id}/nhcx/payments",
            get(payments_api::claim_payments),
        )
}
