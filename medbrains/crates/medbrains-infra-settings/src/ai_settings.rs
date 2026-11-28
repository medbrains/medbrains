//! The hospital's AI settings (`tenant_settings` category `ai`, key `config`), read by
//! `medbrains_server_services::llm::resolve_config`. The API key is never stored here.

use axum::extract::rejection::JsonRejection;
use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use super::{AppError, AppState, Claims, require_permission};

#[derive(Debug, Serialize)]
pub struct AiSettings {
    pub provider: String,
    pub model: String,
    /// The assistant reads registration and OPD through typed actions (default on).
    pub typed_actions: bool,
}

/// GET /api/admin/ai-settings
pub async fn get_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'ai' AND key = 'config' AND deleted_at IS NULL",
        claims.tenant_id,
    )
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
        // On unless set to false, as `medbrains_server_services::llm::resolve_config` reads it.
        typed_actions: cfg
            .get("typed_actions")
            .and_then(serde_json::Value::as_bool)
            != Some(false),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAiSettings {
    pub provider: String,
    pub model: String,
    pub typed_actions: bool,
}

/// PUT /api/admin/ai-settings
pub async fn update_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<UpdateAiSettings>, JsonRejection>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let Json(body) = body?;

    let provider = body.provider.trim();
    if provider != "anthropic" {
        return Err(AppError::BadRequest(format!(
            "AI provider '{provider}' is not supported by this build"
        )));
    }

    // Anthropic has no key to store: access is AWS identity federation,
    // configured per node and checked at startup (`ai.anthropic_federation`).
    let value = serde_json::json!({
        "provider": provider,
        "model": body.model.trim(),
        "typed_actions": body.typed_actions,
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'ai', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value, updated_at = now()",
        claims.tenant_id,
        &value,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(AiSettings {
        provider: provider.to_owned(),
        model: body.model.trim().to_owned(),
        typed_actions: body.typed_actions,
    }))
}
