#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    middleware::client_ip::ClientIp, state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query / Response types
// ══════════════════════════════════════════════════════════

// ── Programs ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListProgramsQuery {
    pub program_type: Option<String>,
    pub is_active: Option<bool>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProgramRequest {
    pub name: String,
    pub code: String,
    pub program_type: String,
    pub description: Option<String>,
    pub protocol_id: Option<Uuid>,
    pub default_duration_months: Option<i32>,
    pub target_outcomes: Option<serde_json::Value>,
    pub monitoring_schedule: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProgramRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub protocol_id: Option<Uuid>,
    pub default_duration_months: Option<i32>,
    pub target_outcomes: Option<serde_json::Value>,
    pub monitoring_schedule: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ChronicProgramRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub code: String,
    pub program_type: String,
    pub description: Option<String>,
    pub protocol_id: Option<Uuid>,
    pub default_duration_months: Option<i32>,
    pub target_outcomes: serde_json::Value,
    pub monitoring_schedule: serde_json::Value,
    pub is_active: bool,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

// ── Enrollments ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEnrollmentsQuery {
    pub program_type: Option<String>,
    pub status: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnrollmentRequest {
    pub patient_id: Uuid,
    pub program_id: Uuid,
    pub primary_doctor_id: Option<Uuid>,
    pub enrollment_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub diagnosis_id: Option<Uuid>,
    pub icd_code: Option<String>,
    pub target_overrides: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEnrollmentRequest {
    pub primary_doctor_id: Option<Uuid>,
    pub expected_end_date: Option<NaiveDate>,
    pub target_overrides: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEnrollmentStatusRequest {
    pub status: String,
    pub status_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ChronicEnrollmentRow {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub program_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub program_name: String,
    pub program_type: String,
    pub enrollment_date: NaiveDate,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    pub status: String,
    pub status_reason: Option<String>,
    pub primary_doctor_name: Option<String>,
    pub icd_code: Option<String>,
    pub notes: Option<String>,
    pub target_overrides: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<Utc>,
}

// ── Timeline ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TimelineQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub enrollment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTimelineEventRequest {
    pub patient_id: Uuid,
    pub enrollment_id: Option<Uuid>,
    pub prescription_item_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub event_type: String,
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub atc_code: Option<String>,
    pub catalog_item_id: Option<Uuid>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub previous_dosage: Option<String>,
    pub previous_frequency: Option<String>,
    pub change_reason: Option<String>,
    pub switched_from_drug: Option<String>,
    pub effective_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DrugTimelineRow {
    pub id: Uuid,
    pub event_type: String,
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub atc_code: Option<String>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub previous_dosage: Option<String>,
    pub previous_frequency: Option<String>,
    pub change_reason: Option<String>,
    pub switched_from_drug: Option<String>,
    pub effective_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub ordered_by_name: String,
    pub is_auto_generated: bool,
    pub enrollment_id: Option<Uuid>,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LabTimelinePoint {
    pub result_id: Uuid,
    pub parameter_name: String,
    pub value: String,
    pub numeric_value: Option<Decimal>,
    pub unit: Option<String>,
    pub flag: Option<String>,
    pub result_date: chrono::DateTime<Utc>,
    pub loinc_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LabSeriesGroup {
    pub parameter_name: String,
    pub loinc_code: Option<String>,
    pub unit: Option<String>,
    pub target_value: Option<Decimal>,
    pub data_points: Vec<LabTimelinePoint>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VitalTimelinePoint {
    pub id: Uuid,
    pub parameter: String,
    pub value: String,
    pub numeric_value: Option<Decimal>,
    pub recorded_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ActiveDrugRow {
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub started_date: NaiveDate,
}

#[derive(Debug, Clone, Serialize)]
pub struct DrugTimelineWithLabsResponse {
    pub medication_events: Vec<DrugTimelineRow>,
    pub lab_series: Vec<LabSeriesGroup>,
    pub vitals_series: Vec<VitalTimelinePoint>,
    pub active_drugs: Vec<ActiveDrugRow>,
}

// ── Adherence ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAdherenceQuery {
    pub event_type: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct RecordAdherenceRequest {
    pub patient_id: Uuid,
    pub enrollment_id: Uuid,
    pub event_type: String,
    pub event_date: Option<NaiveDate>,
    pub drug_name: Option<String>,
    pub appointment_id: Option<Uuid>,
    pub pharmacy_order_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AdherenceRow {
    pub id: Uuid,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub drug_name: Option<String>,
    pub recorded_by_name: String,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdherenceSummaryResponse {
    pub doses_taken: i64,
    pub doses_missed: i64,
    pub doses_late: i64,
    pub dose_adherence_pct: Decimal,
    pub refills_on_time: i64,
    pub refills_late: i64,
    pub refills_missed: i64,
    pub appointments_attended: i64,
    pub appointments_missed: i64,
    pub appointments_rescheduled: i64,
    pub by_month: Vec<MonthlyAdherence>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MonthlyAdherence {
    pub month: String,
    pub taken: i64,
    pub missed: i64,
    pub late: i64,
}

// ── Outcomes ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateOutcomeTargetRequest {
    pub patient_id: Uuid,
    pub enrollment_id: Option<Uuid>,
    pub parameter_name: String,
    pub loinc_code: Option<String>,
    pub target_value: Decimal,
    pub unit: String,
    pub comparison: String,
    pub effective_from: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOutcomeTargetRequest {
    pub target_value: Option<Decimal>,
    pub comparison: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct OutcomeTargetRow {
    pub id: Uuid,
    pub parameter_name: String,
    pub loinc_code: Option<String>,
    pub target_value: Decimal,
    pub unit: String,
    pub comparison: String,
    pub effective_from: NaiveDate,
    pub notes: Option<String>,
    pub enrollment_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OutcomeTargetWithActual {
    pub target: OutcomeTargetRow,
    pub latest_value: Option<Decimal>,
    pub latest_date: Option<chrono::DateTime<Utc>>,
    pub at_target: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OutcomeDashboardResponse {
    pub targets: Vec<OutcomeTargetWithActual>,
    pub adherence_rate: Option<Decimal>,
    pub enrollment_duration_days: Option<i64>,
    pub active_enrollments: i64,
}

// ── Interaction Alerts ───────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct InteractionAlertRow {
    pub id: Uuid,
    pub drug_a_name: String,
    pub drug_b_name: String,
    pub severity: String,
    pub description: Option<String>,
    pub management: Option<String>,
    pub status: String,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<chrono::DateTime<Utc>>,
    pub override_reason: Option<String>,
    pub detected_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AcknowledgeAlertRequest {
    pub status: String,
    pub override_reason: Option<String>,
}

// ── Treatment Summary ────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct TreatmentSummaryResponse {
    pub patient_name: String,
    pub uhid: String,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub active_diagnoses: Vec<DiagnosisSummary>,
    pub current_medications: Vec<ActiveDrugRow>,
    pub lab_trends: Vec<LabSeriesGroup>,
    pub targets: Vec<OutcomeTargetWithActual>,
    pub adherence_rate: Option<Decimal>,
    pub enrollments: Vec<EnrollmentSummary>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DiagnosisSummary {
    pub diagnosis_name: String,
    pub icd_code: Option<String>,
    pub diagnosed_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct EnrollmentSummary {
    pub program_name: String,
    pub enrollment_date: NaiveDate,
    pub status: String,
}

// ── Helpers ──────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct PatientDemographics {
    full_name: String,
    uhid: String,
    date_of_birth: Option<NaiveDate>,
    gender: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Programs
// ══════════════════════════════════════════════════════════

pub async fn list_programs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListProgramsQuery>,
) -> Result<Json<Vec<ChronicProgramRow>>, AppError> {
    require_permission(&claims, permissions::chronic::programs::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChronicProgramRow>(
        "SELECT * FROM chronic_programs \
         WHERE ($1::text IS NULL OR program_type::text = $1) \
         AND ($2::bool IS NULL OR is_active = $2) \
         AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%' OR code ILIKE '%' || $3 || '%') \
         ORDER BY name ASC LIMIT 200",
    )
    .bind(&params.program_type)
    .bind(params.is_active)
    .bind(&params.search)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_program(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    client_ip: Option<Extension<ClientIp>>,
    Json(body): Json<CreateProgramRequest>,
) -> Result<Json<ChronicProgramRow>, AppError> {
    require_permission(&claims, permissions::chronic::programs::CREATE)?;

    let mut tx = state.db.begin().await?;
    let ip_str = client_ip.map(|ip| ip.0.as_str());
    medbrains_db::pool::set_audit_context(
        &mut tx,
        &claims.tenant_id,
        &claims.sub,
        ip_str.as_deref(),
    )
    .await?;

    let row = sqlx::query_as::<_, ChronicProgramRow>(
        "INSERT INTO chronic_programs \
         (tenant_id, name, code, program_type, description, protocol_id, \
          default_duration_months, target_outcomes, monitoring_schedule, created_by) \
         VALUES ($1, $2, $3, $4::chronic_program_type, $5, $6, $7, \
                 COALESCE($8, '[]'::jsonb), COALESCE($9, '[]'::jsonb), $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.program_type)
    .bind(&body.description)
    .bind(body.protocol_id)
    .bind(body.default_duration_months)
    .bind(&body.target_outcomes)
    .bind(&body.monitoring_schedule)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_program(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProgramRequest>,
) -> Result<Json<ChronicProgramRow>, AppError> {
    require_permission(&claims, permissions::chronic::programs::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ChronicProgramRow>(
        "UPDATE chronic_programs SET \
         name = COALESCE($2, name), \
         description = COALESCE($3, description), \
         protocol_id = COALESCE($4, protocol_id), \
         default_duration_months = COALESCE($5, default_duration_months), \
         target_outcomes = COALESCE($6, target_outcomes), \
         monitoring_schedule = COALESCE($7, monitoring_schedule), \
         is_active = COALESCE($8, is_active) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.protocol_id)
    .bind(body.default_duration_months)
    .bind(&body.target_outcomes)
    .bind(&body.monitoring_schedule)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_program(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::programs::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM chronic_programs WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Enrollments
// ══════════════════════════════════════════════════════════

pub async fn list_enrollments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEnrollmentsQuery>,
) -> Result<Json<Vec<ChronicEnrollmentRow>>, AppError> {
    require_permission(&claims, permissions::chronic::enrollments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChronicEnrollmentRow>(
        "SELECT ce.id, ce.patient_id, ce.program_id, \
         (p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, \
         cp.name AS program_name, cp.program_type::text AS program_type, \
         ce.enrollment_date, ce.expected_end_date, ce.actual_end_date, \
         ce.status::text AS status, ce.status_reason, \
         u.full_name AS primary_doctor_name, \
         ce.icd_code, ce.notes, ce.target_overrides, ce.created_at \
         FROM chronic_enrollments ce \
         JOIN patients p ON p.id = ce.patient_id \
         JOIN chronic_programs cp ON cp.id = ce.program_id \
         LEFT JOIN users u ON u.id = ce.primary_doctor_id \
         WHERE ($1::text IS NULL OR cp.program_type::text = $1) \
         AND ($2::text IS NULL OR ce.status::text = $2) \
         AND ($3::uuid IS NULL OR ce.primary_doctor_id = $3) \
         AND ($4::text IS NULL OR (p.first_name || ' ' || p.last_name) ILIKE '%' || $4 || '%' OR p.uhid ILIKE '%' || $4 || '%') \
         ORDER BY ce.created_at DESC LIMIT 200",
    )
    .bind(&params.program_type)
    .bind(&params.status)
    .bind(params.doctor_id)
    .bind(&params.search)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn patient_enrollments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ChronicEnrollmentRow>>, AppError> {
    require_permission(&claims, permissions::chronic::enrollments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChronicEnrollmentRow>(
        "SELECT ce.id, ce.patient_id, ce.program_id, \
         (p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, \
         cp.name AS program_name, cp.program_type::text AS program_type, \
         ce.enrollment_date, ce.expected_end_date, ce.actual_end_date, \
         ce.status::text AS status, ce.status_reason, \
         u.full_name AS primary_doctor_name, \
         ce.icd_code, ce.notes, ce.target_overrides, ce.created_at \
         FROM chronic_enrollments ce \
         JOIN patients p ON p.id = ce.patient_id \
         JOIN chronic_programs cp ON cp.id = ce.program_id \
         LEFT JOIN users u ON u.id = ce.primary_doctor_id \
         WHERE ce.patient_id = $1 \
         ORDER BY ce.enrollment_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEnrollmentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::enrollments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IdRow>(
        "INSERT INTO chronic_enrollments \
         (tenant_id, patient_id, program_id, enrolled_by, primary_doctor_id, \
          enrollment_date, expected_end_date, diagnosis_id, icd_code, \
          target_overrides, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10, $11) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.program_id)
    .bind(claims.sub)
    .bind(body.primary_doctor_id)
    .bind(body.enrollment_date)
    .bind(body.expected_end_date)
    .bind(body.diagnosis_id)
    .bind(&body.icd_code)
    .bind(&body.target_overrides)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": row.id })))
}

#[derive(Debug, sqlx::FromRow)]
struct IdRow {
    id: Uuid,
}

pub async fn update_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEnrollmentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::enrollments::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE chronic_enrollments SET \
         primary_doctor_id = COALESCE($2, primary_doctor_id), \
         expected_end_date = COALESCE($3, expected_end_date), \
         target_overrides = COALESCE($4, target_overrides), \
         notes = COALESCE($5, notes) \
         WHERE id = $1",
    )
    .bind(id)
    .bind(body.primary_doctor_id)
    .bind(body.expected_end_date)
    .bind(&body.target_overrides)
    .bind(&body.notes)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "updated": true })))
}

pub async fn update_enrollment_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEnrollmentStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::enrollments::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now().date_naive();
    let end_date: Option<NaiveDate> = match body.status.as_str() {
        "completed" | "discontinued" | "transferred" | "lost_to_followup" | "deceased" => Some(now),
        _ => None,
    };

    sqlx::query(
        "UPDATE chronic_enrollments SET \
         status = $2::enrollment_status, \
         status_reason = $3, \
         actual_end_date = COALESCE($4, actual_end_date) \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.status_reason)
    .bind(end_date)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "updated": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Drug Timeline
// ══════════════════════════════════════════════════════════

pub async fn drug_timeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Query(params): Query<TimelineQuery>,
) -> Result<Json<Vec<DrugTimelineRow>>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DrugTimelineRow>(
        "SELECT mte.id, mte.event_type::text AS event_type, \
         mte.drug_name, mte.generic_name, mte.atc_code, \
         mte.dosage, mte.frequency, mte.route, \
         mte.previous_dosage, mte.previous_frequency, \
         mte.change_reason, mte.switched_from_drug, \
         mte.effective_date, mte.end_date, \
         u.full_name AS ordered_by_name, \
         mte.is_auto_generated, mte.enrollment_id, mte.created_at \
         FROM medication_timeline_events mte \
         JOIN users u ON u.id = mte.ordered_by \
         WHERE mte.patient_id = $1 \
         AND ($2::date IS NULL OR mte.effective_date >= $2) \
         AND ($3::date IS NULL OR mte.effective_date <= $3) \
         AND ($4::uuid IS NULL OR mte.enrollment_id = $4) \
         ORDER BY mte.effective_date ASC, mte.created_at ASC",
    )
    .bind(patient_id)
    .bind(params.from_date)
    .bind(params.to_date)
    .bind(params.enrollment_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn drug_timeline_with_labs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Query(params): Query<TimelineQuery>,
) -> Result<Json<DrugTimelineWithLabsResponse>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // 1. Medication timeline events
    let med_events = sqlx::query_as::<_, DrugTimelineRow>(
        "SELECT mte.id, mte.event_type::text AS event_type, \
         mte.drug_name, mte.generic_name, mte.atc_code, \
         mte.dosage, mte.frequency, mte.route, \
         mte.previous_dosage, mte.previous_frequency, \
         mte.change_reason, mte.switched_from_drug, \
         mte.effective_date, mte.end_date, \
         u.full_name AS ordered_by_name, \
         mte.is_auto_generated, mte.enrollment_id, mte.created_at \
         FROM medication_timeline_events mte \
         JOIN users u ON u.id = mte.ordered_by \
         WHERE mte.patient_id = $1 \
         AND ($2::date IS NULL OR mte.effective_date >= $2) \
         AND ($3::date IS NULL OR mte.effective_date <= $3) \
         ORDER BY mte.effective_date ASC, mte.created_at ASC",
    )
    .bind(patient_id)
    .bind(params.from_date)
    .bind(params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    // 2. Lab results
    let lab_points = sqlx::query_as::<_, LabTimelinePoint>(
        "SELECT lr.id AS result_id, lr.parameter_name, \
         lr.value, lr.numeric_value, lr.unit, lr.flag, \
         lr.created_at AS result_date, ltc.loinc_code \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id \
         LEFT JOIN lab_test_catalog ltc ON ltc.id = lo.test_id \
         WHERE lo.patient_id = $1 \
         AND lo.status IN ('completed', 'verified') \
         AND ($2::date IS NULL OR lr.created_at::date >= $2) \
         AND ($3::date IS NULL OR lr.created_at::date <= $3) \
         ORDER BY lr.created_at ASC",
    )
    .bind(patient_id)
    .bind(params.from_date)
    .bind(params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    // 3. Vitals (BP, weight, etc.)
    let vitals = sqlx::query_as::<_, VitalTimelinePoint>(
        "SELECT v.id, \
         CASE WHEN v.systolic_bp IS NOT NULL THEN 'Blood Pressure' \
              WHEN v.weight_kg IS NOT NULL THEN 'Weight' \
              ELSE 'Heart Rate' END AS parameter, \
         CASE WHEN v.systolic_bp IS NOT NULL \
              THEN v.systolic_bp::text || '/' || COALESCE(v.diastolic_bp::text, '-') \
              WHEN v.weight_kg IS NOT NULL THEN v.weight_kg::text \
              ELSE v.heart_rate::text END AS value, \
         COALESCE(v.systolic_bp, v.weight_kg, v.heart_rate::numeric) AS numeric_value, \
         v.recorded_at \
         FROM vitals v \
         JOIN encounters e ON e.id = v.encounter_id \
         WHERE e.patient_id = $1 \
         AND ($2::date IS NULL OR v.recorded_at::date >= $2) \
         AND ($3::date IS NULL OR v.recorded_at::date <= $3) \
         AND (v.systolic_bp IS NOT NULL OR v.weight_kg IS NOT NULL OR v.heart_rate IS NOT NULL) \
         ORDER BY v.recorded_at ASC",
    )
    .bind(patient_id)
    .bind(params.from_date)
    .bind(params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    // 4. Outcome targets for reference lines
    let targets = sqlx::query_as::<_, OutcomeTargetRow>(
        "SELECT id, parameter_name, loinc_code, target_value, unit, comparison, \
         effective_from, notes, enrollment_id \
         FROM patient_outcome_targets WHERE patient_id = $1 \
         ORDER BY parameter_name",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // 5. Currently active drugs
    let active_drugs = sqlx::query_as::<_, ActiveDrugRow>(
        "SELECT DISTINCT ON (drug_name) \
         drug_name, generic_name, dosage, frequency, route, \
         effective_date AS started_date \
         FROM medication_timeline_events \
         WHERE patient_id = $1 \
         AND event_type IN ('started', 'resumed', 'dose_changed') \
         AND NOT EXISTS ( \
           SELECT 1 FROM medication_timeline_events mte2 \
           WHERE mte2.patient_id = medication_timeline_events.patient_id \
           AND mte2.drug_name = medication_timeline_events.drug_name \
           AND mte2.event_type IN ('discontinued', 'switched') \
           AND mte2.effective_date > medication_timeline_events.effective_date \
         ) \
         ORDER BY drug_name, effective_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Group lab results by parameter_name
    let mut lab_map: std::collections::HashMap<String, Vec<LabTimelinePoint>> =
        std::collections::HashMap::new();
    for point in lab_points {
        lab_map
            .entry(point.parameter_name.clone())
            .or_default()
            .push(point);
    }

    let lab_series: Vec<LabSeriesGroup> = lab_map
        .into_iter()
        .map(|(param_name, points)| {
            let loinc = points.first().and_then(|p| p.loinc_code.clone());
            let unit = points.first().and_then(|p| p.unit.clone());
            let target_val = targets
                .iter()
                .find(|t| {
                    t.parameter_name.eq_ignore_ascii_case(&param_name)
                        || t.loinc_code.as_deref() == loinc.as_deref()
                })
                .map(|t| t.target_value);

            LabSeriesGroup {
                parameter_name: param_name,
                loinc_code: loinc,
                unit,
                target_value: target_val,
                data_points: points,
            }
        })
        .collect();

    Ok(Json(DrugTimelineWithLabsResponse {
        medication_events: med_events,
        lab_series,
        vitals_series: vitals,
        active_drugs,
    }))
}

pub async fn create_timeline_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTimelineEventRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IdRow>(
        "INSERT INTO medication_timeline_events \
         (tenant_id, patient_id, enrollment_id, prescription_item_id, encounter_id, \
          event_type, drug_name, generic_name, atc_code, catalog_item_id, \
          dosage, frequency, route, \
          previous_dosage, previous_frequency, change_reason, switched_from_drug, \
          ordered_by, effective_date, end_date) \
         VALUES ($1, $2, $3, $4, $5, $6::medication_event_type, $7, $8, $9, $10, \
                 $11, $12, $13, $14, $15, $16, $17, $18, \
                 COALESCE($19, CURRENT_DATE), $20) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.enrollment_id)
    .bind(body.prescription_item_id)
    .bind(body.encounter_id)
    .bind(&body.event_type)
    .bind(&body.drug_name)
    .bind(&body.generic_name)
    .bind(&body.atc_code)
    .bind(body.catalog_item_id)
    .bind(&body.dosage)
    .bind(&body.frequency)
    .bind(&body.route)
    .bind(&body.previous_dosage)
    .bind(&body.previous_frequency)
    .bind(&body.change_reason)
    .bind(&body.switched_from_drug)
    .bind(claims.sub)
    .bind(body.effective_date)
    .bind(body.end_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": row.id })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Adherence
// ══════════════════════════════════════════════════════════

pub async fn list_adherence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(enrollment_id): Path<Uuid>,
    Query(params): Query<ListAdherenceQuery>,
) -> Result<Json<Vec<AdherenceRow>>, AppError> {
    require_permission(&claims, permissions::chronic::adherence::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AdherenceRow>(
        "SELECT ar.id, ar.event_type::text AS event_type, ar.event_date, \
         ar.drug_name, u.full_name AS recorded_by_name, ar.notes, ar.created_at \
         FROM adherence_records ar \
         JOIN users u ON u.id = ar.recorded_by \
         WHERE ar.enrollment_id = $1 \
         AND ($2::text IS NULL OR ar.event_type::text = $2) \
         AND ($3::date IS NULL OR ar.event_date >= $3) \
         AND ($4::date IS NULL OR ar.event_date <= $4) \
         ORDER BY ar.event_date DESC LIMIT 500",
    )
    .bind(enrollment_id)
    .bind(&params.event_type)
    .bind(params.from_date)
    .bind(params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn record_adherence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordAdherenceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::adherence::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IdRow>(
        "INSERT INTO adherence_records \
         (tenant_id, patient_id, enrollment_id, event_type, event_date, \
          drug_name, appointment_id, pharmacy_order_id, recorded_by, notes) \
         VALUES ($1, $2, $3, $4::adherence_event_type, COALESCE($5, CURRENT_DATE), \
                 $6, $7, $8, $9, $10) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.enrollment_id)
    .bind(&body.event_type)
    .bind(body.event_date)
    .bind(&body.drug_name)
    .bind(body.appointment_id)
    .bind(body.pharmacy_order_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": row.id })))
}

pub async fn adherence_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(enrollment_id): Path<Uuid>,
) -> Result<Json<AdherenceSummaryResponse>, AppError> {
    require_permission(&claims, permissions::chronic::adherence::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Count by event type
    #[derive(Debug, sqlx::FromRow)]
    struct EventCount {
        event_type: String,
        count: i64,
    }

    let counts = sqlx::query_as::<_, EventCount>(
        "SELECT event_type::text AS event_type, COUNT(*) AS count \
         FROM adherence_records WHERE enrollment_id = $1 \
         GROUP BY event_type",
    )
    .bind(enrollment_id)
    .fetch_all(&mut *tx)
    .await?;

    let get_count = |et: &str| -> i64 {
        counts
            .iter()
            .find(|c| c.event_type == et)
            .map_or(0, |c| c.count)
    };

    let doses_taken = get_count("dose_taken");
    let doses_missed = get_count("dose_missed");
    let doses_late = get_count("dose_late");
    let total_doses = doses_taken + doses_missed + doses_late;
    let dose_adherence_pct = if total_doses > 0 {
        Decimal::from(doses_taken * 100) / Decimal::from(total_doses)
    } else {
        Decimal::ZERO
    };

    // Monthly breakdown
    let by_month = sqlx::query_as::<_, MonthlyAdherence>(
        "SELECT to_char(event_date, 'YYYY-MM') AS month, \
         COUNT(*) FILTER (WHERE event_type = 'dose_taken') AS taken, \
         COUNT(*) FILTER (WHERE event_type = 'dose_missed') AS missed, \
         COUNT(*) FILTER (WHERE event_type = 'dose_late') AS late \
         FROM adherence_records WHERE enrollment_id = $1 \
         AND event_type IN ('dose_taken', 'dose_missed', 'dose_late') \
         GROUP BY to_char(event_date, 'YYYY-MM') \
         ORDER BY month DESC LIMIT 12",
    )
    .bind(enrollment_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AdherenceSummaryResponse {
        doses_taken,
        doses_missed,
        doses_late,
        dose_adherence_pct,
        refills_on_time: get_count("refill_on_time"),
        refills_late: get_count("refill_late"),
        refills_missed: get_count("refill_missed"),
        appointments_attended: get_count("appointment_attended"),
        appointments_missed: get_count("appointment_missed"),
        appointments_rescheduled: get_count("appointment_rescheduled"),
        by_month,
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Outcome Targets
// ══════════════════════════════════════════════════════════

pub async fn list_outcome_targets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<OutcomeTargetRow>>, AppError> {
    require_permission(&claims, permissions::chronic::outcomes::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OutcomeTargetRow>(
        "SELECT id, parameter_name, loinc_code, target_value, unit, comparison, \
         effective_from, notes, enrollment_id \
         FROM patient_outcome_targets WHERE patient_id = $1 \
         ORDER BY parameter_name",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_outcome_target(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOutcomeTargetRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::outcomes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IdRow>(
        "INSERT INTO patient_outcome_targets \
         (tenant_id, patient_id, enrollment_id, parameter_name, loinc_code, \
          target_value, unit, comparison, set_by, effective_from, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, CURRENT_DATE), $11) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.enrollment_id)
    .bind(&body.parameter_name)
    .bind(&body.loinc_code)
    .bind(body.target_value)
    .bind(&body.unit)
    .bind(&body.comparison)
    .bind(claims.sub)
    .bind(body.effective_from)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": row.id })))
}

pub async fn update_outcome_target(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOutcomeTargetRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::outcomes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE patient_outcome_targets SET \
         target_value = COALESCE($2, target_value), \
         comparison = COALESCE($3, comparison), \
         notes = COALESCE($4, notes) \
         WHERE id = $1",
    )
    .bind(id)
    .bind(body.target_value)
    .bind(&body.comparison)
    .bind(&body.notes)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "updated": true })))
}

pub async fn outcome_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<OutcomeDashboardResponse>, AppError> {
    require_permission(&claims, permissions::chronic::outcomes::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get targets
    let targets = sqlx::query_as::<_, OutcomeTargetRow>(
        "SELECT id, parameter_name, loinc_code, target_value, unit, comparison, \
         effective_from, notes, enrollment_id \
         FROM patient_outcome_targets WHERE patient_id = $1 \
         ORDER BY parameter_name",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // For each target, fetch latest lab value
    let mut targets_with_actuals: Vec<OutcomeTargetWithActual> = Vec::new();
    for target in &targets {
        #[derive(Debug, sqlx::FromRow)]
        struct LatestResult {
            numeric_value: Option<Decimal>,
            created_at: chrono::DateTime<Utc>,
        }

        let latest = sqlx::query_as::<_, LatestResult>(
            "SELECT lr.numeric_value, lr.created_at \
             FROM lab_results lr \
             JOIN lab_orders lo ON lo.id = lr.order_id \
             LEFT JOIN lab_test_catalog ltc ON ltc.id = lo.test_id \
             WHERE lo.patient_id = $1 \
             AND lo.status IN ('completed', 'verified') \
             AND (lr.parameter_name ILIKE $2 OR ltc.loinc_code = $3) \
             AND lr.numeric_value IS NOT NULL \
             ORDER BY lr.created_at DESC LIMIT 1",
        )
        .bind(patient_id)
        .bind(&target.parameter_name)
        .bind(&target.loinc_code)
        .fetch_optional(&mut *tx)
        .await?;

        let at_target = latest.as_ref().and_then(|l| {
            l.numeric_value.map(|val| match target.comparison.as_str() {
                "<" => val < target.target_value,
                "<=" => val <= target.target_value,
                "=" => val == target.target_value,
                ">=" => val >= target.target_value,
                ">" => val > target.target_value,
                _ => false,
            })
        });

        targets_with_actuals.push(OutcomeTargetWithActual {
            target: target.clone(),
            latest_value: latest.as_ref().and_then(|l| l.numeric_value),
            latest_date: latest.as_ref().map(|l| l.created_at),
            at_target,
        });
    }

    // Adherence rate across all enrollments
    let adherence = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) FILTER (WHERE event_type = 'dose_taken') AS count \
         FROM adherence_records WHERE patient_id = $1",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_doses = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM adherence_records \
         WHERE patient_id = $1 AND event_type IN ('dose_taken', 'dose_missed', 'dose_late')",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let adherence_rate = match (adherence.count, total_doses.count) {
        (Some(taken), Some(total)) if total > 0 => {
            Some(Decimal::from(taken * 100) / Decimal::from(total))
        }
        _ => None,
    };

    // Active enrollments count
    let active = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM chronic_enrollments \
         WHERE patient_id = $1 AND status = 'active'",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    // Enrollment duration (earliest active enrollment)
    #[derive(Debug, sqlx::FromRow)]
    struct DateRow {
        enrollment_date: Option<NaiveDate>,
    }
    let earliest = sqlx::query_as::<_, DateRow>(
        "SELECT MIN(enrollment_date) AS enrollment_date FROM chronic_enrollments \
         WHERE patient_id = $1 AND status = 'active'",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let duration_days = earliest
        .enrollment_date
        .map(|d| (Utc::now().date_naive() - d).num_days());

    tx.commit().await?;

    Ok(Json(OutcomeDashboardResponse {
        targets: targets_with_actuals,
        adherence_rate,
        enrollment_duration_days: duration_days,
        active_enrollments: active.count.unwrap_or(0),
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Interaction Alerts
// ══════════════════════════════════════════════════════════

pub async fn list_interaction_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<InteractionAlertRow>>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InteractionAlertRow>(
        "SELECT id, drug_a_name, drug_b_name, severity, description, management, \
         status, acknowledged_by, acknowledged_at, override_reason, detected_at \
         FROM polypharmacy_interaction_alerts \
         WHERE patient_id = $1 \
         ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, detected_at DESC \
         LIMIT 100",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn check_polypharmacy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<InteractionAlertRow>>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get active drugs from timeline
    let active_drugs = sqlx::query_as::<_, ActiveDrugRow>(
        "SELECT DISTINCT ON (drug_name) \
         drug_name, generic_name, dosage, frequency, route, \
         effective_date AS started_date \
         FROM medication_timeline_events \
         WHERE patient_id = $1 \
         AND event_type IN ('started', 'resumed', 'dose_changed') \
         AND NOT EXISTS ( \
           SELECT 1 FROM medication_timeline_events mte2 \
           WHERE mte2.patient_id = medication_timeline_events.patient_id \
           AND mte2.drug_name = medication_timeline_events.drug_name \
           AND mte2.event_type IN ('discontinued', 'switched') \
           AND mte2.effective_date > medication_timeline_events.effective_date \
         ) \
         ORDER BY drug_name, effective_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Cross-check against drug_interactions table
    let mut new_alerts: Vec<InteractionAlertRow> = Vec::new();

    for (i, drug_a) in active_drugs.iter().enumerate() {
        for drug_b in active_drugs.iter().skip(i + 1) {
            #[derive(Debug, sqlx::FromRow)]
            struct InteractionRow {
                id: Uuid,
                severity: String,
                description: Option<String>,
                management: Option<String>,
            }

            let interaction = sqlx::query_as::<_, InteractionRow>(
                "SELECT id, severity, description, management FROM drug_interactions \
                 WHERE (drug_a_name ILIKE $1 AND drug_b_name ILIKE $2) \
                 OR (drug_a_name ILIKE $2 AND drug_b_name ILIKE $1) \
                 LIMIT 1",
            )
            .bind(&drug_a.drug_name)
            .bind(&drug_b.drug_name)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(inter) = interaction {
                // Check if alert already exists (avoid duplicates)
                let exists = sqlx::query_as::<_, CountRow>(
                    "SELECT COUNT(*) AS count FROM polypharmacy_interaction_alerts \
                     WHERE patient_id = $1 AND interaction_id = $2 \
                     AND status IN ('active', 'acknowledged')",
                )
                .bind(patient_id)
                .bind(inter.id)
                .fetch_one(&mut *tx)
                .await?;

                if exists.count.unwrap_or(0) == 0 {
                    let alert = sqlx::query_as::<_, InteractionAlertRow>(
                        "INSERT INTO polypharmacy_interaction_alerts \
                         (tenant_id, patient_id, drug_a_name, drug_b_name, \
                          interaction_id, severity, description, management) \
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                         RETURNING id, drug_a_name, drug_b_name, severity, description, \
                         management, status, acknowledged_by, acknowledged_at, \
                         override_reason, detected_at",
                    )
                    .bind(claims.tenant_id)
                    .bind(patient_id)
                    .bind(&drug_a.drug_name)
                    .bind(&drug_b.drug_name)
                    .bind(inter.id)
                    .bind(&inter.severity)
                    .bind(&inter.description)
                    .bind(&inter.management)
                    .fetch_one(&mut *tx)
                    .await?;

                    new_alerts.push(alert);
                }
            }
        }
    }

    tx.commit().await?;
    Ok(Json(new_alerts))
}

pub async fn acknowledge_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AcknowledgeAlertRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE polypharmacy_interaction_alerts SET \
         status = $2, acknowledged_by = $3, acknowledged_at = now(), \
         override_reason = $4, \
         resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.status)
    .bind(claims.sub)
    .bind(&body.override_reason)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "updated": true })))
}

// ══════════════════════════════════════════════════════════
//  Handler — Treatment Summary
// ══════════════════════════════════════════════════════════

pub async fn treatment_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<TreatmentSummaryResponse>, AppError> {
    require_permission(&claims, permissions::chronic::timeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Patient demographics
    let patient = sqlx::query_as::<_, PatientDemographics>(
        "SELECT full_name, uhid, date_of_birth, gender::text AS gender \
         FROM patients WHERE id = $1",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    // Active diagnoses
    let diagnoses = sqlx::query_as::<_, DiagnosisSummary>(
        "SELECT d.diagnosis_name, d.icd_code, d.diagnosed_date \
         FROM diagnoses d \
         WHERE d.patient_id = $1 AND d.is_active = true \
         ORDER BY d.diagnosed_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Current medications
    let meds = sqlx::query_as::<_, ActiveDrugRow>(
        "SELECT DISTINCT ON (drug_name) \
         drug_name, generic_name, dosage, frequency, route, \
         effective_date AS started_date \
         FROM medication_timeline_events \
         WHERE patient_id = $1 \
         AND event_type IN ('started', 'resumed', 'dose_changed') \
         AND NOT EXISTS ( \
           SELECT 1 FROM medication_timeline_events mte2 \
           WHERE mte2.patient_id = medication_timeline_events.patient_id \
           AND mte2.drug_name = medication_timeline_events.drug_name \
           AND mte2.event_type IN ('discontinued', 'switched') \
           AND mte2.effective_date > medication_timeline_events.effective_date \
         ) \
         ORDER BY drug_name, effective_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Lab trends (last 6 per monitored parameter)
    let lab_points = sqlx::query_as::<_, LabTimelinePoint>(
        "SELECT lr.id AS result_id, lr.parameter_name, \
         lr.value, lr.numeric_value, lr.unit, lr.flag, \
         lr.created_at AS result_date, ltc.loinc_code \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id \
         LEFT JOIN lab_test_catalog ltc ON ltc.id = lo.test_id \
         WHERE lo.patient_id = $1 \
         AND lo.status IN ('completed', 'verified') \
         AND lr.numeric_value IS NOT NULL \
         ORDER BY lr.created_at DESC LIMIT 200",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Targets
    let targets = sqlx::query_as::<_, OutcomeTargetRow>(
        "SELECT id, parameter_name, loinc_code, target_value, unit, comparison, \
         effective_from, notes, enrollment_id \
         FROM patient_outcome_targets WHERE patient_id = $1",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Adherence rate
    let taken = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) FILTER (WHERE event_type = 'dose_taken') AS count \
         FROM adherence_records WHERE patient_id = $1",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let total = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM adherence_records \
         WHERE patient_id = $1 AND event_type IN ('dose_taken', 'dose_missed', 'dose_late')",
    )
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let adherence_rate = match (taken.count, total.count) {
        (Some(t), Some(tot)) if tot > 0 => Some(Decimal::from(t * 100) / Decimal::from(tot)),
        _ => None,
    };

    // Enrollment summaries
    let enrollments = sqlx::query_as::<_, EnrollmentSummary>(
        "SELECT cp.name AS program_name, ce.enrollment_date, ce.status::text AS status \
         FROM chronic_enrollments ce \
         JOIN chronic_programs cp ON cp.id = ce.program_id \
         WHERE ce.patient_id = $1 \
         ORDER BY ce.enrollment_date DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Group lab results
    let mut lab_map: std::collections::HashMap<String, Vec<LabTimelinePoint>> =
        std::collections::HashMap::new();
    for point in lab_points {
        lab_map
            .entry(point.parameter_name.clone())
            .or_default()
            .push(point);
    }

    // Keep only last 6 per series
    let lab_trends: Vec<LabSeriesGroup> = lab_map
        .into_iter()
        .map(|(param_name, mut points)| {
            points.truncate(6);
            points.reverse(); // chronological
            let loinc = points.first().and_then(|p| p.loinc_code.clone());
            let unit = points.first().and_then(|p| p.unit.clone());
            let target_val = targets
                .iter()
                .find(|t| t.parameter_name.eq_ignore_ascii_case(&param_name))
                .map(|t| t.target_value);

            LabSeriesGroup {
                parameter_name: param_name,
                loinc_code: loinc,
                unit,
                target_value: target_val,
                data_points: points,
            }
        })
        .collect();

    // Build targets with actuals
    let targets_with_actuals: Vec<OutcomeTargetWithActual> = targets
        .into_iter()
        .map(|t| {
            let series = lab_trends
                .iter()
                .find(|s| s.parameter_name.eq_ignore_ascii_case(&t.parameter_name));
            let latest = series.and_then(|s| s.data_points.last());
            let latest_val = latest.and_then(|l| l.numeric_value);
            let latest_dt = latest.map(|l| l.result_date);
            let at = latest_val.map(|val| match t.comparison.as_str() {
                "<" => val < t.target_value,
                "<=" => val <= t.target_value,
                "=" => val == t.target_value,
                ">=" => val >= t.target_value,
                ">" => val > t.target_value,
                _ => false,
            });

            OutcomeTargetWithActual {
                target: t,
                latest_value: latest_val,
                latest_date: latest_dt,
                at_target: at,
            }
        })
        .collect();

    Ok(Json(TreatmentSummaryResponse {
        patient_name: patient.full_name,
        uhid: patient.uhid,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        active_diagnoses: diagnoses,
        current_medications: meds,
        lab_trends,
        targets: targets_with_actuals,
        adherence_rate,
        enrollments,
    }))
}
