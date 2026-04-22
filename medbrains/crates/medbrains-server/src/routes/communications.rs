#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::communications::{
    CommClinicalMessage, CommComplaint, CommCriticalAlert, CommFeedbackSurvey, CommMessage,
    CommTemplate,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
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
pub struct ListTemplatesQuery {
    pub channel: Option<String>,
    pub template_type: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub template_name: String,
    pub template_code: String,
    pub channel: String,
    pub template_type: String,
    pub subject: Option<String>,
    pub body_template: String,
    pub placeholders: Option<serde_json::Value>,
    pub language: Option<String>,
    pub is_active: Option<bool>,
    pub requires_approval: Option<bool>,
    pub external_template_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub template_name: Option<String>,
    pub channel: Option<String>,
    pub template_type: Option<String>,
    pub subject: Option<String>,
    pub body_template: Option<String>,
    pub placeholders: Option<serde_json::Value>,
    pub language: Option<String>,
    pub is_active: Option<bool>,
    pub requires_approval: Option<bool>,
    pub external_template_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListMessagesQuery {
    pub channel: Option<String>,
    pub status: Option<String>,
    pub recipient_type: Option<String>,
    pub context_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessageRequest {
    pub template_id: Option<Uuid>,
    pub channel: String,
    pub recipient_type: Option<String>,
    pub recipient_id: Option<Uuid>,
    pub recipient_name: Option<String>,
    pub recipient_contact: String,
    pub subject: Option<String>,
    pub body: String,
    pub scheduled_at: Option<String>,
    pub context_type: Option<String>,
    pub context_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMessageStatusRequest {
    pub status: String,
    pub failure_reason: Option<String>,
    pub external_message_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListClinicalQuery {
    pub sender_id: Option<Uuid>,
    pub recipient_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub priority: Option<String>,
    pub message_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalRequest {
    pub recipient_id: Uuid,
    pub recipient_department_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub priority: Option<String>,
    pub message_type: String,
    pub subject: Option<String>,
    pub body: String,
    pub sbar_data: Option<serde_json::Value>,
    pub is_urgent: Option<bool>,
    pub parent_message_id: Option<Uuid>,
    pub attachments: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListAlertsQuery {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub alert_source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAlertRequest {
    pub alert_source: String,
    pub source_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub department_id: Option<Uuid>,
    pub priority: Option<String>,
    pub title: String,
    pub description: String,
    pub alert_value: Option<String>,
    pub normal_range: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveAlertRequest {
    pub resolution_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListComplaintsQuery {
    pub status: Option<String>,
    pub source: Option<String>,
    pub severity: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateComplaintRequest {
    pub source: String,
    pub patient_id: Option<Uuid>,
    pub complainant_name: String,
    pub complainant_phone: Option<String>,
    pub complainant_email: Option<String>,
    pub department_id: Option<Uuid>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub subject: String,
    pub description: String,
    pub severity: Option<String>,
    pub sla_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateComplaintRequest {
    pub status: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub sla_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveComplaintRequest {
    pub resolution_notes: Option<String>,
    pub satisfaction_score: Option<i32>,
    pub service_recovery_action: Option<String>,
    pub service_recovery_cost: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct ListFeedbackQuery {
    pub feedback_type: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeedbackRequest {
    pub feedback_type: String,
    pub patient_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub overall_rating: Option<i32>,
    pub nps_score: Option<i32>,
    pub wait_time_rating: Option<i32>,
    pub staff_rating: Option<i32>,
    pub cleanliness_rating: Option<i32>,
    pub food_rating: Option<i32>,
    pub communication_rating: Option<i32>,
    pub discharge_rating: Option<i32>,
    pub would_recommend: Option<bool>,
    pub comments: Option<String>,
    pub suggestions: Option<String>,
    pub is_anonymous: Option<bool>,
    pub channel: Option<String>,
    pub survey_data: Option<serde_json::Value>,
    pub waiting_time_minutes: Option<i32>,
    pub collection_point: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeedbackStatsResponse {
    pub total_responses: i64,
    pub avg_overall: f64,
    pub avg_nps: f64,
    pub nps_score: f64,
    pub avg_wait_time: f64,
    pub avg_staff: f64,
    pub avg_cleanliness: f64,
    pub would_recommend_pct: f64,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Templates
// ══════════════════════════════════════════════════════════

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<CommTemplate>>, AppError> {
    require_permission(&claims, permissions::communications::config::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommTemplate>(
        "SELECT * FROM comm_templates \
         WHERE ($1::text IS NULL OR channel::text = $1) \
         AND ($2::text IS NULL OR template_type::text = $2) \
         AND ($3::bool IS NULL OR is_active = $3) \
         ORDER BY template_name LIMIT 200",
    )
    .bind(&params.channel)
    .bind(&params.template_type)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<CommTemplate>, AppError> {
    require_permission(&claims, permissions::communications::config::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommTemplate>(
        "INSERT INTO comm_templates \
         (tenant_id, template_name, template_code, channel, template_type, \
          subject, body_template, placeholders, language, is_active, \
          requires_approval, external_template_id, notes, created_by) \
         VALUES ($1,$2,$3,$4::comm_channel,$5::comm_template_type, \
                 $6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.template_name)
    .bind(&body.template_code)
    .bind(&body.channel)
    .bind(&body.template_type)
    .bind(&body.subject)
    .bind(&body.body_template)
    .bind(&body.placeholders)
    .bind(body.language.as_deref().unwrap_or("en"))
    .bind(body.is_active.unwrap_or(true))
    .bind(body.requires_approval.unwrap_or(false))
    .bind(&body.external_template_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> Result<Json<CommTemplate>, AppError> {
    require_permission(&claims, permissions::communications::config::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommTemplate>(
        "UPDATE comm_templates SET \
         template_name = COALESCE($2, template_name), \
         channel = COALESCE($3::comm_channel, channel), \
         template_type = COALESCE($4::comm_template_type, template_type), \
         subject = COALESCE($5, subject), \
         body_template = COALESCE($6, body_template), \
         placeholders = COALESCE($7, placeholders), \
         language = COALESCE($8, language), \
         is_active = COALESCE($9, is_active), \
         requires_approval = COALESCE($10, requires_approval), \
         external_template_id = COALESCE($11, external_template_id), \
         notes = COALESCE($12, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.template_name)
    .bind(&body.channel)
    .bind(&body.template_type)
    .bind(&body.subject)
    .bind(&body.body_template)
    .bind(&body.placeholders)
    .bind(&body.language)
    .bind(body.is_active)
    .bind(body.requires_approval)
    .bind(&body.external_template_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Messages
// ══════════════════════════════════════════════════════════

pub async fn list_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMessagesQuery>,
) -> Result<Json<Vec<CommMessage>>, AppError> {
    require_permission(&claims, permissions::communications::messages::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommMessage>(
        "SELECT * FROM comm_messages \
         WHERE ($1::text IS NULL OR channel::text = $1) \
         AND ($2::text IS NULL OR status::text = $2) \
         AND ($3::text IS NULL OR recipient_type = $3) \
         AND ($4::text IS NULL OR context_type = $4) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.channel)
    .bind(&params.status)
    .bind(&params.recipient_type)
    .bind(&params.context_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommMessage>, AppError> {
    require_permission(&claims, permissions::communications::messages::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommMessage>("SELECT * FROM comm_messages WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMessageRequest>,
) -> Result<Json<CommMessage>, AppError> {
    require_permission(&claims, permissions::communications::messages::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let message_code = format!("MSG-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, CommMessage>(
        "INSERT INTO comm_messages \
         (tenant_id, message_code, template_id, channel, recipient_type, \
          recipient_id, recipient_name, recipient_contact, subject, body, \
          context_type, context_id, sent_by) \
         VALUES ($1,$2,$3,$4::comm_channel,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&message_code)
    .bind(body.template_id)
    .bind(&body.channel)
    .bind(&body.recipient_type)
    .bind(body.recipient_id)
    .bind(&body.recipient_name)
    .bind(&body.recipient_contact)
    .bind(&body.subject)
    .bind(&body.body)
    .bind(&body.context_type)
    .bind(body.context_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_message_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMessageStatusRequest>,
) -> Result<Json<CommMessage>, AppError> {
    require_permission(&claims, permissions::communications::messages::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let ts_col = match body.status.as_str() {
        "sent" => "sent_at",
        "delivered" => "delivered_at",
        "read" => "read_at",
        "failed" => "failed_at",
        _ => "updated_at",
    };

    let query = format!(
        "UPDATE comm_messages SET \
         status = $2::comm_message_status, \
         {ts_col} = COALESCE({ts_col}, now()), \
         failure_reason = COALESCE($3, failure_reason), \
         external_message_id = COALESCE($4, external_message_id) \
         WHERE id = $1 RETURNING *"
    );

    let row = sqlx::query_as::<_, CommMessage>(&query)
        .bind(id)
        .bind(&body.status)
        .bind(&body.failure_reason)
        .bind(&body.external_message_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Clinical Messages
// ══════════════════════════════════════════════════════════

pub async fn list_clinical_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListClinicalQuery>,
) -> Result<Json<Vec<CommClinicalMessage>>, AppError> {
    require_permission(&claims, permissions::communications::clinical::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommClinicalMessage>(
        "SELECT * FROM comm_clinical_messages \
         WHERE ($1::uuid IS NULL OR sender_id = $1) \
         AND ($2::uuid IS NULL OR recipient_id = $2) \
         AND ($3::uuid IS NULL OR patient_id = $3) \
         AND ($4::text IS NULL OR priority::text = $4) \
         AND ($5::text IS NULL OR message_type = $5) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.sender_id)
    .bind(params.recipient_id)
    .bind(params.patient_id)
    .bind(&params.priority)
    .bind(&params.message_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_clinical_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommClinicalMessage>, AppError> {
    require_permission(&claims, permissions::communications::clinical::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommClinicalMessage>(
        "SELECT * FROM comm_clinical_messages WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_clinical_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateClinicalRequest>,
) -> Result<Json<CommClinicalMessage>, AppError> {
    require_permission(&claims, permissions::communications::clinical::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let message_code = format!("CLIN-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, CommClinicalMessage>(
        "INSERT INTO comm_clinical_messages \
         (tenant_id, message_code, sender_id, recipient_id, recipient_department_id, \
          patient_id, priority, message_type, subject, body, \
          sbar_data, is_urgent, parent_message_id, attachments) \
         VALUES ($1,$2,$3,$4,$5,$6,$7::comm_clinical_priority,$8,$9,$10,$11,$12,$13,$14) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&message_code)
    .bind(claims.sub)
    .bind(body.recipient_id)
    .bind(body.recipient_department_id)
    .bind(body.patient_id)
    .bind(body.priority.as_deref().unwrap_or("routine"))
    .bind(&body.message_type)
    .bind(&body.subject)
    .bind(&body.body)
    .bind(&body.sbar_data)
    .bind(body.is_urgent.unwrap_or(false))
    .bind(body.parent_message_id)
    .bind(&body.attachments)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn acknowledge_clinical_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommClinicalMessage>, AppError> {
    require_permission(&claims, permissions::communications::clinical::ACKNOWLEDGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommClinicalMessage>(
        "UPDATE comm_clinical_messages SET \
         is_read = TRUE, read_at = COALESCE(read_at, now()), \
         acknowledged_at = COALESCE(acknowledged_at, now()), \
         acknowledged_by = $2 \
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
//  Handlers — Critical Alerts
// ══════════════════════════════════════════════════════════

pub async fn list_critical_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAlertsQuery>,
) -> Result<Json<Vec<CommCriticalAlert>>, AppError> {
    require_permission(&claims, permissions::communications::alerts::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommCriticalAlert>(
        "SELECT * FROM comm_critical_alerts \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR priority::text = $2) \
         AND ($3::text IS NULL OR alert_source = $3) \
         ORDER BY triggered_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.priority)
    .bind(&params.alert_source)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_critical_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAlertRequest>,
) -> Result<Json<CommCriticalAlert>, AppError> {
    require_permission(&claims, permissions::communications::alerts::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let alert_code = format!("ALT-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, CommCriticalAlert>(
        "INSERT INTO comm_critical_alerts \
         (tenant_id, alert_code, alert_source, source_id, patient_id, \
          department_id, priority, title, description, alert_value, normal_range) \
         VALUES ($1,$2,$3,$4,$5,$6,$7::comm_clinical_priority,$8,$9,$10,$11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&alert_code)
    .bind(&body.alert_source)
    .bind(body.source_id)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(body.priority.as_deref().unwrap_or("critical"))
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.alert_value)
    .bind(&body.normal_range)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn acknowledge_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommCriticalAlert>, AppError> {
    require_permission(&claims, permissions::communications::alerts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommCriticalAlert>(
        "UPDATE comm_critical_alerts SET \
         status = 'acknowledged', \
         acknowledged_at = COALESCE(acknowledged_at, now()), \
         acknowledged_by = $2 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn resolve_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveAlertRequest>,
) -> Result<Json<CommCriticalAlert>, AppError> {
    require_permission(&claims, permissions::communications::alerts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommCriticalAlert>(
        "UPDATE comm_critical_alerts SET \
         status = 'resolved', \
         resolved_at = COALESCE(resolved_at, now()), \
         resolved_by = $2, \
         resolution_notes = COALESCE($3, resolution_notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.resolution_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Complaints
// ══════════════════════════════════════════════════════════

pub async fn list_complaints(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListComplaintsQuery>,
) -> Result<Json<Vec<CommComplaint>>, AppError> {
    require_permission(&claims, permissions::communications::complaints::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommComplaint>(
        "SELECT * FROM comm_complaints \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR source::text = $2) \
         AND ($3::text IS NULL OR severity = $3) \
         AND ($4::uuid IS NULL OR department_id = $4) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.source)
    .bind(&params.severity)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_complaint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateComplaintRequest>,
) -> Result<Json<CommComplaint>, AppError> {
    require_permission(&claims, permissions::communications::complaints::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let complaint_code = format!("GRV-{ts}-{}", &uid.to_string()[..8]);

    let sla_hours = body.sla_hours.unwrap_or(48);
    let sla_deadline = now + chrono::Duration::hours(i64::from(sla_hours));

    let row = sqlx::query_as::<_, CommComplaint>(
        "INSERT INTO comm_complaints \
         (tenant_id, complaint_code, source, patient_id, complainant_name, \
          complainant_phone, complainant_email, department_id, category, subcategory, \
          subject, description, severity, sla_hours, sla_deadline, created_by) \
         VALUES ($1,$2,$3::comm_complaint_source,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&complaint_code)
    .bind(&body.source)
    .bind(body.patient_id)
    .bind(&body.complainant_name)
    .bind(&body.complainant_phone)
    .bind(&body.complainant_email)
    .bind(body.department_id)
    .bind(&body.category)
    .bind(&body.subcategory)
    .bind(&body.subject)
    .bind(&body.description)
    .bind(body.severity.as_deref().unwrap_or("medium"))
    .bind(sla_hours)
    .bind(sla_deadline)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_complaint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateComplaintRequest>,
) -> Result<Json<CommComplaint>, AppError> {
    require_permission(&claims, permissions::communications::complaints::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommComplaint>(
        "UPDATE comm_complaints SET \
         status = COALESCE($2::comm_complaint_status, status), \
         assigned_to = COALESCE($3, assigned_to), \
         assigned_at = CASE WHEN $3 IS NOT NULL THEN COALESCE(assigned_at, now()) ELSE assigned_at END, \
         category = COALESCE($4, category), \
         severity = COALESCE($5, severity) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.assigned_to)
    .bind(&body.category)
    .bind(&body.severity)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn resolve_complaint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveComplaintRequest>,
) -> Result<Json<CommComplaint>, AppError> {
    require_permission(&claims, permissions::communications::complaints::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CommComplaint>(
        "UPDATE comm_complaints SET \
         status = 'resolved', \
         resolved_at = COALESCE(resolved_at, now()), \
         resolved_by = $2, \
         resolution_notes = COALESCE($3, resolution_notes), \
         satisfaction_score = COALESCE($4, satisfaction_score), \
         service_recovery_action = COALESCE($5, service_recovery_action), \
         service_recovery_cost = COALESCE($6, service_recovery_cost) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.resolution_notes)
    .bind(body.satisfaction_score)
    .bind(&body.service_recovery_action)
    .bind(body.service_recovery_cost)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Feedback
// ══════════════════════════════════════════════════════════

pub async fn list_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFeedbackQuery>,
) -> Result<Json<Vec<CommFeedbackSurvey>>, AppError> {
    require_permission(&claims, permissions::communications::feedback::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommFeedbackSurvey>(
        "SELECT * FROM comm_feedback_surveys \
         WHERE ($1::text IS NULL OR feedback_type::text = $1) \
         AND ($2::uuid IS NULL OR department_id = $2) \
         ORDER BY submitted_at DESC LIMIT 200",
    )
    .bind(&params.feedback_type)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFeedbackRequest>,
) -> Result<Json<CommFeedbackSurvey>, AppError> {
    require_permission(&claims, permissions::communications::feedback::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let feedback_code = format!("FB-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, CommFeedbackSurvey>(
        "INSERT INTO comm_feedback_surveys \
         (tenant_id, feedback_code, feedback_type, patient_id, department_id, doctor_id, \
          overall_rating, nps_score, wait_time_rating, staff_rating, cleanliness_rating, \
          food_rating, communication_rating, discharge_rating, would_recommend, \
          comments, suggestions, is_anonymous, channel, survey_data, \
          waiting_time_minutes, collection_point) \
         VALUES ($1,$2,$3::comm_feedback_type,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&feedback_code)
    .bind(&body.feedback_type)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(body.doctor_id)
    .bind(body.overall_rating)
    .bind(body.nps_score)
    .bind(body.wait_time_rating)
    .bind(body.staff_rating)
    .bind(body.cleanliness_rating)
    .bind(body.food_rating)
    .bind(body.communication_rating)
    .bind(body.discharge_rating)
    .bind(body.would_recommend)
    .bind(&body.comments)
    .bind(&body.suggestions)
    .bind(body.is_anonymous.unwrap_or(false))
    .bind(&body.channel)
    .bind(&body.survey_data)
    .bind(body.waiting_time_minutes)
    .bind(&body.collection_point)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, sqlx::FromRow)]
struct FeedbackStatsRow {
    total_responses: Option<i64>,
    avg_overall: Option<f64>,
    avg_nps: Option<f64>,
    promoters: Option<i64>,
    detractors: Option<i64>,
    avg_wait_time: Option<f64>,
    avg_staff: Option<f64>,
    avg_cleanliness: Option<f64>,
    recommend_yes: Option<i64>,
    recommend_total: Option<i64>,
}

pub async fn get_feedback_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFeedbackQuery>,
) -> Result<Json<FeedbackStatsResponse>, AppError> {
    require_permission(&claims, permissions::communications::feedback::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FeedbackStatsRow>(
        "SELECT \
         COUNT(*)::bigint AS total_responses, \
         AVG(overall_rating::float) AS avg_overall, \
         AVG(nps_score::float) AS avg_nps, \
         COUNT(*) FILTER (WHERE nps_score >= 9)::bigint AS promoters, \
         COUNT(*) FILTER (WHERE nps_score <= 6)::bigint AS detractors, \
         AVG(wait_time_rating::float) AS avg_wait_time, \
         AVG(staff_rating::float) AS avg_staff, \
         AVG(cleanliness_rating::float) AS avg_cleanliness, \
         COUNT(*) FILTER (WHERE would_recommend = TRUE)::bigint AS recommend_yes, \
         COUNT(*) FILTER (WHERE would_recommend IS NOT NULL)::bigint AS recommend_total \
         FROM comm_feedback_surveys \
         WHERE ($1::text IS NULL OR feedback_type::text = $1) \
         AND ($2::uuid IS NULL OR department_id = $2)",
    )
    .bind(&params.feedback_type)
    .bind(params.department_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total = row.total_responses.unwrap_or(0);
    let promoters = row.promoters.unwrap_or(0);
    let detractors = row.detractors.unwrap_or(0);
    let nps_score = if total > 0 {
        ((promoters - detractors) as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    let recommend_total = row.recommend_total.unwrap_or(0);
    let would_recommend_pct = if recommend_total > 0 {
        (row.recommend_yes.unwrap_or(0) as f64 / recommend_total as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(FeedbackStatsResponse {
        total_responses: total,
        avg_overall: row.avg_overall.unwrap_or(0.0),
        avg_nps: row.avg_nps.unwrap_or(0.0),
        nps_score,
        avg_wait_time: row.avg_wait_time.unwrap_or(0.0),
        avg_staff: row.avg_staff.unwrap_or(0.0),
        avg_cleanliness: row.avg_cleanliness.unwrap_or(0.0),
        would_recommend_pct,
    }))
}
