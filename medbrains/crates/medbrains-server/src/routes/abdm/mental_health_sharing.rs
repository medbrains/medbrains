//! Settings → ABDM → mental-health records.
//!
//! Mental Healthcare Act 2017 s.23: psychiatric care contexts are not shared
//! through the HIE-CM by default. Turning this on lets a context be shared
//! only for a patient who has also consented to that category (recorded on
//! their psychiatric record); `abdm_mental_health_shareable` (migration
//! 1199) applies both conditions at discovery, linking and transfer.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct MentalHealthSharing {
    pub enabled: bool,
}

/// `GET /api/abdm/settings/mental-health-sharing`
///
/// # Errors
/// 403 without `abdm.settings.manage`.
pub async fn get_sharing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MentalHealthSharing>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let enabled = sqlx::query_scalar!(
        r#"SELECT COALESCE((SELECT value = 'true'::jsonb FROM tenant_settings
             WHERE tenant_id = $1 AND category = 'abdm' AND key = 'mental_health_sharing'
               AND deleted_at IS NULL), false) AS "enabled!""#,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(MentalHealthSharing { enabled }))
}

/// `PUT /api/abdm/settings/mental-health-sharing`
///
/// # Errors
/// 403 without `abdm.settings.manage`.
pub async fn save_sharing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MentalHealthSharing>,
) -> Result<Json<MentalHealthSharing>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'abdm', 'mental_health_sharing', to_jsonb($2::boolean)) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
           deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
        claims.tenant_id,
        body.enabled,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(body))
}
