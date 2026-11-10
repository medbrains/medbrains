//! `/api/hrms/humanex/*` — connection settings, a pull on demand, and how the
//! last pull of each entity went. Guarded by the integration permissions, as
//! every other external link is.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HUMANEX, HumanexConfig, Tx, load_config, sync::EntityOutcome, sync_tenant};

/// What a screen may see of the settings: never the key itself.
#[derive(Serialize)]
pub struct ConfigView {
    base_url: Option<String>,
    enabled: bool,
    system_user_id: Option<Uuid>,
    api_key_set: bool,
}

impl ConfigView {
    fn of(c: Option<&HumanexConfig>) -> Self {
        Self {
            base_url: c.map(|c| c.base_url.clone()),
            enabled: c.is_some_and(|c| c.enabled),
            system_user_id: c.map(|c| c.system_user_id),
            api_key_set: c.is_some_and(|c| !c.api_key.is_empty()),
        }
    }
}

async fn tenant_tx<'a>(state: &'a AppState, tenant_id: &Uuid) -> Result<Tx<'a>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    Ok(tx)
}

/// `GET /api/hrms/humanex/config`.
pub async fn get_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ConfigView>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;
    let mut tx = tenant_tx(&state, &claims.tenant_id).await?;
    let c = load_config(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(ConfigView::of(c.as_ref())))
}

#[derive(Deserialize)]
pub struct ConfigIn {
    base_url: String,
    /// Omit to keep the stored key.
    api_key: Option<String>,
    enabled: bool,
    system_user_id: Uuid,
}

/// `PUT /api/hrms/humanex/config`.
pub async fn put_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ConfigIn>,
) -> Result<Json<ConfigView>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;
    let base_url = body.base_url.trim().trim_end_matches('/').to_owned();
    if !(base_url.starts_with("https://") || base_url.starts_with("http://")) {
        return Err(AppError::BadRequest(
            "The address must start with https://".into(),
        ));
    }
    let mut tx = tenant_tx(&state, &claims.tenant_id).await?;
    let api_key = match body
        .api_key
        .map(|k| k.trim().to_owned())
        .filter(|k| !k.is_empty())
    {
        Some(k) => k,
        None => load_config(&mut tx, claims.tenant_id)
            .await?
            .map(|c| c.api_key)
            .ok_or_else(|| AppError::BadRequest("Enter the Humanex API key".into()))?,
    };
    let user_ok: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
    )
    .bind(body.system_user_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !user_ok {
        return Err(AppError::BadRequest(
            "Choose a user of this hospital to record the pull as".into(),
        ));
    }
    let cfg = HumanexConfig {
        base_url,
        api_key,
        enabled: body.enabled,
        system_user_id: body.system_user_id,
    };
    let value = serde_json::to_value(&cfg).map_err(|e| AppError::Internal(e.to_string()))?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'hrms', 'humanex', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(value)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(ConfigView::of(Some(&cfg))))
}

/// `POST /api/hrms/humanex/sync` — pull now rather than at the next pass.
pub async fn sync_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<EntityOutcome>>, AppError> {
    require_permission(&claims, permissions::integration::EXECUTE)?;
    Ok(Json(sync_tenant(&state.db, claims.tenant_id).await?))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct StateRow {
    entity: String,
    last_run_at: Option<DateTime<Utc>>,
    last_status: Option<String>,
    last_error: Option<String>,
    upserted: i32,
    failed: i32,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ExceptionRow {
    id: Uuid,
    entity: String,
    record_key: Option<String>,
    error: String,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct StatusView {
    entities: Vec<StateRow>,
    recent_exceptions: Vec<ExceptionRow>,
}

/// `GET /api/hrms/humanex/status` — each entity's last pull, and the 50 most
/// recent rows that could not be applied.
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<StatusView>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;
    let mut tx = tenant_tx(&state, &claims.tenant_id).await?;
    let entities = sqlx::query_as::<_, StateRow>(
        "SELECT entity, last_run_at, last_status, last_error, upserted, failed \
         FROM hrms_sync_state WHERE tenant_id = $1 AND provider = $2 ORDER BY entity",
    )
    .bind(claims.tenant_id)
    .bind(HUMANEX)
    .fetch_all(&mut *tx)
    .await?;
    let recent_exceptions = sqlx::query_as::<_, ExceptionRow>(
        "SELECT id, entity, record_key, error, created_at FROM hrms_sync_exceptions \
         WHERE tenant_id = $1 AND provider = $2 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(HUMANEX)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(StatusView {
        entities,
        recent_exceptions,
    }))
}
