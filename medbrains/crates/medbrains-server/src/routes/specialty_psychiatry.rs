#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::{
    PsychAssessment, PsychCounselingSession, PsychEctRegister, PsychMhrbNotification, PsychPatient,
    PsychSeclusionRestraint,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListPsychPatientsQuery {
    pub admission_category: Option<String>,
    pub substance_abuse: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePsychPatientRequest {
    pub patient_id: Uuid,
    pub admission_category: String,
    pub advance_directive_text: Option<String>,
    pub nominated_rep_name: Option<String>,
    pub nominated_rep_relation: Option<String>,
    pub nominated_rep_contact: Option<String>,
    pub substance_abuse_flag: Option<bool>,
    pub treating_psychiatrist_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePsychPatientRequest {
    pub admission_category: Option<String>,
    pub advance_directive_text: Option<String>,
    pub nominated_rep_name: Option<String>,
    pub nominated_rep_relation: Option<String>,
    pub nominated_rep_contact: Option<String>,
    pub substance_abuse_flag: Option<bool>,
    pub treating_psychiatrist_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssessmentRequest {
    pub assessment_type: String,
    pub mental_status_exam: Option<serde_json::Value>,
    pub ham_d_score: Option<i32>,
    pub bprs_score: Option<i32>,
    pub gaf_score: Option<i32>,
    pub risk_assessment: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEctRequest {
    pub session_number: i32,
    pub consent_obtained: Option<bool>,
    pub laterality: String,
    pub stimulus_dose: Option<f64>,
    pub seizure_duration_sec: Option<i32>,
    pub anesthetic: Option<String>,
    pub muscle_relaxant: Option<String>,
    pub anesthetist_id: Option<Uuid>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRestraintRequest {
    pub restraint_type: String,
    pub reason: String,
    pub review_due_hours: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReleaseRestraintRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMhrbNotificationRequest {
    pub notification_type: String,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMhrbNotificationRequest {
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCounselingRequest {
    pub session_type: String,
    pub therapist_id: Uuid,
    pub modality: Option<String>,
    pub duration_minutes: Option<i32>,
    pub outcome_rating: Option<i32>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Psych Patients
// ══════════════════════════════════════════════════════════

pub async fn list_psych_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPsychPatientsQuery>,
) -> Result<Json<Vec<PsychPatient>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::patients::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychPatient>(
        "SELECT * FROM psych_patients \
         WHERE ($1::text IS NULL OR admission_category::text = $1) \
         AND ($2::bool IS NULL OR substance_abuse_flag = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.admission_category)
    .bind(params.substance_abuse)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_psych_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PsychPatient>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::patients::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychPatient>("SELECT * FROM psych_patients WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_psych_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePsychPatientRequest>,
) -> Result<Json<PsychPatient>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::patients::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychPatient>(
        "INSERT INTO psych_patients \
         (tenant_id, patient_id, admission_category, advance_directive_text, \
          nominated_rep_name, nominated_rep_relation, nominated_rep_contact, \
          substance_abuse_flag, treating_psychiatrist_id, notes) \
         VALUES ($1, $2, $3::psych_admission_category, $4, $5, $6, $7, \
                 COALESCE($8, false), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.admission_category)
    .bind(&body.advance_directive_text)
    .bind(&body.nominated_rep_name)
    .bind(&body.nominated_rep_relation)
    .bind(&body.nominated_rep_contact)
    .bind(body.substance_abuse_flag)
    .bind(body.treating_psychiatrist_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_psych_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePsychPatientRequest>,
) -> Result<Json<PsychPatient>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::patients::UPDATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychPatient>(
        "UPDATE psych_patients SET \
         admission_category = COALESCE($2::psych_admission_category, admission_category), \
         advance_directive_text = COALESCE($3, advance_directive_text), \
         nominated_rep_name = COALESCE($4, nominated_rep_name), \
         nominated_rep_relation = COALESCE($5, nominated_rep_relation), \
         nominated_rep_contact = COALESCE($6, nominated_rep_contact), \
         substance_abuse_flag = COALESCE($7, substance_abuse_flag), \
         treating_psychiatrist_id = COALESCE($8, treating_psychiatrist_id), \
         notes = COALESCE($9, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.admission_category)
    .bind(&body.advance_directive_text)
    .bind(&body.nominated_rep_name)
    .bind(&body.nominated_rep_relation)
    .bind(&body.nominated_rep_contact)
    .bind(body.substance_abuse_flag)
    .bind(body.treating_psychiatrist_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Assessments ──────────────────────────────────────────

pub async fn list_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychAssessment>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychAssessment>(
        "SELECT * FROM psych_assessments WHERE psych_patient_id = $1 \
         ORDER BY assessed_at DESC",
    )
    .bind(psych_patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateAssessmentRequest>,
) -> Result<Json<PsychAssessment>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychAssessment>(
        "INSERT INTO psych_assessments \
         (tenant_id, psych_patient_id, assessment_type, mental_status_exam, \
          ham_d_score, bprs_score, gaf_score, risk_assessment, assessed_by, notes) \
         VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), $5, $6, $7, \
                 COALESCE($8, '{}'::jsonb), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(psych_patient_id)
    .bind(&body.assessment_type)
    .bind(&body.mental_status_exam)
    .bind(body.ham_d_score)
    .bind(body.bprs_score)
    .bind(body.gaf_score)
    .bind(&body.risk_assessment)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── ECT Register ─────────────────────────────────────────

pub async fn list_ect_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychEctRegister>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::ect::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychEctRegister>(
        "SELECT * FROM psych_ect_register WHERE psych_patient_id = $1 \
         ORDER BY session_number",
    )
    .bind(psych_patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_ect_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateEctRequest>,
) -> Result<Json<PsychEctRegister>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::ect::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychEctRegister>(
        "INSERT INTO psych_ect_register \
         (tenant_id, psych_patient_id, session_number, consent_obtained, \
          laterality, stimulus_dose, seizure_duration_sec, anesthetic, \
          muscle_relaxant, performed_by, anesthetist_id, complications, notes) \
         VALUES ($1, $2, $3, COALESCE($4, true), $5::ect_laterality, \
                 $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(psych_patient_id)
    .bind(body.session_number)
    .bind(body.consent_obtained)
    .bind(&body.laterality)
    .bind(body.stimulus_dose)
    .bind(body.seizure_duration_sec)
    .bind(&body.anesthetic)
    .bind(&body.muscle_relaxant)
    .bind(claims.sub)
    .bind(body.anesthetist_id)
    .bind(&body.complications)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Seclusion & Restraint ────────────────────────────────

pub async fn list_restraints(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychSeclusionRestraint>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::restraint::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychSeclusionRestraint>(
        "SELECT * FROM psych_seclusion_restraint WHERE psych_patient_id = $1 \
         ORDER BY start_time DESC",
    )
    .bind(psych_patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_restraint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateRestraintRequest>,
) -> Result<Json<PsychSeclusionRestraint>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::restraint::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let review_hours = body.review_due_hours.unwrap_or(4);

    let row = sqlx::query_as::<_, PsychSeclusionRestraint>(
        "INSERT INTO psych_seclusion_restraint \
         (tenant_id, psych_patient_id, restraint_type, reason, \
          start_time, review_due_at, ordered_by, notes) \
         VALUES ($1, $2, $3::restraint_type, $4, now(), \
                 now() + ($5 || ' hours')::interval, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(psych_patient_id)
    .bind(&body.restraint_type)
    .bind(&body.reason)
    .bind(review_hours.to_string())
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn release_restraint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReleaseRestraintRequest>,
) -> Result<Json<PsychSeclusionRestraint>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::restraint::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychSeclusionRestraint>(
        "UPDATE psych_seclusion_restraint SET \
         end_time = now(), released_by = $2, reviewed_at = now(), \
         notes = COALESCE($3, notes) \
         WHERE id = $1 AND end_time IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── MHRB Notifications ──────────────────────────────────

pub async fn list_mhrb_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychMhrbNotification>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychMhrbNotification>(
        "SELECT * FROM psych_mhrb_notifications WHERE psych_patient_id = $1 \
         ORDER BY created_at DESC",
    )
    .bind(psych_patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mhrb_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateMhrbNotificationRequest>,
) -> Result<Json<PsychMhrbNotification>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychMhrbNotification>(
        "INSERT INTO psych_mhrb_notifications \
         (tenant_id, psych_patient_id, notification_type, reference_number, notes) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(psych_patient_id)
    .bind(&body.notification_type)
    .bind(&body.reference_number)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_mhrb_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMhrbNotificationRequest>,
) -> Result<Json<PsychMhrbNotification>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychMhrbNotification>(
        "UPDATE psych_mhrb_notifications SET \
         status = COALESCE($2, status), \
         sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END, \
         acknowledged_at = CASE WHEN $2 = 'acknowledged' THEN now() ELSE acknowledged_at END, \
         notes = COALESCE($3, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Counseling Sessions ──────────────────────────────────

pub async fn list_counseling_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychCounselingSession>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PsychCounselingSession>(
        "SELECT * FROM psych_counseling_sessions WHERE psych_patient_id = $1 \
         ORDER BY session_date DESC",
    )
    .bind(psych_patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_counseling_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateCounselingRequest>,
) -> Result<Json<PsychCounselingSession>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PsychCounselingSession>(
        "INSERT INTO psych_counseling_sessions \
         (tenant_id, psych_patient_id, session_type, therapist_id, \
          modality, duration_minutes, outcome_rating, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(psych_patient_id)
    .bind(&body.session_type)
    .bind(body.therapist_id)
    .bind(&body.modality)
    .bind(body.duration_minutes)
    .bind(body.outcome_rating)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
