//! The hospital's clinical display settings, readable by the clinicians who chart with them.
//!
//! `GET /api/setup/settings` answers `admin.settings.read`, which no clinician holds, so a
//! hospital that chose its vitals set or review-of-systems list had the choice ignored on every
//! screen that charts. This route returns those keys and nothing else from `tenant_settings`.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Serialize;
use serde_json::Value;

/// The `clinical` settings keys a clinician's screens read; every other key stays admin-only.
const DISPLAY_KEYS: &[&str] = &["vital_parameters", "ros_systems"];

/// One configured display setting. A key the hospital never set is absent, not null.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub(super) struct DisplaySetting {
    key: String,
    value: Value,
}

/// `GET /api/clinical/display-settings`: the hospital's vitals set and ROS list, if it set them.
///
/// Guarded by `clinical_notes.display_settings.read`, not the admin settings read, so a doctor or
/// nurse can chart with the hospital's choices without being able to read the rest of settings.
pub(super) async fn list_display_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DisplaySetting>>, AppError> {
    let permit =
        kernel::authz::permit(&claims, permissions::clinical_notes::display_settings::READ)?;
    let mut tx = kernel::tenant_tx(&state.db, &permit).await?;
    let rows = sqlx::query_as::<_, DisplaySetting>(
        "SELECT key, value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'clinical' AND key = ANY($2) AND deleted_at IS NULL \
         ORDER BY key",
    )
    .bind(claims.tenant_id)
    .bind(DISPLAY_KEYS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
