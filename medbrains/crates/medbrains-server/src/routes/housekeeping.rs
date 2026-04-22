#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::housekeeping::{
    CleaningSchedule, CleaningTask, LaundryBatch, LinenCondemnation, LinenItem,
    LinenMovement, LinenParLevel, PestControlLog, PestControlSchedule, RoomTurnaround,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Cleaning Schedules ──────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCleaningSchedulesQuery {
    pub area_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCleaningScheduleRequest {
    pub area_type: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub frequency_hours: Option<i32>,
    pub checklist_items: Option<serde_json::Value>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCleaningScheduleRequest {
    pub area_type: Option<String>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub frequency_hours: Option<i32>,
    pub checklist_items: Option<serde_json::Value>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Cleaning Tasks ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCleaningTasksQuery {
    pub date: Option<String>,
    pub status: Option<String>,
    pub area_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCleaningTaskRequest {
    pub schedule_id: Option<Uuid>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub area_type: String,
    pub task_date: Option<String>,
    pub assigned_to: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskStatusRequest {
    pub status: String,
}

// ── Room Turnarounds ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTurnaroundsQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTurnaroundRequest {
    pub location_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub discharge_at: Option<String>,
    pub dirty_at: Option<String>,
    pub cleaned_by: Option<String>,
}

// ── Pest Control ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreatePestControlScheduleRequest {
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub pest_type: String,
    pub frequency_months: Option<i32>,
    pub last_done: Option<String>,
    pub next_due: Option<String>,
    pub vendor_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePestControlScheduleRequest {
    pub pest_type: Option<String>,
    pub frequency_months: Option<i32>,
    pub last_done: Option<String>,
    pub next_due: Option<String>,
    pub vendor_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePestControlLogRequest {
    pub schedule_id: Option<Uuid>,
    pub treatment_date: String,
    pub treatment_type: String,
    pub chemicals_used: Option<String>,
    pub areas_treated: Option<serde_json::Value>,
    pub vendor_name: Option<String>,
    pub certificate_no: Option<String>,
    pub next_due: Option<String>,
    pub notes: Option<String>,
}

// ── Linen ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListLinenItemsQuery {
    pub status: Option<String>,
    pub item_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLinenItemRequest {
    pub barcode: Option<String>,
    pub item_type: String,
    pub current_status: Option<String>,
    pub ward_id: Option<Uuid>,
    pub max_washes: Option<i32>,
    pub commissioned_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLinenItemRequest {
    pub current_status: Option<String>,
    pub ward_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLinenMovementRequest {
    pub linen_item_id: Option<Uuid>,
    pub movement_type: String,
    pub from_ward: Option<Uuid>,
    pub to_ward: Option<Uuid>,
    pub quantity: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub contamination_type: Option<String>,
    pub batch_id: Option<Uuid>,
    pub recorded_by: Option<String>,
}

// ── Laundry ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateLaundryBatchRequest {
    pub batch_number: String,
    pub items_count: Option<i32>,
    pub total_weight: Option<Decimal>,
    pub contamination_type: Option<String>,
    pub wash_formula: Option<String>,
    pub wash_temperature: Option<i32>,
    pub cycle_minutes: Option<i32>,
    pub operator_name: Option<String>,
    pub notes: Option<String>,
}

// ── Par Levels ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpsertParLevelRequest {
    pub ward_id: Option<Uuid>,
    pub item_type: String,
    pub par_level: i32,
    pub current_stock: Option<i32>,
    pub reorder_level: Option<i32>,
}

// ── Condemnations ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCondemnationRequest {
    pub linen_item_id: Option<Uuid>,
    pub reason: String,
    pub wash_count_at_condemn: Option<i32>,
    pub replacement_requested: Option<bool>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Cleaning Schedules
// ══════════════════════════════════════════════════════════

pub async fn list_cleaning_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCleaningSchedulesQuery>,
) -> Result<Json<Vec<CleaningSchedule>>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(area_type) = params.area_type {
        sqlx::query_as::<_, CleaningSchedule>(
            "SELECT * FROM cleaning_schedules WHERE area_type::text = $1 \
             ORDER BY created_at DESC",
        )
        .bind(area_type)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, CleaningSchedule>(
            "SELECT * FROM cleaning_schedules ORDER BY created_at DESC",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_cleaning_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCleaningScheduleRequest>,
) -> Result<Json<CleaningSchedule>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CleaningSchedule>(
        "INSERT INTO cleaning_schedules \
         (tenant_id, area_type, location_id, department_id, frequency_hours, \
          checklist_items, is_active, notes) \
         VALUES ($1, $2::cleaning_area_type, $3, $4, COALESCE($5, 24), \
                 COALESCE($6, '[]'::jsonb), COALESCE($7, true), $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.area_type)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(body.frequency_hours)
    .bind(&body.checklist_items)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_cleaning_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCleaningScheduleRequest>,
) -> Result<Json<CleaningSchedule>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CleaningSchedule>(
        "UPDATE cleaning_schedules SET \
         area_type = COALESCE($2::cleaning_area_type, area_type), \
         location_id = COALESCE($3, location_id), \
         department_id = COALESCE($4, department_id), \
         frequency_hours = COALESCE($5, frequency_hours), \
         checklist_items = COALESCE($6, checklist_items), \
         is_active = COALESCE($7, is_active), \
         notes = COALESCE($8, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.area_type)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(body.frequency_hours)
    .bind(&body.checklist_items)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Cleaning Tasks
// ══════════════════════════════════════════════════════════

pub async fn list_cleaning_tasks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCleaningTasksQuery>,
) -> Result<Json<Vec<CleaningTask>>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CleaningTask>(
        "SELECT * FROM cleaning_tasks \
         WHERE ($1::text IS NULL OR task_date::text = $1) \
           AND ($2::text IS NULL OR status::text = $2) \
           AND ($3::text IS NULL OR area_type::text = $3) \
         ORDER BY task_date DESC, created_at DESC",
    )
    .bind(&params.date)
    .bind(&params.status)
    .bind(&params.area_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_cleaning_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCleaningTaskRequest>,
) -> Result<Json<CleaningTask>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CleaningTask>(
        "INSERT INTO cleaning_tasks \
         (tenant_id, schedule_id, location_id, department_id, area_type, \
          task_date, assigned_to, notes) \
         VALUES ($1, $2, $3, $4, $5::cleaning_area_type, \
                 COALESCE($6::date, CURRENT_DATE), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.schedule_id)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.area_type)
    .bind(&body.task_date)
    .bind(&body.assigned_to)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_task_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTaskStatusRequest>,
) -> Result<Json<CleaningTask>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let row = sqlx::query_as::<_, CleaningTask>(
        "UPDATE cleaning_tasks SET \
         status = $2::cleaning_task_status, \
         started_at = CASE WHEN $2 = 'in_progress' THEN $3 ELSE started_at END, \
         completed_at = CASE WHEN $2 = 'completed' THEN $3 ELSE completed_at END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn verify_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CleaningTask>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let row = sqlx::query_as::<_, CleaningTask>(
        "UPDATE cleaning_tasks SET \
         status = 'verified'::cleaning_task_status, \
         verified_by = $2, verified_at = $3 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Room Turnarounds
// ══════════════════════════════════════════════════════════

pub async fn list_turnarounds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTurnaroundsQuery>,
) -> Result<Json<Vec<RoomTurnaround>>, AppError> {
    require_permission(&claims, permissions::housekeeping::turnaround::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RoomTurnaround>(
        "SELECT * FROM room_turnarounds \
         WHERE ($1::date IS NULL OR discharge_at::date >= $1::date) \
           AND ($2::date IS NULL OR discharge_at::date <= $2::date) \
         ORDER BY created_at DESC",
    )
    .bind(&params.from_date)
    .bind(&params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_turnaround(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTurnaroundRequest>,
) -> Result<Json<RoomTurnaround>, AppError> {
    require_permission(&claims, permissions::housekeeping::turnaround::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RoomTurnaround>(
        "INSERT INTO room_turnarounds \
         (tenant_id, location_id, patient_id, discharge_at, dirty_at, cleaned_by) \
         VALUES ($1, $2, $3, $4::timestamptz, \
                 COALESCE($5::timestamptz, now()), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(body.patient_id)
    .bind(&body.discharge_at)
    .bind(&body.dirty_at)
    .bind(&body.cleaned_by)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_turnaround(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomTurnaround>, AppError> {
    require_permission(&claims, permissions::housekeeping::turnaround::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch existing to compute turnaround
    let existing = sqlx::query_as::<_, RoomTurnaround>(
        "SELECT * FROM room_turnarounds WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let now = chrono::Utc::now();
    let minutes = existing
        .dirty_at
        .map(|d| i32::try_from((now - d).num_minutes()).unwrap_or(i32::MAX));

    let row = sqlx::query_as::<_, RoomTurnaround>(
        "UPDATE room_turnarounds SET \
         ready_at = $2, turnaround_minutes = $3, \
         cleaning_completed_at = $2, verified_by = $4 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(now)
    .bind(minutes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Pest Control Schedules
// ══════════════════════════════════════════════════════════

pub async fn list_pest_control_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PestControlSchedule>>, AppError> {
    require_permission(&claims, permissions::housekeeping::pest_control::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PestControlSchedule>(
        "SELECT * FROM pest_control_schedules ORDER BY next_due ASC NULLS LAST",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_pest_control_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePestControlScheduleRequest>,
) -> Result<Json<PestControlSchedule>, AppError> {
    require_permission(&claims, permissions::housekeeping::pest_control::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PestControlSchedule>(
        "INSERT INTO pest_control_schedules \
         (tenant_id, location_id, department_id, pest_type, frequency_months, \
          last_done, next_due, vendor_name, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 3), $6::date, $7::date, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.pest_type)
    .bind(body.frequency_months)
    .bind(&body.last_done)
    .bind(&body.next_due)
    .bind(&body.vendor_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_pest_control_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePestControlScheduleRequest>,
) -> Result<Json<PestControlSchedule>, AppError> {
    require_permission(&claims, permissions::housekeeping::pest_control::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PestControlSchedule>(
        "UPDATE pest_control_schedules SET \
         pest_type = COALESCE($2, pest_type), \
         frequency_months = COALESCE($3, frequency_months), \
         last_done = COALESCE($4::date, last_done), \
         next_due = COALESCE($5::date, next_due), \
         vendor_name = COALESCE($6, vendor_name), \
         notes = COALESCE($7, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.pest_type)
    .bind(body.frequency_months)
    .bind(&body.last_done)
    .bind(&body.next_due)
    .bind(&body.vendor_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Pest Control Logs
// ══════════════════════════════════════════════════════════

pub async fn list_pest_control_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PestControlLog>>, AppError> {
    require_permission(&claims, permissions::housekeeping::pest_control::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PestControlLog>(
        "SELECT * FROM pest_control_logs ORDER BY treatment_date DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_pest_control_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePestControlLogRequest>,
) -> Result<Json<PestControlLog>, AppError> {
    require_permission(&claims, permissions::housekeeping::pest_control::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PestControlLog>(
        "INSERT INTO pest_control_logs \
         (tenant_id, schedule_id, treatment_date, treatment_type, chemicals_used, \
          areas_treated, vendor_name, certificate_no, next_due, notes) \
         VALUES ($1, $2, $3::date, $4, $5, \
                 COALESCE($6, '[]'::jsonb), $7, $8, $9::date, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.schedule_id)
    .bind(&body.treatment_date)
    .bind(&body.treatment_type)
    .bind(&body.chemicals_used)
    .bind(&body.areas_treated)
    .bind(&body.vendor_name)
    .bind(&body.certificate_no)
    .bind(&body.next_due)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Linen Items
// ══════════════════════════════════════════════════════════

pub async fn list_linen_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListLinenItemsQuery>,
) -> Result<Json<Vec<LinenItem>>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LinenItem>(
        "SELECT * FROM linen_items \
         WHERE ($1::text IS NULL OR current_status::text = $1) \
           AND ($2::text IS NULL OR item_type = $2) \
         ORDER BY created_at DESC",
    )
    .bind(&params.status)
    .bind(&params.item_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_linen_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLinenItemRequest>,
) -> Result<Json<LinenItem>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LinenItem>(
        "INSERT INTO linen_items \
         (tenant_id, barcode, item_type, current_status, ward_id, \
          max_washes, commissioned_date, notes) \
         VALUES ($1, $2, $3, COALESCE($4::linen_status, 'clean'), $5, \
                 COALESCE($6, 150), $7::date, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.barcode)
    .bind(&body.item_type)
    .bind(&body.current_status)
    .bind(body.ward_id)
    .bind(body.max_washes)
    .bind(&body.commissioned_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_linen_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLinenItemRequest>,
) -> Result<Json<LinenItem>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LinenItem>(
        "UPDATE linen_items SET \
         current_status = COALESCE($2::linen_status, current_status), \
         ward_id = COALESCE($3, ward_id), \
         notes = COALESCE($4, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.current_status)
    .bind(body.ward_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Linen Movements
// ══════════════════════════════════════════════════════════

pub async fn list_linen_movements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LinenMovement>>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LinenMovement>(
        "SELECT * FROM linen_movements ORDER BY movement_date DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_linen_movement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLinenMovementRequest>,
) -> Result<Json<LinenMovement>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LinenMovement>(
        "INSERT INTO linen_movements \
         (tenant_id, linen_item_id, movement_type, from_ward, to_ward, \
          quantity, weight_kg, contamination_type, batch_id, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, \
                 COALESCE($6, 1), $7, \
                 COALESCE($8::linen_contamination_type, 'regular'), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.linen_item_id)
    .bind(&body.movement_type)
    .bind(body.from_ward)
    .bind(body.to_ward)
    .bind(body.quantity)
    .bind(body.weight_kg)
    .bind(&body.contamination_type)
    .bind(body.batch_id)
    .bind(&body.recorded_by)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Laundry Batches
// ══════════════════════════════════════════════════════════

pub async fn list_laundry_batches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LaundryBatch>>, AppError> {
    require_permission(&claims, permissions::housekeeping::laundry::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LaundryBatch>(
        "SELECT * FROM laundry_batches ORDER BY created_at DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_laundry_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLaundryBatchRequest>,
) -> Result<Json<LaundryBatch>, AppError> {
    require_permission(&claims, permissions::housekeeping::laundry::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let row = sqlx::query_as::<_, LaundryBatch>(
        "INSERT INTO laundry_batches \
         (tenant_id, batch_number, items_count, total_weight, contamination_type, \
          wash_formula, wash_temperature, cycle_minutes, started_at, \
          status, operator_name, notes) \
         VALUES ($1, $2, COALESCE($3, 0), $4, \
                 COALESCE($5::linen_contamination_type, 'regular'), \
                 $6, $7, $8, $9, 'in_progress', $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.batch_number)
    .bind(body.items_count)
    .bind(body.total_weight)
    .bind(&body.contamination_type)
    .bind(&body.wash_formula)
    .bind(body.wash_temperature)
    .bind(body.cycle_minutes)
    .bind(now)
    .bind(&body.operator_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_laundry_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LaundryBatch>, AppError> {
    require_permission(&claims, permissions::housekeeping::laundry::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let row = sqlx::query_as::<_, LaundryBatch>(
        "UPDATE laundry_batches SET \
         status = 'completed', completed_at = $2 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Linen Par Levels
// ══════════════════════════════════════════════════════════

pub async fn list_par_levels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LinenParLevel>>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LinenParLevel>(
        "SELECT * FROM linen_par_levels ORDER BY item_type, ward_id",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn upsert_par_level(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertParLevelRequest>,
) -> Result<Json<LinenParLevel>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LinenParLevel>(
        "INSERT INTO linen_par_levels \
         (tenant_id, ward_id, item_type, par_level, current_stock, reorder_level) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 0)) \
         ON CONFLICT (tenant_id, ward_id, item_type) DO UPDATE SET \
           par_level = EXCLUDED.par_level, \
           current_stock = EXCLUDED.current_stock, \
           reorder_level = EXCLUDED.reorder_level \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.ward_id)
    .bind(&body.item_type)
    .bind(body.par_level)
    .bind(body.current_stock)
    .bind(body.reorder_level)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Linen Condemnations
// ══════════════════════════════════════════════════════════

pub async fn list_condemnations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LinenCondemnation>>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LinenCondemnation>(
        "SELECT * FROM linen_condemnations ORDER BY condemned_date DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_condemnation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCondemnationRequest>,
) -> Result<Json<LinenCondemnation>, AppError> {
    require_permission(&claims, permissions::housekeeping::linen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Update linen item status to condemned if linked
    if let Some(item_id) = body.linen_item_id {
        sqlx::query(
            "UPDATE linen_items SET \
             current_status = 'condemned'::linen_status, \
             condemned_date = CURRENT_DATE \
             WHERE id = $1",
        )
        .bind(item_id)
        .execute(&mut *tx)
        .await?;
    }

    let row = sqlx::query_as::<_, LinenCondemnation>(
        "INSERT INTO linen_condemnations \
         (tenant_id, linen_item_id, reason, wash_count_at_condemn, \
          condemned_by, replacement_requested) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, false)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.linen_item_id)
    .bind(&body.reason)
    .bind(body.wash_count_at_condemn)
    .bind(claims.sub)
    .bind(body.replacement_requested)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  BMW Schedule & Sharp Container Replacement
// ══════════════════════════════════════════════════════════

/// GET /api/housekeeping/bmw/schedule
pub async fn get_bmw_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let dept_filter = params.get("department_id");

    let rows = if let Some(dept_id) = dept_filter {
        let dept_uuid: Uuid = dept_id
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid department_id".into()))?;
        sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT COALESCE(json_agg(r), '[]'::json) FROM ( \
             SELECT waste_category::text, department_id, \
             COUNT(*)::bigint as total_records, \
             MAX(record_date)::text as last_collection, \
             SUM(weight_kg)::float8 as total_kg, \
             SUM(container_count)::bigint as total_containers \
             FROM biowaste_records \
             WHERE tenant_id = $1 AND department_id = $2 \
             GROUP BY waste_category, department_id \
             ORDER BY waste_category \
             ) r",
        )
        .bind(claims.tenant_id)
        .bind(dept_uuid)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT COALESCE(json_agg(r), '[]'::json) FROM ( \
             SELECT waste_category::text, department_id, \
             COUNT(*)::bigint as total_records, \
             MAX(record_date)::text as last_collection, \
             SUM(weight_kg)::float8 as total_kg, \
             SUM(container_count)::bigint as total_containers \
             FROM biowaste_records \
             WHERE tenant_id = $1 \
             GROUP BY waste_category, department_id \
             ORDER BY waste_category, department_id \
             ) r",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(serde_json::json!({"schedule": rows})))
}

/// POST /api/housekeeping/bmw/sharp-replacement
pub async fn create_sharp_replacement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::housekeeping::cleaning::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let department_id = body
        .get("department_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| AppError::BadRequest("department_id is required".into()))?;

    let notes = body.get("notes").and_then(|v| v.as_str()).unwrap_or("");
    let container_count = body
        .get("container_count")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(1);

    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT row_to_json(r) FROM ( \
         INSERT INTO biowaste_records \
         (tenant_id, department_id, waste_category, record_date, \
          weight_kg, container_count, notes, recorded_by) \
         VALUES ($1, $2, 'white_translucent'::waste_category, CURRENT_DATE, \
          0, $3, $4, $5) \
         RETURNING * \
         ) r",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(container_count as i32)
    .bind(format!("Sharp container replacement. {notes}"))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
