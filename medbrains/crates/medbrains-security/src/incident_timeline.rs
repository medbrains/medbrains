//! The security incident's timeline: notes, assessments and notices, newest
//! first. Assessments and notices are written by [`crate::breach`]; this adds
//! free-text notes and reads the whole thread.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::breach::locked_incident;

#[derive(Debug, Deserialize)]
pub struct AddNoteRequest {
    pub description: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SecurityIncidentUpdate {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub update_type: String,
    pub description: String,
    pub updated_by: Option<Uuid>,
    pub updated_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/security/incidents/{id}/updates` — the incident's timeline.
pub async fn list_updates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SecurityIncidentUpdate>>, AppError> {
    require_permission(&claims, permissions::security::incidents::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SecurityIncidentUpdate>(
        "SELECT su.id, su.incident_id, su.update_type, su.description, su.updated_by, \
                u.full_name AS updated_by_name, su.created_at \
         FROM security_incident_updates su \
         LEFT JOIN users u ON u.id = su.updated_by \
         WHERE su.tenant_id = $1 AND su.incident_id = $2 AND su.deleted_at IS NULL \
         ORDER BY su.created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/security/incidents/{id}/updates` — a note on the timeline.
pub async fn add_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AddNoteRequest>,
) -> Result<Json<SecurityIncidentUpdate>, AppError> {
    require_permission(&claims, permissions::security::incidents::UPDATE)?;
    let description = body.description.trim();
    if description.is_empty() {
        return Err(AppError::BadRequest("Write the note first.".into()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    locked_incident(&mut tx, claims.tenant_id, id).await?;
    let row = sqlx::query_as::<_, SecurityIncidentUpdate>(
        "INSERT INTO security_incident_updates \
         (tenant_id, incident_id, update_type, description, updated_by) \
         VALUES ($1, $2, 'note', $3, $4) \
         RETURNING id, incident_id, update_type, description, updated_by, \
                   NULL::text AS updated_by_name, created_at",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(description)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
