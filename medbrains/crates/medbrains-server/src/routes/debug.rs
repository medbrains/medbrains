use axum::{Extension, Json, extract::State};
use serde_json::Value;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::is_bypass_role},
    state::AppState,
};

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn seed_canonical_fixtures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    if !is_bypass_role(&claims) || !e2e_seed_enabled() {
        return Err(AppError::Forbidden);
    }

    medbrains_seed::seed_canonical_fixtures_for_tenant(&state.db, claims.tenant_id)
        .await
        .map_err(|err| AppError::Internal(format!("canonical fixture seed failed: {err}")))?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

fn e2e_seed_enabled() -> bool {
    cfg!(debug_assertions)
        || std::env::var("MEDBRAINS_ENABLE_E2E_SEED")
            .map(|value| {
                matches!(
                    value.to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(false)
}
