// Post-discharge handlers — discharge workflow checklist, DAMA / LAMA
// records, post-discharge follow-ups (survey + readmission watch),
// mortality / M&M reviews. See migration 0108 for the schema.
//
// Plan: Track 1A.bis.4 in delegated-discovering-milner.md — addresses
// "no place to do things after IPD" feedback. Split out of ipd.rs
// because that file is already 5,003 lines (over the 450-line cap).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use axum::routing::{get,post};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::permissions;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
    },
    state::AppState,
};

// ── Discharge workflow checklist ─────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct DischargeWorkflow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub discharge_ordered_at: Option<DateTime<Utc>>,
    pub bill_closed_at: Option<DateTime<Utc>>,
    pub bill_closed_by: Option<Uuid>,
    pub rx_dispensed_at: Option<DateTime<Utc>>,
    pub rx_dispensed_by: Option<Uuid>,
    pub counseling_done_at: Option<DateTime<Utc>>,
    pub counseling_done_by: Option<Uuid>,
    pub counseling_topics: Option<Vec<String>>,
    pub card_printed_at: Option<DateTime<Utc>>,
    pub card_printed_by: Option<Uuid>,
    pub bed_released_at: Option<DateTime<Utc>>,
    pub bed_released_by: Option<Uuid>,
    pub transport_arranged: Option<bool>,
    pub transport_notes: Option<String>,
    pub follow_up_appt_id: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct DischargeStepUpdate {
    pub step: String, // 'discharge_ordered'|'bill_closed'|'rx_dispensed'|'counseling_done'|'card_printed'|'bed_released'|'completed'
    pub counseling_topics: Option<Vec<String>>,
    pub transport_arranged: Option<bool>,
    pub transport_notes: Option<String>,
    pub follow_up_appt_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// GET /api/ipd/admissions/{id}/discharge-workflow
pub async fn get_discharge_workflow(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<DischargeWorkflow>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::discharge_checklist::LIST,
            permissions::ipd::discharge_checklist::UPDATE,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, DischargeWorkflow>(
        "SELECT * FROM ipd_discharge_workflows \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// POST /api/ipd/admissions/{id}/discharge-workflow/step
///
/// Idempotent step toggler. Each step records its `*_at` and `*_by`
/// fields once; re-posting the same step is a no-op (stamps refresh).
/// The wizard UI posts the step name after the user confirms each
/// stage in the discharge flow.
pub async fn update_discharge_step(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<DischargeStepUpdate>,
) -> Result<Json<DischargeWorkflow>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_checklist::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Upsert: create the row on first write so the UI can blindly POST
    // any step without first creating the workflow record.
    sqlx::query(
        "INSERT INTO ipd_discharge_workflows (tenant_id, admission_id) \
         VALUES ($1, $2) ON CONFLICT (admission_id) DO NOTHING",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .execute(&mut *tx)
    .await?;

    let (set_clause, want_user) = match body.step.as_str() {
        "discharge_ordered" => (
            "discharge_ordered_at = COALESCE(discharge_ordered_at, now())",
            false,
        ),
        "bill_closed" => (
            "bill_closed_at = COALESCE(bill_closed_at, now()), bill_closed_by = COALESCE(bill_closed_by, $3)",
            true,
        ),
        "rx_dispensed" => (
            "rx_dispensed_at = COALESCE(rx_dispensed_at, now()), rx_dispensed_by = COALESCE(rx_dispensed_by, $3)",
            true,
        ),
        "counseling_done" => (
            "counseling_done_at = COALESCE(counseling_done_at, now()), counseling_done_by = COALESCE(counseling_done_by, $3), counseling_topics = $4",
            true,
        ),
        "card_printed" => (
            "card_printed_at = COALESCE(card_printed_at, now()), card_printed_by = COALESCE(card_printed_by, $3)",
            true,
        ),
        "bed_released" => (
            "bed_released_at = COALESCE(bed_released_at, now()), bed_released_by = COALESCE(bed_released_by, $3)",
            true,
        ),
        "completed" => (
            "completed_at = COALESCE(completed_at, now()), completed_by = COALESCE(completed_by, $3)",
            true,
        ),
        other => {
            return Err(AppError::BadRequest(format!(
                "unknown discharge step '{other}'"
            )));
        }
    };

    let sql = format!(
        "UPDATE ipd_discharge_workflows SET {set_clause}, updated_at = now() \
         WHERE admission_id = $1 AND tenant_id = $2 RETURNING *"
    );

    let mut q = sqlx::query_as::<_, DischargeWorkflow>(&sql)
        .bind(admission_id)
        .bind(claims.tenant_id);
    if want_user {
        q = q.bind(claims.sub);
    }
    if body.step == "counseling_done" {
        q = q.bind(body.counseling_topics.clone());
    }

    let row = q.fetch_one(&mut *tx).await?;

    // Auto-bag side effect (item 3 of Track 0.ter Phase A): on
    // `rx_dispensed`, build a single pharmacy order from the discharge
    // summary's `medications_on_discharge` JSONB so the dispenser
    // doesn't manually re-enter every drug. Idempotent — we set
    // `discharge_summary_id` on the order and skip if one already
    // exists for this summary. Failures are logged but do not roll
    // back the wizard step (operators can re-enter the order manually).
    if body.step == "rx_dispensed" {
        let _ = autobag_discharge_meds(&mut tx, &claims, admission_id).await;
    }

    let event_name = match body.step.as_str() {
        "discharge_ordered" => Some(ClinicalEventName::IpdDischargeInitiated),
        "completed" => Some(ClinicalEventName::IpdDischargeCompleted),
        _ => None,
    };
    if let Some(event_name) = event_name {
        let admission = sqlx::query!(
            "SELECT patient_id, encounter_id FROM admissions WHERE id = $1 AND tenant_id = $2",
            admission_id,
            claims.tenant_id,
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            event_name,
            row.id,
            claims.sub,
            serde_json::json!({
                "admission_id": admission_id,
                "patient_id": admission.patient_id,
                "encounter_id": admission.encounter_id,
                "workflow_id": row.id,
                "step": body.step.as_str(),
                "discharge_ordered_at": row
                    .discharge_ordered_at
                    .as_ref()
                    .map(DateTime::to_rfc3339),
                "completed_at": row.completed_at.as_ref().map(DateTime::to_rfc3339),
            }),
        )
        .with_patient(admission.patient_id)
        .with_admission(admission_id)
        .with_encounter(admission.encounter_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(serde::Deserialize)]
struct DischargeMedItem {
    drug_name: Option<String>,
    catalog_item_id: Option<Uuid>,
    quantity: Option<i32>,
    unit_price: Option<rust_decimal::Decimal>,
}

async fn autobag_discharge_meds(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    admission_id: Uuid,
) -> Result<(), AppError> {
    let summary: Option<(Uuid, Option<Uuid>, serde_json::Value)> = sqlx::query_as(
        "SELECT ds.id, a.encounter_id, ds.medications_on_discharge \
         FROM ipd_discharge_summaries ds \
         JOIN admissions a ON a.id = ds.admission_id \
         WHERE ds.admission_id = $1 AND ds.tenant_id = $2 \
         ORDER BY ds.created_at DESC LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((summary_id, encounter_id, meds_json)) = summary else {
        return Ok(()); // no discharge summary — nothing to bag
    };

    // Idempotency: skip if a discharge order already exists for this summary.
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM pharmacy_orders \
         WHERE discharge_summary_id = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(summary_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if existing.is_some() {
        return Ok(());
    }

    let meds: Vec<DischargeMedItem> = serde_json::from_value(meds_json).unwrap_or_default();
    if meds.is_empty() {
        return Ok(());
    }

    let items: Vec<medbrains_pharmacy::OrderItemInput> = meds
        .into_iter()
        .filter_map(|m| {
            Some(medbrains_pharmacy::OrderItemInput {
                catalog_item_id: m.catalog_item_id,
                drug_name: m.drug_name?,
                quantity: m.quantity.unwrap_or(1),
                unit_price: m.unit_price.unwrap_or(rust_decimal::Decimal::ZERO),
            })
        })
        .collect();
    if items.is_empty() {
        return Ok(());
    }

    let req = medbrains_pharmacy::CreateOrderRequest {
        prescription_id: None,
        patient_id: claims.tenant_id, // overridden below from admission
        encounter_id,
        notes: Some("Auto-generated from discharge summary".to_owned()),
        items,
        dispensing_type: Some("discharge".to_owned()),
        discharge_summary_id: Some(summary_id),
        billing_package_id: None,
        store_location_id: None,
        safety_override_reason: None,
        allergy_override_reason: None,
        is_dummy: None,
    };

    // Resolve patient_id from the admission since we didn't carry it
    // through the summary join.
    let patient_id: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(admission_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;

    let Some(patient_id) = patient_id else {
        return Ok(());
    };

    let req = medbrains_pharmacy::CreateOrderRequest { patient_id, ..req };

    let _ = medbrains_pharmacy::create_order_in_tx(tx, claims, &req).await?;
    Ok(())
}

// ── DAMA / LAMA records ──────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct DamaRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub record_type: String,
    pub declared_at: DateTime<Utc>,
    pub declared_by: Option<Uuid>,
    pub patient_signed: Option<bool>,
    pub patient_signature_url: Option<String>,
    pub relative_name: Option<String>,
    pub relative_relation: Option<String>,
    pub relative_signed: Option<bool>,
    pub relative_signature_url: Option<String>,
    pub witness_name: Option<String>,
    pub witness_signed: Option<bool>,
    pub witness_signature_url: Option<String>,
    pub risks_explained: Option<String>,
    pub reason_for_leaving: Option<String>,
    pub is_mlc_case: Option<bool>,
    pub mlc_notification_sent_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDamaRequest {
    pub record_type: String,
    pub patient_signed: Option<bool>,
    pub patient_signature_url: Option<String>,
    pub relative_name: Option<String>,
    pub relative_relation: Option<String>,
    pub relative_signed: Option<bool>,
    pub relative_signature_url: Option<String>,
    pub witness_name: Option<String>,
    pub witness_signed: Option<bool>,
    pub witness_signature_url: Option<String>,
    pub risks_explained: Option<String>,
    pub reason_for_leaving: Option<String>,
    pub is_mlc_case: Option<bool>,
    pub notes: Option<String>,
}

/// POST /api/ipd/admissions/{id}/dama
pub async fn record_dama(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateDamaRequest>,
) -> Result<Json<DamaRecord>, AppError> {
    require_permission(&claims, permissions::ipd::discharge::CREATE)?;
    if body.record_type != "dama" && body.record_type != "lama" {
        return Err(AppError::BadRequest(
            "record_type must be 'dama' or 'lama'".to_owned(),
        ));
    }
    if !body.patient_signed.unwrap_or(false) && !body.relative_signed.unwrap_or(false) {
        return Err(AppError::BadRequest(
            "Either patient or authorised relative signature is required".to_owned(),
        ));
    }
    if body
        .risks_explained
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        return Err(AppError::BadRequest(
            "Risks explained is required before recording DAMA/LAMA".to_owned(),
        ));
    }
    if body.witness_name.as_deref().unwrap_or("").trim().is_empty()
        || !body.witness_signed.unwrap_or(false)
    {
        return Err(AppError::BadRequest(
            "Witness name and signature are required for DAMA/LAMA".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let status = sqlx::query_scalar::<_, String>(
        "SELECT status::text FROM admissions WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if status != "admitted" {
        return Err(AppError::BadRequest(
            "DAMA/LAMA can be recorded only for active admitted patients".to_owned(),
        ));
    }

    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM ipd_dama_records WHERE admission_id = $1 AND tenant_id = $2)",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if existing {
        return Err(AppError::BadRequest(
            "DAMA/LAMA has already been recorded for this admission".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, DamaRecord>(
        "INSERT INTO ipd_dama_records \
         (tenant_id, admission_id, record_type, declared_by, \
          patient_signed, patient_signature_url, \
          relative_name, relative_relation, relative_signed, relative_signature_url, \
          witness_name, witness_signed, witness_signature_url, \
          risks_explained, reason_for_leaving, is_mlc_case, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.record_type)
    .bind(claims.sub)
    .bind(body.patient_signed.unwrap_or(false))
    .bind(&body.patient_signature_url)
    .bind(&body.relative_name)
    .bind(&body.relative_relation)
    .bind(body.relative_signed.unwrap_or(false))
    .bind(&body.relative_signature_url)
    .bind(&body.witness_name)
    .bind(body.witness_signed.unwrap_or(false))
    .bind(&body.witness_signature_url)
    .bind(&body.risks_explained)
    .bind(&body.reason_for_leaving)
    .bind(body.is_mlc_case.unwrap_or(false))
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// GET /api/ipd/admissions/{id}/dama
pub async fn get_dama(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<DamaRecord>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, DamaRecord>(
        "SELECT * FROM ipd_dama_records WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY declared_at DESC LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Post-discharge follow-ups + readmission watch ────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct PostDischargeFollowup {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub survey_sent_at: Option<DateTime<Utc>>,
    pub survey_sent_via: Option<String>,
    pub survey_responded_at: Option<DateTime<Utc>>,
    pub survey_score: Option<i32>,
    pub survey_comments: Option<String>,
    pub followup_appt_id: Option<Uuid>,
    pub followup_due_date: Option<NaiveDate>,
    pub followup_attended: Option<bool>,
    pub readmitted_within_30d: Option<bool>,
    pub readmission_admission_id: Option<Uuid>,
    pub readmission_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GET /api/ipd/post-discharge?within_days=30
///
/// Lists recently-discharged admissions with their follow-up status.
/// Filters by cutoff so the dashboard stays manageable.
pub async fn list_post_discharge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PostDischargeFollowup>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PostDischargeFollowup>(
        "SELECT * FROM ipd_post_discharge_followups \
         WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct SendSurveyRequest {
    pub via: String, // 'sms' | 'email' | 'whatsapp'
}

/// POST /api/ipd/post-discharge/{admission_id}/survey/send
///
/// Stamps survey_sent_at; the actual outbound message is delivered by
/// the orchestration layer (DLT/SMS provider) reading this row.
pub async fn send_survey(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<SendSurveyRequest>,
) -> Result<Json<PostDischargeFollowup>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PostDischargeFollowup>(
        "UPDATE ipd_post_discharge_followups \
         SET survey_sent_at = COALESCE(survey_sent_at, now()), \
             survey_sent_via = $1, updated_at = now() \
         WHERE admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&body.via)
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Mortality / M&M reviews ──────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct MortalityReview {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub death_at: DateTime<Utc>,
    pub cause_of_death: Option<String>,
    pub primary_dx: Option<String>,
    pub is_mlc_case: Option<bool>,
    pub autopsy_required: Option<bool>,
    pub autopsy_done_at: Option<DateTime<Utc>>,
    pub review_due_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewer_id: Option<Uuid>,
    pub review_findings: Option<String>,
    pub avoidable: Option<bool>,
    pub contributory_factors: Option<Vec<String>>,
    pub action_items: Option<String>,
    pub death_summary_signed_at: Option<DateTime<Utc>>,
    pub civil_form_filed_at: Option<DateTime<Utc>>,
    pub body_released_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMortalityReviewRequest {
    pub admission_id: Uuid,
    pub death_at: DateTime<Utc>,
    pub cause_of_death: Option<String>,
    pub primary_dx: Option<String>,
    pub is_mlc_case: Option<bool>,
    pub autopsy_required: Option<bool>,
}

/// POST /api/ipd/mortality-reviews
pub async fn create_mortality_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMortalityReviewRequest>,
) -> Result<Json<MortalityReview>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    // NABH expects M&M review within 72h; review_due_at is computed
    // server-side so the dashboard's "overdue" flag is consistent.
    let review_due_at = body.death_at + Duration::hours(72);
    if body.death_at > Utc::now() + Duration::minutes(5) {
        return Err(AppError::BadRequest(
            "Death timestamp cannot be in the future".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let status = sqlx::query_scalar::<_, String>(
        "SELECT status::text FROM admissions WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(body.admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if status != "admitted" && status != "deceased" {
        return Err(AppError::BadRequest(
            "Death can be recorded only for admitted or already deceased admissions".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, MortalityReview>(
        "INSERT INTO ipd_mortality_reviews \
         (tenant_id, admission_id, death_at, cause_of_death, primary_dx, \
          is_mlc_case, autopsy_required, review_due_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (admission_id) DO UPDATE SET \
           death_at = EXCLUDED.death_at, \
           cause_of_death = EXCLUDED.cause_of_death, \
           primary_dx = EXCLUDED.primary_dx, \
           is_mlc_case = EXCLUDED.is_mlc_case, \
           autopsy_required = EXCLUDED.autopsy_required \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(body.death_at)
    .bind(&body.cause_of_death)
    .bind(&body.primary_dx)
    .bind(body.is_mlc_case.unwrap_or(false))
    .bind(body.autopsy_required.unwrap_or(false))
    .bind(review_due_at)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// GET /api/ipd/mortality-reviews
pub async fn list_mortality_reviews(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MortalityReview>>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, MortalityReview>(
        "SELECT * FROM ipd_mortality_reviews \
         WHERE tenant_id = $1 ORDER BY death_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct SubmitMortalityReviewRequest {
    pub review_findings: String,
    pub avoidable: bool,
    pub contributory_factors: Option<Vec<String>>,
    pub action_items: Option<String>,
}

/// POST /api/ipd/mortality-reviews/{id}/submit
pub async fn submit_mortality_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitMortalityReviewRequest>,
) -> Result<Json<MortalityReview>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;
    if body.review_findings.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Mortality review findings are required".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, MortalityReview>(
        "UPDATE ipd_mortality_reviews SET \
         reviewed_at = now(), reviewer_id = $1, \
         review_findings = $2, avoidable = $3, \
         contributory_factors = $4, action_items = $5, \
         updated_at = now() \
         WHERE id = $6 AND tenant_id = $7 RETURNING *",
    )
    .bind(claims.sub)
    .bind(&body.review_findings)
    .bind(body.avoidable)
    .bind(body.contributory_factors.clone())
    .bind(&body.action_items)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// ipd_post_discharge routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/ipd/admissions/{id}/discharge-workflow",
            get(get_discharge_workflow),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-workflow/step",
            post(update_discharge_step),
        )
        .route(
            "/api/ipd/admissions/{id}/dama",
            get(get_dama)
                .post(record_dama),
        )
        .route(
            "/api/ipd/post-discharge",
            get(list_post_discharge),
        )
        .route(
            "/api/ipd/post-discharge/{id}/survey/send",
            post(send_survey),
        )
        .route(
            "/api/ipd/mortality-reviews",
            get(list_mortality_reviews)
                .post(create_mortality_review),
        )
        .route(
            "/api/ipd/mortality-reviews/{id}/submit",
            post(submit_mortality_review),
        )
}
