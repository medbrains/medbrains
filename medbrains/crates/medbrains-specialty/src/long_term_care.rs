//! Long-Term Care module. Ticket #2961: Minimum Data Set (MDS) assessments — the standardized
//! comprehensive assessment for long-stay residents. Gated by `ipd.nursing_assessment.{list,create}`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const MDS_COLS: &str = "id, patient_id, assessment_type, assessment_date, cognitive_status, \
     mood_score, adl_dependency_score, continence_status, nutrition_notes, sections, status, \
     completed_at, notes, created_at";

const MDS_TYPES: [&str; 5] = [
    "admission",
    "quarterly",
    "annual",
    "significant_change",
    "discharge",
];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MdsAssessment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub assessment_type: String,
    pub assessment_date: NaiveDate,
    pub cognitive_status: Option<String>,
    pub mood_score: Option<i32>,
    pub adl_dependency_score: Option<i32>,
    pub continence_status: Option<String>,
    pub nutrition_notes: Option<String>,
    pub sections: serde_json::Value,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PatientQuery {
    pub patient_id: Uuid,
}

/// `GET /api/ltc/mds?patient_id=` — a resident's MDS assessment history.
pub async fn list_mds_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<MdsAssessment>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MdsAssessment>(&format!(
        "SELECT {MDS_COLS} FROM mds_assessments \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY assessment_date DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateMdsRequest {
    pub patient_id: Uuid,
    pub assessment_type: Option<String>,
    pub cognitive_status: Option<String>,
    pub mood_score: Option<i32>,
    pub adl_dependency_score: Option<i32>,
    pub continence_status: Option<String>,
    pub nutrition_notes: Option<String>,
    pub sections: Option<serde_json::Value>,
    pub notes: Option<String>,
}

/// `POST /api/ltc/mds` — start an MDS assessment (draft).
pub async fn create_mds_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMdsRequest>,
) -> Result<Json<MdsAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if let Some(t) = &body.assessment_type {
        if !MDS_TYPES.contains(&t.as_str()) {
            return Err(AppError::BadRequest("Invalid assessment type".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MdsAssessment>(&format!(
        "INSERT INTO mds_assessments \
         (tenant_id, patient_id, assessment_type, cognitive_status, mood_score, \
          adl_dependency_score, continence_status, nutrition_notes, sections, assessed_by, notes) \
         VALUES ($1, $2, COALESCE($3, 'admission'), $4, $5, $6, $7, $8, \
                 COALESCE($9, '{{}}'::jsonb), $10, $11) RETURNING {MDS_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.assessment_type)
    .bind(&body.cognitive_status)
    .bind(body.mood_score)
    .bind(body.adl_dependency_score)
    .bind(&body.continence_status)
    .bind(&body.nutrition_notes)
    .bind(&body.sections)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/ltc/mds/{id}/complete` — finalize a draft MDS assessment.
pub async fn complete_mds_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MdsAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MdsAssessment>(&format!(
        "UPDATE mds_assessments SET status = 'completed', completed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' RETURNING {MDS_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Assessment not found or already completed".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Long-term medication management (#2962) ────────────────────────────────

const LTCMED_COLS: &str = "id, patient_id, drug_name, dosage, frequency, supply_days, auto_refill, \
     start_date, next_refill_date, last_refilled_at, refill_count, status, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LtcMedication {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub drug_name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub supply_days: i32,
    pub auto_refill: bool,
    pub start_date: NaiveDate,
    pub next_refill_date: Option<NaiveDate>,
    pub last_refilled_at: Option<DateTime<Utc>>,
    pub refill_count: i32,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/ltc/medications?patient_id=` — a resident's long-term medications.
pub async fn list_ltc_medications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<LtcMedication>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LtcMedication>(&format!(
        "SELECT {LTCMED_COLS} FROM long_term_medications \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY status, drug_name LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AddLtcMedicationRequest {
    pub patient_id: Uuid,
    pub drug_name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub supply_days: Option<i32>,
    pub auto_refill: Option<bool>,
    pub notes: Option<String>,
}

/// `POST /api/ltc/medications` — start a long-term medication (next refill = start + supply period).
pub async fn add_ltc_medication(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddLtcMedicationRequest>,
) -> Result<Json<LtcMedication>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if body.drug_name.trim().is_empty() {
        return Err(AppError::BadRequest("Drug name is required".to_owned()));
    }
    let supply = body.supply_days.unwrap_or(90);
    if supply <= 0 {
        return Err(AppError::BadRequest("Supply days must be positive".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LtcMedication>(&format!(
        "INSERT INTO long_term_medications \
         (tenant_id, patient_id, drug_name, dosage, frequency, supply_days, auto_refill, \
          next_refill_date, prescriber, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), CURRENT_DATE + $6, $8, $9) \
         RETURNING {LTCMED_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.drug_name.trim())
    .bind(&body.dosage)
    .bind(&body.frequency)
    .bind(supply)
    .bind(body.auto_refill)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/ltc/medications/{id}/refill` — dispense a refill; advances the next refill date.
pub async fn refill_ltc_medication(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LtcMedication>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LtcMedication>(&format!(
        "UPDATE long_term_medications SET refill_count = refill_count + 1, \
            last_refilled_at = now(), next_refill_date = CURRENT_DATE + supply_days, \
            updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' RETURNING {LTCMED_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Medication not found or not active".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateLtcMedicationRequest {
    pub status: Option<String>,
    pub auto_refill: Option<bool>,
}

/// `PUT /api/ltc/medications/{id}` — pause / discontinue or toggle auto-refill.
pub async fn update_ltc_medication(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLtcMedicationRequest>,
) -> Result<Json<LtcMedication>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if let Some(s) = &body.status {
        if !["active", "paused", "discontinued"].contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LtcMedication>(&format!(
        "UPDATE long_term_medications SET status = COALESCE($3, status), \
            auto_refill = COALESCE($4, auto_refill), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {LTCMED_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(body.auto_refill)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Rehabilitation progress tracking (#2963) ───────────────────────────────

const REHAB_COLS: &str = "id, patient_id, therapy_type, session_date, goal, progress_note, \
     functional_score, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RehabProgress {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub therapy_type: String,
    pub session_date: NaiveDate,
    pub goal: Option<String>,
    pub progress_note: Option<String>,
    pub functional_score: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/ltc/rehab?patient_id=` — a resident's rehab progress log.
pub async fn list_rehab_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<RehabProgress>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, RehabProgress>(&format!(
        "SELECT {REHAB_COLS} FROM rehab_progress \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY session_date DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AddRehabRequest {
    pub patient_id: Uuid,
    pub therapy_type: String,
    pub goal: Option<String>,
    pub progress_note: Option<String>,
    pub functional_score: Option<i32>,
}

/// `POST /api/ltc/rehab` — record a rehab session's progress.
pub async fn add_rehab_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddRehabRequest>,
) -> Result<Json<RehabProgress>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !["physiotherapy", "occupational", "speech"].contains(&body.therapy_type.as_str()) {
        return Err(AppError::BadRequest("Invalid therapy type".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, RehabProgress>(&format!(
        "INSERT INTO rehab_progress \
         (tenant_id, patient_id, therapy_type, goal, progress_note, functional_score, therapist) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {REHAB_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.therapy_type)
    .bind(&body.goal)
    .bind(&body.progress_note)
    .bind(body.functional_score)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Family communication portal (#2964) ────────────────────────────────────

const FAM_COLS: &str = "id, patient_id, direction, message_type, subject, body, family_contact, \
     status, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FamilyMessage {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub direction: String,
    pub message_type: String,
    pub subject: Option<String>,
    pub body: String,
    pub family_contact: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/ltc/family-messages?patient_id=` — the family communication thread.
pub async fn list_family_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<FamilyMessage>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, FamilyMessage>(&format!(
        "SELECT {FAM_COLS} FROM family_messages \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct PostFamilyMessageRequest {
    pub patient_id: Uuid,
    pub direction: Option<String>,
    pub message_type: Option<String>,
    pub subject: Option<String>,
    pub body: String,
    pub family_contact: Option<String>,
}

/// `POST /api/ltc/family-messages` — post a care update to / log a message from the family.
pub async fn post_family_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PostFamilyMessageRequest>,
) -> Result<Json<FamilyMessage>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if body.body.trim().is_empty() {
        return Err(AppError::BadRequest("Message body is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FamilyMessage>(&format!(
        "INSERT INTO family_messages \
         (tenant_id, patient_id, direction, message_type, subject, body, family_contact, posted_by) \
         VALUES ($1, $2, COALESCE($3, 'to_family'), COALESCE($4, 'care_update'), $5, $6, $7, $8) \
         RETURNING {FAM_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.direction)
    .bind(&body.message_type)
    .bind(&body.subject)
    .bind(body.body.trim())
    .bind(&body.family_contact)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFamilyMessageRequest {
    pub status: String,
}

/// `PUT /api/ltc/family-messages/{id}` — mark a message read / actioned.
pub async fn update_family_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFamilyMessageRequest>,
) -> Result<Json<FamilyMessage>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !["sent", "read", "actioned"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FamilyMessage>(&format!(
        "UPDATE family_messages SET status = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {FAM_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Readmission risk scoring (#2965) ───────────────────────────────────────

const RISK_COLS: &str = "id, patient_id, length_of_stay, acuity_score, comorbidity_score, \
     ed_visits, total_score, risk_level, notes, assessed_at, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReadmissionRisk {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub length_of_stay: i32,
    pub acuity_score: i32,
    pub comorbidity_score: i32,
    pub ed_visits: i32,
    pub total_score: i32,
    pub risk_level: String,
    pub notes: Option<String>,
    pub assessed_at: NaiveDate,
    pub created_at: DateTime<Utc>,
}

/// LACE-style banding: >=10 high, 5-9 moderate, else low.
fn risk_band(total: i32) -> &'static str {
    if total >= 10 {
        "high"
    } else if total >= 5 {
        "moderate"
    } else {
        "low"
    }
}

/// `GET /api/ltc/readmission-risk?patient_id=` — a patient's readmission-risk assessments.
pub async fn list_readmission_risk(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<ReadmissionRisk>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ReadmissionRisk>(&format!(
        "SELECT {RISK_COLS} FROM readmission_risk_assessments \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY assessed_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AssessRiskRequest {
    pub patient_id: Uuid,
    pub length_of_stay: i32,
    pub acuity_score: i32,
    pub comorbidity_score: i32,
    pub ed_visits: i32,
    pub notes: Option<String>,
}

/// `POST /api/ltc/readmission-risk` — score readmission risk from the LACE components.
pub async fn assess_readmission_risk(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AssessRiskRequest>,
) -> Result<Json<ReadmissionRisk>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    let total =
        body.length_of_stay + body.acuity_score + body.comorbidity_score + body.ed_visits;
    let level = risk_band(total);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ReadmissionRisk>(&format!(
        "INSERT INTO readmission_risk_assessments \
         (tenant_id, patient_id, length_of_stay, acuity_score, comorbidity_score, ed_visits, \
          total_score, risk_level, assessed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING {RISK_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.length_of_stay)
    .bind(body.acuity_score)
    .bind(body.comorbidity_score)
    .bind(body.ed_visits)
    .bind(total)
    .bind(level)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::risk_band;

    #[test]
    fn bands() {
        assert_eq!(risk_band(3), "low");
        assert_eq!(risk_band(5), "moderate");
        assert_eq!(risk_band(9), "moderate");
        assert_eq!(risk_band(10), "high");
    }
}

// ── Home care referral from discharge (#2966) ──────────────────────────────

const REFERRAL_COLS: &str = "id, patient_id, referral_type, reason, status, provider, \
     referred_date, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeCareReferral {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub referral_type: String,
    pub reason: Option<String>,
    pub status: String,
    pub provider: Option<String>,
    pub referred_date: NaiveDate,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/ltc/referrals?patient_id=` — a patient's home-care referrals.
pub async fn list_home_care_referrals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<HomeCareReferral>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeCareReferral>(&format!(
        "SELECT {REFERRAL_COLS} FROM home_care_referrals \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY referred_date DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateReferralRequest {
    pub patient_id: Uuid,
    pub referral_type: String,
    pub reason: Option<String>,
    pub provider: Option<String>,
    pub notes: Option<String>,
}

/// `POST /api/ltc/referrals` — refer a patient to home care at discharge.
pub async fn create_home_care_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReferralRequest>,
) -> Result<Json<HomeCareReferral>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !["nursing", "wound_care", "physiotherapy", "occupational", "speech", "general"]
        .contains(&body.referral_type.as_str())
    {
        return Err(AppError::BadRequest("Invalid referral type".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeCareReferral>(&format!(
        "INSERT INTO home_care_referrals \
         (tenant_id, patient_id, referral_type, reason, provider, referred_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {REFERRAL_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.referral_type)
    .bind(&body.reason)
    .bind(&body.provider)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateReferralRequest {
    pub status: String,
}

/// `PUT /api/ltc/referrals/{id}` — advance a referral (accept / schedule / decline / complete).
pub async fn update_home_care_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReferralRequest>,
) -> Result<Json<HomeCareReferral>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !["pending", "accepted", "scheduled", "declined", "completed"]
        .contains(&body.status.as_str())
    {
        return Err(AppError::BadRequest("Invalid status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeCareReferral>(&format!(
        "UPDATE home_care_referrals SET status = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {REFERRAL_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── SNF admission from discharge (#2960) ───────────────────────────────────

const SNF_COLS: &str = "id, patient_id, admission_date, source, level_of_care, primary_diagnosis, \
     care_plan, expected_los_days, status, discharge_date, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SnfAdmission {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_date: NaiveDate,
    pub source: String,
    pub level_of_care: String,
    pub primary_diagnosis: Option<String>,
    pub care_plan: Option<String>,
    pub expected_los_days: Option<i32>,
    pub status: String,
    pub discharge_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/ltc/snf-admissions?patient_id=` — a patient's SNF admissions.
pub async fn list_snf_admissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientQuery>,
) -> Result<Json<Vec<SnfAdmission>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SnfAdmission>(&format!(
        "SELECT {SNF_COLS} FROM snf_admissions \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY admission_date DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateSnfRequest {
    pub patient_id: Uuid,
    pub source: Option<String>,
    pub level_of_care: Option<String>,
    pub primary_diagnosis: Option<String>,
    pub care_plan: Option<String>,
    pub expected_los_days: Option<i32>,
    pub notes: Option<String>,
}

/// `POST /api/ltc/snf-admissions` — admit a patient to the SNF (care plan carried over).
pub async fn create_snf_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSnfRequest>,
) -> Result<Json<SnfAdmission>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if let Some(s) = &body.source {
        if !["hospital_discharge", "direct", "transfer"].contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid source".to_owned()));
        }
    }
    if let Some(l) = &body.level_of_care {
        if !["skilled_nursing", "rehab", "long_term"].contains(&l.as_str()) {
            return Err(AppError::BadRequest("Invalid level of care".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SnfAdmission>(&format!(
        "INSERT INTO snf_admissions \
         (tenant_id, patient_id, source, level_of_care, primary_diagnosis, care_plan, \
          expected_los_days, admitted_by, notes) \
         VALUES ($1, $2, COALESCE($3, 'hospital_discharge'), COALESCE($4, 'skilled_nursing'), \
                 $5, $6, $7, $8, $9) RETURNING {SNF_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.source)
    .bind(&body.level_of_care)
    .bind(&body.primary_diagnosis)
    .bind(&body.care_plan)
    .bind(body.expected_los_days)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSnfRequest {
    pub status: String,
    pub care_plan: Option<String>,
}

/// `PUT /api/ltc/snf-admissions/{id}` — update the care plan or discharge / transfer the admission.
pub async fn update_snf_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSnfRequest>,
) -> Result<Json<SnfAdmission>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !["admitted", "discharged", "transferred"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SnfAdmission>(&format!(
        "UPDATE snf_admissions SET status = $3, care_plan = COALESCE($4, care_plan), \
            discharge_date = CASE WHEN $3 IN ('discharged', 'transferred') THEN CURRENT_DATE \
                                  ELSE discharge_date END, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {SNF_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.care_plan)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
