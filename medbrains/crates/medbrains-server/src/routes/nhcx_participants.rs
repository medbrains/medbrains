//! NHCX payer directory — the payer/TPA participants (HCX codes) used as the
//! `recipient_code` when submitting a claim.
//!
//! Populated by the fetch/participants/list sync (a follow-up needing the server-side
//! session client) or maintained manually here. The submit flow resolves the
//! `recipient_code` from this directory.

use axum::Json;
use axum::extract::{Extension, Query, State};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;
use medbrains_core::permissions;

#[derive(Debug, Serialize, FromRow)]
pub struct NhcxParticipant {
    pub id: Uuid,
    pub participant_code: String,
    pub participant_name: String,
    pub role: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct NhcxParticipantQuery {
    /// Filter by role (`PAYER` | `PROVIDER` | `TPA`).
    pub role: Option<String>,
}

/// `GET /api/nhcx/participants` — the tenant's NHCX payer directory.
pub async fn list_nhcx_participants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<NhcxParticipantQuery>,
) -> Result<Json<Vec<NhcxParticipant>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NhcxParticipant>(
        "SELECT id, participant_code, participant_name, role, is_active \
         FROM nhcx_participants \
         WHERE tenant_id = $1 AND ($2::text IS NULL OR role = $2) AND is_active = true \
         ORDER BY participant_name",
    )
    .bind(claims.tenant_id)
    .bind(q.role.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertNhcxParticipantRequest {
    pub participant_code: String,
    pub participant_name: String,
    /// `PAYER` (default) | `PROVIDER` | `TPA`.
    pub role: Option<String>,
}

/// `POST /api/nhcx/participants` — add/update a payer in the directory.
pub async fn upsert_nhcx_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertNhcxParticipantRequest>,
) -> Result<Json<NhcxParticipant>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;
    let code = body.participant_code.trim();
    let name = body.participant_name.trim();
    if code.is_empty() || name.is_empty() {
        return Err(AppError::BadRequest(
            "participant_code and participant_name are required".to_owned(),
        ));
    }
    let role = body.role.as_deref().map(str::trim).filter(|r| !r.is_empty()).unwrap_or("PAYER");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, NhcxParticipant>(
        "INSERT INTO nhcx_participants (tenant_id, participant_code, participant_name, role) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, participant_code) DO UPDATE SET \
           participant_name = EXCLUDED.participant_name, role = EXCLUDED.role, \
           is_active = true, updated_at = now() \
         RETURNING id, participant_code, participant_name, role, is_active",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(name)
    .bind(role)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
