#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::security::{
    SecurityAccessCard, SecurityAccessLog, SecurityCamera, SecurityCodeDebrief, SecurityIncident,
    SecurityPatientTag, SecurityTagAlert, SecurityZone,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Zones ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateZoneRequest {
    pub name: String,
    pub zone_code: String,
    pub level: Option<String>,
    pub department_id: Option<Uuid>,
    pub description: Option<String>,
    pub allowed_methods: Option<serde_json::Value>,
    pub after_hours_restricted: Option<bool>,
    pub after_hours_start: Option<String>,
    pub after_hours_end: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateZoneRequest {
    pub name: Option<String>,
    pub level: Option<String>,
    pub department_id: Option<Uuid>,
    pub description: Option<String>,
    pub allowed_methods: Option<serde_json::Value>,
    pub after_hours_restricted: Option<bool>,
    pub after_hours_start: Option<String>,
    pub after_hours_end: Option<String>,
    pub is_active: Option<bool>,
}

// ── Access Logs ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAccessLogsQuery {
    pub zone_id: Option<Uuid>,
    pub employee_id: Option<Uuid>,
    pub is_after_hours: Option<bool>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccessLogRequest {
    pub zone_id: Uuid,
    pub employee_id: Option<Uuid>,
    pub person_name: Option<String>,
    pub access_method: Option<String>,
    pub card_number: Option<String>,
    pub direction: Option<String>,
    pub granted: Option<bool>,
    pub denied_reason: Option<String>,
    pub is_after_hours: Option<bool>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub device_id: Option<String>,
}

// ── Access Cards ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAccessCardsQuery {
    pub employee_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccessCardRequest {
    pub employee_id: Uuid,
    pub card_number: String,
    pub card_type: Option<String>,
    pub issued_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub allowed_zones: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccessCardRequest {
    pub card_type: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub allowed_zones: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateCardRequest {
    pub reason: Option<String>,
}

// ── Cameras ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCamerasQuery {
    pub zone_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCameraRequest {
    pub name: String,
    pub camera_id: Option<String>,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub camera_type: Option<String>,
    pub resolution: Option<String>,
    pub is_recording: Option<bool>,
    pub retention_days: Option<i32>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCameraRequest {
    pub name: Option<String>,
    pub camera_id: Option<String>,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub camera_type: Option<String>,
    pub resolution: Option<String>,
    pub is_recording: Option<bool>,
    pub retention_days: Option<i32>,
    pub ip_address: Option<String>,
    pub is_active: Option<bool>,
}

// ── Incidents ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListIncidentsQuery {
    pub severity: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub severity: Option<String>,
    pub category: String,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub occurred_at: Option<DateTime<Utc>>,
    pub description: String,
    pub persons_involved: Option<serde_json::Value>,
    pub witnesses: Option<serde_json::Value>,
    pub camera_ids: Option<serde_json::Value>,
    pub video_timestamp_start: Option<String>,
    pub video_timestamp_end: Option<String>,
    pub police_notified: Option<bool>,
    pub police_report_number: Option<String>,
    pub assigned_to: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncidentRequest {
    pub severity: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub description: Option<String>,
    pub persons_involved: Option<serde_json::Value>,
    pub witnesses: Option<serde_json::Value>,
    pub camera_ids: Option<serde_json::Value>,
    pub video_timestamp_start: Option<String>,
    pub video_timestamp_end: Option<String>,
    pub police_notified: Option<bool>,
    pub police_report_number: Option<String>,
    pub investigation_notes: Option<String>,
    pub resolution: Option<String>,
    pub assigned_to: Option<Uuid>,
}

// ── Patient Tags ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPatientTagsQuery {
    pub patient_id: Option<Uuid>,
    pub tag_type: Option<String>,
    pub alert_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePatientTagRequest {
    pub patient_id: Uuid,
    pub tag_type: String,
    pub tag_identifier: Option<String>,
    pub allowed_zone_id: Option<Uuid>,
    pub mother_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
}

// ── Tag Alerts ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTagAlertsQuery {
    pub tag_id: Option<Uuid>,
    pub is_resolved: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveTagAlertRequest {
    pub was_false_alarm: Option<bool>,
    pub resolution_notes: Option<String>,
}

// ── Code Debriefs ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDebriefRequest {
    pub code_activation_id: Uuid,
    pub debrief_date: Option<NaiveDate>,
    pub facilitator_id: Option<Uuid>,
    pub attendees: Option<serde_json::Value>,
    pub response_time_seconds: Option<i32>,
    pub total_duration_minutes: Option<i32>,
    pub what_went_well: Option<String>,
    pub what_went_wrong: Option<String>,
    pub root_cause: Option<String>,
    pub lessons_learned: Option<String>,
    pub action_items: Option<serde_json::Value>,
    pub equipment_issues: Option<String>,
    pub training_gaps: Option<String>,
    pub protocol_changes_recommended: Option<String>,
}

// ── Stats ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SecurityStats {
    pub total_zones: i64,
    pub active_cameras: i64,
    pub open_incidents: i64,
    pub active_patient_tags: i64,
    pub unresolved_alerts: i64,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Zones
// ══════════════════════════════════════════════════════════

pub async fn list_zones(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SecurityZone>>, AppError> {
    require_permission(&claims, permissions::security::access::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityZone>("SELECT * FROM security_zones ORDER BY zone_code")
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_zone(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateZoneRequest>,
) -> Result<Json<SecurityZone>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityZone>(
        "INSERT INTO security_zones \
         (tenant_id, name, zone_code, level, department_id, description, \
          allowed_methods, after_hours_restricted, after_hours_start, after_hours_end) \
         VALUES ($1, $2, $3, COALESCE($4, 'general')::sec_zone_level, $5, $6, \
                 COALESCE($7, '[\"card\",\"biometric\",\"pin\",\"manual\"]'::jsonb), \
                 COALESCE($8, false), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.zone_code)
    .bind(&body.level)
    .bind(body.department_id)
    .bind(&body.description)
    .bind(&body.allowed_methods)
    .bind(body.after_hours_restricted)
    .bind(&body.after_hours_start)
    .bind(&body.after_hours_end)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_zone(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateZoneRequest>,
) -> Result<Json<SecurityZone>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityZone>(
        "UPDATE security_zones SET \
         name = COALESCE($2, name), \
         level = COALESCE($3::sec_zone_level, level), \
         department_id = COALESCE($4, department_id), \
         description = COALESCE($5, description), \
         allowed_methods = COALESCE($6, allowed_methods), \
         after_hours_restricted = COALESCE($7, after_hours_restricted), \
         after_hours_start = COALESCE($8, after_hours_start), \
         after_hours_end = COALESCE($9, after_hours_end), \
         is_active = COALESCE($10, is_active) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.level)
    .bind(body.department_id)
    .bind(&body.description)
    .bind(&body.allowed_methods)
    .bind(body.after_hours_restricted)
    .bind(&body.after_hours_start)
    .bind(&body.after_hours_end)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Access Logs
// ══════════════════════════════════════════════════════════

pub async fn list_access_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAccessLogsQuery>,
) -> Result<Json<Vec<SecurityAccessLog>>, AppError> {
    require_permission(&claims, permissions::security::access::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityAccessLog>(
        "SELECT * FROM security_access_logs \
         WHERE ($1::uuid IS NULL OR zone_id = $1) \
         AND ($2::uuid IS NULL OR employee_id = $2) \
         AND ($3::bool IS NULL OR is_after_hours = $3) \
         AND ($4::timestamptz IS NULL OR accessed_at >= $4) \
         AND ($5::timestamptz IS NULL OR accessed_at <= $5) \
         ORDER BY accessed_at DESC LIMIT 500",
    )
    .bind(params.zone_id)
    .bind(params.employee_id)
    .bind(params.is_after_hours)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_access_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAccessLogRequest>,
) -> Result<Json<SecurityAccessLog>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityAccessLog>(
        "INSERT INTO security_access_logs \
         (tenant_id, zone_id, employee_id, person_name, access_method, \
          card_number, direction, granted, denied_reason, is_after_hours, \
          accessed_at, device_id, recorded_by) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 'manual')::sec_access_method, \
                 $6, COALESCE($7, 'entry'), COALESCE($8, true), $9, \
                 COALESCE($10, false), COALESCE($11, now()), $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.zone_id)
    .bind(body.employee_id)
    .bind(&body.person_name)
    .bind(&body.access_method)
    .bind(&body.card_number)
    .bind(&body.direction)
    .bind(body.granted)
    .bind(&body.denied_reason)
    .bind(body.is_after_hours)
    .bind(body.accessed_at)
    .bind(&body.device_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Access Cards
// ══════════════════════════════════════════════════════════

pub async fn list_access_cards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAccessCardsQuery>,
) -> Result<Json<Vec<SecurityAccessCard>>, AppError> {
    require_permission(&claims, permissions::security::access::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityAccessCard>(
        "SELECT * FROM security_access_cards \
         WHERE ($1::uuid IS NULL OR employee_id = $1) \
         AND ($2::bool IS NULL OR is_active = $2) \
         ORDER BY card_number",
    )
    .bind(params.employee_id)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_access_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAccessCardRequest>,
) -> Result<Json<SecurityAccessCard>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityAccessCard>(
        "INSERT INTO security_access_cards \
         (tenant_id, employee_id, card_number, card_type, issued_date, \
          expiry_date, allowed_zones, issued_by) \
         VALUES ($1, $2, $3, COALESCE($4, 'standard'), \
                 COALESCE($5, CURRENT_DATE), $6, \
                 COALESCE($7, '[]'::jsonb), $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.card_number)
    .bind(&body.card_type)
    .bind(body.issued_date)
    .bind(body.expiry_date)
    .bind(&body.allowed_zones)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_access_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAccessCardRequest>,
) -> Result<Json<SecurityAccessCard>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityAccessCard>(
        "UPDATE security_access_cards SET \
         card_type = COALESCE($2, card_type), \
         expiry_date = COALESCE($3, expiry_date), \
         allowed_zones = COALESCE($4, allowed_zones) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.card_type)
    .bind(body.expiry_date)
    .bind(&body.allowed_zones)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn deactivate_access_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DeactivateCardRequest>,
) -> Result<Json<SecurityAccessCard>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityAccessCard>(
        "UPDATE security_access_cards SET \
         is_active = false, deactivated_at = now(), \
         deactivation_reason = $2 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Cameras
// ══════════════════════════════════════════════════════════

pub async fn list_cameras(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCamerasQuery>,
) -> Result<Json<Vec<SecurityCamera>>, AppError> {
    require_permission(&claims, permissions::security::cctv::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityCamera>(
        "SELECT * FROM security_cameras \
         WHERE ($1::uuid IS NULL OR zone_id = $1) \
         AND ($2::bool IS NULL OR is_active = $2) \
         ORDER BY name",
    )
    .bind(params.zone_id)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_camera(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCameraRequest>,
) -> Result<Json<SecurityCamera>, AppError> {
    require_permission(&claims, permissions::security::cctv::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityCamera>(
        "INSERT INTO security_cameras \
         (tenant_id, name, camera_id, zone_id, location_description, \
          camera_type, resolution, is_recording, retention_days, ip_address) \
         VALUES ($1, $2, $3, $4, $5, \
                 COALESCE($6, 'dome'), $7, COALESCE($8, true), \
                 COALESCE($9, 30), $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.camera_id)
    .bind(body.zone_id)
    .bind(&body.location_description)
    .bind(&body.camera_type)
    .bind(&body.resolution)
    .bind(body.is_recording)
    .bind(body.retention_days)
    .bind(&body.ip_address)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_camera(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCameraRequest>,
) -> Result<Json<SecurityCamera>, AppError> {
    require_permission(&claims, permissions::security::cctv::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityCamera>(
        "UPDATE security_cameras SET \
         name = COALESCE($2, name), \
         camera_id = COALESCE($3, camera_id), \
         zone_id = COALESCE($4, zone_id), \
         location_description = COALESCE($5, location_description), \
         camera_type = COALESCE($6, camera_type), \
         resolution = COALESCE($7, resolution), \
         is_recording = COALESCE($8, is_recording), \
         retention_days = COALESCE($9, retention_days), \
         ip_address = COALESCE($10, ip_address), \
         is_active = COALESCE($11, is_active) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.camera_id)
    .bind(body.zone_id)
    .bind(&body.location_description)
    .bind(&body.camera_type)
    .bind(&body.resolution)
    .bind(body.is_recording)
    .bind(body.retention_days)
    .bind(&body.ip_address)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Incidents
// ══════════════════════════════════════════════════════════

pub async fn list_incidents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListIncidentsQuery>,
) -> Result<Json<Vec<SecurityIncident>>, AppError> {
    require_permission(&claims, permissions::security::incidents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityIncident>(
        "SELECT * FROM security_incidents \
         WHERE ($1::text IS NULL OR severity::text = $1) \
         AND ($2::text IS NULL OR status::text = $2) \
         AND ($3::text IS NULL OR category = $3) \
         ORDER BY occurred_at DESC LIMIT 200",
    )
    .bind(&params.severity)
    .bind(&params.status)
    .bind(&params.category)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::security::incidents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row =
        sqlx::query_as::<_, SecurityIncident>("SELECT * FROM security_incidents WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIncidentRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::security::incidents::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let incident_number = format!(
        "SEC-{}-{}",
        Utc::now().format("%Y%m%d%H%M%S"),
        &Uuid::new_v4().to_string()[..6]
    );

    let row = sqlx::query_as::<_, SecurityIncident>(
        "INSERT INTO security_incidents \
         (tenant_id, incident_number, severity, category, zone_id, \
          location_description, occurred_at, description, persons_involved, \
          witnesses, camera_ids, video_timestamp_start, video_timestamp_end, \
          police_notified, police_report_number, reported_by, assigned_to) \
         VALUES ($1, $2, COALESCE($3, 'medium')::sec_incident_severity, $4, $5, \
                 $6, COALESCE($7, now()), $8, COALESCE($9, '[]'::jsonb), \
                 COALESCE($10, '[]'::jsonb), COALESCE($11, '[]'::jsonb), \
                 $12, $13, COALESCE($14, false), $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(&body.severity)
    .bind(&body.category)
    .bind(body.zone_id)
    .bind(&body.location_description)
    .bind(body.occurred_at)
    .bind(&body.description)
    .bind(&body.persons_involved)
    .bind(&body.witnesses)
    .bind(&body.camera_ids)
    .bind(&body.video_timestamp_start)
    .bind(&body.video_timestamp_end)
    .bind(body.police_notified)
    .bind(&body.police_report_number)
    .bind(claims.sub)
    .bind(body.assigned_to)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIncidentRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::security::incidents::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // If status is being set to resolved, auto-fill resolved_at/resolved_by
    let is_resolving = body.status.as_deref() == Some("resolved");

    let row = sqlx::query_as::<_, SecurityIncident>(
        "UPDATE security_incidents SET \
         severity = COALESCE($2::sec_incident_severity, severity), \
         status = COALESCE($3::sec_incident_status, status), \
         category = COALESCE($4, category), \
         zone_id = COALESCE($5, zone_id), \
         location_description = COALESCE($6, location_description), \
         description = COALESCE($7, description), \
         persons_involved = COALESCE($8, persons_involved), \
         witnesses = COALESCE($9, witnesses), \
         camera_ids = COALESCE($10, camera_ids), \
         video_timestamp_start = COALESCE($11, video_timestamp_start), \
         video_timestamp_end = COALESCE($12, video_timestamp_end), \
         police_notified = COALESCE($13, police_notified), \
         police_report_number = COALESCE($14, police_report_number), \
         investigation_notes = COALESCE($15, investigation_notes), \
         resolution = COALESCE($16, resolution), \
         resolved_at = CASE WHEN $17 THEN now() ELSE resolved_at END, \
         resolved_by = CASE WHEN $17 THEN $18 ELSE resolved_by END, \
         assigned_to = COALESCE($19, assigned_to) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.severity)
    .bind(&body.status)
    .bind(&body.category)
    .bind(body.zone_id)
    .bind(&body.location_description)
    .bind(&body.description)
    .bind(&body.persons_involved)
    .bind(&body.witnesses)
    .bind(&body.camera_ids)
    .bind(&body.video_timestamp_start)
    .bind(&body.video_timestamp_end)
    .bind(body.police_notified)
    .bind(&body.police_report_number)
    .bind(&body.investigation_notes)
    .bind(&body.resolution)
    .bind(is_resolving)
    .bind(claims.sub)
    .bind(body.assigned_to)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Patient Tags
// ══════════════════════════════════════════════════════════

pub async fn list_patient_tags(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPatientTagsQuery>,
) -> Result<Json<Vec<SecurityPatientTag>>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityPatientTag>(
        "SELECT * FROM security_patient_tags \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
         AND ($2::text IS NULL OR tag_type::text = $2) \
         AND ($3::text IS NULL OR alert_status::text = $3) \
         ORDER BY activated_at DESC LIMIT 200",
    )
    .bind(params.patient_id)
    .bind(&params.tag_type)
    .bind(&params.alert_status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_tag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePatientTagRequest>,
) -> Result<Json<SecurityPatientTag>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityPatientTag>(
        "INSERT INTO security_patient_tags \
         (tenant_id, patient_id, tag_type, tag_identifier, allowed_zone_id, \
          mother_id, admission_id, activated_by) \
         VALUES ($1, $2, $3::sec_patient_tag_type, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.tag_type)
    .bind(&body.tag_identifier)
    .bind(body.allowed_zone_id)
    .bind(body.mother_id)
    .bind(body.admission_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn deactivate_patient_tag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SecurityPatientTag>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityPatientTag>(
        "UPDATE security_patient_tags SET \
         alert_status = 'deactivated'::sec_tag_alert_status, \
         deactivated_at = now(), deactivated_by = $2 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Tag Alerts
// ══════════════════════════════════════════════════════════

pub async fn list_tag_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTagAlertsQuery>,
) -> Result<Json<Vec<SecurityTagAlert>>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityTagAlert>(
        "SELECT * FROM security_tag_alerts \
         WHERE ($1::uuid IS NULL OR tag_id = $1) \
         AND ($2::bool IS NULL OR is_resolved = $2) \
         ORDER BY triggered_at DESC LIMIT 200",
    )
    .bind(params.tag_id)
    .bind(params.is_resolved)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn resolve_tag_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveTagAlertRequest>,
) -> Result<Json<SecurityTagAlert>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityTagAlert>(
        "UPDATE security_tag_alerts SET \
         is_resolved = true, resolved_at = now(), resolved_by = $2, \
         was_false_alarm = COALESCE($3, false), \
         resolution_notes = $4 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(body.was_false_alarm)
    .bind(&body.resolution_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Code Debriefs
// ══════════════════════════════════════════════════════════

pub async fn list_debriefs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SecurityCodeDebrief>>, AppError> {
    require_permission(&claims, permissions::security::debriefs::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SecurityCodeDebrief>(
        "SELECT * FROM security_code_debriefs ORDER BY debrief_date DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_debrief(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SecurityCodeDebrief>, AppError> {
    require_permission(&claims, permissions::security::debriefs::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityCodeDebrief>(
        "SELECT * FROM security_code_debriefs WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_debrief(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDebriefRequest>,
) -> Result<Json<SecurityCodeDebrief>, AppError> {
    require_permission(&claims, permissions::security::debriefs::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SecurityCodeDebrief>(
        "INSERT INTO security_code_debriefs \
         (tenant_id, code_activation_id, debrief_date, facilitator_id, \
          attendees, response_time_seconds, total_duration_minutes, \
          what_went_well, what_went_wrong, root_cause, lessons_learned, \
          action_items, equipment_issues, training_gaps, \
          protocol_changes_recommended) \
         VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, \
                 COALESCE($5, '[]'::jsonb), $6, $7, \
                 $8, $9, $10, $11, \
                 COALESCE($12, '[]'::jsonb), $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.code_activation_id)
    .bind(body.debrief_date)
    .bind(body.facilitator_id)
    .bind(&body.attendees)
    .bind(body.response_time_seconds)
    .bind(body.total_duration_minutes)
    .bind(&body.what_went_well)
    .bind(&body.what_went_wrong)
    .bind(&body.root_cause)
    .bind(&body.lessons_learned)
    .bind(&body.action_items)
    .bind(&body.equipment_issues)
    .bind(&body.training_gaps)
    .bind(&body.protocol_changes_recommended)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
