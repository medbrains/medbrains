//! Nurse handoff (SBAR) + code blue + equipment checks.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

// ── shift_handoffs (SBAR) ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShiftHandoff {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub outgoing_nurse_id: Uuid,
    pub incoming_nurse_id: Uuid,
    pub outgoing_signed_at: Option<DateTime<Utc>>,
    pub incoming_signed_at: Option<DateTime<Utc>>,
    pub situation: Option<String>,
    pub background: Option<String>,
    pub assessment: Option<String>,
    pub recommendation: Option<String>,
    pub alerts: serde_json::Value,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHandoffRequest {
    pub encounter_id: Uuid,
    pub incoming_nurse_id: Uuid,
    pub situation: Option<String>,
    pub background: Option<String>,
    pub assessment: Option<String>,
    pub recommendation: Option<String>,
    pub alerts: Option<serde_json::Value>,
}

pub async fn create_handoff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHandoffRequest>,
) -> Result<Json<ShiftHandoff>, AppError> {
    require_permission(&claims, permissions::nurse::handoff::RECORD)?;
    if body.incoming_nurse_id == claims.sub {
        return Err(AppError::BadRequest(
            "outgoing and incoming nurse must differ".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let alerts = body.alerts.unwrap_or_else(|| serde_json::json!([]));
    let row = sqlx::query_as::<_, ShiftHandoff>(
        "INSERT INTO shift_handoffs \
         (tenant_id, encounter_id, outgoing_nurse_id, incoming_nurse_id, \
          outgoing_signed_at, situation, background, assessment, \
          recommendation, alerts) \
         VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(body.incoming_nurse_id)
    .bind(&body.situation)
    .bind(&body.background)
    .bind(&body.assessment)
    .bind(&body.recommendation)
    .bind(alerts)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn accept_handoff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ShiftHandoff>, AppError> {
    require_permission(&claims, permissions::nurse::handoff::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ShiftHandoff>(
        "UPDATE shift_handoffs SET \
           incoming_signed_at = now(), completed_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND incoming_nurse_id = $3 \
           AND incoming_signed_at IS NULL \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_handoffs_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<ShiftHandoff>>, AppError> {
    require_permission(&claims, permissions::nurse::handoff::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ShiftHandoff>(
        "SELECT * FROM shift_handoffs \
         WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY created_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── code_blue_events ────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CodeBlueEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub location: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub leader_user_id: Option<Uuid>,
    pub outcome: Option<String>,
    pub recorder_user_id: Option<Uuid>,
    pub medications: serde_json::Value,
    pub shocks: serde_json::Value,
    pub ecg_rhythm_log: serde_json::Value,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartCodeBlueRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub location: String,
    pub leader_user_id: Option<Uuid>,
}

pub async fn start_code_blue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<StartCodeBlueRequest>,
) -> Result<Json<CodeBlueEvent>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CodeBlueEvent>(
        "INSERT INTO code_blue_events \
         (tenant_id, patient_id, encounter_id, location, leader_user_id, recorder_user_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&body.location)
    .bind(body.leader_user_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct AppendCodeBlueRequest {
    pub field: String,
    pub entry: serde_json::Value,
}

pub async fn append_code_blue_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AppendCodeBlueRequest>,
) -> Result<Json<CodeBlueEvent>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::RECORD)?;
    let column = match body.field.as_str() {
        "medications" => "medications",
        "shocks" => "shocks",
        "ecg_rhythm_log" => "ecg_rhythm_log",
        _ => {
            return Err(AppError::BadRequest(
                "field must be medications | shocks | ecg_rhythm_log".to_owned(),
            ));
        }
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sql = format!(
        "UPDATE code_blue_events SET {column} = {column} || $3::jsonb \
         WHERE id = $1 AND tenant_id = $2 AND ended_at IS NULL RETURNING *",
    );
    let row = sqlx::query_as::<_, CodeBlueEvent>(&sql)
        .bind(id)
        .bind(claims.tenant_id)
        .bind(serde_json::Value::Array(vec![body.entry]))
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct EndCodeBlueRequest {
    pub outcome: String,
    pub notes: Option<String>,
}

pub async fn end_code_blue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EndCodeBlueRequest>,
) -> Result<Json<CodeBlueEvent>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CodeBlueEvent>(
        "UPDATE code_blue_events SET \
           ended_at = now(), outcome = $3, notes = COALESCE($4, notes) \
         WHERE id = $1 AND tenant_id = $2 AND ended_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.outcome)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListCodeBlueQuery {
    pub active_only: Option<bool>,
    pub limit: Option<i64>,
}

pub async fn list_code_blue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCodeBlueQuery>,
) -> Result<Json<Vec<CodeBlueEvent>>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let active_only = q.active_only.unwrap_or(false);
    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, CodeBlueEvent>(
        "SELECT * FROM code_blue_events \
         WHERE tenant_id = $1 \
           AND ($2::bool = false OR ended_at IS NULL) \
         ORDER BY started_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(active_only)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── equipment_checks ────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EquipmentCheck {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Option<Uuid>,
    pub checklist_template_id: Option<Uuid>,
    pub checked_by: Uuid,
    pub checked_at: DateTime<Utc>,
    pub items: serde_json::Value,
    pub all_passed: bool,
    pub next_check_due_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEquipmentCheckRequest {
    pub location_id: Option<Uuid>,
    pub checklist_template_id: Option<Uuid>,
    pub items: serde_json::Value,
    pub all_passed: bool,
    pub next_check_due_at: Option<DateTime<Utc>>,
}

pub async fn create_equipment_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEquipmentCheckRequest>,
) -> Result<Json<EquipmentCheck>, AppError> {
    require_permission(&claims, permissions::nurse::equipment::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EquipmentCheck>(
        "INSERT INTO equipment_checks \
         (tenant_id, location_id, checklist_template_id, checked_by, items, \
          all_passed, next_check_due_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(body.checklist_template_id)
    .bind(claims.sub)
    .bind(body.items)
    .bind(body.all_passed)
    .bind(body.next_check_due_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListEquipmentChecksQuery {
    pub location_id: Option<Uuid>,
    pub overdue_only: Option<bool>,
    pub limit: Option<i64>,
}

pub async fn list_equipment_checks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListEquipmentChecksQuery>,
) -> Result<Json<Vec<EquipmentCheck>>, AppError> {
    require_permission(&claims, permissions::nurse::equipment::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let overdue = q.overdue_only.unwrap_or(false);
    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, EquipmentCheck>(
        "SELECT * FROM equipment_checks \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR location_id = $2) \
           AND ($3::bool = false OR (next_check_due_at IS NOT NULL AND next_check_due_at <= now())) \
         ORDER BY checked_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.location_id)
    .bind(overdue)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
