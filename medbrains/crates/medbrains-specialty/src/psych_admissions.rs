//! Mental Healthcare Act admissions — one row per legal episode.
//!
//! The section's requirements are checked in [`crate::psych_mhca`] before
//! the row exists; this module loads the facts, writes the episode with its
//! deadlines, and records discharge and Board reporting.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_authz_gate::mental_health::{
    PsychChild, require_psych_child_access, require_psych_record_access,
};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::{PsychAdmission, PsychAdmissionCategory};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::psych_mhca::{
    AdmissionFacts, AdmissionInput, Examination, ExaminerRole, plan_admission,
};

#[derive(Debug, Deserialize)]
pub struct ExaminationRequest {
    pub user_id: Uuid,
    pub role: String,
    pub examined_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdmissionRequest {
    pub category: PsychAdmissionCategory,
    pub admitted_at: Option<DateTime<Utc>>,
    pub applicant: String,
    #[serde(default)]
    pub criteria: Vec<String>,
    #[serde(default)]
    pub least_restrictive_certified: bool,
    #[serde(default)]
    pub needs_high_support: bool,
    #[serde(default)]
    pub minor_safeguards_confirmed: bool,
    pub capacity_note: Option<String>,
    #[serde(default)]
    pub examinations: Vec<ExaminationRequest>,
    #[serde(default)]
    pub extension_number: i32,
}

#[derive(Debug, Deserialize)]
pub struct DischargeAdmissionRequest {
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BoardReportRequest {
    pub reference_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BoardDecisionRequest {
    pub decision: String,
    pub reference_number: Option<String>,
}

async fn facts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    psych_patient_id: Uuid,
) -> Result<AdmissionFacts, AppError> {
    let row = sqlx::query!(
        r#"SELECT date_part('year', age(p.date_of_birth))::int AS "age_years?",
                  (p.gender::text = 'female') AS "is_woman!",
                  EXISTS (SELECT 1 FROM psych_nominated_representatives r
                           WHERE r.psych_patient_id = pp.id AND r.revoked_at IS NULL
                             AND r.deleted_at IS NULL) AS "has_rep!",
                  (SELECT max(a.discharged_at) FROM psych_admissions a
                    WHERE a.psych_patient_id = pp.id AND a.category = 'supported'
                      AND a.deleted_at IS NULL) AS "last_s89_discharge?"
             FROM psych_patients pp JOIN patients p ON p.id = pp.patient_id
            WHERE pp.id = $1 AND pp.tenant_id = $2"#,
        psych_patient_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(AdmissionFacts {
        age_years: row.age_years,
        is_woman: row.is_woman,
        has_nominated_rep: row.has_rep,
        last_s89_discharge: row.last_s89_discharge,
    })
}

fn to_input(body: &CreateAdmissionRequest) -> Result<AdmissionInput, AppError> {
    let examinations = body
        .examinations
        .iter()
        .map(|e| {
            Ok(Examination {
                user_id: e.user_id,
                role: ExaminerRole::parse(&e.role)?,
                examined_at: e.examined_at,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    Ok(AdmissionInput {
        category: body.category,
        admitted_at: body.admitted_at.unwrap_or_else(Utc::now),
        applicant: body.applicant.clone(),
        criteria: body.criteria.clone(),
        least_restrictive_certified: body.least_restrictive_certified,
        needs_high_support: body.needs_high_support,
        minor_safeguards_confirmed: body.minor_safeguards_confirmed,
        examinations,
        extension_number: body.extension_number,
    })
}

pub async fn list_admissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychAdmission>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::admissions::LIST,
    )?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PsychAdmission,
        r#"SELECT id, tenant_id, psych_patient_id,
                  category AS "category: PsychAdmissionCategory", admitted_at, applicant,
                  criteria, least_restrictive_certified, needs_high_support, capacity_note,
                  examiner1_id, examiner1_role, examiner1_examined_at,
                  examiner2_id, examiner2_role, examiner2_examined_at,
                  extension_number, period_ends_at, minor_safeguards_confirmed,
                  board_report_due_at, board_reported_at, board_reference,
                  board_decision_due_at, board_decision, board_decided_at,
                  discharged_at, discharge_note, admitted_by, created_at, updated_at
             FROM psych_admissions
            WHERE psych_patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            ORDER BY admitted_at DESC LIMIT 500"#,
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateAdmissionRequest>,
) -> Result<Json<PsychAdmission>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::admissions::CREATE,
    )?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let input = to_input(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let open = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM psych_admissions WHERE psych_patient_id = $1
             AND tenant_id = $2 AND discharged_at IS NULL AND deleted_at IS NULL) AS "open!""#,
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    if open {
        return Err(AppError::Conflict(
            "The patient has an open admission; discharge or convert it first".to_owned(),
        ));
    }
    let plan = plan_admission(
        &input,
        facts(&mut tx, claims.tenant_id, psych_patient_id).await?,
    )?;
    let exam = |i: usize| input.examinations.get(i);
    let role = |i: usize| body.examinations.get(i).map(|e| e.role.clone());
    let row = sqlx::query_as!(
        PsychAdmission,
        r#"INSERT INTO psych_admissions
             (tenant_id, psych_patient_id, category, admitted_at, applicant, criteria,
              least_restrictive_certified, needs_high_support, capacity_note,
              examiner1_id, examiner1_role, examiner1_examined_at,
              examiner2_id, examiner2_role, examiner2_examined_at,
              extension_number, period_ends_at, minor_safeguards_confirmed,
              board_report_due_at, board_decision_due_at, admitted_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                   $16, $17, $18, $19, $20, $21)
           RETURNING id, tenant_id, psych_patient_id,
                  category AS "category: PsychAdmissionCategory", admitted_at, applicant,
                  criteria, least_restrictive_certified, needs_high_support, capacity_note,
                  examiner1_id, examiner1_role, examiner1_examined_at,
                  examiner2_id, examiner2_role, examiner2_examined_at,
                  extension_number, period_ends_at, minor_safeguards_confirmed,
                  board_report_due_at, board_reported_at, board_reference,
                  board_decision_due_at, board_decision, board_decided_at,
                  discharged_at, discharge_note, admitted_by, created_at, updated_at"#,
        claims.tenant_id,
        psych_patient_id,
        input.category as PsychAdmissionCategory,
        input.admitted_at,
        input.applicant,
        &input.criteria,
        input.least_restrictive_certified,
        input.needs_high_support,
        body.capacity_note,
        exam(0).map(|e| e.user_id),
        role(0),
        exam(0).map(|e| e.examined_at),
        exam(1).map(|e| e.user_id),
        role(1),
        exam(1).map(|e| e.examined_at),
        input.extension_number,
        plan.period_ends_at,
        input.minor_safeguards_confirmed,
        plan.board_report_due_at,
        plan.board_decision_due_at,
        claims.sub,
    )
    .fetch_one(&mut *tx)
    .await?;
    // The record's current legal status follows its latest admission.
    sqlx::query!(
        "UPDATE psych_patients SET admission_category = $3 WHERE id = $1 AND tenant_id = $2",
        psych_patient_id,
        claims.tenant_id,
        input.category as PsychAdmissionCategory,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn discharge_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DischargeAdmissionRequest>,
) -> Result<Json<PsychAdmission>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::admissions::UPDATE,
    )?;
    require_psych_child_access(&state, &claims, PsychChild::Admission, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychAdmission,
        r#"UPDATE psych_admissions SET discharged_at = now(), discharge_note = $3
            WHERE id = $1 AND tenant_id = $2 AND discharged_at IS NULL AND deleted_at IS NULL
           RETURNING id, tenant_id, psych_patient_id,
                  category AS "category: PsychAdmissionCategory", admitted_at, applicant,
                  criteria, least_restrictive_certified, needs_high_support, capacity_note,
                  examiner1_id, examiner1_role, examiner1_examined_at,
                  examiner2_id, examiner2_role, examiner2_examined_at,
                  extension_number, period_ends_at, minor_safeguards_confirmed,
                  board_report_due_at, board_reported_at, board_reference,
                  board_decision_due_at, board_decision, board_decided_at,
                  discharged_at, discharge_note, admitted_by, created_at, updated_at"#,
        id,
        claims.tenant_id,
        body.note,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This admission is already discharged".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Record that the Board was told, and keep the notice with the others.
pub async fn report_admission_to_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<BoardReportRequest>,
) -> Result<Json<PsychAdmission>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    require_psych_child_access(&state, &claims, PsychChild::Admission, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychAdmission,
        r#"UPDATE psych_admissions SET board_reported_at = now(), board_reference = $3
            WHERE id = $1 AND tenant_id = $2 AND board_reported_at IS NULL
              AND board_report_due_at IS NOT NULL AND deleted_at IS NULL
           RETURNING id, tenant_id, psych_patient_id,
                  category AS "category: PsychAdmissionCategory", admitted_at, applicant,
                  criteria, least_restrictive_certified, needs_high_support, capacity_note,
                  examiner1_id, examiner1_role, examiner1_examined_at,
                  examiner2_id, examiner2_role, examiner2_examined_at,
                  extension_number, period_ends_at, minor_safeguards_confirmed,
                  board_report_due_at, board_reported_at, board_reference,
                  board_decision_due_at, board_decision, board_decided_at,
                  discharged_at, discharge_note, admitted_by, created_at, updated_at"#,
        id,
        claims.tenant_id,
        body.reference_number,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("Already reported, or this admission is not reportable".to_owned())
    })?;
    sqlx::query!(
        "INSERT INTO psych_mhrb_notifications \
           (tenant_id, psych_patient_id, notification_type, reference_number, status, sent_at) \
         VALUES ($1, $2, $3, $4, 'sent', now())",
        claims.tenant_id,
        row.psych_patient_id,
        format!("Admission report ({})", section_label(row.category)),
        body.reference_number,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// s.90(4): the Board permits the admission or orders discharge.
pub async fn record_board_decision(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<BoardDecisionRequest>,
) -> Result<Json<PsychAdmission>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    require_psych_child_access(&state, &claims, PsychChild::Admission, id).await?;
    if !matches!(body.decision.as_str(), "permitted" | "discharge_ordered") {
        return Err(AppError::BadRequest(
            "The Board either permits the admission or orders discharge".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychAdmission,
        r#"UPDATE psych_admissions SET board_decision = $3, board_decided_at = now(),
                  board_reference = COALESCE($4, board_reference),
                  discharged_at = CASE WHEN $3 = 'discharge_ordered' THEN now()
                                       ELSE discharged_at END
            WHERE id = $1 AND tenant_id = $2 AND category = 'supported_extended'
              AND board_decision IS NULL AND deleted_at IS NULL
           RETURNING id, tenant_id, psych_patient_id,
                  category AS "category: PsychAdmissionCategory", admitted_at, applicant,
                  criteria, least_restrictive_certified, needs_high_support, capacity_note,
                  examiner1_id, examiner1_role, examiner1_examined_at,
                  examiner2_id, examiner2_role, examiner2_examined_at,
                  extension_number, period_ends_at, minor_safeguards_confirmed,
                  board_report_due_at, board_reported_at, board_reference,
                  board_decision_due_at, board_decision, board_decided_at,
                  discharged_at, discharge_note, admitted_by, created_at, updated_at"#,
        id,
        claims.tenant_id,
        body.decision,
        body.reference_number,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "Only an s.90 admission awaiting the Board can take a decision".to_owned(),
        )
    })?;
    tx.commit().await?;
    Ok(Json(row))
}

const fn section_label(category: PsychAdmissionCategory) -> &'static str {
    match category {
        PsychAdmissionCategory::Independent => "s.86",
        PsychAdmissionCategory::MinorSupported => "s.87",
        PsychAdmissionCategory::Supported => "s.89",
        PsychAdmissionCategory::SupportedExtended => "s.90",
        PsychAdmissionCategory::Emergency => "s.94",
    }
}
