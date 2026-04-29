#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, NaiveTime, Utc};
use medbrains_core::mrd::{
    MrdBirthRegister, MrdDeathRegister, MrdMedicalRecord, MrdRecordMovement, MrdRetentionPolicy,
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MrdMedicalRecord>(
        "SELECT * FROM mrd_medical_records \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
           AND ($2::text IS NULL OR status::text = $2) \
           AND ($3::text IS NULL OR record_type = $3) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(q.patient_id)
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MrdRecordMovement>(
        "SELECT * FROM mrd_record_movements \
         WHERE medical_record_id = $1 \
         ORDER BY issued_at DESC",
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    Path((_record_id, movement_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MrdRecordMovement>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MrdRecordMovement>(
        "UPDATE mrd_record_movements SET \
           returned_at = now(), status = 'returned' \
         WHERE id = $1 RETURNING *",
    )
    .bind(movement_id)
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MrdRetentionPolicy>(
        "SELECT * FROM mrd_retention_policies ORDER BY record_type, category",
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
//  Handlers — Statistics
// ══════════════════════════════════════════════════════════

pub async fn stats_morbidity_mortality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StatsQuery>,
) -> Result<Json<MorbidityMortalityResponse>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Morbidity — top 20 diagnoses by ICD code
    let morbidity = sqlx::query_as::<_, MorbidityRow>(
        "SELECT d.icd_code, d.description AS diagnosis_name, COUNT(*) AS count \
         FROM diagnoses d \
         WHERE ($1::date IS NULL OR d.created_at::date >= $1) \
           AND ($2::date IS NULL OR d.created_at::date <= $2) \
         GROUP BY d.icd_code, d.name \
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
         ORDER BY total_admitted DESC",
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
