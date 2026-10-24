//! Settings → ABDM: the hospital's ABDM keys and environment.
//!
//! - `GET  /api/abdm/settings`       — what is set, never the secret
//! - `PUT  /api/abdm/settings`       — save; a blank secret keeps the saved one
//! - `POST /api/abdm/settings/test`  — sign in to ABDM with the saved keys
//!
//! The client secret is sealed (AEAD) before it is stored and is never
//! returned by any endpoint.

use axum::{Extension, Json, extract::State};
use medbrains_abdm::AbdmEnvironment;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use super::abha::{
    StoredAbdmConfig, connect, forget_session, seal_secret, secret_key, server_key_missing,
    stored_abdm_config,
};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct AbdmSettingsView {
    pub environment: AbdmEnvironment,
    pub client_id: Option<String>,
    /// Whether a secret is saved. The secret itself is never sent back.
    pub has_secret: bool,
    /// `settings` when saved here; `env` when the server's environment holds
    /// the keys instead; `none` when neither.
    pub source: &'static str,
    /// The environment variable this server lacks, when ABDM is off for that
    /// reason; saving is refused until the administrator sets it.
    pub server_key_missing: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
pub struct SaveAbdmSettings {
    pub environment: AbdmEnvironment,
    pub client_id: String,
    /// Blank keeps the saved secret.
    #[serde(default)]
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AbdmConnectionTest {
    pub ok: bool,
    pub message: String,
}

fn view(stored: &StoredAbdmConfig, server_key_missing: Option<&'static str>) -> AbdmSettingsView {
    let saved = stored.client_id.is_some() && stored.client_secret_sealed.is_some();
    let in_env =
        std::env::var("ABDM_CLIENT_ID").is_ok() && std::env::var("ABDM_CLIENT_SECRET").is_ok();
    AbdmSettingsView {
        environment: stored.environment.unwrap_or(AbdmEnvironment::Sandbox),
        client_id: stored.client_id.clone(),
        has_secret: stored.client_secret_sealed.is_some(),
        source: if saved {
            "settings"
        } else if in_env {
            "env"
        } else {
            "none"
        },
        server_key_missing,
    }
}

/// `GET /api/abdm/settings`
///
/// # Errors
/// 403 without `abdm.settings.manage`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AbdmSettingsView>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = stored_abdm_config(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;
    let missing = server_key_missing(state.secret_resolver.as_ref()).await;
    Ok(Json(view(&stored, missing)))
}

/// `PUT /api/abdm/settings`
///
/// # Errors
/// 400 without a client id, or without a secret when none is saved yet.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveAbdmSettings>,
) -> Result<Json<AbdmSettingsView>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    let client_id = body.client_id.trim();
    if client_id.is_empty() {
        return Err(AppError::BadRequest("enter the ABDM client ID".to_owned()));
    }
    let key = secret_key(state.secret_resolver.as_ref()).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let previous = stored_abdm_config(&mut tx, &claims.tenant_id).await?;
    let sealed = match body
        .client_secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(secret) => seal_secret(&key, secret)?,
        None => previous
            .client_secret_sealed
            .ok_or_else(|| AppError::BadRequest("enter the ABDM client secret".to_owned()))?,
    };
    let stored = StoredAbdmConfig {
        environment: Some(body.environment),
        client_id: Some(client_id.to_owned()),
        client_secret_sealed: Some(sealed),
    };
    let value = serde_json::to_value(&stored)
        .map_err(|e| AppError::Internal(format!("abdm settings json: {e}")))?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'abdm', 'abha_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
           deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
    )
    .bind(claims.tenant_id)
    .bind(value)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    forget_session(claims.tenant_id);
    Ok(Json(view(&stored, None)))
}

/// `POST /api/abdm/settings/test` — sign in to ABDM and fetch its encryption
/// key with the saved settings. A failure is reported, not raised: the screen
/// shows ABDM's reason.
///
/// # Errors
/// 403 without `abdm.settings.manage`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn test_connection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AbdmConnectionTest>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    forget_session(claims.tenant_id);
    let result = match connect(&state, claims.tenant_id).await {
        Ok(abdm) => AbdmConnectionTest {
            ok: true,
            message: match abdm.environment {
                AbdmEnvironment::Sandbox => "Connected to the ABDM sandbox.".to_owned(),
                AbdmEnvironment::Production => "Connected to ABDM production.".to_owned(),
            },
        },
        Err(AppError::BadRequest(m) | AppError::ServiceUnavailable(m)) => AbdmConnectionTest {
            ok: false,
            message: m,
        },
        Err(other) => return Err(other),
    };
    Ok(Json(result))
}
