#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::insurance::{
    AppealStatus, DenialReasonCount, InsuranceDashboard, InsuranceVerification, PaCheckResult,
    PaRequirementRule, PaUrgency, PriorAuthAppeal, PriorAuthDocument, PriorAuthRequest,
    PriorAuthStatus, VerificationStatus,
};
use medbrains_core::permissions;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Verification ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVerificationsQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct RunVerificationRequest {
    pub patient_id: Uuid,
    pub patient_insurance_id: Uuid,
    pub trigger_point: String,
    pub trigger_entity_id: Option<Uuid>,
}

// ── Prior Auth ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPriorAuthQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
    pub urgency: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePriorAuthRequest {
    pub patient_id: Uuid,
    pub patient_insurance_id: Uuid,
    pub service_type: String,
    pub service_code: Option<String>,
    pub service_description: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub ordering_doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
    pub insurance_claim_id: Option<Uuid>,
    pub urgency: Option<PaUrgency>,
    pub requested_start: Option<NaiveDate>,
    pub requested_end: Option<NaiveDate>,
    pub requested_units: Option<i32>,
    pub estimated_cost: Option<rust_decimal::Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePriorAuthRequestBody {
    pub service_type: Option<String>,
    pub service_code: Option<String>,
    pub service_description: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub urgency: Option<PaUrgency>,
    pub requested_start: Option<NaiveDate>,
    pub requested_end: Option<NaiveDate>,
    pub requested_units: Option<i32>,
    pub estimated_cost: Option<rust_decimal::Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct RespondPriorAuthRequest {
    pub status: PriorAuthStatus,
    pub auth_number: Option<String>,
    pub approved_start: Option<NaiveDate>,
    pub approved_end: Option<NaiveDate>,
    pub approved_units: Option<i32>,
    pub approved_amount: Option<rust_decimal::Decimal>,
    pub denial_reason: Option<String>,
    pub denial_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CheckPaRequest {
    pub patient_id: Uuid,
    pub service_type: String,
    pub charge_code: Option<String>,
    pub estimated_cost: Option<rust_decimal::Decimal>,
    pub expected_los: Option<i32>,
}

// ── Documents ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AttachDocumentRequest {
    pub document_type: String,
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub content_text: Option<String>,
    pub content_json: Option<Value>,
    pub source_entity: Option<String>,
    pub source_id: Option<Uuid>,
}

// ── Appeals ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAppealsQuery {
    pub prior_auth_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppealRequest {
    pub prior_auth_id: Uuid,
    pub reason: Option<String>,
    pub clinical_rationale: Option<String>,
    pub supporting_evidence: Option<String>,
    pub letter_content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppealRequest {
    pub status: Option<AppealStatus>,
    pub reason: Option<String>,
    pub clinical_rationale: Option<String>,
    pub supporting_evidence: Option<String>,
    pub letter_content: Option<String>,
    pub payer_decision: Option<String>,
    pub payer_response_date: Option<NaiveDate>,
    pub payer_notes: Option<String>,
}

// ── Rules ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateRuleRequest {
    pub rule_name: String,
    pub description: Option<String>,
    pub insurance_provider: Option<String>,
    pub scheme_type: Option<String>,
    pub tpa_name: Option<String>,
    pub service_type: Option<String>,
    pub charge_code: Option<String>,
    pub charge_code_pattern: Option<String>,
    pub cost_threshold: Option<rust_decimal::Decimal>,
    pub los_threshold: Option<i32>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRuleRequest {
    pub rule_name: Option<String>,
    pub description: Option<String>,
    pub insurance_provider: Option<String>,
    pub scheme_type: Option<String>,
    pub tpa_name: Option<String>,
    pub service_type: Option<String>,
    pub charge_code: Option<String>,
    pub charge_code_pattern: Option<String>,
    pub cost_threshold: Option<rust_decimal::Decimal>,
    pub los_threshold: Option<i32>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

// ── Internal helper types ───────────────────────────────

#[derive(sqlx::FromRow)]
struct CountRow {
    count: i64,
}

#[derive(sqlx::FromRow)]
struct DenialRow {
    reason: Option<String>,
    count: i64,
}

#[derive(sqlx::FromRow)]
struct AvgTatRow {
    avg_hours: Option<f64>,
}

// ══════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════

async fn generate_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    seq_type: &str,
    prefix: &str,
) -> Result<String, AppError> {
    let row: (i64,) = sqlx::query_as(
        "INSERT INTO sequences (tenant_id, seq_type, current_value) \
         VALUES ($1, $2, 1) \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET current_value = sequences.current_value + 1 \
         RETURNING current_value",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_one(&mut **tx)
    .await?;
    Ok(format!("{prefix}-{:06}", row.0))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Verification
// ══════════════════════════════════════════════════════════

pub async fn run_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RunVerificationRequest>,
) -> Result<Json<InsuranceVerification>, AppError> {
    require_permission(&claims, permissions::insurance::verification::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Look up the patient_insurance record to build verification snapshot
    type PolicyRow = (
        Option<String>,
        Option<String>,
        Option<NaiveDate>,
        Option<NaiveDate>,
        Option<rust_decimal::Decimal>,
        Option<String>,
    );
    let policy: Option<PolicyRow> = sqlx::query_as(
        "SELECT insurance_provider, member_id, valid_from, valid_until, \
                sum_insured, scheme_type::text \
         FROM patient_insurance \
         WHERE id = $1 AND tenant_id = $2 AND patient_id = $3",
    )
    .bind(body.patient_insurance_id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((payer_name, member_id, coverage_start, coverage_end, scheme_balance, scheme_type)) =
        policy
    else {
        // No policy found — create error verification
        let row: InsuranceVerification = sqlx::query_as(
            "INSERT INTO insurance_verifications \
                 (tenant_id, patient_id, patient_insurance_id, trigger_point, \
                  trigger_entity_id, status, error_code, error_message, verified_by, verified_at) \
             VALUES ($1, $2, $3, $4, $5, 'error', 'NO_POLICY', 'Insurance policy not found', $6, now()) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(body.patient_insurance_id)
        .bind(&body.trigger_point)
        .bind(body.trigger_entity_id)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        return Ok(Json(row));
    };

    // Determine status based on coverage dates
    let today = Utc::now().date_naive();
    let status = match (coverage_start, coverage_end) {
        (Some(start), Some(end)) if today >= start && today <= end => VerificationStatus::Active,
        (Some(start), None) if today >= start => VerificationStatus::Active,
        (None, Some(end)) if today <= end => VerificationStatus::Active,
        (None, None) => VerificationStatus::Active,
        _ => VerificationStatus::Inactive,
    };

    let row: InsuranceVerification = sqlx::query_as(
        "INSERT INTO insurance_verifications \
             (tenant_id, patient_id, patient_insurance_id, trigger_point, \
              trigger_entity_id, status, verified_at, payer_name, member_id, \
              coverage_start, coverage_end, scheme_type, scheme_balance, \
              verified_by) \
         VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11::insurance_scheme_type, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.patient_insurance_id)
    .bind(&body.trigger_point)
    .bind(body.trigger_entity_id)
    .bind(&status)
    .bind(&payer_name)
    .bind(&member_id)
    .bind(coverage_start)
    .bind(coverage_end)
    .bind(&scheme_type)
    .bind(scheme_balance)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_verifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListVerificationsQuery>,
) -> Result<Json<Vec<InsuranceVerification>>, AppError> {
    require_permission(&claims, permissions::insurance::verification::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows: Vec<InsuranceVerification> = sqlx::query_as(
        "SELECT * FROM insurance_verifications \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR patient_id = $2) \
           AND ($3::text IS NULL OR status::text = $3) \
           AND ($4::date IS NULL OR created_at::date >= $4) \
           AND ($5::date IS NULL OR created_at::date <= $5) \
         ORDER BY created_at DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .bind(&q.status)
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InsuranceVerification>, AppError> {
    require_permission(&claims, permissions::insurance::verification::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: InsuranceVerification =
        sqlx::query_as("SELECT * FROM insurance_verifications WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_patient_benefits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pid): Path<Uuid>,
) -> Result<Json<Option<InsuranceVerification>>, AppError> {
    require_permission(&claims, permissions::insurance::verification::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: Option<InsuranceVerification> = sqlx::query_as(
        "SELECT * FROM insurance_verifications \
         WHERE tenant_id = $1 AND patient_id = $2 AND status = 'active' \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(pid)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Prior Auth
// ══════════════════════════════════════════════════════════

pub async fn list_prior_auths(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListPriorAuthQuery>,
) -> Result<Json<Vec<PriorAuthRequest>>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows: Vec<PriorAuthRequest> = sqlx::query_as(
        "SELECT * FROM prior_auth_requests \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR patient_id = $2) \
           AND ($3::text IS NULL OR status::text = $3) \
           AND ($4::text IS NULL OR urgency::text = $4) \
           AND ($5::date IS NULL OR created_at::date >= $5) \
           AND ($6::date IS NULL OR created_at::date <= $6) \
         ORDER BY created_at DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .bind(&q.status)
    .bind(&q.urgency)
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: PriorAuthRequest =
        sqlx::query_as("SELECT * FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePriorAuthRequest>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pa_number = generate_number(&mut tx, claims.tenant_id, "prior_auth", "PA").await?;
    let urgency = body.urgency.unwrap_or(PaUrgency::Standard);

    let row: PriorAuthRequest = sqlx::query_as(
        "INSERT INTO prior_auth_requests \
             (tenant_id, pa_number, patient_id, patient_insurance_id, \
              service_type, service_code, service_description, diagnosis_codes, \
              ordering_doctor_id, department_id, encounter_id, invoice_id, insurance_claim_id, \
              status, urgency, requested_start, requested_end, requested_units, estimated_cost, \
              created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14,$15,$16,$17,$18,$19) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&pa_number)
    .bind(body.patient_id)
    .bind(body.patient_insurance_id)
    .bind(&body.service_type)
    .bind(&body.service_code)
    .bind(&body.service_description)
    .bind(&body.diagnosis_codes)
    .bind(body.ordering_doctor_id)
    .bind(body.department_id)
    .bind(body.encounter_id)
    .bind(body.invoice_id)
    .bind(body.insurance_claim_id)
    .bind(&urgency)
    .bind(body.requested_start)
    .bind(body.requested_end)
    .bind(body.requested_units)
    .bind(body.estimated_cost)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Status log entry
    sqlx::query(
        "INSERT INTO prior_auth_status_log \
             (tenant_id, prior_auth_id, to_status, notes, changed_by) \
         VALUES ($1, $2, 'draft', 'Created', $3)",
    )
    .bind(claims.tenant_id)
    .bind(row.id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePriorAuthRequestBody>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Only allow update when in draft or pending_info
    let row: PriorAuthRequest = sqlx::query_as(
        "UPDATE prior_auth_requests SET \
             service_type = COALESCE($3, service_type), \
             service_code = COALESCE($4, service_code), \
             service_description = COALESCE($5, service_description), \
             diagnosis_codes = COALESCE($6, diagnosis_codes), \
             urgency = COALESCE($7, urgency), \
             requested_start = COALESCE($8, requested_start), \
             requested_end = COALESCE($9, requested_end), \
             requested_units = COALESCE($10, requested_units), \
             estimated_cost = COALESCE($11, estimated_cost) \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('draft', 'pending_info') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.service_type)
    .bind(&body.service_code)
    .bind(&body.service_description)
    .bind(&body.diagnosis_codes)
    .bind(&body.urgency)
    .bind(body.requested_start)
    .bind(body.requested_end)
    .bind(body.requested_units)
    .bind(body.estimated_cost)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn submit_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::SUBMIT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get current to determine TAT
    let current: PriorAuthRequest =
        sqlx::query_as("SELECT * FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let tat_hours = match current.urgency {
        PaUrgency::Standard => 72,
        PaUrgency::Urgent => 24,
        PaUrgency::Retrospective => 120,
    };

    let row: PriorAuthRequest = sqlx::query_as(
        "UPDATE prior_auth_requests SET \
             status = 'submitted', submitted_at = now(), submitted_by = $3, \
             expected_tat_hours = $4 \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('draft', 'pending_info') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(tat_hours)
    .fetch_one(&mut *tx)
    .await?;

    // Status log
    sqlx::query(
        "INSERT INTO prior_auth_status_log \
             (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
         VALUES ($1, $2, $3, 'submitted', 'Submitted to payer', $4)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&current.status)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn respond_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RespondPriorAuthRequest>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current: PriorAuthRequest =
        sqlx::query_as("SELECT * FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let row: PriorAuthRequest = sqlx::query_as(
        "UPDATE prior_auth_requests SET \
             status = $3, responded_at = now(), \
             auth_number = COALESCE($4, auth_number), \
             approved_start = COALESCE($5, approved_start), \
             approved_end = COALESCE($6, approved_end), \
             approved_units = COALESCE($7, approved_units), \
             approved_amount = COALESCE($8, approved_amount), \
             denial_reason = COALESCE($9, denial_reason), \
             denial_code = COALESCE($10, denial_code) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.auth_number)
    .bind(body.approved_start)
    .bind(body.approved_end)
    .bind(body.approved_units)
    .bind(body.approved_amount)
    .bind(&body.denial_reason)
    .bind(&body.denial_code)
    .fetch_one(&mut *tx)
    .await?;

    // Status log
    sqlx::query(
        "INSERT INTO prior_auth_status_log \
             (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&current.status)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PriorAuthRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current: PriorAuthRequest =
        sqlx::query_as("SELECT * FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let row: PriorAuthRequest = sqlx::query_as(
        "UPDATE prior_auth_requests SET status = 'cancelled' \
         WHERE id = $1 AND tenant_id = $2 \
           AND status NOT IN ('approved', 'denied', 'expired', 'cancelled') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO prior_auth_status_log \
             (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
         VALUES ($1, $2, $3, 'cancelled', 'Cancelled', $4)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&current.status)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn check_pa_required(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CheckPaRequest>,
) -> Result<Json<PaCheckResult>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Look up patient's active insurance
    let insurance: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT insurance_provider, scheme_type::text, tpa_name \
         FROM patient_insurance \
         WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
         ORDER BY priority ASC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((provider, scheme, tpa)) = insurance else {
        tx.commit().await?;
        return Ok(Json(PaCheckResult {
            required: false,
            matching_rule_id: None,
            rule_name: None,
        }));
    };

    // Match against PA requirement rules
    let rule: Option<PaRequirementRule> = sqlx::query_as(
        "SELECT * FROM pa_requirement_rules \
         WHERE tenant_id = $1 AND is_active = true \
           AND (insurance_provider IS NULL OR insurance_provider = $2) \
           AND (scheme_type IS NULL OR scheme_type::text = $3) \
           AND (tpa_name IS NULL OR tpa_name = $4) \
           AND (service_type IS NULL OR service_type = $5) \
           AND (charge_code IS NULL OR charge_code = $6) \
           AND (cost_threshold IS NULL OR $7 >= cost_threshold) \
           AND (los_threshold IS NULL OR $8 >= los_threshold) \
         ORDER BY priority DESC \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(&provider)
    .bind(&scheme)
    .bind(&tpa)
    .bind(&body.service_type)
    .bind(&body.charge_code)
    .bind(body.estimated_cost)
    .bind(body.expected_los)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(match rule {
        Some(r) => PaCheckResult {
            required: true,
            matching_rule_id: Some(r.id),
            rule_name: Some(r.rule_name),
        },
        None => PaCheckResult {
            required: false,
            matching_rule_id: None,
            rule_name: None,
        },
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Documents
// ══════════════════════════════════════════════════════════

pub async fn list_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pa_id): Path<Uuid>,
) -> Result<Json<Vec<PriorAuthDocument>>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows: Vec<PriorAuthDocument> = sqlx::query_as(
        "SELECT * FROM prior_auth_documents \
         WHERE prior_auth_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(pa_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn attach_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pa_id): Path<Uuid>,
    Json(body): Json<AttachDocumentRequest>,
) -> Result<Json<PriorAuthDocument>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: PriorAuthDocument = sqlx::query_as(
        "INSERT INTO prior_auth_documents \
             (tenant_id, prior_auth_id, document_type, file_name, file_path, \
              file_size_bytes, mime_type, content_text, content_json, \
              source_entity, source_id, uploaded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(pa_id)
    .bind(&body.document_type)
    .bind(&body.file_name)
    .bind(&body.file_path)
    .bind(body.file_size_bytes)
    .bind(&body.mime_type)
    .bind(&body.content_text)
    .bind(&body.content_json)
    .bind(&body.source_entity)
    .bind(body.source_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((pa_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "DELETE FROM prior_auth_documents \
         WHERE id = $1 AND prior_auth_id = $2 AND tenant_id = $3",
    )
    .bind(doc_id)
    .bind(pa_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Appeals
// ══════════════════════════════════════════════════════════

pub async fn list_appeals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListAppealsQuery>,
) -> Result<Json<Vec<PriorAuthAppeal>>, AppError> {
    require_permission(&claims, permissions::insurance::appeals::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows: Vec<PriorAuthAppeal> = sqlx::query_as(
        "SELECT * FROM prior_auth_appeals \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR prior_auth_id = $2) \
           AND ($3::text IS NULL OR status::text = $3) \
         ORDER BY created_at DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.prior_auth_id)
    .bind(&q.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_appeal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAppealRequest>,
) -> Result<Json<PriorAuthAppeal>, AppError> {
    require_permission(&claims, permissions::insurance::appeals::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify the PA is denied
    let pa: PriorAuthRequest = sqlx::query_as(
        "SELECT * FROM prior_auth_requests \
         WHERE id = $1 AND tenant_id = $2 AND status = 'denied'",
    )
    .bind(body.prior_auth_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Count existing appeals to determine level
    let count_row: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_appeals \
         WHERE prior_auth_id = $1 AND tenant_id = $2",
    )
    .bind(pa.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let level = (count_row.count + 1) as i32;

    let appeal_number = generate_number(&mut tx, claims.tenant_id, "pa_appeal", "APL").await?;

    let deadline = (Utc::now() + chrono::Duration::days(30)).date_naive();

    let row: PriorAuthAppeal = sqlx::query_as(
        "INSERT INTO prior_auth_appeals \
             (tenant_id, prior_auth_id, appeal_number, level, status, \
              reason, clinical_rationale, supporting_evidence, letter_content, \
              deadline, created_by) \
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.prior_auth_id)
    .bind(&appeal_number)
    .bind(level)
    .bind(&body.reason)
    .bind(&body.clinical_rationale)
    .bind(&body.supporting_evidence)
    .bind(&body.letter_content)
    .bind(deadline)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_appeal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAppealRequest>,
) -> Result<Json<PriorAuthAppeal>, AppError> {
    require_permission(&claims, permissions::insurance::appeals::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Handle status transitions
    let submitted_at = body
        .status
        .as_ref()
        .filter(|s| **s == AppealStatus::Submitted)
        .map(|_| Utc::now());
    let submitted_by = submitted_at.map(|_| claims.sub);
    let resolved_at = body
        .status
        .as_ref()
        .filter(|s| {
            matches!(
                s,
                AppealStatus::Upheld | AppealStatus::Overturned | AppealStatus::Withdrawn
            )
        })
        .map(|_| Utc::now());

    let row: PriorAuthAppeal = sqlx::query_as(
        "UPDATE prior_auth_appeals SET \
             status = COALESCE($3, status), \
             reason = COALESCE($4, reason), \
             clinical_rationale = COALESCE($5, clinical_rationale), \
             supporting_evidence = COALESCE($6, supporting_evidence), \
             letter_content = COALESCE($7, letter_content), \
             payer_decision = COALESCE($8, payer_decision), \
             payer_response_date = COALESCE($9, payer_response_date), \
             payer_notes = COALESCE($10, payer_notes), \
             submitted_at = COALESCE($11, submitted_at), \
             submitted_by = COALESCE($12, submitted_by), \
             resolved_at = COALESCE($13, resolved_at) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.reason)
    .bind(&body.clinical_rationale)
    .bind(&body.supporting_evidence)
    .bind(&body.letter_content)
    .bind(&body.payer_decision)
    .bind(body.payer_response_date)
    .bind(&body.payer_notes)
    .bind(submitted_at)
    .bind(submitted_by)
    .bind(resolved_at)
    .fetch_one(&mut *tx)
    .await?;

    // If overturned, auto-update parent PA to approved
    if body.status == Some(AppealStatus::Overturned) {
        let pa: PriorAuthRequest = sqlx::query_as(
            "UPDATE prior_auth_requests SET status = 'approved' \
             WHERE id = $1 AND tenant_id = $2 RETURNING *",
        )
        .bind(row.prior_auth_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO prior_auth_status_log \
                 (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
             VALUES ($1, $2, 'denied', 'approved', 'Appeal overturned', $3)",
        )
        .bind(claims.tenant_id)
        .bind(pa.id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — PA Rules
// ══════════════════════════════════════════════════════════

pub async fn list_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PaRequirementRule>>, AppError> {
    require_permission(&claims, permissions::insurance::rules::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows: Vec<PaRequirementRule> = sqlx::query_as(
        "SELECT * FROM pa_requirement_rules \
         WHERE tenant_id = $1 ORDER BY priority DESC, rule_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRuleRequest>,
) -> Result<Json<PaRequirementRule>, AppError> {
    require_permission(&claims, permissions::insurance::rules::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: PaRequirementRule = sqlx::query_as(
        "INSERT INTO pa_requirement_rules \
             (tenant_id, rule_name, description, insurance_provider, \
              scheme_type, tpa_name, service_type, charge_code, charge_code_pattern, \
              cost_threshold, los_threshold, priority, is_active, created_by) \
         VALUES ($1,$2,$3,$4,$5::insurance_scheme_type,$6,$7,$8,$9,$10,$11,COALESCE($12,0),COALESCE($13,true),$14) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.rule_name)
    .bind(&body.description)
    .bind(&body.insurance_provider)
    .bind(&body.scheme_type)
    .bind(&body.tpa_name)
    .bind(&body.service_type)
    .bind(&body.charge_code)
    .bind(&body.charge_code_pattern)
    .bind(body.cost_threshold)
    .bind(body.los_threshold)
    .bind(body.priority)
    .bind(body.is_active)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRuleRequest>,
) -> Result<Json<PaRequirementRule>, AppError> {
    require_permission(&claims, permissions::insurance::rules::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: PaRequirementRule = sqlx::query_as(
        "UPDATE pa_requirement_rules SET \
             rule_name = COALESCE($3, rule_name), \
             description = COALESCE($4, description), \
             insurance_provider = COALESCE($5, insurance_provider), \
             scheme_type = COALESCE($6::insurance_scheme_type, scheme_type), \
             tpa_name = COALESCE($7, tpa_name), \
             service_type = COALESCE($8, service_type), \
             charge_code = COALESCE($9, charge_code), \
             charge_code_pattern = COALESCE($10, charge_code_pattern), \
             cost_threshold = COALESCE($11, cost_threshold), \
             los_threshold = COALESCE($12, los_threshold), \
             priority = COALESCE($13, priority), \
             is_active = COALESCE($14, is_active) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.rule_name)
    .bind(&body.description)
    .bind(&body.insurance_provider)
    .bind(&body.scheme_type)
    .bind(&body.tpa_name)
    .bind(&body.service_type)
    .bind(&body.charge_code)
    .bind(&body.charge_code_pattern)
    .bind(body.cost_threshold)
    .bind(body.los_threshold)
    .bind(body.priority)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Dashboard
// ══════════════════════════════════════════════════════════

pub async fn dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<InsuranceDashboard>, AppError> {
    require_permission(&claims, permissions::insurance::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Total verifications
    let total_v: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM insurance_verifications WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let active_v: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM insurance_verifications \
         WHERE tenant_id = $1 AND status = 'active'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // PA counts
    let total_pa: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_requests WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let pending_pa: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_requests \
         WHERE tenant_id = $1 AND status IN ('draft','pending_info','submitted','in_review')",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let approved_pa: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_requests \
         WHERE tenant_id = $1 AND status IN ('approved','partially_approved')",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let denied_pa: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_requests \
         WHERE tenant_id = $1 AND status = 'denied'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let decided = approved_pa.count + denied_pa.count;
    let denial_rate = if decided > 0 {
        (denied_pa.count as f64 / decided as f64) * 100.0
    } else {
        0.0
    };

    // Pending appeals
    let pending_appeals: CountRow = sqlx::query_as(
        "SELECT COUNT(*)::bigint AS count FROM prior_auth_appeals \
         WHERE tenant_id = $1 AND status IN ('draft','submitted','in_review')",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Avg TAT
    let avg_tat: AvgTatRow = sqlx::query_as(
        "SELECT AVG(EXTRACT(EPOCH FROM (responded_at - submitted_at)) / 3600)::float8 AS avg_hours \
         FROM prior_auth_requests \
         WHERE tenant_id = $1 AND responded_at IS NOT NULL AND submitted_at IS NOT NULL",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Expiring soon (7 days)
    let expiring: Vec<PriorAuthRequest> = sqlx::query_as(
        "SELECT * FROM prior_auth_requests \
         WHERE tenant_id = $1 AND status = 'approved' \
           AND expires_at IS NOT NULL AND expires_at <= now() + interval '7 days' \
           AND expires_at > now() \
         ORDER BY expires_at ASC LIMIT 20",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Top denial reasons
    let denial_rows: Vec<DenialRow> = sqlx::query_as(
        "SELECT denial_reason AS reason, COUNT(*)::bigint AS count \
         FROM prior_auth_requests \
         WHERE tenant_id = $1 AND status = 'denied' AND denial_reason IS NOT NULL \
         GROUP BY denial_reason ORDER BY count DESC LIMIT 10",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let top_denial_reasons: Vec<DenialReasonCount> = denial_rows
        .into_iter()
        .map(|r| DenialReasonCount {
            reason: r.reason.unwrap_or_default(),
            count: r.count,
        })
        .collect();

    tx.commit().await?;

    Ok(Json(InsuranceDashboard {
        total_verifications: total_v.count,
        active_verifications: active_v.count,
        total_prior_auths: total_pa.count,
        pending_prior_auths: pending_pa.count,
        approved_prior_auths: approved_pa.count,
        denied_prior_auths: denied_pa.count,
        denial_rate_percent: denial_rate,
        pending_appeals: pending_appeals.count,
        avg_tat_hours: avg_tat.avg_hours,
        expiring_soon: expiring,
        top_denial_reasons,
    }))
}
