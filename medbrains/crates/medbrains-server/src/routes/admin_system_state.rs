//! Admin endpoints for `system_state` — get + flip operating mode.
//!
//! Sprint A spec: `RFCs/sprints/SPRINT-A-outbox.md` §7.

use axum::{extract::State, Extension, Json};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct SystemStateResponse {
    pub mode: String,
    pub since: chrono::DateTime<chrono::Utc>,
    pub reason: Option<String>,
    pub set_by: Option<uuid::Uuid>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSystemStateRequest {
    pub mode: String,
    pub reason: Option<String>,
}

/// `GET /api/admin/system_state` — read current operating mode.
pub async fn get_system_state(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SystemStateResponse>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: Option<(String, chrono::DateTime<chrono::Utc>, Option<String>, Option<uuid::Uuid>, chrono::DateTime<chrono::Utc>)> =
        sqlx::query_as( // allow-raw-sql: admin endpoint reads own tenant's system_state
            "SELECT mode, since, reason, set_by, updated_at \
             FROM system_state WHERE tenant_id = $1 LIMIT 1",
        )
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    tx.commit().await?;

    let resp = match row {
        Some((mode, since, reason, set_by, updated_at)) => SystemStateResponse {
            mode,
            since,
            reason,
            set_by,
            updated_at,
        },
        None => SystemStateResponse {
            mode: "normal".to_string(),
            since: chrono::Utc::now(),
            reason: None,
            set_by: None,
            updated_at: chrono::Utc::now(),
        },
    };
    Ok(Json(resp))
}

/// `POST /api/admin/system_state` — flip operating mode.
/// Body: `{ "mode": "read_only" | "degraded" | "normal", "reason": "..." }`
pub async fn update_system_state(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateSystemStateRequest>,
) -> Result<Json<SystemStateResponse>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;

    if !matches!(body.mode.as_str(), "normal" | "degraded" | "read_only") {
        return Err(AppError::BadRequest(format!(
            "invalid mode '{}': expected normal | degraded | read_only",
            body.mode
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: (String, chrono::DateTime<chrono::Utc>, Option<String>, Option<uuid::Uuid>, chrono::DateTime<chrono::Utc>) =
        sqlx::query_as( // allow-raw-sql: admin endpoint upserts tenant's own system_state
            "INSERT INTO system_state (tenant_id, mode, since, reason, set_by) \
             VALUES ($1, $2, now(), $3, $4) \
             ON CONFLICT (tenant_id) DO UPDATE \
                 SET mode = EXCLUDED.mode, \
                     since = CASE WHEN system_state.mode <> EXCLUDED.mode THEN now() ELSE system_state.since END, \
                     reason = EXCLUDED.reason, \
                     set_by = EXCLUDED.set_by, \
                     updated_at = now() \
             RETURNING mode, since, reason, set_by, updated_at",
        )
        .bind(claims.tenant_id)
        .bind(&body.mode)
        .bind(body.reason.as_deref())
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;

    // Invalidate the per-process cache for this tenant so the next
    // request hits the DB. Multi-process invalidation is via the
    // queue_broadcaster broadcast — Phase 1 just relies on the 30s TTL
    // for cross-replica propagation; Phase 2 wires WS broadcast.
    state.system_state_cache.invalidate(claims.tenant_id);

    Ok(Json(SystemStateResponse {
        mode: row.0,
        since: row.1,
        reason: row.2,
        set_by: row.3,
        updated_at: row.4,
    }))
}
