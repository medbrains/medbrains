use axum::{Json, Extension, extract::State};
use serde::Serialize;

use crate::middleware::auth::Claims;
use crate::middleware::authorization::authz_context;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub postgres: &'static str,
    pub yottadb: &'static str,
    pub authz_backend: String,
}

/// `GET /api/health` — checks connectivity to databases.
/// `YottaDB` shows "deferred (phase 2)" if `YOTTADB_URL` is not configured.
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let pg_ok = medbrains_db::pool::health_check(&state.db).await.is_ok();

    let ydb_status = match &state.yottadb {
        Some(client) => {
            if client.health_check().await.unwrap_or(false) {
                "connected"
            } else {
                "disconnected"
            }
        }
        None => "deferred (phase 2)",
    };

    let overall = if pg_ok { "ok" } else { "degraded" };

    let authz_backend = state.authz.backend_name().to_owned();

    Json(HealthResponse {
        status: overall,
        postgres: if pg_ok { "connected" } else { "disconnected" },
        yottadb: ydb_status,
        authz_backend,
    })
}

#[derive(Debug, Serialize)]
pub struct AuthzProbeResponse {
    pub backend: &'static str,
    pub user_id: String,
    pub role: String,
    pub is_bypass: bool,
    pub patient_count: usize,
    pub error: Option<String>,
}

/// `GET /api/debug/authz-probe` — diagnostic: calls list_accessible
/// for `patient` as the current user and reports raw count + error.
/// Bypass roles get count=0 (handled by backend short-circuit).
pub async fn authz_probe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Json<AuthzProbeResponse> {
    let ctx = authz_context(&claims);
    let result = state
        .authz
        .list_accessible(&ctx, "patient", medbrains_authz::Relation::Viewer)
        .await;
    let (count, error) = match result {
        Ok(ids) => (ids.len(), None),
        Err(e) => (0, Some(e.to_string())),
    };
    Json(AuthzProbeResponse {
        backend: state.authz.backend_name(),
        user_id: ctx.user_id.to_string(),
        role: ctx.role.clone(),
        is_bypass: ctx.is_bypass,
        patient_count: count,
        error,
    })
}
