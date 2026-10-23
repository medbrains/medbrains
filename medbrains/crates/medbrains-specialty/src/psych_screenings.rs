//! PHQ-9 and GAD-7, stored item by item and scored on the server.
//!
//! A positive PHQ-9 item 9 (any answer above 0 to "thoughts that you would
//! be better off dead, or of hurting yourself") opens a suicide-risk review
//! at once: the screening is saved as `pending`, the treating psychiatrist is
//! notified, it heads the safety worklist, and it stays there until a
//! clinician records the review's outcome and plan.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_authz_gate::mental_health::{
    MentalHealthViewer, PsychChild, require_psych_child_access, require_psych_record_access,
};
use medbrains_clinical_scores::phq::{Instrument, score};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::PsychScreening;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const REVIEW_OUTCOMES: [&str; 4] = ["no_current_risk", "low", "moderate", "high"];

#[derive(Debug, Deserialize)]
pub struct CreateScreeningRequest {
    pub instrument: String,
    pub answers: Vec<i16>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SafetyReviewRequest {
    pub outcome: String,
    pub note: String,
}

/// A screening waiting for its suicide-risk review, for the worklist.
#[derive(Debug, Serialize)]
pub struct PendingSafetyReview {
    pub screening_id: Uuid,
    pub psych_patient_id: Uuid,
    pub patient_id: Uuid,
    pub total: i32,
    pub administered_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychScreening>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::LIST,
    )?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PsychScreening,
        "SELECT id, tenant_id, psych_patient_id, instrument, answers, total, severity, \
                item9_positive, administered_by, administered_at, safety_review_status, \
                safety_reviewed_by, safety_reviewed_at, safety_review_outcome, safety_review_note, \
                notes, created_at, updated_at \
           FROM psych_screenings \
          WHERE psych_patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY administered_at LIMIT 1000",
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<CreateScreeningRequest>,
) -> Result<Json<PsychScreening>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::assessments::CREATE,
    )?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let instrument = Instrument::from_code(&body.instrument)
        .ok_or_else(|| AppError::BadRequest("Choose PHQ-9 or GAD-7".to_owned()))?;
    let scored =
        score(instrument, &body.answers).map_err(|e| AppError::BadRequest(e.to_string()))?;
    let review = if scored.item9_positive {
        "pending"
    } else {
        "not_required"
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychScreening,
        "INSERT INTO psych_screenings \
           (tenant_id, psych_patient_id, instrument, answers, total, severity, item9_positive, \
            administered_by, safety_review_status, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING id, tenant_id, psych_patient_id, instrument, answers, total, severity, \
                item9_positive, administered_by, administered_at, safety_review_status, \
                safety_reviewed_by, safety_reviewed_at, safety_review_outcome, safety_review_note, \
                notes, created_at, updated_at",
        claims.tenant_id,
        psych_patient_id,
        instrument.code(),
        &body.answers,
        scored.total,
        scored.severity,
        scored.item9_positive,
        claims.sub,
        review,
        body.notes
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .fetch_one(&mut *tx)
    .await?;
    if scored.item9_positive {
        alert_treating_psychiatrist(&mut tx, &claims, &row).await?;
    }
    tx.commit().await?;
    Ok(Json(row))
}

/// Tell the treating psychiatrist now. The message names the event, not the
/// patient's answers — the record stays behind its own gate.
async fn alert_treating_psychiatrist(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    screening: &PsychScreening,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT pp.tenant_id, pp.treating_psychiatrist_id, 'psych_safety', \
                'Urgent: suicide-risk review needed', \
                'A PHQ-9 recorded thoughts of self-harm. Assess the patient today.', \
                'clinical', 'psych_screening', $3, \
                '/specialty/psychiatry?patient_id=' || pp.patient_id::text \
           FROM psych_patients pp \
          WHERE pp.id = $1 AND pp.tenant_id = $2 AND pp.treating_psychiatrist_id IS NOT NULL \
            AND pp.treating_psychiatrist_id <> $4",
        screening.psych_patient_id,
        claims.tenant_id,
        screening.id,
        claims.sub,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn complete_safety_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SafetyReviewRequest>,
) -> Result<Json<PsychScreening>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::safety::REVIEW)?;
    require_psych_child_access(&state, &claims, PsychChild::Screening, id).await?;
    if !REVIEW_OUTCOMES.contains(&body.outcome.as_str()) {
        return Err(AppError::BadRequest(
            "Choose the assessed level of risk".to_owned(),
        ));
    }
    if body.note.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Record what was assessed and the safety plan".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychScreening,
        "UPDATE psych_screenings SET safety_review_status = 'completed', \
                safety_reviewed_by = $3, safety_reviewed_at = now(), \
                safety_review_outcome = $4, safety_review_note = $5 \
          WHERE id = $1 AND tenant_id = $2 AND safety_review_status = 'pending' \
            AND deleted_at IS NULL \
         RETURNING id, tenant_id, psych_patient_id, instrument, answers, total, severity, \
                item9_positive, administered_by, administered_at, safety_review_status, \
                safety_reviewed_by, safety_reviewed_at, safety_review_outcome, safety_review_note, \
                notes, created_at, updated_at",
        id,
        claims.tenant_id,
        claims.sub,
        body.outcome,
        body.note.trim(),
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("No review is pending on this screening".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Every pending suicide-risk review this caller may open — one query, with
/// the same care-team and restricted-record filters as the patient list.
pub async fn list_pending_safety_reviews(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingSafetyReview>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::safety::REVIEW)?;
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, None).await?;
    let viewer = MentalHealthViewer::of(&claims);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PendingSafetyReview,
        r#"SELECT s.id AS screening_id, s.psych_patient_id, pp.patient_id, s.total,
                  s.administered_at
             FROM psych_screenings s JOIN psych_patients pp ON pp.id = s.psych_patient_id
            WHERE s.tenant_id = $1 AND s.safety_review_status = 'pending'
              AND s.deleted_at IS NULL AND pp.deleted_at IS NULL
              AND ($2::uuid[] IS NULL OR pp.patient_id = ANY($2))
              AND (NOT pp.is_restricted
                   OR NOT public.mental_health_withheld(pp.patient_id, $3, $4))
            ORDER BY s.administered_at LIMIT 200"#,
        claims.tenant_id,
        permitted.as_deref(),
        viewer.user_id,
        viewer.can_all,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
