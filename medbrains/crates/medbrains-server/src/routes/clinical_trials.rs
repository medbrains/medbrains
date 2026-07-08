//! Clinical Trials registry (ticket #2983). A hospital research department's trials with a
//! lifecycle status. Gated by the `specialty.clinical_trials.*` permission (research / admin).

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

const COLS: &str = "id, tenant_id, protocol_number, title, sponsor, phase, status, indication, \
     principal_investigator, target_enrollment, start_date, end_date, notes, is_active, \
     min_age, max_age, eligibility_sex, diagnosis_codes, created_at, updated_at";

const VALID_STATUS: [&str; 6] = [
    "planned",
    "recruiting",
    "active",
    "completed",
    "terminated",
    "suspended",
];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ClinicalTrial {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub protocol_number: String,
    pub title: String,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub status: String,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub eligibility_sex: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A patient who matches a trial's structured eligibility (age / sex / diagnosis).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TrialCandidate {
    pub id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub age: Option<i32>,
    pub biological_sex: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrialQuery {
    pub status: Option<String>,
}

/// `GET /api/clinical-trials?status=` — the registry, optionally filtered by lifecycle status.
pub async fn list_trials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TrialQuery>,
) -> Result<Json<Vec<ClinicalTrial>>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "SELECT {COLS} FROM clinical_trials \
         WHERE tenant_id = $1 AND is_active = true AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC LIMIT 2000"
    ))
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/clinical-trials/{id}` — one trial.
pub async fn get_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "SELECT {COLS} FROM clinical_trials WHERE id = $1 AND tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CreateTrialRequest {
    pub protocol_number: String,
    pub title: String,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub status: Option<String>,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

/// `POST /api/clinical-trials` — register a trial.
pub async fn create_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTrialRequest>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if body.protocol_number.trim().is_empty() || body.title.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Protocol number and title are required".to_owned(),
        ));
    }
    if let Some(s) = &body.status {
        if !VALID_STATUS.contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "INSERT INTO clinical_trials \
         (tenant_id, protocol_number, title, sponsor, phase, status, indication, \
          principal_investigator, target_enrollment, start_date, end_date, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'planned'), $7, $8, $9, $10, $11, $12) \
         RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.protocol_number.trim())
    .bind(body.title.trim())
    .bind(&body.sponsor)
    .bind(&body.phase)
    .bind(&body.status)
    .bind(&body.indication)
    .bind(&body.principal_investigator)
    .bind(body.target_enrollment)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateTrialRequest {
    pub status: Option<String>,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub eligibility_sex: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
}

/// `PUT /api/clinical-trials/{id}` — update a trial (status change / detail / eligibility edit).
pub async fn update_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTrialRequest>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if let Some(s) = &body.status {
        if !VALID_STATUS.contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "UPDATE clinical_trials SET status = COALESCE($3, status), sponsor = COALESCE($4, sponsor), \
            phase = COALESCE($5, phase), indication = COALESCE($6, indication), \
            principal_investigator = COALESCE($7, principal_investigator), \
            target_enrollment = COALESCE($8, target_enrollment), \
            end_date = COALESCE($9, end_date), notes = COALESCE($10, notes), \
            min_age = COALESCE($11, min_age), max_age = COALESCE($12, max_age), \
            eligibility_sex = COALESCE($13, eligibility_sex), \
            diagnosis_codes = COALESCE($14, diagnosis_codes), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.sponsor)
    .bind(&body.phase)
    .bind(&body.indication)
    .bind(&body.principal_investigator)
    .bind(body.target_enrollment)
    .bind(body.end_date)
    .bind(&body.notes)
    .bind(body.min_age)
    .bind(body.max_age)
    .bind(&body.eligibility_sex)
    .bind(&body.diagnosis_codes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/clinical-trials/{id}/candidates` — auto-screen patients against the trial's
/// eligibility (age band / biological sex / required diagnosis ICD codes).
pub async fn screen_candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TrialCandidate>>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let trial = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "SELECT {COLS} FROM clinical_trials WHERE id = $1 AND tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let codes = trial.diagnosis_codes.filter(|c| !c.is_empty());
    let candidates = sqlx::query_as::<_, TrialCandidate>(
        "SELECT p.id, p.first_name, p.last_name, \
            date_part('year', age(p.date_of_birth))::int AS age, p.biological_sex \
         FROM patients p \
         WHERE p.tenant_id = $1 AND p.date_of_birth IS NOT NULL \
           AND ($2::int IS NULL OR date_part('year', age(p.date_of_birth)) >= $2) \
           AND ($3::int IS NULL OR date_part('year', age(p.date_of_birth)) <= $3) \
           AND ($4::text IS NULL OR p.biological_sex = $4) \
           AND ($5::text[] IS NULL OR EXISTS ( \
                 SELECT 1 FROM encounter_diagnoses ed JOIN encounters e ON e.id = ed.encounter_id \
                 WHERE e.patient_id = p.id AND ed.icd_code = ANY($5))) \
         ORDER BY p.created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(trial.min_age)
    .bind(trial.max_age)
    .bind(trial.eligibility_sex.as_deref())
    .bind(codes.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(candidates))
}

// ── Informed consent for trial participation (#2985) ───────────────────────
// Reuses the versioned e-consent module (consent_templates carry the version, consent_records the
// signatures); a trial consent is a consent_record of type 'research' linked to the trial.

const CONSENT_COLS: &str = "cr.id, cr.patient_id, p.first_name, p.last_name, cr.template_id, \
     ct.name AS template_name, ct.version AS template_version, cr.signed_by_patient, \
     cr.patient_signed_at, cr.is_revoked, cr.created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TrialConsent {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub template_id: Option<Uuid>,
    pub template_name: Option<String>,
    pub template_version: Option<i32>,
    pub signed_by_patient: Option<bool>,
    pub patient_signed_at: Option<DateTime<Utc>>,
    pub is_revoked: Option<bool>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/clinical-trials/{id}/consents` — the informed-consent records for a trial.
pub async fn list_trial_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TrialConsent>>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TrialConsent>(&format!(
        "SELECT {CONSENT_COLS} FROM consent_records cr \
         LEFT JOIN patients p ON p.id = cr.patient_id \
         LEFT JOIN consent_templates ct ON ct.id = cr.template_id \
         WHERE cr.tenant_id = $1 AND cr.trial_id = $2 ORDER BY cr.created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RecordTrialConsentRequest {
    pub patient_id: Uuid,
    pub template_id: Option<Uuid>,
}

/// `POST /api/clinical-trials/{id}/consents` — record a patient's signed trial consent.
pub async fn record_trial_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecordTrialConsentRequest>,
) -> Result<Json<TrialConsent>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let new_id: Uuid = sqlx::query_scalar(
        "INSERT INTO consent_records \
         (tenant_id, patient_id, consent_type, language, created_by, trial_id, template_id, \
          signed_by_patient, patient_signed_at, obtained_by) \
         VALUES ($1, $2, 'research', 'en', $3, $4, $5, true, now(), $3) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(id)
    .bind(body.template_id)
    .fetch_one(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, TrialConsent>(&format!(
        "SELECT {CONSENT_COLS} FROM consent_records cr \
         LEFT JOIN patients p ON p.id = cr.patient_id \
         LEFT JOIN consent_templates ct ON ct.id = cr.template_id WHERE cr.id = $1"
    ))
    .bind(new_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Protocol visit schedule + procedure tracking (#2986) ───────────────────

const VISIT_COLS: &str = "tv.id, tv.patient_id, p.first_name, p.last_name, tv.visit_name, \
     tv.scheduled_date, tv.status, tv.procedures, tv.completed_at, tv.notes, tv.created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TrialVisit {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub visit_name: String,
    pub scheduled_date: NaiveDate,
    pub status: String,
    pub procedures: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/clinical-trials/{id}/visits` — the protocol visit schedule for a trial.
pub async fn list_trial_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TrialVisit>>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TrialVisit>(&format!(
        "SELECT {VISIT_COLS} FROM trial_visits tv \
         LEFT JOIN patients p ON p.id = tv.patient_id \
         WHERE tv.tenant_id = $1 AND tv.trial_id = $2 \
         ORDER BY tv.scheduled_date, tv.created_at LIMIT 1000"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ScheduleVisitRequest {
    pub patient_id: Uuid,
    pub visit_name: String,
    pub scheduled_date: NaiveDate,
    pub procedures: Option<String>,
}

/// `POST /api/clinical-trials/{id}/visits` — schedule a protocol visit for an enrolled patient.
pub async fn schedule_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ScheduleVisitRequest>,
) -> Result<Json<TrialVisit>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if body.visit_name.trim().is_empty() {
        return Err(AppError::BadRequest("Visit name is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let new_id: Uuid = sqlx::query_scalar(
        "INSERT INTO trial_visits \
         (tenant_id, trial_id, patient_id, visit_name, scheduled_date, procedures) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.patient_id)
    .bind(body.visit_name.trim())
    .bind(body.scheduled_date)
    .bind(&body.procedures)
    .fetch_one(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, TrialVisit>(&format!(
        "SELECT {VISIT_COLS} FROM trial_visits tv \
         LEFT JOIN patients p ON p.id = tv.patient_id WHERE tv.id = $1"
    ))
    .bind(new_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateVisitRequest {
    pub status: String,
    pub notes: Option<String>,
}

/// `PUT /api/trial-visits/{id}` — mark a visit completed / missed / rescheduled.
pub async fn update_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVisitRequest>,
) -> Result<Json<TrialVisit>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if !["scheduled", "completed", "missed", "rescheduled"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid visit status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, TrialVisit>(&format!(
        "WITH upd AS ( \
           UPDATE trial_visits SET status = $3, notes = COALESCE($4, notes), \
             completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END, \
             completed_by = CASE WHEN $3 = 'completed' THEN $5 ELSE completed_by END, \
             updated_at = now() \
           WHERE id = $1 AND tenant_id = $2 RETURNING id) \
         SELECT {VISIT_COLS} FROM trial_visits tv \
         LEFT JOIN patients p ON p.id = tv.patient_id WHERE tv.id = (SELECT id FROM upd)"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
