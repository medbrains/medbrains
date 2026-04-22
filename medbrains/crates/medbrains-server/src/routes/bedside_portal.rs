#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::bedside_portal::{
    BedsideEducationVideo, BedsideEducationView, BedsideNurseRequest,
    BedsideRealtimeFeedback, BedsideSession,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub bed_location: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListNurseRequestsQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNurseRequestPayload {
    pub patient_id: Uuid,
    pub request_type: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRequestStatusPayload {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct ListVideosQuery {
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVideoRequest {
    pub title: String,
    pub description: Option<String>,
    pub video_url: String,
    pub thumbnail_url: Option<String>,
    pub category: String,
    pub condition_codes: Option<serde_json::Value>,
    pub language: Option<String>,
    pub duration_seconds: Option<i32>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVideoRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub video_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub category: Option<String>,
    pub condition_codes: Option<serde_json::Value>,
    pub language: Option<String>,
    pub duration_seconds: Option<i32>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RecordVideoViewRequest {
    pub video_id: Uuid,
    pub patient_id: Uuid,
    pub watched_seconds: Option<i32>,
    pub completed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitFeedbackRequest {
    pub patient_id: Uuid,
    pub pain_level: Option<i32>,
    pub comfort_level: Option<i32>,
    pub cleanliness_level: Option<i32>,
    pub noise_level: Option<i32>,
    pub staff_response: Option<i32>,
    pub comments: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyScheduleItem {
    pub event_type: String,
    pub scheduled_at: Option<chrono::DateTime<Utc>>,
    pub description: String,
    pub status: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Sessions
// ══════════════════════════════════════════════════════════

pub async fn list_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BedsideSession>>, AppError> {
    require_permission(&claims, permissions::bedside::sessions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BedsideSession>(
        "SELECT * FROM bedside_sessions ORDER BY started_at DESC LIMIT 100",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSessionRequest>,
) -> Result<Json<BedsideSession>, AppError> {
    require_permission(&claims, permissions::bedside::sessions::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideSession>(
        "INSERT INTO bedside_sessions (tenant_id, admission_id, patient_id, bed_location, device_id) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(body.patient_id)
    .bind(&body.bed_location)
    .bind(&body.device_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn end_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BedsideSession>, AppError> {
    require_permission(&claims, permissions::bedside::sessions::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideSession>(
        "UPDATE bedside_sessions SET ended_at = now(), is_active = FALSE \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Daily Schedule
// ══════════════════════════════════════════════════════════

pub async fn get_daily_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<DailyScheduleItem>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Combine medication schedule, nursing tasks, and diet orders for today
    let rows = sqlx::query_as::<_, DailyScheduleItem>(
        "SELECT * FROM ( \
           SELECT 'medication' AS event_type, scheduled_at, \
                  COALESCE(drug_name, 'Medication') AS description, \
                  status::text AS status \
           FROM ipd_medication_administration WHERE admission_id = $1 \
                AND scheduled_at::date = CURRENT_DATE \
           UNION ALL \
           SELECT 'nursing_task' AS event_type, scheduled_at, \
                  COALESCE(task_description, 'Nursing Task') AS description, \
                  status::text AS status \
           FROM nursing_tasks WHERE admission_id = $1 \
                AND scheduled_at::date = CURRENT_DATE \
           UNION ALL \
           SELECT 'meal' AS event_type, meal_time AS scheduled_at, \
                  COALESCE(meal_type, 'Meal') AS description, \
                  status::text AS status \
           FROM diet_orders WHERE admission_id = $1 \
                AND status = 'active' \
         ) combined ORDER BY scheduled_at ASC NULLS LAST",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Medications
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MedicationItem {
    pub id: Uuid,
    pub drug_name: Option<String>,
    pub dose: Option<String>,
    pub route: Option<String>,
    pub frequency: Option<String>,
    pub scheduled_at: Option<chrono::DateTime<Utc>>,
    pub status: Option<String>,
}

pub async fn get_medications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<MedicationItem>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MedicationItem>(
        "SELECT id, drug_name, dose, route, frequency, scheduled_at, status::text AS status \
         FROM ipd_medication_administration \
         WHERE admission_id = $1 AND status = 'scheduled' \
         ORDER BY scheduled_at ASC LIMIT 50",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Vitals
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VitalReading {
    pub id: Uuid,
    pub vital_type: Option<String>,
    pub value_numeric: Option<f64>,
    pub value_text: Option<String>,
    pub unit: Option<String>,
    pub recorded_at: Option<chrono::DateTime<Utc>>,
}

pub async fn get_vitals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<VitalReading>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VitalReading>(
        "SELECT v.id, v.vital_type, v.value_numeric, v.value_text, v.unit, v.recorded_at \
         FROM vitals v \
         JOIN encounters e ON e.id = v.encounter_id \
         JOIN admissions a ON a.encounter_id = e.id \
         WHERE a.id = $1 \
         ORDER BY v.recorded_at DESC LIMIT 10",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Lab Results
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LabResultItem {
    pub id: Uuid,
    pub test_name: Option<String>,
    pub result_value: Option<String>,
    pub unit: Option<String>,
    pub reference_range: Option<String>,
    pub is_abnormal: Option<bool>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
}

pub async fn get_lab_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<LabResultItem>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabResultItem>(
        "SELECT lr.id, ltc.name AS test_name, lr.result_value, lr.unit, \
                lr.reference_range, lr.is_abnormal, lr.completed_at \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id \
         JOIN lab_test_catalog ltc ON ltc.id = lo.test_id \
         JOIN encounters e ON e.id = lo.encounter_id \
         JOIN admissions a ON a.encounter_id = e.id \
         WHERE a.id = $1 \
         ORDER BY lr.completed_at DESC NULLS LAST LIMIT 20",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Diet Order
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DietOrderItem {
    pub id: Uuid,
    pub diet_type: Option<String>,
    pub meal_type: Option<String>,
    pub instructions: Option<String>,
    pub status: Option<String>,
}

pub async fn get_diet_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<DietOrderItem>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DietOrderItem>(
        "SELECT id, diet_type, meal_type, instructions, status::text AS status \
         FROM diet_orders WHERE admission_id = $1 AND status = 'active' \
         ORDER BY created_at DESC LIMIT 10",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Nurse Requests
// ══════════════════════════════════════════════════════════

pub async fn create_nurse_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateNurseRequestPayload>,
) -> Result<Json<BedsideNurseRequest>, AppError> {
    require_permission(&claims, permissions::bedside::REQUEST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideNurseRequest>(
        "INSERT INTO bedside_nurse_requests \
         (tenant_id, admission_id, patient_id, request_type, notes) \
         VALUES ($1, $2, $3, $4::bedside_request_type, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(body.patient_id)
    .bind(&body.request_type)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_nurse_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Query(params): Query<ListNurseRequestsQuery>,
) -> Result<Json<Vec<BedsideNurseRequest>>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BedsideNurseRequest>(
        "SELECT * FROM bedside_nurse_requests \
         WHERE admission_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY created_at DESC LIMIT 50",
    )
    .bind(admission_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn update_request_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRequestStatusPayload>,
) -> Result<Json<BedsideNurseRequest>, AppError> {
    require_permission(&claims, permissions::bedside::sessions::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideNurseRequest>(
        "UPDATE bedside_nurse_requests SET \
         status = $2::bedside_request_status, \
         acknowledged_by = CASE WHEN $2 = 'acknowledged' THEN $3 ELSE acknowledged_by END, \
         acknowledged_at = CASE WHEN $2 = 'acknowledged' THEN now() ELSE acknowledged_at END, \
         completed_by = CASE WHEN $2 IN ('completed', 'cancelled') THEN $3 ELSE completed_by END, \
         completed_at = CASE WHEN $2 IN ('completed', 'cancelled') THEN now() ELSE completed_at END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Education Videos
// ══════════════════════════════════════════════════════════

pub async fn list_videos(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVideosQuery>,
) -> Result<Json<Vec<BedsideEducationVideo>>, AppError> {
    require_permission(&claims, permissions::bedside::videos::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BedsideEducationVideo>(
        "SELECT * FROM bedside_education_videos \
         WHERE is_active = TRUE \
         AND ($1::text IS NULL OR category = $1) \
         ORDER BY sort_order ASC, title ASC",
    )
    .bind(&params.category)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_video(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVideoRequest>,
) -> Result<Json<BedsideEducationVideo>, AppError> {
    require_permission(&claims, permissions::bedside::videos::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideEducationVideo>(
        "INSERT INTO bedside_education_videos \
         (tenant_id, title, description, video_url, thumbnail_url, category, \
          condition_codes, language, duration_seconds, sort_order, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.video_url)
    .bind(&body.thumbnail_url)
    .bind(&body.category)
    .bind(&body.condition_codes)
    .bind(&body.language)
    .bind(body.duration_seconds)
    .bind(body.sort_order)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_video(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVideoRequest>,
) -> Result<Json<BedsideEducationVideo>, AppError> {
    require_permission(&claims, permissions::bedside::videos::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideEducationVideo>(
        "UPDATE bedside_education_videos SET \
         title = COALESCE($2, title), \
         description = COALESCE($3, description), \
         video_url = COALESCE($4, video_url), \
         thumbnail_url = COALESCE($5, thumbnail_url), \
         category = COALESCE($6, category), \
         condition_codes = COALESCE($7, condition_codes), \
         language = COALESCE($8, language), \
         duration_seconds = COALESCE($9, duration_seconds), \
         is_active = COALESCE($10, is_active), \
         sort_order = COALESCE($11, sort_order) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.video_url)
    .bind(&body.thumbnail_url)
    .bind(&body.category)
    .bind(&body.condition_codes)
    .bind(&body.language)
    .bind(body.duration_seconds)
    .bind(body.is_active)
    .bind(body.sort_order)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn record_video_view(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<RecordVideoViewRequest>,
) -> Result<Json<BedsideEducationView>, AppError> {
    require_permission(&claims, permissions::bedside::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideEducationView>(
        "INSERT INTO bedside_education_views \
         (tenant_id, video_id, patient_id, admission_id, watched_seconds, completed) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.video_id)
    .bind(body.patient_id)
    .bind(admission_id)
    .bind(body.watched_seconds.unwrap_or(0))
    .bind(body.completed.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Feedback
// ══════════════════════════════════════════════════════════

pub async fn submit_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<SubmitFeedbackRequest>,
) -> Result<Json<BedsideRealtimeFeedback>, AppError> {
    require_permission(&claims, permissions::bedside::feedback::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BedsideRealtimeFeedback>(
        "INSERT INTO bedside_realtime_feedback \
         (tenant_id, admission_id, patient_id, pain_level, comfort_level, \
          cleanliness_level, noise_level, staff_response, comments) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(body.patient_id)
    .bind(body.pain_level)
    .bind(body.comfort_level)
    .bind(body.cleanliness_level)
    .bind(body.noise_level)
    .bind(body.staff_response)
    .bind(&body.comments)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<BedsideRealtimeFeedback>>, AppError> {
    require_permission(&claims, permissions::bedside::feedback::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BedsideRealtimeFeedback>(
        "SELECT * FROM bedside_realtime_feedback \
         WHERE admission_id = $1 \
         ORDER BY submitted_at DESC LIMIT 50",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
