//! Admin infrastructure & security settings (Setup Center → Infrastructure).
//!
//! - Read-only node infra status: which secrets backend + deploy mode are
//!   active (both are boot-time env decisions, not per-tenant editable).
//! - Per-tenant AI provider config (`tenant_settings` category `ai`, key
//!   `config`) consumed by [`crate::routes::ai`]. The API key itself is never
//!   stored here or returned — only a reference to a key in the secret backend.

use axum::{Extension, Json, extract::State};
use medbrains_core::deploy_mode::DeployMode;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct InfraStatus {
    /// Active secrets backend label (`env` | `file` | `aws-secrets-manager`).
    pub secrets_backend: &'static str,
    /// Active deploy mode (`saas` | `hybrid` | `onprem`).
    pub deploy_mode: &'static str,
}

/// GET /api/admin/infra-status
pub async fn get_infra_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<InfraStatus>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    Ok(Json(InfraStatus {
        secrets_backend: state.secret_resolver.backend_label(),
        deploy_mode: DeployMode::from_env().as_code(),
    }))
}

#[derive(Debug, Serialize)]
pub struct AiSettings {
    pub provider: String,
    pub model: String,
    /// Reference (not the value) to the API key in the secret backend.
    pub api_key_secret: Option<String>,
    /// Whether `ANTHROPIC_API_KEY` is present as a fallback.
    pub env_fallback: bool,
}

/// GET /api/admin/ai-settings
pub async fn get_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'ai' AND key = 'config' AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let cfg = stored.unwrap_or_default();
    let field = |name: &str| {
        cfg.get(name)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned)
    };

    Ok(Json(AiSettings {
        provider: field("provider").unwrap_or_else(|| "anthropic".to_owned()),
        model: field("model").unwrap_or_default(),
        api_key_secret: field("api_key_secret"),
        env_fallback: std::env::var("ANTHROPIC_API_KEY").is_ok(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAiSettings {
    pub provider: String,
    pub model: String,
    pub api_key_secret: Option<String>,
}

/// PUT /api/admin/ai-settings
pub async fn update_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateAiSettings>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let provider = body.provider.trim();
    if provider != "anthropic" {
        return Err(AppError::BadRequest(format!(
            "AI provider '{provider}' is not supported by this build"
        )));
    }

    let secret = body
        .api_key_secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let value = serde_json::json!({
        "provider": provider,
        "model": body.model.trim(),
        "api_key_secret": secret,
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'ai', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(&value)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(AiSettings {
        provider: provider.to_owned(),
        model: body.model.trim().to_owned(),
        api_key_secret: secret.map(ToOwned::to_owned),
        env_fallback: std::env::var("ANTHROPIC_API_KEY").is_ok(),
    }))
}
