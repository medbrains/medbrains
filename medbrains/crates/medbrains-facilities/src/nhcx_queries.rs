//! The payer query desk: a payer's `communication/request` (filed by the
//! callback receiver) answered with text and supporting documents, sent
//! back as an HCX `Communication` on the same correlation id.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_bundle::{self, DocumentRef};
use crate::nhcx_common::{self, Outbound, Tx};

/// A payer's question and the hospital's answer.
#[derive(Debug, Serialize, FromRow)]
pub struct NhcxPayerQuery {
    pub id: Uuid,
    pub prior_auth_id: Option<Uuid>,
    pub insurance_claim_id: Option<Uuid>,
    pub sender_code: String,
    pub question: String,
    pub requested_items: Vec<String>,
    pub received_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    /// `open` or `answered`.
    pub status: String,
    pub answer_text: Option<String>,
    pub answer_document_ids: Vec<Uuid>,
    pub answered_at: Option<DateTime<Utc>>,
    /// Where the answer stands: `queued`, `sent`, `send_failed`.
    pub nhcx_status: Option<String>,
    pub nhcx_disposition: Option<String>,
    pub nhcx_submitted_at: Option<DateTime<Utc>>,
}

pub(crate) const QUERY_COLUMNS: &str = "id, prior_auth_id, insurance_claim_id, sender_code, \
     question, requested_items, received_at, due_at, status, answer_text, answer_document_ids, \
     answered_at, nhcx_status, nhcx_disposition, nhcx_submitted_at";

/// The queries on a pre-authorisation, newest first.
pub(crate) async fn queries_for(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    prior_auth_id: Uuid,
) -> Result<Vec<NhcxPayerQuery>, AppError> {
    let sql = format!(
        "SELECT {QUERY_COLUMNS} FROM nhcx_payer_queries \
         WHERE tenant_id = $1 AND prior_auth_id = $2 AND deleted_at IS NULL \
         ORDER BY received_at DESC LIMIT 50"
    );
    Ok(sqlx::query_as::<_, NhcxPayerQuery>(&sql)
        .bind(tenant_id)
        .bind(prior_auth_id)
        .fetch_all(&mut **tx)
        .await?)
}

#[derive(Debug, Deserialize)]
pub struct AnswerPayerQueryRequest {
    pub text: String,
    /// Documents already attached to the pre-authorisation.
    #[serde(default)]
    pub document_ids: Vec<Uuid>,
}

const MAX_ANSWER_CHARS: usize = 4000;
const MAX_ANSWER_DOCUMENTS: usize = 20;

/// The query's patient (through its pre-authorisation or claim).
async fn query_patient(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    q: &NhcxPayerQuery,
) -> Result<Uuid, AppError> {
    let patient: Option<Uuid> = sqlx::query_scalar(
        "SELECT COALESCE( \
             (SELECT patient_id FROM prior_auth_requests WHERE id = $1 AND tenant_id = $3), \
             (SELECT patient_id FROM insurance_claims WHERE id = $2 AND tenant_id = $3))",
    )
    .bind(q.prior_auth_id)
    .bind(q.insurance_claim_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    patient.ok_or(AppError::NotFound)
}

async fn answer_documents(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    q: &NhcxPayerQuery,
    ids: &[Uuid],
) -> Result<Vec<DocumentRef>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    if ids.len() > MAX_ANSWER_DOCUMENTS {
        return Err(AppError::BadRequest(format!(
            "attach at most {MAX_ANSWER_DOCUMENTS} documents"
        )));
    }
    let docs = sqlx::query_as::<_, DocumentRef>(
        "SELECT document_type, file_name, file_path, mime_type, created_at \
         FROM prior_auth_documents \
         WHERE id = ANY($1) AND prior_auth_id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
    )
    .bind(ids)
    .bind(q.prior_auth_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    if docs.len() != ids.len() {
        return Err(AppError::BadRequest(
            "attach only documents already on this pre-authorisation".into(),
        ));
    }
    Ok(docs)
}

/// `POST /api/insurance/nhcx/queries/{id}/answer` — answer a payer query
/// through NHCX.
///
/// # Errors
/// 403 without `insurance.nhcx.respond` or access to the patient; 404 for an
/// unknown query; 409 once answered (unless the answer failed to send); 400
/// for an empty answer or documents not on the pre-authorisation; 503 until
/// the hospital is onboarded to NHCX.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn answer_payer_query(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AnswerPayerQueryRequest>,
) -> Result<Json<NhcxPayerQuery>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::RESPOND)?;
    let text = body.text.trim();
    if text.is_empty() || text.chars().count() > MAX_ANSWER_CHARS {
        return Err(AppError::BadRequest(format!(
            "write an answer of 1 to {MAX_ANSWER_CHARS} characters"
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sql = format!(
        "SELECT {QUERY_COLUMNS} FROM nhcx_payer_queries \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE"
    );
    let q = sqlx::query_as::<_, NhcxPayerQuery>(&sql)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let patient_id = query_patient(&mut tx, claims.tenant_id, &q).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    if q.status == "answered" && q.nhcx_status.as_deref() != Some("send_failed") {
        return Err(AppError::Conflict(
            "this query has already been answered".into(),
        ));
    }
    nhcx_common::require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    nhcx_common::require_payer_certificate(&mut tx, claims.tenant_id, &q.sender_code).await?;
    let docs = answer_documents(&mut tx, claims.tenant_id, &q, &body.document_ids).await?;

    let (correlation_id, workflow_id, api_call_id): (Uuid, Option<Uuid>, Uuid) = sqlx::query_as(
        "UPDATE nhcx_payer_queries SET status = 'answered', answer_text = $1, \
                answer_document_ids = $2, answered_by = $3, answered_at = now(), \
                nhcx_api_call_id = $4, nhcx_status = 'queued', nhcx_disposition = NULL, \
                nhcx_submitted_at = NULL \
         WHERE id = $5 AND tenant_id = $6 RETURNING nhcx_correlation_id, nhcx_workflow_id, nhcx_api_call_id",
    )
    .bind(text)
    .bind(&body.document_ids)
    .bind(claims.sub)
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if let Some(pa_id) = q.prior_auth_id {
        resume_review(&mut tx, &claims, pa_id).await?;
    }

    let about = q.prior_auth_id.or(q.insurance_claim_id).unwrap_or(id);
    let payload = nhcx_bundle::communication(id, about, text, &docs);
    let msg = Outbound {
        record: NhcxRecord::PayerQuery,
        record_id: id,
        operation: NhcxOperation::Communication,
        recipient: &q.sender_code,
        correlation_id,
        api_call_id,
        workflow_id: workflow_id.unwrap_or_else(Uuid::new_v4),
        payload: &payload,
        hcx_status: Some("response.complete"),
    };
    nhcx_common::queue(&mut tx, &claims, &msg).await?;
    let row = sqlx::query_as::<_, NhcxPayerQuery>(&format!(
        "SELECT {QUERY_COLUMNS} FROM nhcx_payer_queries WHERE id = $1 AND tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The payer has its answer; the request is back with the payer to decide.
async fn resume_review(tx: &mut Tx<'_>, claims: &Claims, pa_id: Uuid) -> Result<(), AppError> {
    let moved = sqlx::query(
        "UPDATE prior_auth_requests SET status = 'in_review' \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending_info'",
    )
    .bind(pa_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    if moved.rows_affected() > 0 {
        sqlx::query(
            "INSERT INTO prior_auth_status_log \
                 (tenant_id, prior_auth_id, from_status, to_status, notes, changed_by) \
             VALUES ($1, $2, 'pending_info', 'in_review', 'Hospital answered the payer''s query', $3)",
        )
        .bind(claims.tenant_id)
        .bind(pa_id)
        .bind(claims.sub)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
