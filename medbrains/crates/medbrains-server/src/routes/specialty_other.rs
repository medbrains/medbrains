#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::specialty::other::{
    CancerStaging, ChemoProtocol, DialysisSession, RadiationSession, SpecialtyRecord,
    SpecialtyTemplate,
};
use medbrains_core::specialty::palliative::{
    DnrOrder, MortuaryRecord, NuclearMedAdministration, NuclearMedSource, PainAssessment,
};
use medbrains_core::specialty::pmr::{AudiologyTest, PsychometricTest, RehabPlan, RehabSession};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types — PMR
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListRehabPlansQuery {
    pub discipline: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRehabPlanRequest {
    pub patient_id: Uuid,
    pub discipline: String,
    pub diagnosis: Option<String>,
    pub goals: String,
    pub plan_details: Option<serde_json::Value>,
    pub fim_score_initial: Option<i32>,
    pub barthel_score_initial: Option<i32>,
    pub therapist_id: Option<Uuid>,
    pub target_end_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRehabSessionRequest {
    pub session_number: i32,
    pub therapist_id: Uuid,
    pub intervention: String,
    pub pain_score: Option<i32>,
    pub rom_data: Option<serde_json::Value>,
    pub strength_data: Option<serde_json::Value>,
    pub fim_score: Option<i32>,
    pub barthel_score: Option<i32>,
    pub duration_minutes: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAudiologyTestRequest {
    pub patient_id: Uuid,
    pub test_type: String,
    pub right_ear_results: Option<serde_json::Value>,
    pub left_ear_results: Option<serde_json::Value>,
    pub is_nhsp: Option<bool>,
    pub nhsp_referral_needed: Option<bool>,
    pub audiogram_data: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePsychometricRequest {
    pub patient_id: Uuid,
    pub test_name: String,
    pub raw_data_encrypted: Option<serde_json::Value>,
    pub summary_for_clinician: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Request / Query types — Palliative
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListDnrQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDnrRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub scope: String,
    pub witness_name: Option<String>,
    pub review_due_hours: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeDnrRequest {
    pub revocation_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePainAssessmentRequest {
    pub patient_id: Uuid,
    pub pain_score: i32,
    pub pain_location: Option<String>,
    pub pain_character: Option<String>,
    pub who_ladder_step: Option<i32>,
    pub opioid_dose_morphine_eq: Option<f64>,
    pub breakthrough_doses: Option<i32>,
    pub current_medications: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListMortuaryQuery {
    pub status: Option<String>,
    pub is_mlc: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMortuaryRequest {
    pub body_receipt_number: String,
    pub deceased_name: String,
    pub deceased_age: Option<i32>,
    pub deceased_gender: Option<String>,
    pub date_of_death: Option<String>,
    pub cause_of_death: Option<String>,
    pub is_mlc: Option<bool>,
    pub mlc_case_id: Option<Uuid>,
    pub cold_storage_slot: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMortuaryRequest {
    pub status: Option<String>,
    pub cold_storage_slot: Option<String>,
    pub pm_requested: Option<bool>,
    pub pm_performed_by: Option<String>,
    pub pm_findings: Option<String>,
    pub viscera_preserved: Option<bool>,
    pub organ_donation_status: Option<String>,
    pub released_to: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNuclearSourceRequest {
    pub isotope: String,
    pub activity_mci: f64,
    pub half_life_hours: f64,
    pub source_type: String,
    pub aerb_license_number: Option<String>,
    pub batch_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNuclearAdminRequest {
    pub source_id: Uuid,
    pub patient_id: Uuid,
    pub dose_mci: f64,
    pub route: String,
    pub indication: String,
    pub isolation_required: Option<bool>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Request / Query types — Other Specialties
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub specialty: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub specialty: String,
    pub template_name: String,
    pub template_code: String,
    pub form_schema: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecordRequest {
    pub patient_id: Uuid,
    pub specialty: String,
    pub template_id: Option<Uuid>,
    pub form_data: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListDialysisQuery {
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDialysisRequest {
    pub patient_id: Uuid,
    pub machine_number: Option<String>,
    pub access_type: String,
    pub dialyzer_type: Option<String>,
    pub pre_weight_kg: Option<f64>,
    pub uf_goal_ml: Option<i32>,
    /// Planned session duration (minutes) — used to check the ultrafiltration rate up front.
    pub duration_minutes: Option<i32>,
    pub heparin_dose: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateDialysisResponse {
    pub session: DialysisSession,
    /// Planned ultrafiltration rate in mL/kg/hr, when weight + goal + duration are all given.
    pub uf_rate_ml_kg_hr: Option<f64>,
    /// True when the planned UF rate exceeds the safe ceiling (KDOQI ~13 mL/kg/hr).
    pub uf_rate_exceeds_safe: bool,
}

/// KDOQI ultrafiltration-rate safety: removing fluid faster than ~13 mL/kg/hr drives intradialytic
/// hypotension and is associated with higher mortality. Returns the planned UF rate in mL/kg/hr, or
/// None when weight/duration are missing or non-positive.
const MAX_SAFE_UF_RATE_ML_KG_HR: f64 = 13.0;

fn uf_rate_ml_kg_hr(uf_goal_ml: i32, duration_minutes: i32, pre_weight_kg: f64) -> Option<f64> {
    if duration_minutes <= 0 || pre_weight_kg <= 0.0 || uf_goal_ml < 0 {
        return None;
    }
    Some(f64::from(uf_goal_ml) / (f64::from(duration_minutes) / 60.0) / pre_weight_kg)
}

#[derive(Debug, Deserialize)]
pub struct UpdateDialysisRequest {
    pub post_weight_kg: Option<f64>,
    pub uf_achieved_ml: Option<i32>,
    pub duration_minutes: Option<i32>,
    pub post_vitals: Option<serde_json::Value>,
    pub intradialytic_events: Option<serde_json::Value>,
    pub kt_v: Option<f64>,
    pub urr_pct: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListChemoQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChemoRequest {
    pub patient_id: Uuid,
    pub protocol_name: String,
    pub cancer_type: String,
    pub staging: Option<String>,
    pub regimen: Option<serde_json::Value>,
    pub cycle_number: Option<i32>,
    pub total_cycles: Option<i32>,
    /// Anthracycline given this cycle (if any) — for cumulative cardiotoxicity tracking.
    pub anthracycline_agent: Option<String>,
    /// This cycle's anthracycline dose in mg/m² (already normalised to body surface area).
    pub anthracycline_dose_mg_m2: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChemoRequest {
    pub toxicity_grade: Option<i32>,
    pub recist_response: Option<String>,
    pub tumor_board_discussed: Option<bool>,
    pub tumor_board_recommendation: Option<String>,
    pub next_cycle_date: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — PMR / Rehabilitation
// ══════════════════════════════════════════════════════════

pub async fn list_rehab_plans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRehabPlansQuery>,
) -> Result<Json<Vec<RehabPlan>>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::plans::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, RehabPlan>(
        "SELECT * FROM rehab_plans \
         WHERE ($1::text IS NULL OR discipline::text = $1) \
         AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.discipline)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_rehab_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRehabPlanRequest>,
) -> Result<Json<RehabPlan>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::plans::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, RehabPlan>(
        "INSERT INTO rehab_plans \
         (tenant_id, patient_id, discipline, diagnosis, goals, plan_details, \
          fim_score_initial, barthel_score_initial, therapist_id, target_end_date, notes) \
         VALUES ($1, $2, $3::rehab_discipline, $4, $5, COALESCE($6, '{}'::jsonb), \
                 $7, $8, $9, $10::date, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.discipline)
    .bind(&body.diagnosis)
    .bind(&body.goals)
    .bind(&body.plan_details)
    .bind(body.fim_score_initial)
    .bind(body.barthel_score_initial)
    .bind(body.therapist_id)
    .bind(&body.target_end_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_rehab_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<RehabSession>>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::sessions::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, RehabSession>(
        "SELECT * FROM rehab_sessions WHERE plan_id = $1 ORDER BY session_number LIMIT 5000",
    )
    .bind(plan_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_rehab_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
    Json(body): Json<CreateRehabSessionRequest>,
) -> Result<Json<RehabSession>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::sessions::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, RehabSession>(
        "INSERT INTO rehab_sessions \
         (tenant_id, plan_id, session_number, therapist_id, intervention, \
          pain_score, rom_data, strength_data, fim_score, barthel_score, \
          duration_minutes, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{}'::jsonb), \
                 COALESCE($8, '{}'::jsonb), $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(plan_id)
    .bind(body.session_number)
    .bind(body.therapist_id)
    .bind(&body.intervention)
    .bind(body.pain_score)
    .bind(&body.rom_data)
    .bind(&body.strength_data)
    .bind(body.fim_score)
    .bind(body.barthel_score)
    .bind(body.duration_minutes)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Audiology ────────────────────────────────────────────

pub async fn list_audiology_tests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AudiologyTest>>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::audiology::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AudiologyTest>(
        "SELECT * FROM audiology_tests ORDER BY test_date DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_audiology_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAudiologyTestRequest>,
) -> Result<Json<AudiologyTest>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::audiology::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, AudiologyTest>(
        "INSERT INTO audiology_tests \
         (tenant_id, patient_id, test_type, right_ear_results, left_ear_results, \
          is_nhsp, nhsp_referral_needed, audiogram_data, performed_by, notes) \
         VALUES ($1, $2, $3::hearing_test_type, COALESCE($4, '{}'::jsonb), \
                 COALESCE($5, '{}'::jsonb), COALESCE($6, false), \
                 COALESCE($7, false), COALESCE($8, '{}'::jsonb), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.test_type)
    .bind(&body.right_ear_results)
    .bind(&body.left_ear_results)
    .bind(body.is_nhsp)
    .bind(body.nhsp_referral_needed)
    .bind(&body.audiogram_data)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Psychometric Tests ───────────────────────────────────

pub async fn list_psychometric_tests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PsychometricTest>>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::psychometric::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PsychometricTest>(
        "SELECT * FROM psychometric_tests ORDER BY test_date DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_psychometric_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePsychometricRequest>,
) -> Result<Json<PsychometricTest>, AppError> {
    require_permission(&claims, permissions::specialty::pmr::psychometric::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PsychometricTest>(
        "INSERT INTO psychometric_tests \
         (tenant_id, patient_id, test_name, raw_data_encrypted, \
          summary_for_clinician, administered_by, notes) \
         VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.test_name)
    .bind(&body.raw_data_encrypted)
    .bind(&body.summary_for_clinician)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Palliative / Mortuary / Nuclear Med
// ══════════════════════════════════════════════════════════

pub async fn list_dnr_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDnrQuery>,
) -> Result<Json<Vec<DnrOrder>>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::dnr::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, DnrOrder>(
        "SELECT * FROM dnr_orders \
         WHERE ($1::text IS NULL OR status::text = $1) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// A DNR order must be reviewed periodically (NABH / palliative-care policy: reviewed regularly and
/// whenever the clinical condition changes), so the review interval can't be set open-ended — an
/// order that is never re-reviewed can outlive the patient's wishes or clinical reality. No single
/// interval is mandated, so this enforces a sanity range of 1 hour .. 30 days (default 48h).
const MAX_DNR_REVIEW_HOURS: i32 = 720;

fn validated_dnr_review_hours(requested: Option<i32>) -> Result<i32, AppError> {
    let hours = requested.unwrap_or(48);
    if (1..=MAX_DNR_REVIEW_HOURS).contains(&hours) {
        Ok(hours)
    } else {
        Err(AppError::BadRequest(format!(
            "DNR review interval must be between 1 and {MAX_DNR_REVIEW_HOURS} hours (30 days) — a DNR \
             order must be periodically reviewed and cannot be left open-ended."
        )))
    }
}

pub async fn create_dnr_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDnrRequest>,
) -> Result<Json<DnrOrder>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::dnr::MANAGE)?;
    let review_hours = validated_dnr_review_hours(body.review_due_hours)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, DnrOrder>(
        "INSERT INTO dnr_orders \
         (tenant_id, patient_id, admission_id, scope, authorized_by, \
          witness_name, review_due_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, \
                 now() + ($7 || ' hours')::interval, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(&body.scope)
    .bind(claims.sub)
    .bind(&body.witness_name)
    .bind(review_hours.to_string())
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn revoke_dnr_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeDnrRequest>,
) -> Result<Json<DnrOrder>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::dnr::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, DnrOrder>(
        "UPDATE dnr_orders SET status = 'revoked', revoked_at = now(), \
         revoked_by = $2, revocation_reason = $3 \
         WHERE id = $1 AND status = 'active' RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.revocation_reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Pain Assessment ──────────────────────────────────────

pub async fn list_pain_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PainAssessment>>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::pain::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PainAssessment>(
        "SELECT * FROM pain_assessments ORDER BY assessed_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_pain_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePainAssessmentRequest>,
) -> Result<Json<PainAssessment>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::pain::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PainAssessment>(
        "INSERT INTO pain_assessments \
         (tenant_id, patient_id, pain_score, pain_location, pain_character, \
          who_ladder_step, opioid_dose_morphine_eq, breakthrough_doses, \
          current_medications, assessed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), \
                 COALESCE($9, '[]'::jsonb), $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.pain_score)
    .bind(&body.pain_location)
    .bind(&body.pain_character)
    .bind(body.who_ladder_step)
    .bind(body.opioid_dose_morphine_eq)
    .bind(body.breakthrough_doses)
    .bind(&body.current_medications)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Mortuary ─────────────────────────────────────────────

pub async fn list_mortuary_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMortuaryQuery>,
) -> Result<Json<Vec<MortuaryRecord>>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::mortuary::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MortuaryRecord>(
        "SELECT * FROM mortuary_records \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::bool IS NULL OR is_mlc = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(params.is_mlc)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mortuary_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMortuaryRequest>,
) -> Result<Json<MortuaryRecord>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::palliative::mortuary::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MortuaryRecord>(
        "INSERT INTO mortuary_records \
         (tenant_id, body_receipt_number, deceased_name, deceased_age, \
          deceased_gender, date_of_death, cause_of_death, is_mlc, \
          mlc_case_id, cold_storage_slot, notes) \
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, \
                 COALESCE($8, false), $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.body_receipt_number)
    .bind(&body.deceased_name)
    .bind(body.deceased_age)
    .bind(&body.deceased_gender)
    .bind(&body.date_of_death)
    .bind(&body.cause_of_death)
    .bind(body.is_mlc)
    .bind(body.mlc_case_id)
    .bind(&body.cold_storage_slot)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_mortuary_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMortuaryRequest>,
) -> Result<Json<MortuaryRecord>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::palliative::mortuary::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, MortuaryRecord>(
        "UPDATE mortuary_records SET \
         status = COALESCE($2::body_status, status), \
         cold_storage_slot = COALESCE($3, cold_storage_slot), \
         pm_requested = COALESCE($4, pm_requested), \
         pm_performed_by = COALESCE($5, pm_performed_by), \
         pm_findings = COALESCE($6, pm_findings), \
         pm_date = CASE WHEN $5 IS NOT NULL AND pm_date IS NULL THEN now() ELSE pm_date END, \
         viscera_preserved = COALESCE($7, viscera_preserved), \
         organ_donation_status = COALESCE($8, organ_donation_status), \
         released_to = COALESCE($9, released_to), \
         released_at = CASE WHEN $2 = 'released' THEN now() ELSE released_at END, \
         released_by = CASE WHEN $2 = 'released' THEN $10 ELSE released_by END, \
         notes = COALESCE($11, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.cold_storage_slot)
    .bind(body.pm_requested)
    .bind(&body.pm_performed_by)
    .bind(&body.pm_findings)
    .bind(body.viscera_preserved)
    .bind(&body.organ_donation_status)
    .bind(&body.released_to)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Nuclear Medicine ─────────────────────────────────────

pub async fn list_nuclear_sources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NuclearMedSource>>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::nucmed::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, NuclearMedSource>(
        "SELECT * FROM nuclear_med_sources ORDER BY created_at DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_nuclear_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNuclearSourceRequest>,
) -> Result<Json<NuclearMedSource>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::nucmed::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, NuclearMedSource>(
        "INSERT INTO nuclear_med_sources \
         (tenant_id, isotope, activity_mci, half_life_hours, source_type, \
          aerb_license_number, batch_number, calibration_date, notes) \
         VALUES ($1, $2, $3, $4, $5::radiopharmaceutical_type, $6, $7, now(), $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.isotope)
    .bind(body.activity_mci)
    .bind(body.half_life_hours)
    .bind(&body.source_type)
    .bind(&body.aerb_license_number)
    .bind(&body.batch_number)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_nuclear_administrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NuclearMedAdministration>>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::nucmed::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, NuclearMedAdministration>(
        "SELECT * FROM nuclear_med_administrations ORDER BY administered_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// AERB radiation-protection rule: I-131 (radioiodine) therapy at or above 30 mCi requires mandatory
/// patient isolation — the patient emits penetrating gamma and is a source to others. Computed
/// server-side so the isolation flag can never be omitted for a high-dose therapeutic dose.
const I131_ISOLATION_THRESHOLD_MCI: f64 = 30.0;

fn radionuclide_isolation_required(isotope: &str, dose_mci: f64) -> bool {
    let normalized: String =
        isotope.chars().filter(char::is_ascii_alphanumeric).collect::<String>().to_lowercase();
    let is_i131 = normalized.contains("i131") || normalized.contains("iodine131");
    is_i131 && dose_mci >= I131_ISOLATION_THRESHOLD_MCI
}

pub async fn create_nuclear_administration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNuclearAdminRequest>,
) -> Result<Json<NuclearMedAdministration>, AppError> {
    require_permission(&claims, permissions::specialty::palliative::nucmed::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // The isolation flag must not be client-trusted: for a high-dose I-131 therapeutic dose AERB
    // mandates isolation, so force it on regardless of what the caller sent.
    let isotope = sqlx::query_scalar::<_, String>(
        "SELECT isotope FROM nuclear_med_sources WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.source_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let isolation_required = body.isolation_required.unwrap_or(false)
        || radionuclide_isolation_required(&isotope, body.dose_mci);

    let row = sqlx::query_as::<_, NuclearMedAdministration>(
        "INSERT INTO nuclear_med_administrations \
         (tenant_id, source_id, patient_id, dose_mci, route, indication, \
          administered_by, isolation_required, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.source_id)
    .bind(body.patient_id)
    .bind(body.dose_mci)
    .bind(&body.route)
    .bind(&body.indication)
    .bind(claims.sub)
    .bind(isolation_required)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Other Specialties (Templates, Records, Dialysis, Chemo)
// ══════════════════════════════════════════════════════════

pub async fn list_specialty_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<SpecialtyTemplate>>, AppError> {
    require_permission(&claims, permissions::specialty::other::templates::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, SpecialtyTemplate>(
        "SELECT * FROM specialty_templates \
         WHERE ($1::text IS NULL OR specialty = $1) \
         ORDER BY specialty, template_name LIMIT 5000",
    )
    .bind(&params.specialty)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_specialty_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<SpecialtyTemplate>, AppError> {
    require_permission(&claims, permissions::specialty::other::templates::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, SpecialtyTemplate>(
        "INSERT INTO specialty_templates \
         (tenant_id, specialty, template_name, template_code, form_schema) \
         VALUES ($1, $2, $3, $4, COALESCE($5, '{}'::jsonb)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.specialty)
    .bind(&body.template_name)
    .bind(&body.template_code)
    .bind(&body.form_schema)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_specialty_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SpecialtyRecord>>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, SpecialtyRecord>(
        "SELECT * FROM specialty_records ORDER BY recorded_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_specialty_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRecordRequest>,
) -> Result<Json<SpecialtyRecord>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, SpecialtyRecord>(
        "INSERT INTO specialty_records \
         (tenant_id, patient_id, specialty, template_id, form_data, recorded_by, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, '{}'::jsonb), $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.specialty)
    .bind(body.template_id)
    .bind(&body.form_data)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Dialysis ─────────────────────────────────────────────

pub async fn list_dialysis_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDialysisQuery>,
) -> Result<Json<Vec<DialysisSession>>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, DialysisSession>(
        "SELECT * FROM dialysis_sessions \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
         ORDER BY session_date DESC LIMIT 200",
    )
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_dialysis_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDialysisRequest>,
) -> Result<Json<CreateDialysisResponse>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, DialysisSession>(
        "INSERT INTO dialysis_sessions \
         (tenant_id, patient_id, machine_number, access_type, dialyzer_type, \
          pre_weight_kg, uf_goal_ml, duration_minutes, heparin_dose, performed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.machine_number)
    .bind(&body.access_type)
    .bind(&body.dialyzer_type)
    .bind(body.pre_weight_kg)
    .bind(body.uf_goal_ml)
    .bind(body.duration_minutes)
    .bind(&body.heparin_dose)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-charge the session (was a silent revenue leak). Master-priced by the "DIALYSIS"
    // charge code; unconfigured → a visible ₹0 line for the biller, never a missed charge.
    super::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        super::billing::AutoChargeInput {
            patient_id: body.patient_id,
            encounter_id: None,
            charge_code: "DIALYSIS".to_owned(),
            source: "procedure".to_owned(),
            source_id: row.id,
            quantity: 1,
            description_override: Some("Haemodialysis session".to_owned()),
            unit_price_override: None,
            tax_percent_override: None,
        },
    )
    .await?;

    tx.commit().await?;

    let uf_rate_ml_kg_hr = match (body.uf_goal_ml, body.duration_minutes, body.pre_weight_kg) {
        (Some(goal), Some(mins), Some(weight)) => uf_rate_ml_kg_hr(goal, mins, weight),
        _ => None,
    };
    let uf_rate_exceeds_safe = uf_rate_ml_kg_hr.is_some_and(|r| r > MAX_SAFE_UF_RATE_ML_KG_HR);
    Ok(Json(CreateDialysisResponse { session: row, uf_rate_ml_kg_hr, uf_rate_exceeds_safe }))
}

pub async fn update_dialysis_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDialysisRequest>,
) -> Result<Json<DialysisSession>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, DialysisSession>(
        "UPDATE dialysis_sessions SET \
         post_weight_kg = COALESCE($2, post_weight_kg), \
         uf_achieved_ml = COALESCE($3, uf_achieved_ml), \
         duration_minutes = COALESCE($4, duration_minutes), \
         post_vitals = COALESCE($5, post_vitals), \
         intradialytic_events = COALESCE($6, intradialytic_events), \
         kt_v = COALESCE($7, kt_v), \
         urr_pct = COALESCE($8, urr_pct), \
         notes = COALESCE($9, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.post_weight_kg)
    .bind(body.uf_achieved_ml)
    .bind(body.duration_minutes)
    .bind(&body.post_vitals)
    .bind(&body.intradialytic_events)
    .bind(body.kt_v)
    .bind(body.urr_pct)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Chemo Protocols ──────────────────────────────────────

pub async fn list_chemo_protocols(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListChemoQuery>,
) -> Result<Json<Vec<ChemoProtocol>>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, ChemoProtocol>(
        "SELECT * FROM chemo_protocols \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
         AND ($2::text IS NULL OR status = $2) \
         ORDER BY cycle_date DESC LIMIT 200",
    )
    .bind(params.patient_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_chemo_protocol(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateChemoRequest>,
) -> Result<Json<ChemoProtocol>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, ChemoProtocol>(
        "INSERT INTO chemo_protocols \
         (tenant_id, patient_id, protocol_name, cancer_type, staging, \
          regimen, cycle_number, total_cycles, treating_oncologist_id, notes, \
          anthracycline_agent, anthracycline_dose_mg_m2) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, '[]'::jsonb), \
                 COALESCE($7, 1), $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.protocol_name)
    .bind(&body.cancer_type)
    .bind(&body.staging)
    .bind(&body.regimen)
    .bind(body.cycle_number)
    .bind(body.total_cycles)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(body.anthracycline_agent.as_deref())
    .bind(body.anthracycline_dose_mg_m2)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Lifetime cumulative anthracycline dose ceiling (mg/m²) beyond which cardiotoxicity risk rises
/// sharply. Matched case-insensitively on the agent name.
fn anthracycline_ceiling_mg_m2(agent: &str) -> Option<f64> {
    let a = agent.to_lowercase();
    if a.contains("epirubicin") {
        Some(900.0)
    } else if a.contains("daunorubicin") {
        Some(550.0)
    } else if a.contains("idarubicin") {
        Some(150.0)
    } else if a.contains("mitoxantrone") {
        Some(140.0)
    } else if a.contains("doxorubicin") {
        // Covers doxorubicin and liposomal doxorubicin; 450 mg/m² is the conservative ceiling.
        Some(450.0)
    } else {
        None
    }
}

#[derive(Debug, Deserialize)]
pub struct AnthracyclineCumulativeQuery {
    pub patient_id: Uuid,
    pub agent: String,
}

#[derive(Debug, serde::Serialize)]
pub struct AnthracyclineCumulativeResult {
    pub agent: String,
    pub cumulative_mg_m2: f64,
    pub ceiling_mg_m2: Option<f64>,
    pub remaining_mg_m2: Option<f64>,
    /// True once cumulative >= 90% of the ceiling — the next cycle needs cardiac review.
    pub near_ceiling: bool,
    /// True once cumulative exceeds the ceiling.
    pub over_ceiling: bool,
}

/// `GET /api/specialty/chemo/anthracycline-cumulative?patient_id=&agent=` — the patient's running
/// lifetime anthracycline dose for the agent, versus the cardiotoxicity ceiling.
pub async fn anthracycline_cumulative(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnthracyclineCumulativeQuery>,
) -> Result<Json<AnthracyclineCumulativeResult>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let cumulative: Option<f64> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(anthracycline_dose_mg_m2), 0) FROM chemo_protocols \
         WHERE tenant_id = $1 AND patient_id = $2 \
           AND lower(anthracycline_agent) = lower($3)",
    )
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .bind(&params.agent)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    let cumulative_mg_m2 = cumulative.unwrap_or(0.0);
    let ceiling_mg_m2 = anthracycline_ceiling_mg_m2(&params.agent);
    let remaining_mg_m2 = ceiling_mg_m2.map(|c| c - cumulative_mg_m2);
    let near_ceiling = ceiling_mg_m2.is_some_and(|c| cumulative_mg_m2 >= 0.9 * c);
    let over_ceiling = ceiling_mg_m2.is_some_and(|c| cumulative_mg_m2 > c);

    Ok(Json(AnthracyclineCumulativeResult {
        agent: params.agent,
        cumulative_mg_m2,
        ceiling_mg_m2,
        remaining_mg_m2,
        near_ceiling,
        over_ceiling,
    }))
}

#[cfg(test)]
mod anthracycline_tests {
    use super::anthracycline_ceiling_mg_m2;

    #[test]
    fn doxorubicin_ceiling() {
        assert_eq!(anthracycline_ceiling_mg_m2("Doxorubicin"), Some(450.0));
        assert_eq!(anthracycline_ceiling_mg_m2("liposomal doxorubicin"), Some(450.0));
    }

    #[test]
    fn other_anthracyclines() {
        assert_eq!(anthracycline_ceiling_mg_m2("Epirubicin"), Some(900.0));
        assert_eq!(anthracycline_ceiling_mg_m2("daunorubicin"), Some(550.0));
        assert_eq!(anthracycline_ceiling_mg_m2("Idarubicin"), Some(150.0));
    }

    #[test]
    fn unknown_agent_has_no_ceiling() {
        assert_eq!(anthracycline_ceiling_mg_m2("cisplatin"), None);
    }
}

#[cfg(test)]
mod dnr_tests {
    use super::validated_dnr_review_hours;

    #[test]
    fn defaults_to_forty_eight_hours() {
        assert_eq!(validated_dnr_review_hours(None).unwrap(), 48);
    }

    #[test]
    fn accepts_within_bounds() {
        assert_eq!(validated_dnr_review_hours(Some(1)).unwrap(), 1);
        assert_eq!(validated_dnr_review_hours(Some(720)).unwrap(), 720);
    }

    #[test]
    fn rejects_open_ended_and_nonpositive() {
        // An open-ended DNR could outlive the patient's wishes with no re-review.
        assert!(validated_dnr_review_hours(Some(721)).is_err());
        assert!(validated_dnr_review_hours(Some(999_999)).is_err());
        assert!(validated_dnr_review_hours(Some(0)).is_err());
        assert!(validated_dnr_review_hours(Some(-5)).is_err());
    }
}

pub async fn update_chemo_protocol(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChemoRequest>,
) -> Result<Json<ChemoProtocol>, AppError> {
    require_permission(&claims, permissions::specialty::other::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, ChemoProtocol>(
        "UPDATE chemo_protocols SET \
         toxicity_grade = COALESCE($2, toxicity_grade), \
         recist_response = COALESCE($3, recist_response), \
         tumor_board_discussed = COALESCE($4, tumor_board_discussed), \
         tumor_board_recommendation = COALESCE($5, tumor_board_recommendation), \
         tumor_board_date = CASE WHEN $4 = true THEN CURRENT_DATE ELSE tumor_board_date END, \
         next_cycle_date = COALESCE($6::date, next_cycle_date), \
         status = COALESCE($7, status), \
         notes = COALESCE($8, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.toxicity_grade)
    .bind(&body.recist_response)
    .bind(body.tumor_board_discussed)
    .bind(&body.tumor_board_recommendation)
    .bind(&body.next_cycle_date)
    .bind(&body.status)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Oncology depth (B3): cancer TNM staging + radiation sessions ──

#[derive(Debug, Deserialize)]
pub struct StagingQuery {
    pub patient_id: Option<Uuid>,
}

/// `GET /api/specialty/oncology/staging`
pub async fn list_cancer_stagings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StagingQuery>,
) -> Result<Json<Vec<CancerStaging>>, AppError> {
    require_permission(&claims, permissions::specialty::other::oncology::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, CancerStaging>(
        "SELECT * FROM cancer_stagings \
         WHERE tenant_id = $1 AND ($2::uuid IS NULL OR patient_id = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateStagingRequest {
    pub patient_id: Uuid,
    pub primary_site: String,
    pub histology: Option<String>,
    pub t_stage: Option<String>,
    pub n_stage: Option<String>,
    pub m_stage: Option<String>,
    pub overall_stage: Option<String>,
    pub notes: Option<String>,
}

/// `POST /api/specialty/oncology/staging`
pub async fn create_cancer_staging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStagingRequest>,
) -> Result<Json<CancerStaging>, AppError> {
    require_permission(&claims, permissions::specialty::other::oncology::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, CancerStaging>(
        "INSERT INTO cancer_stagings \
         (tenant_id, patient_id, primary_site, histology, t_stage, n_stage, m_stage, \
          overall_stage, staged_by, staged_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.primary_site)
    .bind(body.histology)
    .bind(body.t_stage)
    .bind(body.n_stage)
    .bind(body.m_stage)
    .bind(body.overall_stage)
    .bind(claims.sub)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/specialty/oncology/radiation`
pub async fn list_radiation_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StagingQuery>,
) -> Result<Json<Vec<RadiationSession>>, AppError> {
    require_permission(&claims, permissions::specialty::other::oncology::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, RadiationSession>(
        "SELECT * FROM radiation_sessions \
         WHERE tenant_id = $1 AND ($2::uuid IS NULL OR patient_id = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRadiationRequest {
    pub patient_id: Uuid,
    pub site: String,
    pub technique: Option<String>,
    pub total_dose_gy: Option<rust_decimal::Decimal>,
    pub fractions: Option<i32>,
    pub session_number: Option<i32>,
    pub notes: Option<String>,
}

/// `POST /api/specialty/oncology/radiation`
pub async fn create_radiation_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRadiationRequest>,
) -> Result<Json<RadiationSession>, AppError> {
    require_permission(&claims, permissions::specialty::other::oncology::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, RadiationSession>(
        "INSERT INTO radiation_sessions \
         (tenant_id, patient_id, site, technique, total_dose_gy, fractions, session_number, \
          delivered_by, delivered_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.site)
    .bind(body.technique)
    .bind(body.total_dose_gy)
    .bind(body.fractions)
    .bind(body.session_number)
    .bind(claims.sub)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod dialysis_tests {
    use super::uf_rate_ml_kg_hr;

    #[test]
    fn safe_rate() {
        // 2000 mL over 240 min for a 70 kg patient = 2000/4/70 = 7.14 mL/kg/hr (safe).
        let r = uf_rate_ml_kg_hr(2000, 240, 70.0).unwrap();
        assert!((r - 7.142_857).abs() < 1e-3);
        assert!(r <= 13.0);
    }

    #[test]
    fn excessive_rate() {
        // 4000 mL over 180 min for a 60 kg patient = 4000/3/60 = 22.2 mL/kg/hr (unsafe).
        let r = uf_rate_ml_kg_hr(4000, 180, 60.0).unwrap();
        assert!(r > 13.0);
    }

    #[test]
    fn missing_inputs_return_none() {
        assert!(uf_rate_ml_kg_hr(2000, 0, 70.0).is_none());
        assert!(uf_rate_ml_kg_hr(2000, 240, 0.0).is_none());
    }
}

#[cfg(test)]
mod nuclear_isolation_tests {
    use super::radionuclide_isolation_required;

    #[test]
    fn high_dose_i131_requires_isolation() {
        assert!(radionuclide_isolation_required("I-131", 100.0));
        assert!(radionuclide_isolation_required("Iodine-131", 30.0)); // boundary
        assert!(radionuclide_isolation_required("i131", 45.5));
    }

    #[test]
    fn low_dose_i131_does_not() {
        // Diagnostic / low therapeutic doses below the AERB isolation threshold.
        assert!(!radionuclide_isolation_required("I-131", 5.0));
    }

    #[test]
    fn other_isotopes_do_not() {
        assert!(!radionuclide_isolation_required("Tc-99m", 100.0));
        assert!(!radionuclide_isolation_required("Lu-177", 200.0));
    }
}
