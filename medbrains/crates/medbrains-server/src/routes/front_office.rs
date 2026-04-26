#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::front_office::{
    EnquiryLog, QueueDisplayConfig, QueuePriorityRule, VisitingHours, VisitorLog, VisitorPass,
    VisitorRegistration,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Visiting Hours ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpsertVisitingHoursRequest {
    pub ward_id: Option<Uuid>,
    pub day_of_week: i32,
    pub start_time: String,
    pub end_time: String,
    pub max_visitors_per_patient: Option<i32>,
    pub is_active: Option<bool>,
}

// ── Visitor Registrations ───────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVisitorsQuery {
    pub patient_id: Option<Uuid>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVisitorRequest {
    pub visitor_name: String,
    pub phone: Option<String>,
    pub id_type: Option<String>,
    pub id_number: Option<String>,
    pub photo_url: Option<String>,
    pub relationship: Option<String>,
    pub category: Option<String>,
    pub patient_id: Option<Uuid>,
    pub ward_id: Option<Uuid>,
    pub purpose: Option<String>,
}

// ── Visitor Passes ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPassesQuery {
    pub status: Option<String>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePassRequest {
    pub registration_id: Uuid,
    pub ward_id: Option<Uuid>,
    pub bed_number: Option<String>,
    pub valid_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RevokePassRequest {
    pub reason: Option<String>,
}

// ── Visitor Logs ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVisitorLogsQuery {
    pub pass_id: Option<Uuid>,
    pub active_only: Option<bool>,
}

// ── Queue Priority Rules ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpsertQueuePriorityRequest {
    pub department_id: Option<Uuid>,
    pub priority: String,
    pub weight: Option<i32>,
    pub auto_detect_criteria: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

// ── Queue Display Config ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpsertDisplayConfigRequest {
    pub department_id: Option<Uuid>,
    pub location_name: String,
    pub display_type: Option<String>,
    pub doctors_per_screen: Option<i32>,
    pub show_patient_name: Option<bool>,
    pub show_wait_time: Option<bool>,
    pub language: Option<serde_json::Value>,
    pub announcement_enabled: Option<bool>,
    pub scroll_speed: Option<i32>,
}

// ── Enquiry Logs ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEnquiriesQuery {
    pub enquiry_type: Option<String>,
    pub resolved: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnquiryRequest {
    pub caller_name: Option<String>,
    pub caller_phone: Option<String>,
    pub enquiry_type: Option<String>,
    pub patient_id: Option<Uuid>,
    pub response_text: Option<String>,
}

// ── Queue Stats ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct QueueStatsQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct QueueStatsResponse {
    pub department_id: Option<Uuid>,
    pub waiting_count: i64,
    pub avg_wait_minutes: Option<f64>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Visiting Hours
// ══════════════════════════════════════════════════════════

pub async fn list_visiting_hours(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<VisitingHours>>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VisitingHours>(
        "SELECT * FROM visiting_hours ORDER BY ward_id NULLS FIRST, day_of_week, start_time",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn upsert_visiting_hours(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertVisitingHoursRequest>,
) -> Result<Json<VisitingHours>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, VisitingHours>(
        "INSERT INTO visiting_hours \
         (tenant_id, ward_id, day_of_week, start_time, end_time, \
          max_visitors_per_patient, is_active) \
         VALUES ($1, $2, $3, $4::time, $5::time, COALESCE($6, 2), COALESCE($7, true)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.ward_id)
    .bind(body.day_of_week)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(body.max_visitors_per_patient)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Visitor Registrations
// ══════════════════════════════════════════════════════════

pub async fn list_visitors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVisitorsQuery>,
) -> Result<Json<Vec<VisitorRegistration>>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pid) = params.patient_id {
        sqlx::query_as::<_, VisitorRegistration>(
            "SELECT * FROM visitor_registrations WHERE patient_id = $1 \
             ORDER BY created_at DESC",
        )
        .bind(pid)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(cat) = params.category {
        sqlx::query_as::<_, VisitorRegistration>(
            "SELECT * FROM visitor_registrations WHERE category::text = $1 \
             ORDER BY created_at DESC",
        )
        .bind(cat)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, VisitorRegistration>(
            "SELECT * FROM visitor_registrations ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_visitor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVisitorRequest>,
) -> Result<Json<VisitorRegistration>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, VisitorRegistration>(
        "INSERT INTO visitor_registrations \
         (tenant_id, visitor_name, phone, id_type, id_number, photo_url, \
          relationship, category, patient_id, ward_id, purpose, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
                 COALESCE($8, 'general')::visitor_category, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.visitor_name)
    .bind(&body.phone)
    .bind(&body.id_type)
    .bind(&body.id_number)
    .bind(&body.photo_url)
    .bind(&body.relationship)
    .bind(&body.category)
    .bind(body.patient_id)
    .bind(body.ward_id)
    .bind(&body.purpose)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Visitor Passes
// ══════════════════════════════════════════════════════════

pub async fn list_passes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPassesQuery>,
) -> Result<Json<Vec<VisitorPass>>, AppError> {
    require_permission(&claims, permissions::front_office::passes::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(status) = params.status {
        sqlx::query_as::<_, VisitorPass>(
            "SELECT * FROM visitor_passes WHERE status::text = $1 \
             ORDER BY created_at DESC",
        )
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(reg_id) = params.registration_id {
        sqlx::query_as::<_, VisitorPass>(
            "SELECT * FROM visitor_passes WHERE registration_id = $1 \
             ORDER BY created_at DESC",
        )
        .bind(reg_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, VisitorPass>(
            "SELECT * FROM visitor_passes ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_pass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePassRequest>,
) -> Result<Json<VisitorPass>, AppError> {
    require_permission(&claims, permissions::front_office::passes::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let valid_hours = body.valid_hours.unwrap_or(2);
    let pass_number = format!(
        "VP-{}-{}",
        chrono::Utc::now().format("%Y%m%d%H%M"),
        &Uuid::new_v4().to_string()[..6]
    );

    let row = sqlx::query_as::<_, VisitorPass>(
        "INSERT INTO visitor_passes \
         (tenant_id, registration_id, pass_number, ward_id, bed_number, \
          valid_from, valid_until, status, qr_code, issued_by) \
         VALUES ($1, $2, $3, $4, $5, now(), now() + ($6 || ' hours')::interval, \
                 'active', $3, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&pass_number)
    .bind(body.ward_id)
    .bind(&body.bed_number)
    .bind(valid_hours.to_string())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn revoke_pass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokePassRequest>,
) -> Result<Json<VisitorPass>, AppError> {
    require_permission(&claims, permissions::front_office::passes::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, VisitorPass>(
        "UPDATE visitor_passes SET status = 'revoked', revoked_at = now(), \
         revoked_reason = $2 WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Visitor Logs
// ══════════════════════════════════════════════════════════

pub async fn list_visitor_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVisitorLogsQuery>,
) -> Result<Json<Vec<VisitorLog>>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pass_id) = params.pass_id {
        sqlx::query_as::<_, VisitorLog>(
            "SELECT * FROM visitor_logs WHERE pass_id = $1 ORDER BY check_in_at DESC",
        )
        .bind(pass_id)
        .fetch_all(&mut *tx)
        .await?
    } else if params.active_only.unwrap_or(false) {
        sqlx::query_as::<_, VisitorLog>(
            "SELECT * FROM visitor_logs WHERE check_out_at IS NULL \
             ORDER BY check_in_at DESC",
        )
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, VisitorLog>(
            "SELECT * FROM visitor_logs ORDER BY check_in_at DESC LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn check_in_visitor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pass_id): Path<Uuid>,
) -> Result<Json<VisitorLog>, AppError> {
    require_permission(&claims, permissions::front_office::passes::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, VisitorLog>(
        "INSERT INTO visitor_logs (tenant_id, pass_id, check_in_at, logged_by) \
         VALUES ($1, $2, now(), $3) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(pass_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn check_out_visitor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pass_id): Path<Uuid>,
) -> Result<Json<VisitorLog>, AppError> {
    require_permission(&claims, permissions::front_office::passes::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, VisitorLog>(
        "UPDATE visitor_logs SET check_out_at = now() \
         WHERE pass_id = $1 AND check_out_at IS NULL \
         RETURNING *",
    )
    .bind(pass_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Queue Priority Rules
// ══════════════════════════════════════════════════════════

pub async fn list_queue_priority_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueuePriorityRule>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, QueuePriorityRule>(
        "SELECT * FROM queue_priority_rules ORDER BY weight DESC, priority",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn upsert_queue_priority(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertQueuePriorityRequest>,
) -> Result<Json<QueuePriorityRule>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QueuePriorityRule>(
        "INSERT INTO queue_priority_rules \
         (tenant_id, department_id, priority, weight, auto_detect_criteria, is_active) \
         VALUES ($1, $2, $3::queue_priority, COALESCE($4, 1), \
                 COALESCE($5, '{}'::jsonb), COALESCE($6, true)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&body.priority)
    .bind(body.weight)
    .bind(&body.auto_detect_criteria)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Queue Display Config
// ══════════════════════════════════════════════════════════

pub async fn list_display_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueueDisplayConfig>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, QueueDisplayConfig>(
        "SELECT * FROM queue_display_config ORDER BY location_name",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn upsert_display_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertDisplayConfigRequest>,
) -> Result<Json<QueueDisplayConfig>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QueueDisplayConfig>(
        "INSERT INTO queue_display_config \
         (tenant_id, department_id, location_name, display_type, \
          doctors_per_screen, show_patient_name, show_wait_time, \
          language, announcement_enabled, scroll_speed) \
         VALUES ($1, $2, $3, COALESCE($4, 'waiting_area'), \
                 COALESCE($5, 4), COALESCE($6, false), COALESCE($7, true), \
                 COALESCE($8, '[\"en\"]'::jsonb), COALESCE($9, false), COALESCE($10, 3)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&body.location_name)
    .bind(&body.display_type)
    .bind(body.doctors_per_screen)
    .bind(body.show_patient_name)
    .bind(body.show_wait_time)
    .bind(&body.language)
    .bind(body.announcement_enabled)
    .bind(body.scroll_speed)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Enquiry Logs
// ══════════════════════════════════════════════════════════

pub async fn list_enquiries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEnquiriesQuery>,
) -> Result<Json<Vec<EnquiryLog>>, AppError> {
    require_permission(&claims, permissions::front_office::enquiry::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(etype) = params.enquiry_type {
        sqlx::query_as::<_, EnquiryLog>(
            "SELECT * FROM enquiry_logs WHERE enquiry_type = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(etype)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(resolved) = params.resolved {
        sqlx::query_as::<_, EnquiryLog>(
            "SELECT * FROM enquiry_logs WHERE resolved = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(resolved)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, EnquiryLog>(
            "SELECT * FROM enquiry_logs ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_enquiry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEnquiryRequest>,
) -> Result<Json<EnquiryLog>, AppError> {
    require_permission(&claims, permissions::front_office::enquiry::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EnquiryLog>(
        "INSERT INTO enquiry_logs \
         (tenant_id, caller_name, caller_phone, enquiry_type, patient_id, \
          response_text, handled_by) \
         VALUES ($1, $2, $3, COALESCE($4, 'general'), $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.caller_name)
    .bind(&body.caller_phone)
    .bind(&body.enquiry_type)
    .bind(body.patient_id)
    .bind(&body.response_text)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn resolve_enquiry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EnquiryLog>, AppError> {
    require_permission(&claims, permissions::front_office::enquiry::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EnquiryLog>(
        "UPDATE enquiry_logs SET resolved = true WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Queue Stats
// ══════════════════════════════════════════════════════════

#[derive(sqlx::FromRow)]
struct StatsRow {
    department_id: Option<Uuid>,
    waiting_count: Option<i64>,
    avg_wait_minutes: Option<f64>,
}

pub async fn get_queue_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<QueueStatsQuery>,
) -> Result<Json<Vec<QueueStatsResponse>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, StatsRow>(
            "SELECT department_id, \
             COUNT(*) FILTER (WHERE queue_status = 'waiting') AS waiting_count, \
             EXTRACT(EPOCH FROM AVG(now() - created_at) FILTER (WHERE queue_status = 'waiting')) / 60.0 AS avg_wait_minutes \
             FROM opd_queues WHERE department_id = $1 AND DATE(created_at) = CURRENT_DATE \
             GROUP BY department_id",
        )
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, StatsRow>(
            "SELECT department_id, \
             COUNT(*) FILTER (WHERE queue_status = 'waiting') AS waiting_count, \
             EXTRACT(EPOCH FROM AVG(now() - created_at) FILTER (WHERE queue_status = 'waiting')) / 60.0 AS avg_wait_minutes \
             FROM opd_queues WHERE DATE(created_at) = CURRENT_DATE \
             GROUP BY department_id",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;

    let result = rows
        .into_iter()
        .map(|r| QueueStatsResponse {
            department_id: r.department_id,
            waiting_count: r.waiting_count.unwrap_or(0),
            avg_wait_minutes: r.avg_wait_minutes,
        })
        .collect();

    Ok(Json(result))
}

// ══════════════════════════════════════════════════════════
//  GET /api/front-office/analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VisitorAnalyticsRow {
    pub department_id: Option<Uuid>,
    pub total_visitors: Option<i64>,
    pub avg_visit_duration_minutes: Option<f64>,
    pub peak_hour: Option<i32>,
}

pub async fn visitor_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::front_office::visitors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Visitor counts by department (ward = proxy for department)
    let dept_counts = sqlx::query_as::<_, VisitorAnalyticsRow>(
        "SELECT vr.ward_id AS department_id, \
         COUNT(*)::bigint AS total_visitors, \
         AVG(EXTRACT(EPOCH FROM (vl.checked_out_at - vl.checked_in_at)) / 60.0) \
           FILTER (WHERE vl.checked_out_at IS NOT NULL) AS avg_visit_duration_minutes, \
         MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM vl.checked_in_at)::int) AS peak_hour \
         FROM visitor_registrations vr \
         LEFT JOIN visitor_passes vp ON vp.registration_id = vr.id \
         LEFT JOIN visitor_logs vl ON vl.pass_id = vp.id \
         WHERE vr.tenant_id = $1 \
           AND vr.created_at >= CURRENT_DATE - INTERVAL '30 days' \
         GROUP BY vr.ward_id \
         ORDER BY total_visitors DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Overall totals
    let total = sqlx::query_as::<_, (Option<i64>,)>(
        "SELECT COUNT(*)::bigint FROM visitor_registrations \
         WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Today's count
    let today = sqlx::query_as::<_, (Option<i64>,)>(
        "SELECT COUNT(*)::bigint FROM visitor_registrations \
         WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "total_visitors_30d": total.0.unwrap_or(0),
        "visitors_today": today.0.unwrap_or(0),
        "by_department": dept_counts.iter().map(|r| serde_json::json!({
            "department_id": r.department_id,
            "total_visitors": r.total_visitors,
            "avg_visit_duration_minutes": r.avg_visit_duration_minutes,
            "peak_hour": r.peak_hour,
        })).collect::<Vec<_>>(),
    })))
}

// ══════════════════════════════════════════════════════════
//  GET /api/front-office/queue/metrics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct QueueMetricsQuery {
    pub department_id: Option<Uuid>,
    pub date: Option<chrono::NaiveDate>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QueueMetricsRow {
    pub department_id: Option<Uuid>,
    pub hour_of_day: Option<i32>,
    pub patients_seen: Option<i64>,
    pub avg_wait_minutes: Option<f64>,
    pub max_wait_minutes: Option<f64>,
}

pub async fn queue_metrics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<QueueMetricsQuery>,
) -> Result<Json<Vec<QueueMetricsRow>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, QueueMetricsRow>(
        "SELECT department_id, \
         EXTRACT(HOUR FROM called_at)::int AS hour_of_day, \
         COUNT(*) FILTER (WHERE queue_status = 'completed')::bigint AS patients_seen, \
         AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60.0) \
           FILTER (WHERE called_at IS NOT NULL) AS avg_wait_minutes, \
         MAX(EXTRACT(EPOCH FROM (called_at - created_at)) / 60.0) \
           FILTER (WHERE called_at IS NOT NULL) AS max_wait_minutes \
         FROM opd_queues \
         WHERE DATE(created_at) = COALESCE($1, CURRENT_DATE) \
           AND ($2::uuid IS NULL OR department_id = $2) \
         GROUP BY department_id, EXTRACT(HOUR FROM called_at) \
         ORDER BY department_id, hour_of_day",
    )
    .bind(params.date)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
