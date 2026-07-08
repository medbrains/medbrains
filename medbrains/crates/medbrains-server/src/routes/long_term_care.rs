//! Long-Term Care module. Ticket #2961: Minimum Data Set (MDS) assessments — the standardized
//! comprehensive assessment for long-stay residents. Gated by `ipd.nursing_assessment.{list,create}`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

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
