//! Pre-authorisation through NHCX: send a `prior_auth_requests` row to the
//! payer as a `ClaimBundle` with `use = preauthorization`, and show where it
//! stands — its timeline, the payer's open queries and the IRDAI clock.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{NhcxOperation, NhcxRecord, PreauthSla, preauth_sla};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_bundle::{self, ClaimContent, DiagnosisLine, DocumentRef, ItemLine, Parties};
use crate::nhcx_common::{self, Outbound, Tx};
use crate::nhcx_queries::{self, NhcxPayerQuery};

#[derive(Debug, FromRow)]
struct PaRow {
    id: Uuid,
    patient_id: Uuid,
    patient_insurance_id: Uuid,
    service_type: String,
    service_code: Option<String>,
    service_description: Option<String>,
    diagnosis_codes: Option<Vec<String>>,
    ordering_doctor_id: Option<Uuid>,
    encounter_id: Option<Uuid>,
    urgency: String,
    status: String,
    estimated_cost: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitPreauthToNhcxRequest {
    /// The payer's HCX participant code.
    pub recipient_code: String,
    /// `initial` (default), `enhancement` or `discharge` — a discharge
    /// request runs on IRDAI's three-hour clock, the others on one hour.
    pub request_stage: Option<String>,
}

const STAGES: [&str; 3] = ["initial", "enhancement", "discharge"];

async fn load_pa(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<PaRow, AppError> {
    sqlx::query_as::<_, PaRow>(
        "SELECT id, patient_id, patient_insurance_id, service_type, service_code, \
                service_description, diagnosis_codes, ordering_doctor_id, encounter_id, \
                urgency::text AS urgency, status::text AS status, estimated_cost \
         FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The encounter's coded diagnoses; failing those, the codes typed on the
/// request, read as ICD-10.
async fn diagnoses(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    pa: &PaRow,
) -> Result<Vec<DiagnosisLine>, AppError> {
    let coded = nhcx_common::encounter_diagnoses(tx, tenant_id, pa.encounter_id).await?;
    if !coded.is_empty() {
        return Ok(coded);
    }
    let typed = pa.diagnosis_codes.iter().flatten().take(50);
    Ok(typed
        .enumerate()
        .map(|(i, code)| DiagnosisLine {
            icd_code: Some(code.clone()),
            icd_system: "icd10".to_owned(),
            description: code.clone(),
            snomed_code: None,
            is_primary: i == 0,
        })
        .collect())
}

async fn build(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    pa: &PaRow,
    recipient: &str,
) -> Result<serde_json::Value, AppError> {
    let patient = nhcx_common::load_patient(tx, tenant_id, pa.patient_id).await?;
    let (_, policy) =
        nhcx_common::load_policy(tx, tenant_id, pa.patient_id, Some(pa.patient_insurance_id))
            .await?
            .ok_or_else(|| AppError::BadRequest("the pre-authorisation's policy is gone".into()))?;
    let provider = nhcx_common::load_provider(tx, tenant_id).await?;
    let doctor = nhcx_common::load_doctor(tx, tenant_id, pa.ordering_doctor_id).await?;
    let diagnoses = diagnoses(tx, tenant_id, pa).await?;
    let documents = sqlx::query_as::<_, DocumentRef>(
        "SELECT document_type, file_name, file_path, mime_type, created_at \
         FROM prior_auth_documents WHERE prior_auth_id = $1 AND tenant_id = $2 \
           AND deleted_at IS NULL ORDER BY created_at LIMIT 50",
    )
    .bind(pa.id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let items = [ItemLine {
        code: pa.service_code.clone(),
        description: pa
            .service_description
            .clone()
            .unwrap_or_else(|| pa.service_type.clone()),
        unit_price: pa.estimated_cost,
        net: pa.estimated_cost,
    }];
    let parties = Parties {
        patient: &patient,
        policy: &policy,
        provider: &provider,
        doctor: doctor.as_ref(),
        recipient,
    };
    let content = ClaimContent {
        id: pa.id,
        use_: "preauthorization",
        urgent: pa.urgency != "standard",
        items: &items,
        diagnoses: &diagnoses,
        documents: &documents,
    };
    Ok(nhcx_bundle::claim_bundle(&parties, &content))
}

/// `POST /api/insurance/prior-auths/{id}/submit-to-nhcx`
///
/// # Errors
/// 403 without `insurance.nhcx.submit` or access to the patient; 404 for an
/// unknown request; 409 for a cancelled or expired request, or while a
/// message for it is still on its way; 400 for a payer without an
/// encryption certificate or an unknown stage; 503 until onboarded.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit_preauth_to_nhcx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitPreauthToNhcxRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let recipient = nhcx_common::required_recipient(&body.recipient_code)?;
    let stage = body.request_stage.as_deref().unwrap_or("initial");
    if !STAGES.contains(&stage) {
        return Err(AppError::BadRequest(format!(
            "unknown request stage {stage}"
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    nhcx_common::require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    let pa = load_pa(&mut tx, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, pa.patient_id).await?;
    if pa.status == "cancelled" || pa.status == "expired" {
        return Err(AppError::Conflict(format!(
            "this pre-authorisation is {}",
            pa.status
        )));
    }
    nhcx_common::require_payer_certificate(&mut tx, claims.tenant_id, recipient).await?;
    let bundle = build(&mut tx, claims.tenant_id, &pa, recipient).await?;

    let (correlation_id, api_call_id) = (Uuid::new_v4(), Uuid::new_v4());
    // A new request starts a new IRDAI clock; the old decision stays in the
    // status log.
    let workflow_id: Uuid = sqlx::query_scalar(
        "UPDATE prior_auth_requests SET nhcx_correlation_id = $1, nhcx_api_call_id = $2, \
                nhcx_workflow_id = COALESCE(nhcx_workflow_id, $3), nhcx_recipient_code = $4, \
                nhcx_status = 'queued', nhcx_disposition = NULL, nhcx_response_payload = NULL, \
                nhcx_response_at = NULL, nhcx_submitted_at = NULL, request_stage = $5, \
                status = CASE WHEN status = 'draft' THEN 'submitted'::prior_auth_status \
                              ELSE status END, \
                submitted_at = now(), submitted_by = $6, responded_at = NULL \
         WHERE id = $7 AND tenant_id = $8 \
           AND NOT (nhcx_status IS NOT DISTINCT FROM 'queued' \
                    AND updated_at > now() - interval '15 minutes') \
         RETURNING nhcx_workflow_id",
    )
    .bind(correlation_id)
    .bind(api_call_id)
    .bind(Uuid::new_v4())
    .bind(recipient)
    .bind(stage)
    .bind(claims.sub)
    .bind(pa.id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "a message for this pre-authorisation is still on its way to NHCX".into(),
        )
    })?;
    if pa.status == "draft" {
        sqlx::query(
            "INSERT INTO prior_auth_status_log \
                 (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
             VALUES ($1, $2, 'draft', 'submitted', 'Sent to the payer through NHCX', $3)",
        )
        .bind(claims.tenant_id)
        .bind(pa.id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }
    let msg = Outbound {
        record: NhcxRecord::PriorAuth,
        record_id: pa.id,
        operation: NhcxOperation::Preauth,
        recipient,
        correlation_id,
        api_call_id,
        workflow_id,
        payload: &bundle,
        hcx_status: None,
    };
    let queued = nhcx_common::queue(&mut tx, &claims, &msg).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

/// One step on a pre-authorisation's way.
#[derive(Debug, Serialize)]
pub struct NhcxTimelineEvent {
    pub at: DateTime<Utc>,
    /// `sent`, `acknowledged`, `query_raised`, `responded`, `approved`,
    /// `partially_approved`, `rejected`, `cancelled`.
    pub kind: String,
    pub label: String,
    pub amount: Option<Decimal>,
}

/// A status-log row as a timeline step; `pending_info` is left to the
/// query rows, which say what was asked.
fn status_event(to_status: &str) -> Option<(&'static str, &'static str)> {
    Some(match to_status {
        "submitted" => ("sent", "Sent to the payer"),
        "in_review" => ("acknowledged", "With the payer for review"),
        "approved" => ("approved", "Approved by the payer"),
        "partially_approved" => ("partially_approved", "Partly approved by the payer"),
        "denied" => ("rejected", "Rejected by the payer"),
        "cancelled" => ("cancelled", "Cancelled"),
        _ => return None,
    })
}

#[derive(Debug, FromRow)]
struct ViewRow {
    request_stage: String,
    status: String,
    nhcx_status: Option<String>,
    nhcx_recipient_code: Option<String>,
    nhcx_correlation_id: Option<Uuid>,
    nhcx_disposition: Option<String>,
    estimated_cost: Option<Decimal>,
    approved_amount: Option<Decimal>,
    auth_number: Option<String>,
    submitted_at: Option<DateTime<Utc>>,
    nhcx_submitted_at: Option<DateTime<Utc>>,
    responded_at: Option<DateTime<Utc>>,
    patient_id: Uuid,
}

/// A document the desk may attach to an answer.
#[derive(Debug, Serialize, FromRow)]
pub struct NhcxAttachableDocument {
    pub id: Uuid,
    pub document_type: String,
    pub file_name: Option<String>,
}

/// Everything the pre-auth screen shows about the NHCX exchange.
#[derive(Debug, Serialize)]
pub struct PreauthNhcxView {
    pub prior_auth_id: Uuid,
    pub request_stage: String,
    pub status: String,
    pub nhcx_status: Option<String>,
    pub nhcx_recipient_code: Option<String>,
    pub nhcx_correlation_id: Option<Uuid>,
    pub nhcx_disposition: Option<String>,
    pub estimated_cost: Option<Decimal>,
    pub approved_amount: Option<Decimal>,
    pub auth_number: Option<String>,
    pub sla: PreauthSla,
    pub timeline: Vec<NhcxTimelineEvent>,
    pub queries: Vec<NhcxPayerQuery>,
    pub documents: Vec<NhcxAttachableDocument>,
}

fn timeline(
    v: &ViewRow,
    log: Vec<(DateTime<Utc>, String)>,
    queries: &[NhcxPayerQuery],
) -> Vec<NhcxTimelineEvent> {
    let event = |at, kind: &str, label: String| NhcxTimelineEvent {
        at,
        kind: kind.to_owned(),
        label,
        amount: None,
    };
    let mut events: Vec<NhcxTimelineEvent> = log
        .into_iter()
        .filter_map(|(at, to)| status_event(&to).map(|(k, l)| event(at, k, l.to_owned())))
        .collect();
    if let Some(at) = v.nhcx_submitted_at {
        events.push(event(
            at,
            "acknowledged",
            "Accepted by the NHCX gateway".to_owned(),
        ));
    }
    for q in queries {
        events.push(event(
            q.received_at,
            "query_raised",
            format!("Payer asked: {}", q.question),
        ));
        if let Some(at) = q.answered_at {
            events.push(event(
                at,
                "responded",
                "Hospital answered the query".to_owned(),
            ));
        }
    }
    events.sort_by_key(|e| e.at);
    // The amount belongs to the latest decision only.
    if let Some(last) = events
        .iter_mut()
        .rev()
        .find(|e| e.kind == "approved" || e.kind == "partially_approved")
    {
        last.amount = v.approved_amount;
    }
    events
}

/// `GET /api/insurance/prior-auths/{id}/nhcx`
///
/// # Errors
/// 403 without `insurance.nhcx.view` or access to the patient; 404 for an
/// unknown request.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_preauth_nhcx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PreauthNhcxView>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let v = sqlx::query_as::<_, ViewRow>(
        "SELECT request_stage, status::text AS status, nhcx_status, nhcx_recipient_code, \
                nhcx_correlation_id, nhcx_disposition, estimated_cost, approved_amount, \
                auth_number, submitted_at, nhcx_submitted_at, responded_at, patient_id \
         FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, v.patient_id).await?;
    let log: Vec<(DateTime<Utc>, String)> = sqlx::query_as(
        "SELECT created_at, to_status::text FROM prior_auth_status_log \
         WHERE prior_auth_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let queries = nhcx_queries::queries_for(&mut tx, claims.tenant_id, id).await?;
    let documents = sqlx::query_as::<_, NhcxAttachableDocument>(
        "SELECT id, document_type, file_name FROM prior_auth_documents \
         WHERE prior_auth_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 50",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let received = v.nhcx_submitted_at.or(v.submitted_at);
    let sla = preauth_sla(
        v.request_stage == "discharge",
        received,
        v.responded_at,
        Utc::now(),
    );
    let timeline = timeline(&v, log, &queries);
    Ok(Json(PreauthNhcxView {
        prior_auth_id: id,
        request_stage: v.request_stage,
        status: v.status,
        nhcx_status: v.nhcx_status,
        nhcx_recipient_code: v.nhcx_recipient_code,
        nhcx_correlation_id: v.nhcx_correlation_id,
        nhcx_disposition: v.nhcx_disposition,
        estimated_cost: v.estimated_cost,
        approved_amount: v.approved_amount,
        auth_number: v.auth_number,
        sla,
        timeline,
        queries,
        documents,
    }))
}
