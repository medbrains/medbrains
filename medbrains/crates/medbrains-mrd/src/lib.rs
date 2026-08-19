#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, NaiveTime, Utc};
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::mrd::{
    MrdBirthRegister, MrdCaseSheetPacket, MrdCaseSheetPage, MrdDeathRegister, MrdFormRecord,
    MrdMedicalRecord, MrdRecordMovement, MrdRetentionPolicy, MrdStorageLocation,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get,post,put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{require_any_permission, require_permission};
use medbrains_server_core::state::AppState;

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Medical Records ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRecordsQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub record_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecordRequest {
    pub patient_id: Uuid,
    pub record_number: Option<String>,
    pub record_type: Option<String>,
    pub volume_number: Option<i32>,
    pub total_pages: Option<i32>,
    pub shelf_location: Option<String>,
    pub retention_years: Option<i32>,
    pub destruction_due_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRecordRequest {
    pub volume_number: Option<i32>,
    pub total_pages: Option<i32>,
    pub shelf_location: Option<String>,
    pub status: Option<String>,
    pub retention_years: Option<i32>,
    pub destruction_due_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

// ── Movements ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct IssueRecordRequest {
    pub issued_to_user_id: Option<Uuid>,
    pub issued_to_department_id: Option<Uuid>,
    pub purpose: Option<String>,
    pub due_days: Option<i32>,
    pub notes: Option<String>,
}

// ── Birth Register ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListBirthsQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBirthRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub register_number: Option<String>,
    pub birth_date: NaiveDate,
    pub birth_time: Option<NaiveTime>,
    pub baby_gender: String,
    pub baby_weight_grams: Option<i32>,
    pub birth_type: Option<String>,
    pub apgar_1min: Option<i16>,
    pub apgar_5min: Option<i16>,
    pub complications: Option<String>,
    pub attending_doctor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_issued: Option<bool>,
    pub father_name: Option<String>,
    pub mother_age: Option<i32>,
}

// ── Death Register ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListDeathsQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeathRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
    pub mlc_case_id: Option<Uuid>,
    pub register_number: Option<String>,
    pub death_date: NaiveDate,
    pub death_time: Option<NaiveTime>,
    pub cause_of_death: Option<String>,
    pub immediate_cause: Option<String>,
    pub antecedent_cause: Option<String>,
    pub underlying_cause: Option<String>,
    pub manner_of_death: Option<String>,
    pub is_medico_legal: Option<bool>,
    pub is_brought_dead: Option<bool>,
    pub certifying_doctor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_issued: Option<bool>,
    pub reported_to_municipality: Option<bool>,
    pub municipality_report_date: Option<NaiveDate>,
}

// ── Retention Policies ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateRetentionPolicyRequest {
    pub record_type: String,
    pub category: String,
    pub retention_years: i32,
    pub legal_reference: Option<String>,
    pub destruction_method: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRetentionPolicyRequest {
    pub retention_years: Option<i32>,
    pub legal_reference: Option<String>,
    pub destruction_method: Option<String>,
    pub is_active: Option<bool>,
}

// ── Case Sheet Packets and Storage ─────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCaseSheetPacketsQuery {
    pub status: Option<String>,
    pub packet_type: Option<String>,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct PrintCaseSheetPacketRequest {
    pub printer_id: Option<Uuid>,
    pub copies: Option<i32>,
    pub reprint_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FileCaseSheetPacketRequest {
    pub storage_location_id: Uuid,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MrdCaseSheetCompletenessItem {
    pub code: String,
    pub label: String,
    pub source_module: String,
    pub status: String,
    pub required: bool,
    pub evidence_count: i64,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct MrdCaseSheetCompletenessResponse {
    pub packet_id: Uuid,
    pub packet_number: String,
    pub packet_type: String,
    pub completeness_pct: f64,
    pub required_total: i64,
    pub complete_total: i64,
    pub missing_total: i64,
    pub items: Vec<MrdCaseSheetCompletenessItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStorageLocationRequest {
    pub code: String,
    pub name: String,
    pub building: Option<String>,
    pub floor: Option<String>,
    pub room: Option<String>,
    pub rack: Option<String>,
    pub shelf: Option<String>,
    pub bin: Option<String>,
    pub barcode: Option<String>,
    pub capacity: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStorageLocationRequest {
    pub name: Option<String>,
    pub building: Option<String>,
    pub floor: Option<String>,
    pub room: Option<String>,
    pub rack: Option<String>,
    pub shelf: Option<String>,
    pub bin: Option<String>,
    pub barcode: Option<String>,
    pub capacity: Option<i32>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Stats ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MorbidityRow {
    pub icd_code: Option<String>,
    pub diagnosis_name: String,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MortalityRow {
    pub cause_of_death: Option<String>,
    pub manner_of_death: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct MorbidityMortalityResponse {
    pub morbidity: Vec<MorbidityRow>,
    pub mortality: Vec<MortalityRow>,
}

#[derive(Debug, Serialize)]
pub struct AdmissionDischargeRow {
    pub department_name: Option<String>,
    pub total_admitted: i64,
    pub total_discharged: i64,
    pub total_deaths: i64,
    pub avg_los_days: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct AdmissionDischargeSummary {
    pub rows: Vec<AdmissionDischargeRow>,
    pub total_admitted: i64,
    pub total_discharged: i64,
    pub total_deaths: i64,
    pub overall_avg_los_days: Option<f64>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Medical Records
// ══════════════════════════════════════════════════════════

pub async fn list_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRecordsQuery>,
) -> Result<Json<Vec<MrdMedicalRecord>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    // Dual-mode: with ?patient_id it is one patient's records, without it it is
    // every patient's. Both resolve to a set of permitted ids so the dangerous
    // mode cannot be left open while the safe one looks guarded.
    let permitted_patients =
        medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdMedicalRecord>(
        "SELECT * FROM mrd_medical_records \
         WHERE ($1::uuid[] IS NULL OR patient_id = ANY($1)) \
           AND ($2::text IS NULL OR status::text = $2) \
           AND ($3::text IS NULL OR record_type = $3) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(permitted_patients.as_deref())
    .bind(q.status)
    .bind(q.record_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRecordRequest>,
) -> Result<Json<MrdMedicalRecord>, AppError> {
    require_permission(&claims, permissions::mrd::records::CREATE)?;
    // The body names the patient the record is opened on.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Register-first lock (opt-in): an OPD medical record needs a registered OPD visit.
    if body.record_type.as_deref().unwrap_or("opd") == "opd" {
        medbrains_opd::assert_patient_opd_registered(&mut tx, &claims.tenant_id, body.patient_id)
            .await?;
    }

    // Auto-generate record number from sequence if not provided
    let record_number = if let Some(rn) = &body.record_number {
        rn.clone()
    } else {
        // Ensure MRD_RECORD sequence exists
        sqlx::query(
            "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val) \
             VALUES ($1, 'MRD_RECORD', 'MRD', 0) \
             ON CONFLICT (tenant_id, seq_type) DO NOTHING",
        )
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        let next: i64 = sqlx::query_scalar(
            "UPDATE sequences SET current_val = current_val + 1 \
             WHERE tenant_id = $1 AND seq_type = 'MRD_RECORD' \
             RETURNING current_val",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        let prefix: String = sqlx::query_scalar(
            "SELECT prefix FROM sequences WHERE tenant_id = $1 AND seq_type = 'MRD_RECORD'",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        format!("{prefix}{next:06}")
    };

    let row = sqlx::query_as::<_, MrdMedicalRecord>(
        "INSERT INTO mrd_medical_records \
         (tenant_id, patient_id, record_number, record_type, volume_number, \
          total_pages, shelf_location, retention_years, destruction_due_date, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&record_number)
    .bind(body.record_type.as_deref().unwrap_or("opd"))
    .bind(body.volume_number.unwrap_or(1))
    .bind(body.total_pages)
    .bind(&body.shelf_location)
    .bind(body.retention_years.unwrap_or(5))
    .bind(body.destruction_due_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MrdMedicalRecord>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row =
        sqlx::query_as::<_, MrdMedicalRecord>("SELECT * FROM mrd_medical_records WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRecordRequest>,
) -> Result<Json<MrdMedicalRecord>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdMedicalRecord>(
        "UPDATE mrd_medical_records SET \
           volume_number = COALESCE($2, volume_number), \
           total_pages = COALESCE($3, total_pages), \
           shelf_location = COALESCE($4, shelf_location), \
           status = COALESCE($5::mrd_record_status, status), \
           retention_years = COALESCE($6, retention_years), \
           destruction_due_date = COALESCE($7, destruction_due_date), \
           notes = COALESCE($8, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.volume_number)
    .bind(body.total_pages)
    .bind(&body.shelf_location)
    .bind(&body.status)
    .bind(body.retention_years)
    .bind(body.destruction_due_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Record Movements
// ══════════════════════════════════════════════════════════

pub async fn list_movements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(record_id): Path<Uuid>,
) -> Result<Json<Vec<MrdRecordMovement>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdRecordMovement>(
        "SELECT * FROM mrd_record_movements \
         WHERE medical_record_id = $1 \
         ORDER BY issued_at DESC LIMIT 5000",
    )
    .bind(record_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn issue_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(record_id): Path<Uuid>,
    Json(body): Json<IssueRecordRequest>,
) -> Result<Json<MrdRecordMovement>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let due_days = body.due_days.unwrap_or(7);
    let due_date = Utc::now().date_naive() + chrono::Duration::days(i64::from(due_days));

    let row = sqlx::query_as::<_, MrdRecordMovement>(
        "INSERT INTO mrd_record_movements \
         (tenant_id, medical_record_id, issued_to_user_id, issued_to_department_id, \
          due_date, purpose, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(record_id)
    .bind(body.issued_to_user_id)
    .bind(body.issued_to_department_id)
    .bind(due_date)
    .bind(&body.purpose)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update last_accessed_at on the medical record
    sqlx::query("UPDATE mrd_medical_records SET last_accessed_at = now() WHERE id = $1")
        .bind(record_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn return_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((record_id, movement_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MrdRecordMovement>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    // The URL names a parent; scope the statement by it so it cannot address a
    // child under the wrong one. Without this the parent segment is decorative
    // and the audit row names a record the write never touched.
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdRecordMovement>(
        "UPDATE mrd_record_movements SET \
           returned_at = now(), status = 'returned' \
         WHERE id = $1 AND medical_record_id = $2 RETURNING *",
    )
    .bind(movement_id)
    .bind(record_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Birth Register
// ══════════════════════════════════════════════════════════

pub async fn list_births(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListBirthsQuery>,
) -> Result<Json<Vec<MrdBirthRegister>>, AppError> {
    require_permission(&claims, permissions::mrd::births::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdBirthRegister>(
        "SELECT * FROM mrd_birth_register \
         WHERE ($1::date IS NULL OR birth_date >= $1) \
           AND ($2::date IS NULL OR birth_date <= $2) \
         ORDER BY birth_date DESC, birth_time DESC NULLS LAST LIMIT 500",
    )
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_birth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBirthRequest>,
) -> Result<Json<MrdBirthRegister>, AppError> {
    require_permission(&claims, permissions::mrd::births::CREATE)?;
    // A birth register entry is statutory, and the register itself is rightly
    // unfiltered — but CREATING one names a specific patient, and recording a
    // birth against the wrong person is a legal document about the wrong life.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let register_number = if let Some(rn) = &body.register_number {
        rn.clone()
    } else {
        let next: i64 = sqlx::query_scalar(
            "UPDATE sequences SET current_val = current_val + 1 \
             WHERE tenant_id = $1 AND seq_type = 'MRD_BIRTH' \
             RETURNING current_val",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        let prefix: String = sqlx::query_scalar(
            "SELECT prefix FROM sequences WHERE tenant_id = $1 AND seq_type = 'MRD_BIRTH'",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        format!("{prefix}{next:06}")
    };

    let row = sqlx::query_as::<_, MrdBirthRegister>(
        "INSERT INTO mrd_birth_register \
         (tenant_id, patient_id, admission_id, register_number, birth_date, birth_time, \
          baby_gender, baby_weight_grams, birth_type, apgar_1min, apgar_5min, \
          complications, attending_doctor_id, certificate_number, certificate_issued, \
          father_name, mother_age, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(&register_number)
    .bind(body.birth_date)
    .bind(body.birth_time)
    .bind(&body.baby_gender)
    .bind(body.baby_weight_grams)
    .bind(body.birth_type.as_deref().unwrap_or("normal"))
    .bind(body.apgar_1min)
    .bind(body.apgar_5min)
    .bind(&body.complications)
    .bind(body.attending_doctor_id)
    .bind(&body.certificate_number)
    .bind(body.certificate_issued.unwrap_or(false))
    .bind(&body.father_name)
    .bind(body.mother_age)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_birth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MrdBirthRegister>, AppError> {
    require_permission(&claims, permissions::mrd::births::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row =
        sqlx::query_as::<_, MrdBirthRegister>("SELECT * FROM mrd_birth_register WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Death Register
// ══════════════════════════════════════════════════════════

pub async fn list_deaths(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListDeathsQuery>,
) -> Result<Json<Vec<MrdDeathRegister>>, AppError> {
    require_permission(&claims, permissions::mrd::deaths::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdDeathRegister>(
        "SELECT * FROM mrd_death_register \
         WHERE ($1::date IS NULL OR death_date >= $1) \
           AND ($2::date IS NULL OR death_date <= $2) \
         ORDER BY death_date DESC, death_time DESC NULLS LAST LIMIT 500",
    )
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_death(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDeathRequest>,
) -> Result<Json<MrdDeathRegister>, AppError> {
    require_permission(&claims, permissions::mrd::deaths::CREATE)?;
    // As with births: reading the death register is statutory and stays open;
    // recording a death against a named patient is not something
    // `mrd.deaths.create` alone should authorise on ANY patient in the tenant.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let register_number = if let Some(rn) = &body.register_number {
        rn.clone()
    } else {
        let next: i64 = sqlx::query_scalar(
            "UPDATE sequences SET current_val = current_val + 1 \
             WHERE tenant_id = $1 AND seq_type = 'MRD_DEATH' \
             RETURNING current_val",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        let prefix: String = sqlx::query_scalar(
            "SELECT prefix FROM sequences WHERE tenant_id = $1 AND seq_type = 'MRD_DEATH'",
        )
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        format!("{prefix}{next:06}")
    };

    let row = sqlx::query_as::<_, MrdDeathRegister>(
        "INSERT INTO mrd_death_register \
         (tenant_id, patient_id, admission_id, er_visit_id, mlc_case_id, register_number, \
          death_date, death_time, cause_of_death, immediate_cause, antecedent_cause, \
          underlying_cause, manner_of_death, is_medico_legal, is_brought_dead, \
          certifying_doctor_id, certificate_number, certificate_issued, \
          reported_to_municipality, municipality_report_date, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.er_visit_id)
    .bind(body.mlc_case_id)
    .bind(&register_number)
    .bind(body.death_date)
    .bind(body.death_time)
    .bind(&body.cause_of_death)
    .bind(&body.immediate_cause)
    .bind(&body.antecedent_cause)
    .bind(&body.underlying_cause)
    .bind(body.manner_of_death.as_deref().unwrap_or("natural"))
    .bind(body.is_medico_legal.unwrap_or(false))
    .bind(body.is_brought_dead.unwrap_or(false))
    .bind(body.certifying_doctor_id)
    .bind(&body.certificate_number)
    .bind(body.certificate_issued.unwrap_or(false))
    .bind(body.reported_to_municipality.unwrap_or(false))
    .bind(body.municipality_report_date)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_death(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MrdDeathRegister>, AppError> {
    require_permission(&claims, permissions::mrd::deaths::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row =
        sqlx::query_as::<_, MrdDeathRegister>("SELECT * FROM mrd_death_register WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Retention Policies
// ══════════════════════════════════════════════════════════

pub async fn list_retention_policies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MrdRetentionPolicy>>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdRetentionPolicy>(
        "SELECT * FROM mrd_retention_policies ORDER BY record_type, category LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_retention_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRetentionPolicyRequest>,
) -> Result<Json<MrdRetentionPolicy>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdRetentionPolicy>(
        "INSERT INTO mrd_retention_policies \
         (tenant_id, record_type, category, retention_years, legal_reference, \
          destruction_method, is_active, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.record_type)
    .bind(&body.category)
    .bind(body.retention_years)
    .bind(&body.legal_reference)
    .bind(&body.destruction_method)
    .bind(body.is_active.unwrap_or(true))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_retention_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRetentionPolicyRequest>,
) -> Result<Json<MrdRetentionPolicy>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdRetentionPolicy>(
        "UPDATE mrd_retention_policies SET \
           retention_years = COALESCE($2, retention_years), \
           legal_reference = COALESCE($3, legal_reference), \
           destruction_method = COALESCE($4, destruction_method), \
           is_active = COALESCE($5, is_active) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.retention_years)
    .bind(&body.legal_reference)
    .bind(&body.destruction_method)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Case Sheet Packets and Storage
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SequenceRow {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct RecordIdRow {
    id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct OpdCaseSheetSourceRow {
    patient_id: Uuid,
    patient_name: String,
    uhid: String,
    encounter_date: NaiveDate,
    department_name: Option<String>,
    doctor_name: Option<String>,
    chief_complaint: Option<String>,
    history: Option<String>,
    hpi: Option<String>,
    examination: Option<String>,
    plan: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct IpdCaseSheetSourceRow {
    patient_id: Uuid,
    patient_name: String,
    uhid: String,
    admitted_at: chrono::DateTime<Utc>,
    discharged_at: Option<chrono::DateTime<Utc>>,
    department_name: Option<String>,
    doctor_name: Option<String>,
    ward_name: Option<String>,
    bed_name: Option<String>,
    provisional_diagnosis: Option<String>,
    discharge_summary: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CaseSheetAdmissionRefRow {
    encounter_id: Uuid,
    status: String,
}

async fn generate_sequence_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    seq_type: &str,
    prefix: &str,
    default_pad_width: usize,
) -> Result<String, AppError> {
    let pad_width_i32 = i32::try_from(default_pad_width)
        .map_err(|_| AppError::Internal("invalid sequence pad width".to_owned()))?;

    sqlx::query(
        "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         VALUES ($1, $2, $3, 0, $4) \
         ON CONFLICT (tenant_id, seq_type) DO NOTHING",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .bind(prefix)
    .bind(pad_width_i32)
    .execute(&mut **tx)
    .await?;

    let seq = sqlx::query_as::<_, SequenceRow>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = $2 \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_one(&mut **tx)
    .await?;

    let pad = match usize::try_from(seq.pad_width) {
        Ok(value) if value > 0 => value,
        _ => default_pad_width,
    };

    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

async fn find_or_create_medical_record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    record_type: &str,
) -> Result<Uuid, AppError> {
    if let Some(row) = sqlx::query_as::<_, RecordIdRow>(
        "SELECT id FROM mrd_medical_records \
         WHERE tenant_id = $1 AND patient_id = $2 AND record_type = $3 \
           AND status <> 'destroyed'::mrd_record_status \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(record_type)
    .fetch_optional(&mut **tx)
    .await?
    {
        return Ok(row.id);
    }

    let record_number =
        generate_sequence_number(tx, claims.tenant_id, "MRD_RECORD", "MRD", 6).await?;

    let row = sqlx::query_as::<_, RecordIdRow>(
        "INSERT INTO mrd_medical_records \
         (tenant_id, patient_id, record_number, record_type, volume_number, \
          retention_years, created_by) \
         VALUES ($1, $2, $3, $4, 1, 5, $5) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(record_number)
    .bind(record_type)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    Ok(row.id)
}

fn packet_select_sql() -> &'static str {
    "SELECT p.*, \
       concat_ws(' ', pt.first_name, pt.last_name) AS patient_name, \
       pt.uhid \
     FROM mrd_case_sheet_packets p \
     JOIN patients pt ON pt.id = p.patient_id AND pt.tenant_id = p.tenant_id"
}

async fn fetch_case_sheet_packet(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    packet_id: Uuid,
) -> Result<MrdCaseSheetPacket, AppError> {
    sqlx::query_as::<_, MrdCaseSheetPacket>(&format!(
        "{} WHERE p.id = $1 AND p.tenant_id = $2",
        packet_select_sql()
    ))
    .bind(packet_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

async fn count_case_sheet_evidence(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    sql: &str,
    tenant_id: Uuid,
    source_id: Uuid,
) -> Result<i64, AppError> {
    let count = sqlx::query_scalar::<_, i64>(sql)
        .bind(tenant_id)
        .bind(source_id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(count)
}

#[allow(clippy::too_many_arguments)]
fn push_completeness_item(
    items: &mut Vec<MrdCaseSheetCompletenessItem>,
    code: &str,
    label: &str,
    source_module: &str,
    required: bool,
    evidence_count: i64,
    ok_message: &str,
    missing_message: &str,
) {
    let is_complete = evidence_count > 0;
    let status = if is_complete {
        "ok"
    } else if required {
        "missing"
    } else {
        "warning"
    };
    let message = if is_complete {
        ok_message
    } else {
        missing_message
    };

    items.push(MrdCaseSheetCompletenessItem {
        code: code.to_owned(),
        label: label.to_owned(),
        source_module: source_module.to_owned(),
        status: status.to_owned(),
        required,
        evidence_count,
        message: message.to_owned(),
    });
}

async fn create_case_sheet_pages(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    packet_id: Uuid,
    source_id: Uuid,
    packet_type: &str,
) -> Result<i32, AppError> {
    let pages: &[(&str, &str, &str, &str)] = if packet_type == "opd" {
        &[
            ("opd-cover", "OPD case sheet cover", "opd", "encounters"),
            (
                "opd-datewise-soap",
                "Datewise SOAP notes consolidation",
                "opd",
                "consultations",
            ),
            (
                "opd-history",
                "Chief complaint and history",
                "opd",
                "consultations",
            ),
            (
                "opd-exam",
                "Examination and assessment",
                "opd",
                "consultations",
            ),
            (
                "opd-diagnosis",
                "Diagnosis and ICD coding",
                "opd",
                "diagnoses",
            ),
            (
                "opd-orders",
                "Prescriptions and investigations",
                "opd",
                "orders",
            ),
            ("opd-advice", "Advice and follow-up", "opd", "encounters"),
        ]
    } else {
        &[
            ("ipd-cover", "IPD case sheet cover", "ipd", "admissions"),
            ("ipd-admission-note", "Admission note", "ipd", "admissions"),
            (
                "ipd-datewise-soap",
                "Datewise SOAP progress notes consolidation",
                "ipd",
                "ipd_progress_notes",
            ),
            (
                "ipd-nursing",
                "Nursing assessment",
                "ipd",
                "mrd_form_records",
            ),
            (
                "ipd-progress",
                "Progress notes",
                "ipd",
                "ipd_progress_notes",
            ),
            (
                "ipd-vitals",
                "Vitals and I/O chart",
                "ipd",
                "mrd_form_records",
            ),
            (
                "ipd-mar",
                "Medication administration record",
                "ipd",
                "ipd_mar",
            ),
            (
                "ipd-consents",
                "Consents and legal forms",
                "ipd",
                "consents",
            ),
            ("ipd-ot", "OT and anesthesia records", "ipd", "ot_records"),
            ("ipd-investigations", "Investigations", "ipd", "orders"),
            (
                "ipd-discharge",
                "Discharge checklist and summary",
                "ipd",
                "discharge_summaries",
            ),
        ]
    };

    let mut page_order = 1_i32;
    for (page_code, page_title, source_module, source_table) in pages {
        sqlx::query(
            "INSERT INTO mrd_case_sheet_pages \
             (tenant_id, packet_id, page_code, page_title, page_order, \
              source_module, source_table, source_id, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available') \
             ON CONFLICT (packet_id, page_code) DO UPDATE SET \
               page_title = EXCLUDED.page_title, \
               page_order = EXCLUDED.page_order, \
               source_module = EXCLUDED.source_module, \
               source_table = EXCLUDED.source_table, \
               source_id = EXCLUDED.source_id, \
               status = EXCLUDED.status",
        )
        .bind(tenant_id)
        .bind(packet_id)
        .bind(*page_code)
        .bind(*page_title)
        .bind(page_order)
        .bind(*source_module)
        .bind(*source_table)
        .bind(source_id)
        .execute(&mut **tx)
        .await?;
        page_order += 1;
    }

    Ok(page_order - 1)
}

pub async fn list_storage_locations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MrdStorageLocation>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::mrd::records::LIST,
            permissions::mrd::storage::MANAGE,
            permissions::mrd::case_sheets::FILE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdStorageLocation>(
        "SELECT * FROM mrd_storage_locations \
         WHERE tenant_id = $1 ORDER BY is_active DESC, code LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_storage_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStorageLocationRequest>,
) -> Result<Json<MrdStorageLocation>, AppError> {
    require_permission(&claims, permissions::mrd::storage::MANAGE)?;

    let code = body.code.trim();
    let name = body.name.trim();
    if code.is_empty() || name.is_empty() {
        return Err(AppError::BadRequest(
            "storage location code and name are required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdStorageLocation>(
        "INSERT INTO mrd_storage_locations \
         (tenant_id, code, name, building, floor, room, rack, shelf, bin, barcode, \
          capacity, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(name)
    .bind(&body.building)
    .bind(&body.floor)
    .bind(&body.room)
    .bind(&body.rack)
    .bind(&body.shelf)
    .bind(&body.bin)
    .bind(&body.barcode)
    .bind(body.capacity)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_storage_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStorageLocationRequest>,
) -> Result<Json<MrdStorageLocation>, AppError> {
    require_permission(&claims, permissions::mrd::storage::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MrdStorageLocation>(
        "UPDATE mrd_storage_locations SET \
           name = COALESCE($3, name), \
           building = COALESCE($4, building), \
           floor = COALESCE($5, floor), \
           room = COALESCE($6, room), \
           rack = COALESCE($7, rack), \
           shelf = COALESCE($8, shelf), \
           bin = COALESCE($9, bin), \
           barcode = COALESCE($10, barcode), \
           capacity = COALESCE($11, capacity), \
           is_active = COALESCE($12, is_active), \
           notes = COALESCE($13, notes) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.building)
    .bind(&body.floor)
    .bind(&body.room)
    .bind(&body.rack)
    .bind(&body.shelf)
    .bind(&body.bin)
    .bind(&body.barcode)
    .bind(body.capacity)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_case_sheet_packets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCaseSheetPacketsQuery>,
) -> Result<Json<Vec<MrdCaseSheetPacket>>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    // Dual-mode: with ?patient_id it is one patient's records, without it it is
    // every patient's. Both resolve to a set of permitted ids so the dangerous
    // mode cannot be left open while the safe one looks guarded.
    let permitted_patients =
        medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdCaseSheetPacket>(&format!(
        "{} WHERE p.tenant_id = $1 \
           AND ($2::text IS NULL OR p.status = $2::text) \
           AND ($3::text IS NULL OR p.packet_type = $3::text) \
           AND ($4::uuid IS NULL OR p.patient_id = $4) \
           AND ($5::uuid IS NULL OR p.encounter_id = $5) \
           AND ($6::uuid IS NULL OR p.admission_id = $6) \
         ORDER BY p.created_at DESC LIMIT 500",
        packet_select_sql()
    ))
    .bind(claims.tenant_id)
    .bind(q.status)
    .bind(q.packet_type)
    .bind(permitted_patients.as_deref())
    .bind(q.encounter_id)
    .bind(q.admission_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_case_sheet_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MrdCaseSheetPacket>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = fetch_case_sheet_packet(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_case_sheet_pages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(packet_id): Path<Uuid>,
) -> Result<Json<Vec<MrdCaseSheetPage>>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MrdCaseSheetPage>(
        "SELECT * FROM mrd_case_sheet_pages \
         WHERE tenant_id = $1 AND packet_id = $2 ORDER BY page_order LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(packet_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_case_sheet_completeness(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(packet_id): Path<Uuid>,
) -> Result<Json<MrdCaseSheetCompletenessResponse>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;
    // The path names the packet; the patient is one hop away on it.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::CASE_SHEET_PACKET,
        packet_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let packet = fetch_case_sheet_packet(&mut tx, claims.tenant_id, packet_id).await?;
    let pages = sqlx::query_as::<_, MrdCaseSheetPage>(
        "SELECT * FROM mrd_case_sheet_pages \
         WHERE tenant_id = $1 AND packet_id = $2 ORDER BY page_order LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(packet_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut items = Vec::new();
    let page_evidence = pages
        .iter()
        .filter(|page| {
            page.is_required && matches!(page.status.as_str(), "available" | "printed" | "waived")
        })
        .count();
    push_completeness_item(
        &mut items,
        "packet_pages",
        "Case sheet packet pages generated",
        "mrd",
        true,
        i64::try_from(page_evidence).unwrap_or(0),
        "Required packet page placeholders are generated",
        "Required packet pages are missing or deficient",
    );

    if let Some(encounter_id) = packet.encounter_id {
        let encounter_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM encounters WHERE tenant_id = $1 AND id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "opd_encounter",
            "OPD encounter header",
            "opd",
            true,
            encounter_count,
            "Encounter demographic, department, and doctor linkage is present",
            "Encounter header is missing",
        );

        let consultation_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM consultations WHERE tenant_id = $1 AND encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "opd_consultation",
            "Chief complaint, history, examination, and plan",
            "opd",
            true,
            consultation_count,
            "Consultation note exists",
            "Consultation note is missing",
        );

        push_completeness_item(
            &mut items,
            "opd_datewise_soap",
            "Datewise SOAP notes consolidation",
            "opd",
            true,
            consultation_count,
            "SOAP note is available for MRD datewise consolidation",
            "SOAP note is missing for MRD datewise consolidation",
        );

        let diagnosis_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM diagnoses WHERE tenant_id = $1 AND encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "diagnosis_icd",
            "Diagnosis and ICD coding",
            "clinical",
            true,
            diagnosis_count,
            "Diagnosis rows are linked to the encounter",
            "Diagnosis/ICD rows are missing",
        );

        let prescription_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint \
             FROM prescription_items pi \
             JOIN prescriptions p ON p.id = pi.prescription_id AND p.tenant_id = pi.tenant_id \
             WHERE p.tenant_id = $1 AND p.encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "opd_prescription",
            "Prescription orders",
            "opd",
            false,
            prescription_count,
            "Prescription rows are linked",
            "No prescription rows are linked",
        );

        let pharmacy_trace_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint \
             FROM pharmacy_order_items oi \
             JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
             WHERE o.tenant_id = $1 AND o.encounter_id = $2 AND o.status = 'dispensed' \
               AND (oi.batch_stock_id IS NOT NULL OR NULLIF(trim(COALESCE(oi.batch_number, '')), '') IS NOT NULL) \
               AND oi.expiry_date IS NOT NULL",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "pharmacy_dispense_traceability",
            "Pharmacy dispense batch and expiry evidence",
            "pharmacy",
            prescription_count > 0,
            pharmacy_trace_count,
            "Dispensed pharmacy rows carry batch and expiry evidence",
            "Prescribed medicines are not fully dispensed with batch/expiry evidence",
        );

        let lab_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM lab_orders WHERE tenant_id = $1 AND encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "lab_orders",
            "Lab investigations",
            "lab",
            false,
            lab_count,
            "Lab orders are linked",
            "No lab investigation rows are linked",
        );

        let radiology_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM radiology_orders WHERE tenant_id = $1 AND encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "radiology_orders",
            "Radiology investigations",
            "radiology",
            false,
            radiology_count,
            "Radiology orders are linked",
            "No radiology investigation rows are linked",
        );

        let invoice_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM invoices WHERE tenant_id = $1 AND encounter_id = $2",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "billing_invoice",
            "Billing invoice linkage",
            "billing",
            false,
            invoice_count,
            "Billing invoices are linked to the encounter",
            "No billing invoice is linked to the encounter",
        );

        let consent_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM procedure_consents \
             WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'signed'",
            claims.tenant_id,
            encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "procedure_consents",
            "Procedure/investigation consents",
            "consent",
            false,
            consent_count,
            "Signed consent rows are linked",
            "No signed consent rows are linked",
        );
    }

    if let Some(admission_id) = packet.admission_id {
        let admission = sqlx::query_as::<_, CaseSheetAdmissionRefRow>(
            "SELECT encounter_id, status::text FROM admissions WHERE tenant_id = $1 AND id = $2",
        )
        .bind(claims.tenant_id)
        .bind(admission_id)
        .fetch_one(&mut *tx)
        .await?;

        let admission_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM admissions WHERE tenant_id = $1 AND id = $2",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_admission",
            "IPD admission header",
            "ipd",
            true,
            admission_count,
            "Admission, bed, and treating doctor linkage is present",
            "Admission header is missing",
        );

        let progress_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM ipd_progress_notes WHERE tenant_id = $1 AND admission_id = $2",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_progress_notes",
            "IPD progress notes",
            "ipd",
            true,
            progress_count,
            "Progress notes are linked",
            "Progress notes are missing",
        );

        push_completeness_item(
            &mut items,
            "ipd_datewise_soap",
            "Datewise SOAP/progress notes consolidation",
            "ipd",
            true,
            progress_count,
            "Datewise SOAP/progress notes are available for MRD consolidation",
            "Datewise SOAP/progress notes are missing for MRD consolidation",
        );

        let nursing_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM ipd_nursing_assessments WHERE tenant_id = $1 AND admission_id = $2",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_nursing_assessment",
            "Nursing assessment",
            "ipd",
            true,
            nursing_count,
            "Nursing assessment rows are linked",
            "Nursing assessment is missing",
        );

        let mar_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM ipd_medication_administration WHERE tenant_id = $1 AND admission_id = $2",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_mar",
            "Medication administration record",
            "ipd",
            true,
            mar_count,
            "Medication administration rows are linked",
            "Medication administration record is missing",
        );

        let chart_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM mrd_form_records \
             WHERE tenant_id = $1 AND admission_id = $2 \
               AND form_type IN ('vitals_chart', 'io_chart')",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_vitals_io",
            "Vitals and intake/output chart",
            "mrd",
            true,
            chart_count,
            "Vitals/I-O chart rows are linked",
            "Vitals/I-O chart rows are missing",
        );

        let investigation_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT \
               ((SELECT COUNT(*) FROM lab_orders WHERE tenant_id = $1 AND encounter_id = $2) + \
                (SELECT COUNT(*) FROM radiology_orders WHERE tenant_id = $1 AND encounter_id = $2))::bigint",
            claims.tenant_id,
            admission.encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_investigations",
            "IPD investigations",
            "lab/radiology",
            false,
            investigation_count,
            "Investigation rows are linked",
            "No investigation rows are linked",
        );

        let patient_consent_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM patient_consents \
             WHERE tenant_id = $1 AND patient_id = $2 AND consent_status = 'granted'",
            claims.tenant_id,
            packet.patient_id,
        )
        .await?;
        let procedure_consent_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM procedure_consents \
             WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'signed'",
            claims.tenant_id,
            admission.encounter_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_consents",
            "Patient and procedure consents",
            "consent",
            true,
            patient_consent_count + procedure_consent_count,
            "Consent rows are linked",
            "Patient/procedure consents are missing",
        );

        let invoice_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM invoices WHERE tenant_id = $1 AND admission_id = $2",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_billing",
            "IPD billing invoice linkage",
            "billing",
            false,
            invoice_count,
            "Billing invoices are linked to the admission",
            "No billing invoice is linked to the admission",
        );

        let discharge_required = admission.status == "discharged";
        let discharge_summary_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM ipd_discharge_summaries \
             WHERE tenant_id = $1 AND admission_id = $2 AND status = 'finalized'",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_discharge_summary",
            "Discharge checklist and summary",
            "ipd",
            discharge_required,
            discharge_summary_count,
            "Finalized discharge summary is linked",
            "Finalized discharge summary is missing",
        );

        let discharge_checklist_count = count_case_sheet_evidence(
            &mut tx,
            "SELECT COUNT(*)::bigint FROM ipd_discharge_checklists \
             WHERE tenant_id = $1 AND admission_id = $2 AND status = 'completed'",
            claims.tenant_id,
            admission_id,
        )
        .await?;
        push_completeness_item(
            &mut items,
            "ipd_discharge_checklist",
            "Completed discharge checklist",
            "ipd",
            discharge_required,
            discharge_checklist_count,
            "Completed discharge checklist rows are linked",
            "Discharge checklist completion is missing",
        );
    }

    let required_total =
        i64::try_from(items.iter().filter(|item| item.required).count()).unwrap_or(0);
    let complete_total = i64::try_from(
        items
            .iter()
            .filter(|item| item.required && item.status == "ok")
            .count(),
    )
    .unwrap_or(0);
    let missing_total = required_total - complete_total;
    let completeness_pct = if required_total == 0 {
        100.0
    } else {
        (complete_total as f64 / required_total as f64 * 100.0).round()
    };

    tx.commit().await?;
    Ok(Json(MrdCaseSheetCompletenessResponse {
        packet_id,
        packet_number: packet.packet_number,
        packet_type: packet.packet_type,
        completeness_pct,
        required_total,
        complete_total,
        missing_total,
        items,
    }))
}

pub async fn generate_opd_case_sheet_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<MrdCaseSheetPacket>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::GENERATE)?;
    // A case-sheet packet is the WHOLE chart assembled for release — the single
    // largest disclosure this system performs. `case_sheets.generate` said the
    // caller may assemble packets, not whose.
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let source = sqlx::query_as::<_, OpdCaseSheetSourceRow>(
        "SELECT e.patient_id, concat_ws(' ', p.first_name, p.last_name) AS patient_name, \
           p.uhid, e.encounter_date, d.name AS department_name, u.full_name AS doctor_name, \
           c.chief_complaint, c.history, c.hpi, c.examination, c.plan \
         FROM encounters e \
         JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN users u ON u.id = e.doctor_id AND u.tenant_id = e.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT * FROM consultations c \
           WHERE c.encounter_id = e.id AND c.tenant_id = e.tenant_id \
           ORDER BY c.updated_at DESC LIMIT 1 \
         ) c ON true \
         WHERE e.id = $1 AND e.tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let diagnoses: Vec<String> = sqlx::query_scalar(
        "SELECT COALESCE(icd_code || ' ', '') || description \
         FROM diagnoses WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY is_primary DESC, created_at LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;

    let version: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM mrd_case_sheet_packets \
         WHERE tenant_id = $1 AND packet_type = 'opd' AND encounter_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut *tx)
    .await?;

    let medical_record_id =
        find_or_create_medical_record(&mut tx, &claims, source.patient_id, "opd").await?;
    let packet_number =
        generate_sequence_number(&mut tx, claims.tenant_id, "MRD_CASESHEET", "CS-", 6).await?;
    let datewise_soap_notes: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(jsonb_build_object( \
           'date', e.encounter_date, \
           'encounter_id', e.id, \
           'department', d.name, \
           'doctor', u.full_name, \
           'subjective', concat_ws(E'\\n', NULLIF(c.chief_complaint, ''), NULLIF(c.history, ''), NULLIF(c.hpi, '')), \
           'objective', c.examination, \
           'assessment', ( \
             SELECT string_agg(COALESCE(dx.icd_code || ' ', '') || dx.description, '; ' ORDER BY dx.is_primary DESC, dx.created_at) \
             FROM diagnoses dx \
             WHERE dx.tenant_id = c.tenant_id AND dx.encounter_id = c.encounter_id \
           ), \
           'plan', c.plan, \
           'source', 'opd_consultation', \
           'updated_at', c.updated_at \
         ) ORDER BY e.encounter_date, c.created_at), '[]'::jsonb) \
         FROM consultations c \
         JOIN encounters e ON e.id = c.encounter_id AND e.tenant_id = c.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN users u ON u.id = c.doctor_id AND u.tenant_id = c.tenant_id \
         WHERE c.tenant_id = $1 AND c.encounter_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut *tx)
    .await?;

    let snapshot = serde_json::json!({
        "source": "opd",
        "encounter_id": encounter_id,
        "patient_id": source.patient_id,
        "patient_name": source.patient_name,
        "uhid": source.uhid,
        "encounter_date": source.encounter_date,
        "department": source.department_name,
        "doctor": source.doctor_name,
        "chief_complaint": source.chief_complaint,
        "history": source.history,
        "hpi": source.hpi,
        "examination": source.examination,
        "plan": source.plan,
        "diagnoses": diagnoses,
        "datewise_soap_notes": datewise_soap_notes,
    });

    let inserted = sqlx::query_as::<_, RecordIdRow>(
        "INSERT INTO mrd_case_sheet_packets \
         (tenant_id, patient_id, encounter_id, medical_record_id, packet_number, packet_type, \
          status, version, page_count, source_snapshot, generated_by) \
         VALUES ($1, $2, $3, $4, $5, 'opd', 'generated', $6, 0, $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(source.patient_id)
    .bind(encounter_id)
    .bind(medical_record_id)
    .bind(packet_number)
    .bind(version)
    .bind(&snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let page_count =
        create_case_sheet_pages(&mut tx, claims.tenant_id, inserted.id, encounter_id, "opd")
            .await?;
    sqlx::query("UPDATE mrd_case_sheet_packets SET page_count = $2 WHERE id = $1")
        .bind(inserted.id)
        .bind(page_count)
        .execute(&mut *tx)
        .await?;

    let row = fetch_case_sheet_packet(&mut tx, claims.tenant_id, inserted.id).await?;
    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::MrdCaseSheetGenerated,
        row.id,
        claims.sub,
        serde_json::json!({
            "packet_id": row.id,
            "packet_type": &row.packet_type,
            "patient_id": row.patient_id,
            "encounter_id": row.encounter_id,
            "admission_id": row.admission_id,
            "medical_record_id": row.medical_record_id,
            "packet_number": &row.packet_number,
            "version": row.version,
            "page_count": row.page_count,
            "generated_at": row.generated_at,
        }),
    )
    .with_patient(row.patient_id);
    if let Some(encounter_id) = row.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    if let Some(admission_id) = row.admission_id {
        event = event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn generate_ipd_case_sheet_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<MrdCaseSheetPacket>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::GENERATE)?;
    // The admission's whole chart. As above.
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let source = sqlx::query_as::<_, IpdCaseSheetSourceRow>(
        "SELECT a.patient_id, concat_ws(' ', p.first_name, p.last_name) AS patient_name, \
           p.uhid, a.admitted_at, a.discharged_at, d.name AS department_name, \
           u.full_name AS doctor_name, w.name AS ward_name, l.name AS bed_name, \
           a.provisional_diagnosis, a.discharge_summary \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = a.tenant_id \
         LEFT JOIN users u ON u.id = a.admitting_doctor AND u.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let version: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM mrd_case_sheet_packets \
         WHERE tenant_id = $1 AND packet_type = 'ipd' AND admission_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    let medical_record_id =
        find_or_create_medical_record(&mut tx, &claims, source.patient_id, "ipd").await?;
    let packet_number =
        generate_sequence_number(&mut tx, claims.tenant_id, "MRD_CASESHEET", "CS-", 6).await?;
    let datewise_soap_notes: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(jsonb_build_object( \
           'date', n.note_date, \
           'note_type', n.note_type::text, \
           'author', u.full_name, \
           'subjective', n.subjective, \
           'objective', n.objective, \
           'assessment', n.assessment, \
           'plan', n.plan, \
           'is_addendum', n.is_addendum, \
           'parent_note_id', n.parent_note_id, \
           'created_at', n.created_at \
         ) ORDER BY n.note_date, n.created_at), '[]'::jsonb) \
         FROM ipd_progress_notes n \
         LEFT JOIN users u ON u.id = n.author_id AND u.tenant_id = n.tenant_id \
         WHERE n.tenant_id = $1 AND n.admission_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    let snapshot = serde_json::json!({
        "source": "ipd",
        "admission_id": admission_id,
        "patient_id": source.patient_id,
        "patient_name": source.patient_name,
        "uhid": source.uhid,
        "admitted_at": source.admitted_at,
        "discharged_at": source.discharged_at,
        "department": source.department_name,
        "doctor": source.doctor_name,
        "ward": source.ward_name,
        "bed": source.bed_name,
        "provisional_diagnosis": source.provisional_diagnosis,
        "discharge_summary": source.discharge_summary,
        "datewise_soap_notes": datewise_soap_notes,
    });

    let inserted = sqlx::query_as::<_, RecordIdRow>(
        "INSERT INTO mrd_case_sheet_packets \
         (tenant_id, patient_id, admission_id, medical_record_id, packet_number, packet_type, \
          status, version, page_count, source_snapshot, generated_by) \
         VALUES ($1, $2, $3, $4, $5, 'ipd', 'generated', $6, 0, $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(source.patient_id)
    .bind(admission_id)
    .bind(medical_record_id)
    .bind(packet_number)
    .bind(version)
    .bind(&snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let page_count =
        create_case_sheet_pages(&mut tx, claims.tenant_id, inserted.id, admission_id, "ipd")
            .await?;
    sqlx::query("UPDATE mrd_case_sheet_packets SET page_count = $2 WHERE id = $1")
        .bind(inserted.id)
        .bind(page_count)
        .execute(&mut *tx)
        .await?;

    let row = fetch_case_sheet_packet(&mut tx, claims.tenant_id, inserted.id).await?;
    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::MrdCaseSheetGenerated,
        row.id,
        claims.sub,
        serde_json::json!({
            "packet_id": row.id,
            "packet_type": &row.packet_type,
            "patient_id": row.patient_id,
            "encounter_id": row.encounter_id,
            "admission_id": row.admission_id,
            "medical_record_id": row.medical_record_id,
            "packet_number": &row.packet_number,
            "version": row.version,
            "page_count": row.page_count,
            "generated_at": row.generated_at,
        }),
    )
    .with_patient(row.patient_id);
    if let Some(encounter_id) = row.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    if let Some(admission_id) = row.admission_id {
        event = event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn print_case_sheet_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PrintCaseSheetPacketRequest>,
) -> Result<Json<MrdCaseSheetPacket>, AppError> {
    // The FIRST print had no permission check at all — only reprints were
    // guarded, and only on `case_sheets.reprint`. A case-sheet packet is the
    // whole chart, so printing one was the largest disclosure in the system and
    // any authenticated user in the tenant could perform it once per packet.
    // `mrd.case_sheets.print` already existed and was simply never asked for.
    require_permission(&claims, permissions::mrd::case_sheets::PRINT)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::CASE_SHEET_PACKET,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let packet = fetch_case_sheet_packet(&mut tx, claims.tenant_id, id).await?;
    let is_reprint = packet.printed_at.is_some();
    if is_reprint {
        require_permission(&claims, permissions::mrd::case_sheets::REPRINT)?;
        if body
            .reprint_reason
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
        {
            return Err(AppError::BadRequest(
                "reprint reason is required for already printed case sheets".to_owned(),
            ));
        }
    } else {
        require_permission(&claims, permissions::mrd::case_sheets::PRINT)?;
    }

    let copies = body.copies.unwrap_or(1);
    if !(1..=10).contains(&copies) {
        return Err(AppError::BadRequest(
            "copies must be between 1 and 10".to_owned(),
        ));
    }

    let today = Utc::now().format("%Y%m%d").to_string();
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM document_outputs \
         WHERE tenant_id = $1 AND document_number LIKE 'DOC-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("DOC-{today}-{:04}", count + 1);
    let title = format!(
        "{} Case Sheet {}",
        packet.packet_type.to_uppercase(),
        packet.packet_number
    );

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'mrd', 'mrd_case_sheet_packets', $2, $3, $4, $5, \
          $6, $7, 'custom'::document_template_category, 'printed'::document_output_status, \
          $8, $9, now(), now(), \
          CASE WHEN $10::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $11, $12) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(packet.patient_id)
    .bind(packet.encounter_id)
    .bind(packet.admission_id)
    .bind(&document_number)
    .bind(&title)
    .bind(packet.page_count)
    .bind(copies)
    .bind(packet.printed_at.is_some())
    .bind(&packet.source_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let print_job_id: Option<Uuid> = if let Some(printer_id) = body.printer_id {
        Some(
            sqlx::query_scalar(
                "INSERT INTO print_jobs \
                 (tenant_id, document_output_id, printer_id, status, copies, submitted_by) \
                 VALUES ($1, $2, $3, 'queued'::print_job_status, $4, $5) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(document_output_id)
            .bind(printer_id)
            .bind(copies)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?,
        )
    } else {
        None
    };

    sqlx::query(
        "UPDATE mrd_case_sheet_packets SET \
           status = 'printed', document_output_id = $2, print_job_id = $3, \
           printed_by = $4, printed_at = now(), reprint_reason = $5 \
         WHERE id = $1 AND tenant_id = $6",
    )
    .bind(id)
    .bind(document_output_id)
    .bind(print_job_id)
    .bind(claims.sub)
    .bind(&body.reprint_reason)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE mrd_case_sheet_pages SET status = 'printed', printed_at = now() \
         WHERE tenant_id = $1 AND packet_id = $2 AND status = 'available'",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    let row = fetch_case_sheet_packet(&mut tx, claims.tenant_id, id).await?;
    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::MrdCaseSheetPrinted,
        row.id,
        claims.sub,
        serde_json::json!({
            "packet_id": row.id,
            "patient_id": row.patient_id,
            "packet_type": &row.packet_type,
            "packet_number": &row.packet_number,
            "encounter_id": row.encounter_id,
            "admission_id": row.admission_id,
            "document_output_id": row.document_output_id,
            "print_job_id": row.print_job_id,
            "page_count": row.page_count,
            "copies": copies,
            "is_reprint": is_reprint,
            "printed_at": row.printed_at,
        }),
    )
    .with_patient(row.patient_id);
    if let Some(encounter_id) = row.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    if let Some(admission_id) = row.admission_id {
        event = event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdatePageStatusRequest {
    pub status: String,
    pub deficiency_reason: Option<String>,
}

/// `PUT /api/mrd/case-sheets/{packet_id}/pages/{page_id}/status` — flag a page
/// deficient (with reason), waive it, or mark it available/resolved. A record
/// can't be filed while any page is deficient.
pub async fn update_case_sheet_page_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((packet_id, page_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdatePageStatusRequest>,
) -> Result<Json<MrdCaseSheetPage>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;

    if !["deficient", "waived", "available"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!("Invalid page status '{}'.", body.status)));
    }
    if body.status == "deficient" && body.deficiency_reason.as_deref().unwrap_or("").trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "A reason is required to flag a page deficient.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, MrdCaseSheetPage>(
        "UPDATE mrd_case_sheet_pages SET \
           status = $3, \
           deficiency_reason = CASE WHEN $3 = 'deficient' THEN $4 ELSE NULL END, \
           marked_deficient_by = CASE WHEN $3 = 'deficient' THEN $5 ELSE NULL END, \
           marked_deficient_at = CASE WHEN $3 = 'deficient' THEN now() ELSE NULL END, \
           updated_at = now() \
         WHERE id = $1 AND packet_id = $2 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(page_id)
    .bind(packet_id)
    .bind(&body.status)
    .bind(&body.deficiency_reason)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn file_case_sheet_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<FileCaseSheetPacketRequest>,
) -> Result<Json<MrdCaseSheetPacket>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let packet = fetch_case_sheet_packet(&mut tx, claims.tenant_id, id).await?;
    if packet.printed_at.is_none() {
        return Err(AppError::BadRequest(
            "case sheet must be printed before it can be filed".to_owned(),
        ));
    }
    if packet.status == "filed" {
        return Err(AppError::BadRequest(
            "case sheet is already filed; use MRD movement/retrieval to relocate it".to_owned(),
        ));
    }

    // A record may not be filed as complete while any page is flagged deficient.
    let deficient: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mrd_case_sheet_pages \
         WHERE packet_id = $1 AND tenant_id = $2 AND status = 'deficient'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if deficient > 0 {
        return Err(AppError::BadRequest(format!(
            "Resolve {deficient} deficient page(s) before filing this record."
        )));
    }

    let location = sqlx::query_as::<_, MrdStorageLocation>(
        "SELECT * FROM mrd_storage_locations \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true",
    )
    .bind(body.storage_location_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("active shelf location is required".to_owned()))?;
    if let Some(capacity) = location.capacity {
        if location.current_count >= capacity {
            return Err(AppError::BadRequest(
                "selected shelf location is already at capacity".to_owned(),
            ));
        }
    }

    let shelf_location = format!("{} - {}", location.code, location.name);

    sqlx::query(
        "UPDATE mrd_case_sheet_packets SET \
           status = 'filed', storage_location_id = $2, shelf_location = $3, \
           filed_by = $4, filed_at = now(), notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $6",
    )
    .bind(id)
    .bind(location.id)
    .bind(&shelf_location)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if let Some(medical_record_id) = packet.medical_record_id {
        sqlx::query(
            "UPDATE mrd_medical_records SET shelf_location = $2, last_accessed_at = now() \
             WHERE id = $1 AND tenant_id = $3",
        )
        .bind(medical_record_id)
        .bind(&shelf_location)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "UPDATE mrd_storage_locations SET current_count = current_count + 1 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(location.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let row = fetch_case_sheet_packet(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Statistics
// ══════════════════════════════════════════════════════════

pub async fn stats_morbidity_mortality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StatsQuery>,
) -> Result<Json<MorbidityMortalityResponse>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Morbidity — top 20 diagnoses by ICD code
    let morbidity = sqlx::query_as::<_, MorbidityRow>(
        "SELECT d.icd_code, d.description AS diagnosis_name, COUNT(*) AS count \
         FROM diagnoses d \
         WHERE ($1::date IS NULL OR d.created_at::date >= $1) \
           AND ($2::date IS NULL OR d.created_at::date <= $2) \
         GROUP BY d.icd_code, d.description \
         ORDER BY count DESC LIMIT 20",
    )
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    // Mortality — top causes from death register
    let mortality = sqlx::query_as::<_, MortalityRow>(
        "SELECT COALESCE(a.discharge_summary, 'Unknown') AS cause_of_death, \
         'natural' AS manner_of_death, COUNT(*) AS count \
         FROM admissions a \
         WHERE a.discharge_type = 'death' \
           AND ($1::date IS NULL OR a.discharged_at::date >= $1) \
           AND ($2::date IS NULL OR a.discharged_at::date <= $2) \
         GROUP BY a.discharge_summary \
         ORDER BY count DESC LIMIT 20",
    )
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(MorbidityMortalityResponse {
        morbidity,
        mortality,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct AdmDischRow {
    department_name: Option<String>,
    total_admitted: Option<i64>,
    total_discharged: Option<i64>,
    total_deaths: Option<i64>,
    avg_los_days: Option<f64>,
}

pub async fn stats_admission_discharge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StatsQuery>,
) -> Result<Json<AdmissionDischargeSummary>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AdmDischRow>(
        "SELECT \
           dep.name AS department_name, \
           COUNT(*)::bigint AS total_admitted, \
           COUNT(*) FILTER (WHERE a.status = 'discharged'::admission_status)::bigint \
             AS total_discharged, \
           COUNT(*) FILTER (WHERE a.discharge_type = 'deceased'::discharge_type)::bigint \
             AS total_deaths, \
           AVG(EXTRACT(EPOCH FROM (COALESCE(a.discharged_at, now()) - a.admitted_at)) / 86400)::float8 \
             AS avg_los_days \
         FROM admissions a \
         JOIN encounters enc ON enc.id = a.encounter_id \
         LEFT JOIN departments dep ON dep.id = enc.department_id \
         WHERE ($1::date IS NULL OR a.admitted_at::date >= $1) \
           AND ($2::date IS NULL OR a.admitted_at::date <= $2) \
         GROUP BY dep.name \
         ORDER BY total_admitted DESC LIMIT 5000",
    )
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    let total_admitted: i64 = rows.iter().map(|r| r.total_admitted.unwrap_or(0)).sum();
    let total_discharged: i64 = rows.iter().map(|r| r.total_discharged.unwrap_or(0)).sum();
    let total_deaths: i64 = rows.iter().map(|r| r.total_deaths.unwrap_or(0)).sum();
    let overall_avg_los_days = if rows.is_empty() {
        None
    } else {
        let sum: f64 = rows.iter().filter_map(|r| r.avg_los_days).sum();
        let count = rows.iter().filter(|r| r.avg_los_days.is_some()).count();
        if count > 0 {
            Some(sum / count as f64)
        } else {
            None
        }
    };

    let result_rows: Vec<AdmissionDischargeRow> = rows
        .into_iter()
        .map(|r| AdmissionDischargeRow {
            department_name: r.department_name,
            total_admitted: r.total_admitted.unwrap_or(0),
            total_discharged: r.total_discharged.unwrap_or(0),
            total_deaths: r.total_deaths.unwrap_or(0),
            avg_los_days: r.avg_los_days,
        })
        .collect();

    tx.commit().await?;
    Ok(Json(AdmissionDischargeSummary {
        rows: result_rows,
        total_admitted,
        total_discharged,
        total_deaths,
        overall_avg_los_days,
    }))
}

// ══════════════════════════════════════════════════════════
//  Form Records
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListFormRecordsQuery {
    pub admission_id: Option<Uuid>,
    pub form_type: Option<String>,
}

pub async fn list_form_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFormRecordsQuery>,
) -> Result<Json<Vec<MrdFormRecord>>, AppError> {
    require_permission(&claims, permissions::mrd::forms::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MrdFormRecord>(
        "SELECT f.*,
                uc.full_name AS completed_by_name,
                uv.full_name AS verified_by_name
         FROM mrd_form_records f
         LEFT JOIN users uc ON uc.id = f.completed_by
         LEFT JOIN users uv ON uv.id = f.verified_by
         WHERE ($1::uuid IS NULL OR f.admission_id = $1)
           AND ($2::text  IS NULL OR f.form_type   = $2)
         ORDER BY f.form_date DESC, f.form_type LIMIT 5000",
    )
    .bind(params.admission_id)
    .bind(params.form_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CompleteFormRecordBody {
    pub notes: Option<String>,
}

pub async fn complete_form_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_body): Json<CompleteFormRecordBody>,
) -> Result<Json<MrdFormRecord>, AppError> {
    require_permission(&claims, permissions::mrd::forms::MANAGE)?;
    let user_id = claims.sub;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MrdFormRecord>(
        "UPDATE mrd_form_records
            SET completed_by = $2, completed_at = NOW()
          WHERE id = $1
          RETURNING *, NULL::text AS completed_by_name, NULL::text AS verified_by_name",
    )
    .bind(id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn verify_form_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MrdFormRecord>, AppError> {
    require_permission(&claims, permissions::mrd::forms::MANAGE)?;
    let user_id = claims.sub;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MrdFormRecord>(
        "UPDATE mrd_form_records
            SET verified_by = $2, verified_at = NOW()
          WHERE id = $1
          RETURNING *, NULL::text AS completed_by_name, NULL::text AS verified_by_name",
    )
    .bind(id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct AttachDocumentBody {
    pub s3_key: String,
}

pub async fn attach_form_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AttachDocumentBody>,
) -> Result<Json<MrdFormRecord>, AppError> {
    require_permission(&claims, permissions::mrd::forms::MANAGE)?;
    // Enforce tenant isolation: key must start with tenant prefix
    let prefix = format!("{}/", claims.tenant_id);
    if !body.s3_key.starts_with(&prefix) {
        return Err(AppError::BadRequest(
            "s3_key must belong to your tenant".to_string(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MrdFormRecord>(
        "UPDATE mrd_form_records
            SET pdf_url = $2
          WHERE id = $1
          RETURNING *, NULL::text AS completed_by_name, NULL::text AS verified_by_name",
    )
    .bind(id)
    .bind(&body.s3_key)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Medical Records Department (records, coding, deficiencies, ROI, forms) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/mrd/records",
            get(list_records).post(create_record),
        )
        .route(
            "/api/mrd/records/{id}",
            get(get_record).put(update_record),
        )
        .route(
            "/api/mrd/records/{id}/movements",
            get(list_movements),
        )
        .route(
            "/api/mrd/records/{id}/issue",
            post(issue_record),
        )
        .route(
            "/api/mrd/records/{record_id}/movements/{id}/return",
            post(return_record),
        )
        .route(
            "/api/mrd/births",
            get(list_births).post(create_birth),
        )
        .route(
            "/api/mrd/births/{id}",
            get(get_birth),
        )
        .route(
            "/api/mrd/deaths",
            get(list_deaths).post(create_death),
        )
        .route(
            "/api/mrd/deaths/{id}",
            get(get_death),
        )
        .route(
            "/api/mrd/retention-policies",
            get(list_retention_policies).post(create_retention_policy),
        )
        .route(
            "/api/mrd/retention-policies/{id}",
            put(update_retention_policy),
        )
        .route(
            "/api/mrd/storage-locations",
            get(list_storage_locations).post(create_storage_location),
        )
        .route(
            "/api/mrd/storage-locations/{id}",
            put(update_storage_location),
        )
        .route(
            "/api/mrd/case-sheets",
            get(list_case_sheet_packets),
        )
        .route(
            "/api/mrd/case-sheets/from-opd/{encounter_id}",
            post(generate_opd_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/from-ipd/{admission_id}",
            post(generate_ipd_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}",
            get(get_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}/pages",
            get(list_case_sheet_pages),
        )
        .route(
            "/api/mrd/case-sheets/{packet_id}/pages/{page_id}/status",
            put(update_case_sheet_page_status),
        )
        .route(
            "/api/mrd/case-sheets/{id}/completeness",
            get(get_case_sheet_completeness),
        )
        .route(
            "/api/mrd/case-sheets/{id}/print",
            post(print_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}/file",
            post(file_case_sheet_packet),
        )
        .route(
            "/api/mrd/stats/morbidity-mortality",
            get(stats_morbidity_mortality),
        )
        .route(
            "/api/mrd/stats/admission-discharge",
            get(stats_admission_discharge),
        )
        .route(
            "/api/mrd/form-records",
            get(list_form_records),
        )
        .route(
            "/api/mrd/form-records/{id}/complete",
            post(complete_form_record),
        )
        .route(
            "/api/mrd/form-records/{id}/verify",
            post(verify_form_record),
        )
        .route(
            "/api/mrd/form-records/{id}/attach-document",
            post(attach_form_document),
        )
}
