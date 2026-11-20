//! What the patient search box offers at this hospital: the field it searches
//! by default, and whether OPD numbers are worth offering at all.
//!
//! `tenant_settings` `registration`/`search_default_by` (all, phone, uhid,
//! name, `opd_number`; all when unset or unreadable). The search box reads it
//! with the list or lookup permission, so every desk sees the same default.

use axum::extract::State;
use axum::routing::get;
use axum::{Extension, Json};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::opd_number::{self, Mode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::search::SearchBy;

/// The search box's settings.
#[derive(Debug, Serialize)]
pub(crate) struct SearchSettings {
    /// The field searched until the desk picks another.
    pub default_by: String,
    /// Whether the hospital keeps an OPD number, so "OPD number" is offered.
    pub opd_number_enabled: bool,
}

/// A new default.
#[derive(Debug, Deserialize)]
pub(crate) struct SearchSettingsUpdate {
    pub default_by: String,
}

/// The routes, merged into the patients router.
pub(crate) fn router() -> axum::Router<AppState> {
    axum::Router::new().route(
        "/api/registration/search-settings",
        get(get_search_settings).put(update_search_settings),
    )
}

/// Read both settings in one transaction.
async fn read(state: &AppState, permit: &kernel::Permit) -> Result<SearchSettings, AppError> {
    let tenant_id = permit.tenant_id();
    let mut tx = kernel::actor_tx(&state.db, permit, None).await?;
    let stored = stored_default(&mut tx, tenant_id).await?;
    let policy = opd_number::read_policy(&mut tx, tenant_id).await?;
    tx.commit().await?;
    // Unreadable is all, never a refusal: the box must always search.
    let default_by = stored
        .filter(|by| SearchBy::from_param(Some(by)).is_ok())
        .unwrap_or_else(|| "all".to_owned());
    Ok(SearchSettings {
        default_by,
        opd_number_enabled: policy.mode != Mode::Off,
    })
}

/// The stored default, as text.
async fn stored_default(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
) -> Result<Option<String>, AppError> {
    let value = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'registration' AND key = 'search_default_by' \
           AND deleted_at IS NULL",
        tenant_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(value.and_then(|v| v.as_str().map(ToOwned::to_owned)))
}

/// `GET /api/registration/search-settings`: for whoever can search patients.
pub(crate) async fn get_search_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SearchSettings>, AppError> {
    let permit = kernel::authz::permit_any(
        &claims,
        &[permissions::patients::LIST, permissions::patients::FIND],
    )?;
    Ok(Json(read(&state, &permit).await?))
}

/// `PUT /api/registration/search-settings`: the hospital's default field.
pub(crate) async fn update_search_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SearchSettingsUpdate>,
) -> Result<Json<SearchSettings>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::general::MANAGE)?;
    SearchBy::from_param(Some(&body.default_by))?;
    let mut tx = kernel::actor_tx(&state.db, &permit, None).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'registration', 'search_default_by', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
        permit.tenant_id(),
        serde_json::Value::from(body.default_by.trim())
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(read(&state, &permit).await?))
}
