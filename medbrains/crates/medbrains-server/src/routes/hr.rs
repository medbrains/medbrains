#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::hr::{
    Appraisal, AttendanceRecord, Designation, DutyRoster, Employee, EmployeeCredential,
    LeaveBalance, LeaveRequest, OnCallSchedule, ShiftDefinition, StatutoryRecord, TrainingProgram,
    TrainingRecord,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

// ── Designations ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDesignationRequest {
    pub code: String,
    pub name: String,
    pub level: Option<i32>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDesignationRequest {
    pub name: Option<String>,
    pub level: Option<i32>,
    pub category: Option<String>,
    pub is_active: Option<bool>,
}

// ── Employees ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEmployeesQuery {
    pub search: Option<String>,
    pub department_id: Option<Uuid>,
    pub status: Option<String>,
    pub employment_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEmployeeRequest {
    pub employee_code: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub employment_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub designation_id: Option<Uuid>,
    pub reporting_to: Option<Uuid>,
    pub date_of_joining: Option<String>,
    pub qualifications: Option<serde_json::Value>,
    pub blood_group: Option<String>,
    pub address: Option<serde_json::Value>,
    pub emergency_contact: Option<serde_json::Value>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub pf_number: Option<String>,
    pub esi_number: Option<String>,
    pub uan_number: Option<String>,
    pub pan_number: Option<String>,
    pub aadhaar_number: Option<String>,
    pub user_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmployeeRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub employment_type: Option<String>,
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
    pub designation_id: Option<Uuid>,
    pub reporting_to: Option<Uuid>,
    pub date_of_leaving: Option<String>,
    pub qualifications: Option<serde_json::Value>,
    pub blood_group: Option<String>,
    pub address: Option<serde_json::Value>,
    pub emergency_contact: Option<serde_json::Value>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub pf_number: Option<String>,
    pub esi_number: Option<String>,
    pub uan_number: Option<String>,
    pub pan_number: Option<String>,
    pub aadhaar_number: Option<String>,
    pub user_id: Option<Uuid>,
    pub notes: Option<String>,
}

// ── Credentials ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCredentialRequest {
    pub credential_type: String,
    pub issuing_body: String,
    pub registration_no: String,
    pub state_code: Option<String>,
    pub issued_date: Option<String>,
    pub expiry_date: Option<String>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCredentialRequest {
    pub status: Option<String>,
    pub expiry_date: Option<String>,
    pub verified_by: Option<Uuid>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

// ── Shifts ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateShiftRequest {
    pub code: String,
    pub name: String,
    pub shift_type: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub break_minutes: Option<i32>,
    pub is_night: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateShiftRequest {
    pub name: Option<String>,
    pub shift_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub break_minutes: Option<i32>,
    pub is_night: Option<bool>,
    pub is_active: Option<bool>,
}

// ── Duty Rosters ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRosterQuery {
    pub department_id: Option<Uuid>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRosterRequest {
    pub employee_id: Uuid,
    pub department_id: Option<Uuid>,
    pub shift_id: Uuid,
    pub roster_date: String,
    pub is_on_call: Option<bool>,
    pub notes: Option<String>,
}

// ── Attendance ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAttendanceQuery {
    pub department_id: Option<Uuid>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub employee_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAttendanceRequest {
    pub employee_id: Uuid,
    pub attendance_date: String,
    pub shift_id: Option<Uuid>,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub status: Option<String>,
    pub source: Option<String>,
    pub notes: Option<String>,
}

// ── Leave ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListLeaveQuery {
    pub employee_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeaveRequest {
    pub employee_id: Uuid,
    pub leave_type: String,
    pub start_date: String,
    pub end_date: String,
    pub days: Option<f64>,
    pub is_half_day: Option<bool>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LeaveActionRequest {
    pub action: String,
    pub remarks: Option<String>,
}

// ── On-Call ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListOnCallQuery {
    pub department_id: Option<Uuid>,
    pub schedule_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOnCallRequest {
    pub employee_id: Uuid,
    pub department_id: Option<Uuid>,
    pub schedule_date: String,
    pub start_time: String,
    pub end_time: String,
    pub is_primary: Option<bool>,
    pub contact_number: Option<String>,
    pub notes: Option<String>,
}

// ── Training ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateTrainingProgramRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_mandatory: Option<bool>,
    pub frequency_months: Option<i32>,
    pub duration_hours: Option<f64>,
    pub target_roles: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTrainingRecordRequest {
    pub employee_id: Uuid,
    pub program_id: Uuid,
    pub training_date: String,
    pub status: Option<String>,
    pub score: Option<f64>,
    pub certificate_no: Option<String>,
    pub expiry_date: Option<String>,
    pub trainer_name: Option<String>,
    pub notes: Option<String>,
}

// ── Appraisals ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateAppraisalRequest {
    pub employee_id: Uuid,
    pub appraisal_year: i32,
    pub rating: Option<f64>,
    pub strengths: Option<String>,
    pub improvements: Option<String>,
    pub goals: Option<serde_json::Value>,
    pub notes: Option<String>,
}

// ── Statutory Records ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateStatutoryRecordRequest {
    pub employee_id: Uuid,
    pub record_type: String,
    pub title: String,
    pub compliance_date: Option<String>,
    pub expiry_date: Option<String>,
    pub details: Option<serde_json::Value>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Designation handlers
// ══════════════════════════════════════════════════════════

pub async fn list_designations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Designation>>, AppError> {
    require_permission(&claims, permissions::hr::employees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Designation>(
        "SELECT * FROM designations WHERE tenant_id = $1 ORDER BY level, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_designation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDesignationRequest>,
) -> Result<Json<Designation>, AppError> {
    require_permission(&claims, permissions::hr::employees::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Designation>(
        "INSERT INTO designations (tenant_id, code, name, level, category) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.level.unwrap_or(0))
    .bind(body.category.as_deref().unwrap_or("clinical"))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_designation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDesignationRequest>,
) -> Result<Json<Designation>, AppError> {
    require_permission(&claims, permissions::hr::employees::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Designation>(
        "UPDATE designations SET \
         name = COALESCE($3, name), \
         level = COALESCE($4, level), \
         category = COALESCE($5, category), \
         is_active = COALESCE($6, is_active) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(body.level)
    .bind(&body.category)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Employee handlers
// ══════════════════════════════════════════════════════════

pub async fn list_employees(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEmployeesQuery>,
) -> Result<Json<Vec<Employee>>, AppError> {
    require_permission(&claims, permissions::hr::employees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE tenant_id = $1 \
             AND (first_name ILIKE $2 OR last_name ILIKE $2 \
             OR employee_code ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2) \
             ORDER BY first_name, last_name",
        )
        .bind(claims.tenant_id)
        .bind(&pattern)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY first_name, last_name",
        )
        .bind(claims.tenant_id)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.status {
        sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE tenant_id = $1 \
             AND status = $2::employee_status \
             ORDER BY first_name, last_name",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE tenant_id = $1 \
             ORDER BY first_name, last_name",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_employee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Employee>, AppError> {
    require_permission(&claims, permissions::hr::employees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row =
        sqlx::query_as::<_, Employee>("SELECT * FROM employees WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_employee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEmployeeRequest>,
) -> Result<Json<Employee>, AppError> {
    require_permission(&claims, permissions::hr::employees::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Employee>(
        "INSERT INTO employees (tenant_id, employee_code, first_name, last_name, \
         date_of_birth, gender, phone, email, employment_type, department_id, \
         designation_id, reporting_to, date_of_joining, qualifications, blood_group, \
         address, emergency_contact, bank_name, bank_account, bank_ifsc, \
         pf_number, esi_number, uan_number, pan_number, aadhaar_number, \
         user_id, notes) \
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, \
         COALESCE($9::employment_type, 'permanent'), $10, $11, $12, \
         COALESCE($13::date, CURRENT_DATE), COALESCE($14, '[]'::jsonb), $15, \
         COALESCE($16, '{}'::jsonb), COALESCE($17, '{}'::jsonb), \
         $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.employee_code)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(&body.date_of_birth)
    .bind(&body.gender)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.employment_type)
    .bind(body.department_id)
    .bind(body.designation_id)
    .bind(body.reporting_to)
    .bind(&body.date_of_joining)
    .bind(&body.qualifications)
    .bind(&body.blood_group)
    .bind(&body.address)
    .bind(&body.emergency_contact)
    .bind(&body.bank_name)
    .bind(&body.bank_account)
    .bind(&body.bank_ifsc)
    .bind(&body.pf_number)
    .bind(&body.esi_number)
    .bind(&body.uan_number)
    .bind(&body.pan_number)
    .bind(&body.aadhaar_number)
    .bind(body.user_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_employee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEmployeeRequest>,
) -> Result<Json<Employee>, AppError> {
    require_permission(&claims, permissions::hr::employees::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Employee>(
        "UPDATE employees SET \
         first_name = COALESCE($3, first_name), \
         last_name = COALESCE($4, last_name), \
         date_of_birth = COALESCE($5::date, date_of_birth), \
         gender = COALESCE($6, gender), \
         phone = COALESCE($7, phone), \
         email = COALESCE($8, email), \
         employment_type = COALESCE($9::employment_type, employment_type), \
         status = COALESCE($10::employee_status, status), \
         department_id = COALESCE($11, department_id), \
         designation_id = COALESCE($12, designation_id), \
         reporting_to = COALESCE($13, reporting_to), \
         date_of_leaving = COALESCE($14::date, date_of_leaving), \
         qualifications = COALESCE($15, qualifications), \
         blood_group = COALESCE($16, blood_group), \
         address = COALESCE($17, address), \
         emergency_contact = COALESCE($18, emergency_contact), \
         bank_name = COALESCE($19, bank_name), \
         bank_account = COALESCE($20, bank_account), \
         bank_ifsc = COALESCE($21, bank_ifsc), \
         pf_number = COALESCE($22, pf_number), \
         esi_number = COALESCE($23, esi_number), \
         uan_number = COALESCE($24, uan_number), \
         pan_number = COALESCE($25, pan_number), \
         aadhaar_number = COALESCE($26, aadhaar_number), \
         user_id = COALESCE($27, user_id), \
         notes = COALESCE($28, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(&body.date_of_birth)
    .bind(&body.gender)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.employment_type)
    .bind(&body.status)
    .bind(body.department_id)
    .bind(body.designation_id)
    .bind(body.reporting_to)
    .bind(&body.date_of_leaving)
    .bind(&body.qualifications)
    .bind(&body.blood_group)
    .bind(&body.address)
    .bind(&body.emergency_contact)
    .bind(&body.bank_name)
    .bind(&body.bank_account)
    .bind(&body.bank_ifsc)
    .bind(&body.pf_number)
    .bind(&body.esi_number)
    .bind(&body.uan_number)
    .bind(&body.pan_number)
    .bind(&body.aadhaar_number)
    .bind(body.user_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Credential handlers
// ══════════════════════════════════════════════════════════

pub async fn list_credentials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<EmployeeCredential>>, AppError> {
    require_permission(&claims, permissions::hr::credentials::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EmployeeCredential>(
        "SELECT * FROM employee_credentials \
         WHERE tenant_id = $1 AND employee_id = $2 \
         ORDER BY expiry_date NULLS LAST",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_credential(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
    Json(body): Json<CreateCredentialRequest>,
) -> Result<Json<EmployeeCredential>, AppError> {
    require_permission(&claims, permissions::hr::credentials::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EmployeeCredential>(
        "INSERT INTO employee_credentials \
         (tenant_id, employee_id, credential_type, issuing_body, registration_no, \
          state_code, issued_date, expiry_date, document_url, notes) \
         VALUES ($1, $2, $3::credential_type, $4, $5, $6, $7::date, $8::date, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .bind(&body.credential_type)
    .bind(&body.issuing_body)
    .bind(&body.registration_no)
    .bind(&body.state_code)
    .bind(&body.issued_date)
    .bind(&body.expiry_date)
    .bind(&body.document_url)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_credential(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((employee_id, cred_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateCredentialRequest>,
) -> Result<Json<EmployeeCredential>, AppError> {
    require_permission(&claims, permissions::hr::credentials::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EmployeeCredential>(
        "UPDATE employee_credentials SET \
         status = COALESCE($4::credential_status, status), \
         expiry_date = COALESCE($5::date, expiry_date), \
         verified_by = COALESCE($6, verified_by), \
         verified_at = CASE WHEN $6 IS NOT NULL THEN now() ELSE verified_at END, \
         document_url = COALESCE($7, document_url), \
         notes = COALESCE($8, notes) \
         WHERE id = $3 AND employee_id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(employee_id)
    .bind(claims.tenant_id)
    .bind(cred_id)
    .bind(&body.status)
    .bind(&body.expiry_date)
    .bind(body.verified_by)
    .bind(&body.document_url)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Shift handlers
// ══════════════════════════════════════════════════════════

pub async fn list_shifts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ShiftDefinition>>, AppError> {
    require_permission(&claims, permissions::hr::roster::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ShiftDefinition>(
        "SELECT * FROM shift_definitions WHERE tenant_id = $1 ORDER BY start_time",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateShiftRequest>,
) -> Result<Json<ShiftDefinition>, AppError> {
    require_permission(&claims, permissions::hr::roster::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ShiftDefinition>(
        "INSERT INTO shift_definitions \
         (tenant_id, code, name, shift_type, start_time, end_time, break_minutes, is_night) \
         VALUES ($1, $2, $3, COALESCE($4::shift_type, 'general'), \
         $5::time, $6::time, COALESCE($7, 0), COALESCE($8, false)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.shift_type)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(body.break_minutes)
    .bind(body.is_night)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateShiftRequest>,
) -> Result<Json<ShiftDefinition>, AppError> {
    require_permission(&claims, permissions::hr::roster::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ShiftDefinition>(
        "UPDATE shift_definitions SET \
         name = COALESCE($3, name), \
         shift_type = COALESCE($4::shift_type, shift_type), \
         start_time = COALESCE($5::time, start_time), \
         end_time = COALESCE($6::time, end_time), \
         break_minutes = COALESCE($7, break_minutes), \
         is_night = COALESCE($8, is_night), \
         is_active = COALESCE($9, is_active) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.shift_type)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(body.break_minutes)
    .bind(body.is_night)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Duty Roster handlers
// ══════════════════════════════════════════════════════════

pub async fn list_rosters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRosterQuery>,
) -> Result<Json<Vec<DutyRoster>>, AppError> {
    require_permission(&claims, permissions::hr::roster::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let (Some(from), Some(to)) = (&params.date_from, &params.date_to) {
        sqlx::query_as::<_, DutyRoster>(
            "SELECT * FROM duty_rosters WHERE tenant_id = $1 \
             AND roster_date BETWEEN $2::date AND $3::date \
             ORDER BY roster_date, employee_id",
        )
        .bind(claims.tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, DutyRoster>(
            "SELECT * FROM duty_rosters WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY roster_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, DutyRoster>(
            "SELECT * FROM duty_rosters WHERE tenant_id = $1 \
             ORDER BY roster_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_roster(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRosterRequest>,
) -> Result<Json<DutyRoster>, AppError> {
    require_permission(&claims, permissions::hr::roster::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DutyRoster>(
        "INSERT INTO duty_rosters \
         (tenant_id, employee_id, department_id, shift_id, roster_date, \
          is_on_call, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5::date, COALESCE($6, false), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.department_id)
    .bind(body.shift_id)
    .bind(&body.roster_date)
    .bind(body.is_on_call)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_swap(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DutyRoster>, AppError> {
    require_permission(&claims, permissions::hr::roster::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DutyRoster>(
        "UPDATE duty_rosters SET swap_approved = true \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Attendance handlers
// ══════════════════════════════════════════════════════════

pub async fn list_attendance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAttendanceQuery>,
) -> Result<Json<Vec<AttendanceRecord>>, AppError> {
    require_permission(&claims, permissions::hr::attendance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, AttendanceRecord>(
            "SELECT * FROM attendance_records \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY attendance_date DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let (Some(from), Some(to)) = (&params.date_from, &params.date_to) {
        sqlx::query_as::<_, AttendanceRecord>(
            "SELECT * FROM attendance_records WHERE tenant_id = $1 \
             AND attendance_date BETWEEN $2::date AND $3::date \
             ORDER BY attendance_date, employee_id",
        )
        .bind(claims.tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, AttendanceRecord>(
            "SELECT * FROM attendance_records WHERE tenant_id = $1 \
             ORDER BY attendance_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_attendance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAttendanceRequest>,
) -> Result<Json<AttendanceRecord>, AppError> {
    require_permission(&claims, permissions::hr::attendance::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AttendanceRecord>(
        "INSERT INTO attendance_records \
         (tenant_id, employee_id, attendance_date, shift_id, \
          check_in, check_out, status, source, notes, recorded_by) \
         VALUES ($1, $2, $3::date, $4, $5::timestamptz, $6::timestamptz, \
         COALESCE($7, 'present'), COALESCE($8, 'manual'), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.attendance_date)
    .bind(body.shift_id)
    .bind(&body.check_in)
    .bind(&body.check_out)
    .bind(&body.status)
    .bind(&body.source)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Leave handlers
// ══════════════════════════════════════════════════════════

pub async fn list_leave_balances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<LeaveBalance>>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LeaveBalance>(
        "SELECT * FROM leave_balances \
         WHERE tenant_id = $1 AND employee_id = $2 \
         ORDER BY year DESC, leave_type",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_leave_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListLeaveQuery>,
) -> Result<Json<Vec<LeaveRequest>>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, LeaveRequest>(
            "SELECT * FROM leave_requests \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.status {
        sqlx::query_as::<_, LeaveRequest>(
            "SELECT * FROM leave_requests \
             WHERE tenant_id = $1 AND status = $2::leave_status \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LeaveRequest>(
            "SELECT * FROM leave_requests WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_leave_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLeaveRequest>,
) -> Result<Json<LeaveRequest>, AppError> {
    require_permission(&claims, permissions::hr::leave::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LeaveRequest>(
        "INSERT INTO leave_requests \
         (tenant_id, employee_id, leave_type, start_date, end_date, \
          days, is_half_day, reason, status) \
         VALUES ($1, $2, $3::leave_type, $4::date, $5::date, \
         COALESCE($6, 1), COALESCE($7, false), $8, 'pending_hod') \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.leave_type)
    .bind(&body.start_date)
    .bind(&body.end_date)
    .bind(body.days)
    .bind(body.is_half_day)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn leave_action(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LeaveActionRequest>,
) -> Result<Json<LeaveRequest>, AppError> {
    require_permission(&claims, permissions::hr::leave::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let new_status = match body.action.as_str() {
        "approve_hod" => "pending_admin",
        "approve_admin" | "approve" => "approved",
        "reject" => "rejected",
        _ => return Err(AppError::BadRequest("Invalid action".into())),
    };

    let row = sqlx::query_as::<_, LeaveRequest>(
        "UPDATE leave_requests SET \
         status = $3::leave_status, \
         hod_id = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_id IS NULL \
                       THEN $4 ELSE hod_id END, \
         hod_action_at = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_action_at IS NULL \
                              THEN now() ELSE hod_action_at END, \
         hod_remarks = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_remarks IS NULL \
                            THEN $5 ELSE hod_remarks END, \
         admin_id = CASE WHEN $3 IN ('approved','rejected') AND admin_id IS NULL \
                         THEN $4 ELSE admin_id END, \
         admin_action_at = CASE WHEN $3 IN ('approved','rejected') AND admin_action_at IS NULL \
                                THEN now() ELSE admin_action_at END, \
         admin_remarks = CASE WHEN $3 IN ('approved','rejected') AND admin_remarks IS NULL \
                              THEN $5 ELSE admin_remarks END \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.remarks)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LeaveRequest>, AppError> {
    require_permission(&claims, permissions::hr::leave::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LeaveRequest>(
        "UPDATE leave_requests SET \
         status = 'cancelled'::leave_status, \
         cancelled_by = $3, cancelled_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  On-Call handlers
// ══════════════════════════════════════════════════════════

pub async fn list_on_call(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOnCallQuery>,
) -> Result<Json<Vec<OnCallSchedule>>, AppError> {
    require_permission(&claims, permissions::hr::on_call::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref date) = params.schedule_date {
        sqlx::query_as::<_, OnCallSchedule>(
            "SELECT * FROM on_call_schedules \
             WHERE tenant_id = $1 AND schedule_date = $2::date \
             ORDER BY department_id, start_time",
        )
        .bind(claims.tenant_id)
        .bind(date)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OnCallSchedule>(
            "SELECT * FROM on_call_schedules WHERE tenant_id = $1 \
             ORDER BY schedule_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_on_call(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOnCallRequest>,
) -> Result<Json<OnCallSchedule>, AppError> {
    require_permission(&claims, permissions::hr::on_call::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OnCallSchedule>(
        "INSERT INTO on_call_schedules \
         (tenant_id, employee_id, department_id, schedule_date, \
          start_time, end_time, is_primary, contact_number, notes, created_by) \
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time, \
         COALESCE($7, true), $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.department_id)
    .bind(&body.schedule_date)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(body.is_primary)
    .bind(&body.contact_number)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Training handlers
// ══════════════════════════════════════════════════════════

pub async fn list_training_programs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TrainingProgram>>, AppError> {
    require_permission(&claims, permissions::hr::training::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TrainingProgram>(
        "SELECT * FROM training_programs WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_training_program(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTrainingProgramRequest>,
) -> Result<Json<TrainingProgram>, AppError> {
    require_permission(&claims, permissions::hr::training::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TrainingProgram>(
        "INSERT INTO training_programs \
         (tenant_id, code, name, description, is_mandatory, \
          frequency_months, duration_hours, target_roles) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), $6, $7, \
         COALESCE($8, '[]'::jsonb)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_mandatory)
    .bind(body.frequency_months)
    .bind(body.duration_hours)
    .bind(&body.target_roles)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_training_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<TrainingRecord>>, AppError> {
    require_permission(&claims, permissions::hr::training::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TrainingRecord>(
        "SELECT * FROM training_records \
         WHERE tenant_id = $1 AND employee_id = $2 \
         ORDER BY training_date DESC",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_training_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTrainingRecordRequest>,
) -> Result<Json<TrainingRecord>, AppError> {
    require_permission(&claims, permissions::hr::training::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TrainingRecord>(
        "INSERT INTO training_records \
         (tenant_id, employee_id, program_id, training_date, status, \
          score, certificate_no, expiry_date, trainer_name, notes) \
         VALUES ($1, $2, $3, $4::date, \
         COALESCE($5::training_status, 'scheduled'), \
         $6, $7, $8::date, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.program_id)
    .bind(&body.training_date)
    .bind(&body.status)
    .bind(body.score)
    .bind(&body.certificate_no)
    .bind(&body.expiry_date)
    .bind(&body.trainer_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Appraisal handlers
// ══════════════════════════════════════════════════════════

pub async fn list_appraisals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<Appraisal>>, AppError> {
    require_permission(&claims, permissions::hr::appraisal::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Appraisal>(
        "SELECT * FROM appraisals \
         WHERE tenant_id = $1 AND employee_id = $2 \
         ORDER BY appraisal_year DESC",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_appraisal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAppraisalRequest>,
) -> Result<Json<Appraisal>, AppError> {
    require_permission(&claims, permissions::hr::appraisal::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appraisal>(
        "INSERT INTO appraisals \
         (tenant_id, employee_id, appraisal_year, appraiser_id, \
          rating, strengths, improvements, goals, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '[]'::jsonb), $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.appraisal_year)
    .bind(claims.sub)
    .bind(body.rating)
    .bind(&body.strengths)
    .bind(&body.improvements)
    .bind(&body.goals)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Statutory Record handlers
// ══════════════════════════════════════════════════════════

pub async fn list_statutory_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<StatutoryRecord>>, AppError> {
    require_permission(&claims, permissions::hr::credentials::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StatutoryRecord>(
        "SELECT * FROM statutory_records \
         WHERE tenant_id = $1 AND employee_id = $2 \
         ORDER BY compliance_date DESC NULLS LAST",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_statutory_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStatutoryRecordRequest>,
) -> Result<Json<StatutoryRecord>, AppError> {
    require_permission(&claims, permissions::hr::credentials::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StatutoryRecord>(
        "INSERT INTO statutory_records \
         (tenant_id, employee_id, record_type, title, \
          compliance_date, expiry_date, details, notes) \
         VALUES ($1, $2, $3, $4, $5::date, $6::date, \
         COALESCE($7, '{}'::jsonb), $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.record_type)
    .bind(&body.title)
    .bind(&body.compliance_date)
    .bind(&body.expiry_date)
    .bind(&body.details)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Training Compliance analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TrainingComplianceRow {
    pub program_id: Uuid,
    pub program_name: String,
    pub total_employees: i64,
    pub completed_count: i64,
    pub completion_pct: f64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ExpiringCredentialRow {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub credential_type: String,
    pub credential_number: String,
    pub expiry_date: Option<chrono::NaiveDate>,
}

#[derive(Debug, serde::Serialize)]
pub struct TrainingComplianceResponse {
    pub programs: Vec<TrainingComplianceRow>,
    pub expiring_credentials: Vec<ExpiringCredentialRow>,
}

pub async fn training_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TrainingComplianceResponse>, AppError> {
    require_permission(&claims, permissions::hr::training::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Completion rates per mandatory training program
    let programs = sqlx::query_as::<_, TrainingComplianceRow>(
        "SELECT \
             tp.id AS program_id, \
             tp.name AS program_name, \
             (SELECT COUNT(*) FROM employees e2 \
              WHERE e2.tenant_id = tp.tenant_id AND e2.status = 'active')::bigint \
                 AS total_employees, \
             COUNT(DISTINCT tr.employee_id)::bigint AS completed_count, \
             CASE WHEN (SELECT COUNT(*) FROM employees e3 \
                        WHERE e3.tenant_id = tp.tenant_id AND e3.status = 'active') > 0 \
                 THEN ROUND( \
                     (COUNT(DISTINCT tr.employee_id)::numeric / \
                      (SELECT COUNT(*) FROM employees e4 \
                       WHERE e4.tenant_id = tp.tenant_id AND e4.status = 'active')::numeric \
                     ) * 100, 2 \
                 )::float8 \
                 ELSE 0.0 \
             END AS completion_pct \
         FROM training_programs tp \
         LEFT JOIN training_records tr ON tr.program_id = tp.id \
             AND tr.tenant_id = tp.tenant_id \
             AND tr.status = 'completed' \
         WHERE tp.tenant_id = $1 AND tp.is_mandatory = true \
         GROUP BY tp.id, tp.name \
         ORDER BY completion_pct ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Credentials expiring within 90 days
    let expiring_credentials = sqlx::query_as::<_, ExpiringCredentialRow>(
        "SELECT id, employee_id, credential_type, credential_number, expiry_date \
         FROM employee_credentials \
         WHERE tenant_id = $1 \
         AND expiry_date IS NOT NULL \
         AND expiry_date <= CURRENT_DATE + interval '90 days' \
         AND expiry_date >= CURRENT_DATE \
         ORDER BY expiry_date ASC \
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(TrainingComplianceResponse {
        programs,
        expiring_credentials,
    }))
}
