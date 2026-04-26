use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{Duration, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

async fn set_tenant_context(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<(), AppError> {
    Ok(medbrains_db::pool::set_tenant_context(tx, tenant_id).await?)
}

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct RetroSettingsPayload {
    pub max_backdate_hours: Option<i64>,
    pub requires_approval: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RetroSettings {
    pub max_backdate_hours: i64,
    pub requires_approval: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateRetroEncounterRequest {
    pub patient_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Uuid,
    pub clinical_event_date: chrono::DateTime<Utc>,
    pub reason: String,
    pub visit_type: Option<String>,
    pub chief_complaint: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRetroQuery {
    pub status: Option<String>,
    pub source_table: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveRejectRequest {
    pub review_notes: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RetroEntryRow {
    pub id: Uuid,
    pub source_table: String,
    pub source_record_id: Uuid,
    pub clinical_event_date: chrono::DateTime<Utc>,
    pub entry_date: chrono::DateTime<Utc>,
    pub entered_by: Uuid,
    pub reason: String,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<chrono::DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub entered_by_name: Option<String>,
    pub reviewed_by_name: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers
// ══════════════════════════════════════════════════════════

/// GET /api/retrospective/settings
pub async fn get_retro_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<RetroSettings>, AppError> {
    require_permission(&claims, permissions::retrospective::SETTINGS)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let max_hours: Option<String> = sqlx::query_scalar(
        "SELECT value::text FROM tenant_settings \
         WHERE category = 'retrospective' AND key = 'max_backdate_hours'",
    )
    .fetch_optional(&mut *tx)
    .await?;

    let requires_approval: Option<String> = sqlx::query_scalar(
        "SELECT value::text FROM tenant_settings \
         WHERE category = 'retrospective' AND key = 'requires_approval'",
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let hours = max_hours
        .and_then(|v| v.trim_matches('"').parse::<i64>().ok())
        .unwrap_or(72);
    let approval = requires_approval
        .and_then(|v| v.trim_matches('"').parse::<bool>().ok())
        .unwrap_or(true);

    Ok(Json(RetroSettings {
        max_backdate_hours: hours,
        requires_approval: approval,
    }))
}

/// PUT /api/retrospective/settings
pub async fn update_retro_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RetroSettingsPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::retrospective::SETTINGS)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if let Some(hours) = body.max_backdate_hours {
        let val = serde_json::Value::String(hours.to_string());
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ((current_setting('app.tenant_id'))::uuid, 'retrospective', 'max_backdate_hours', $1) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value"
        )
        .bind(&val)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(approval) = body.requires_approval {
        let val = serde_json::Value::String(approval.to_string());
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ((current_setting('app.tenant_id'))::uuid, 'retrospective', 'requires_approval', $1) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value"
        )
        .bind(&val)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "updated": true })))
}

/// POST /api/retrospective/encounters
pub async fn create_retro_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRetroEncounterRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::retrospective::CREATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Read max_backdate_hours setting
    let max_hours_str: Option<String> = sqlx::query_scalar(
        "SELECT value::text FROM tenant_settings \
         WHERE category = 'retrospective' AND key = 'max_backdate_hours'",
    )
    .fetch_optional(&mut *tx)
    .await?;

    let max_hours = max_hours_str
        .and_then(|v| v.trim_matches('"').parse::<i64>().ok())
        .unwrap_or(72);

    let now = Utc::now();
    let cutoff = now - Duration::hours(max_hours);

    if body.clinical_event_date < cutoff {
        return Err(AppError::BadRequest(format!(
            "Clinical event date is beyond the allowed backdate window of {max_hours} hours"
        )));
    }

    if body.clinical_event_date > now {
        return Err(AppError::BadRequest(
            "Clinical event date cannot be in the future".to_string(),
        ));
    }

    // Create the encounter
    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, department_id, doctor_id, \
         encounter_date, visit_type, chief_complaint, notes, status, is_retrospective) \
         VALUES ((current_setting('app.tenant_id'))::uuid, $1, $2, $3, $4, \
         COALESCE($5, 'follow_up'), $6, $7, 'completed', true) \
         RETURNING id",
    )
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(body.doctor_id)
    .bind(body.clinical_event_date)
    .bind(&body.visit_type)
    .bind(&body.chief_complaint)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Read requires_approval setting
    let requires_str: Option<String> = sqlx::query_scalar(
        "SELECT value::text FROM tenant_settings \
         WHERE category = 'retrospective' AND key = 'requires_approval'",
    )
    .fetch_optional(&mut *tx)
    .await?;

    let requires_approval = requires_str
        .and_then(|v| v.trim_matches('"').parse::<bool>().ok())
        .unwrap_or(true);

    let initial_status = if requires_approval {
        "pending"
    } else {
        "approved"
    };

    // Create retrospective entry
    let retro_id: Uuid = sqlx::query_scalar(
        "INSERT INTO retrospective_entries \
         (tenant_id, source_table, source_record_id, clinical_event_date, \
          entered_by, reason, status) \
         VALUES ((current_setting('app.tenant_id'))::uuid, 'encounters', $1, $2, $3, $4, \
                 $5::retrospective_entry_status) \
         RETURNING id",
    )
    .bind(encounter_id)
    .bind(body.clinical_event_date)
    .bind(claims.sub)
    .bind(&body.reason)
    .bind(initial_status)
    .fetch_one(&mut *tx)
    .await?;

    // Link encounter to retro entry
    sqlx::query("UPDATE encounters SET retrospective_entry_id = $1 WHERE id = $2")
        .bind(retro_id)
        .bind(encounter_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "encounter_id": encounter_id,
        "retrospective_entry_id": retro_id,
        "status": initial_status
    })))
}

/// GET /api/retrospective/entries
pub async fn list_retro_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRetroQuery>,
) -> Result<Json<Vec<RetroEntryRow>>, AppError> {
    require_permission(&claims, permissions::retrospective::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RetroEntryRow>(
        "SELECT re.id, re.source_table, re.source_record_id, re.clinical_event_date, \
         re.entry_date, re.entered_by, re.reason, re.status::text as status, \
         re.reviewed_by, re.reviewed_at, re.review_notes, re.created_at, \
         u.full_name as entered_by_name, \
         ru.full_name as reviewed_by_name \
         FROM retrospective_entries re \
         JOIN users u ON u.id = re.entered_by \
         LEFT JOIN users ru ON ru.id = re.reviewed_by \
         WHERE ($1::text IS NULL OR re.status::text = $1) \
           AND ($2::text IS NULL OR re.source_table = $2) \
         ORDER BY re.created_at DESC",
    )
    .bind(&q.status)
    .bind(&q.source_table)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

/// GET /api/retrospective/entries/:id
pub async fn get_retro_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RetroEntryRow>, AppError> {
    require_permission(&claims, permissions::retrospective::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RetroEntryRow>(
        "SELECT re.id, re.source_table, re.source_record_id, re.clinical_event_date, \
         re.entry_date, re.entered_by, re.reason, re.status::text as status, \
         re.reviewed_by, re.reviewed_at, re.review_notes, re.created_at, \
         u.full_name as entered_by_name, \
         ru.full_name as reviewed_by_name \
         FROM retrospective_entries re \
         JOIN users u ON u.id = re.entered_by \
         LEFT JOIN users ru ON ru.id = re.reviewed_by \
         WHERE re.id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
}

/// PUT /api/retrospective/entries/:id/approve
pub async fn approve_retro_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveRejectRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::retrospective::APPROVE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE retrospective_entries \
         SET status = 'approved', reviewed_by = $1, reviewed_at = now(), review_notes = $2 \
         WHERE id = $3 AND status = 'pending'",
    )
    .bind(claims.sub)
    .bind(&body.review_notes)
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::BadRequest(
            "Entry not found or already reviewed".into(),
        ));
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "approved": true })))
}

/// PUT /api/retrospective/entries/:id/reject
pub async fn reject_retro_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveRejectRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::retrospective::APPROVE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE retrospective_entries \
         SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_notes = $2 \
         WHERE id = $3 AND status = 'pending'",
    )
    .bind(claims.sub)
    .bind(&body.review_notes)
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::BadRequest(
            "Entry not found or already reviewed".into(),
        ));
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "rejected": true })))
}

/// GET /`api/retrospective/audit/:source_table/:source_id`
pub async fn retro_audit_trail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((source_table, source_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<RetroEntryRow>>, AppError> {
    require_permission(&claims, permissions::retrospective::AUDIT)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RetroEntryRow>(
        "SELECT re.id, re.source_table, re.source_record_id, re.clinical_event_date, \
         re.entry_date, re.entered_by, re.reason, re.status::text as status, \
         re.reviewed_by, re.reviewed_at, re.review_notes, re.created_at, \
         u.full_name as entered_by_name, \
         ru.full_name as reviewed_by_name \
         FROM retrospective_entries re \
         JOIN users u ON u.id = re.entered_by \
         LEFT JOIN users ru ON ru.id = re.reviewed_by \
         WHERE re.source_table = $1 AND re.source_record_id = $2 \
         ORDER BY re.created_at DESC",
    )
    .bind(&source_table)
    .bind(source_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}
