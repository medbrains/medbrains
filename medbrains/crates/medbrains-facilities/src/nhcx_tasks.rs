//! Asking a payer about a claim through NHCX: where a claim or
//! pre-authorisation stands (`hcx/status`), which claims it holds
//! (`hcx/search`), and — under `insurance.nhcx.cancel` — to cancel a claim or
//! reprocess one once its deductions are answered.
//!
//! Each ask is an `nhcx_tasks` row with its own correlation id, queued with
//! its outbox event in one transaction; the payer's reply is matched to the
//! Task by the callback receiver and applied to its claim.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_common::{self, Outbound, Tx};
use crate::nhcx_task_bundle::{TaskAsk, TaskParties, task_bundle};

/// A Task queued in the last 15 minutes is still on its way; a second would
/// reach the payer twice.
const IN_FLIGHT_MINUTES: i32 = 15;
/// The widest search a desk may ask a payer for.
const MAX_SEARCH_DAYS: i64 = 92;
const MIN_REASON_CHARS: usize = 3;
const MAX_REASON_CHARS: usize = 1000;

/// The claim a Task is about.
#[derive(Debug, sqlx::FromRow)]
struct Subject {
    id: Uuid,
    patient_id: Uuid,
    number: String,
    recipient: Option<String>,
    /// The api call id of the last message sent about it.
    api_call_id: Option<Uuid>,
    status: String,
}

async fn claim_subject(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<Subject, AppError> {
    sqlx::query_as::<_, Subject>(
        "SELECT id, patient_id, COALESCE(NULLIF(claim_number, ''), id::text) AS number, \
                nhcx_recipient_code AS recipient, nhcx_api_call_id AS api_call_id, status \
           FROM insurance_claims WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

async fn preauth_subject(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<Subject, AppError> {
    sqlx::query_as::<_, Subject>(
        "SELECT id, patient_id, COALESCE(NULLIF(auth_number, ''), pa_number) AS number, \
                nhcx_recipient_code AS recipient, nhcx_api_call_id AS api_call_id, \
                status::text AS status \
           FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The payer the subject was sent to — a Task about a claim the payer never
/// received means nothing to it.
fn sent_to(subject: &Subject) -> Result<&str, AppError> {
    subject.recipient.as_deref().ok_or_else(|| {
        AppError::Conflict("this has not been sent to a payer through NHCX yet".into())
    })
}

/// The api call id the status enquiry names.
fn sent_call(subject: &Subject) -> Result<Uuid, AppError> {
    subject.api_call_id.ok_or_else(|| {
        AppError::Conflict("this has not been sent to a payer through NHCX yet".into())
    })
}

fn reason(text: &str) -> Result<&str, AppError> {
    let text = text.trim();
    let n = text.chars().count();
    if !(MIN_REASON_CHARS..=MAX_REASON_CHARS).contains(&n) {
        return Err(AppError::BadRequest(format!(
            "say why, in {MIN_REASON_CHARS} to {MAX_REASON_CHARS} characters"
        )));
    }
    Ok(text)
}

async fn parties(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    payer_code: &str,
) -> Result<(nhcx_common::ProviderParty, String), AppError> {
    let provider = nhcx_common::load_provider(tx, tenant_id).await?;
    let payer: Option<String> = sqlx::query_scalar(
        "SELECT participant_name FROM nhcx_participants \
          WHERE tenant_id = $1 AND participant_code = $2 AND is_active",
    )
    .bind(tenant_id)
    .bind(payer_code)
    .fetch_optional(&mut **tx)
    .await?;
    Ok((provider, payer.unwrap_or_else(|| payer_code.to_owned())))
}

/// One Task to queue.
struct TaskSpec<'a> {
    ask: TaskAsk<'a>,
    operation: NhcxOperation,
    claim_id: Option<Uuid>,
    prior_auth_id: Option<Uuid>,
    recipient: &'a str,
    request: Value,
}

/// Record the Task and queue its message, in the caller's transaction.
async fn queue_task(
    tx: &mut Tx<'_>,
    claims: &Claims,
    spec: &TaskSpec<'_>,
) -> Result<Value, AppError> {
    nhcx_common::require_nhcx_onboarded(tx, claims.tenant_id).await?;
    nhcx_common::require_payer_certificate(tx, claims.tenant_id, spec.recipient).await?;
    let kind = spec.ask.kind();
    let busy: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM nhcx_tasks WHERE tenant_id = $1 AND kind = $2 \
            AND insurance_claim_id IS NOT DISTINCT FROM $3 AND prior_auth_id IS NOT DISTINCT FROM $4 \
            AND ($3::uuid IS NOT NULL OR $4::uuid IS NOT NULL) \
            AND nhcx_status = 'queued' AND deleted_at IS NULL \
            AND created_at > now() - make_interval(mins => $5))",
    )
    .bind(claims.tenant_id)
    .bind(kind)
    .bind(spec.claim_id)
    .bind(spec.prior_auth_id)
    .bind(IN_FLIGHT_MINUTES)
    .fetch_one(&mut **tx)
    .await?;
    if busy {
        return Err(AppError::Conflict(format!(
            "a {kind} request is still on its way to NHCX — wait for it to be sent"
        )));
    }
    let (provider, payer_name) = parties(tx, claims.tenant_id, spec.recipient).await?;
    let bundle = task_bundle(
        &spec.ask,
        &TaskParties {
            provider: &provider,
            payer_name: &payer_name,
            payer_code: spec.recipient,
        },
    );
    // A Task opens its own thread: its correlation id is its own api call
    // id, under the operation's step code (cancel PC01, reprocess 36). A
    // status enquiry's correlation id is the checked message's api call id.
    let api_call_id = Uuid::new_v4();
    let correlation_id = match spec.ask {
        TaskAsk::Status { checks } => checks,
        _ => api_call_id,
    };
    let workflow_id = spec.operation.fixed_workflow_code();
    let task_id: Uuid = sqlx::query_scalar(
        "INSERT INTO nhcx_tasks (tenant_id, kind, insurance_claim_id, prior_auth_id, \
             recipient_code, request, nhcx_correlation_id, nhcx_api_call_id, nhcx_workflow_id, \
             nhcx_status, requested_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(kind)
    .bind(spec.claim_id)
    .bind(spec.prior_auth_id)
    .bind(spec.recipient)
    .bind(&spec.request)
    .bind(correlation_id)
    .bind(api_call_id)
    .bind(workflow_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    let msg = Outbound {
        record: NhcxRecord::Task,
        record_id: task_id,
        operation: spec.operation,
        recipient: spec.recipient,
        correlation_id,
        api_call_id,
        workflow_id,
        payload: &bundle,
    };
    nhcx_common::queue(tx, claims, &msg).await
}

async fn begin(state: &AppState, claims: &Claims) -> Result<Tx<'static>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// `POST /api/billing/insurance-claims/{id}/nhcx/status` — ask the payer
/// where the claim stands.
///
/// # Errors
/// 403 without `insurance.nhcx.submit` or access to the patient; 404 for an
/// unknown claim; 409 before it was sent, or while a status request is in
/// flight; 503 until the hospital is onboarded to NHCX.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn claim_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let mut tx = begin(&state, &claims).await?;
    let s = claim_subject(&mut tx, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, s.patient_id).await?;
    let spec = TaskSpec {
        ask: TaskAsk::Status {
            checks: sent_call(&s)?,
        },
        operation: NhcxOperation::Status,
        claim_id: Some(s.id),
        prior_auth_id: None,
        recipient: sent_to(&s)?,
        request: json!({}),
    };
    let queued = queue_task(&mut tx, &claims, &spec).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

/// `POST /api/insurance/prior-auths/{id}/nhcx/status` — ask the payer
/// where the pre-authorisation stands.
///
/// # Errors
/// As [`claim_status`], for a pre-authorisation.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn preauth_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let mut tx = begin(&state, &claims).await?;
    let s = preauth_subject(&mut tx, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, s.patient_id).await?;
    let spec = TaskSpec {
        ask: TaskAsk::Status {
            checks: sent_call(&s)?,
        },
        operation: NhcxOperation::Status,
        claim_id: None,
        prior_auth_id: Some(s.id),
        recipient: sent_to(&s)?,
        request: json!({}),
    };
    let queued = queue_task(&mut tx, &claims, &spec).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

#[derive(Debug, Deserialize)]
pub struct ClaimTaskRequest {
    /// Why — for a reprocess, what was answered or corrected.
    pub reason: String,
}

const CLOSED: [&str; 3] = ["settled", "partially_settled", "cancelled"];

async fn claim_task(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    (body, cancel): (&ClaimTaskRequest, bool),
) -> Result<Value, AppError> {
    require_permission(claims, permissions::insurance::nhcx::CANCEL)?;
    let why = reason(&body.reason)?;
    let mut tx = begin(state, claims).await?;
    let s = claim_subject(&mut tx, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, s.patient_id).await?;
    if CLOSED.contains(&s.status.as_str()) {
        return Err(AppError::Conflict(format!(
            "the claim is {}; the payer can no longer change it",
            s.status.replace('_', " ")
        )));
    }
    let (ask, operation) = if cancel {
        let ask = TaskAsk::Cancel {
            focus: s.id,
            number: &s.number,
            reason: why,
        };
        (ask, NhcxOperation::Cancel)
    } else {
        let rejected = s.status == "claim_rejected";
        let ask = TaskAsk::Reprocess {
            focus: s.id,
            number: &s.number,
            reason: why,
            rejected,
        };
        (ask, NhcxOperation::Reprocess)
    };
    let spec = TaskSpec {
        ask,
        operation,
        claim_id: Some(s.id),
        prior_auth_id: None,
        recipient: sent_to(&s)?,
        request: json!({ "reason": why }),
    };
    let queued = queue_task(&mut tx, claims, &spec).await?;
    tx.commit().await?;
    Ok(queued)
}

/// `POST /api/billing/insurance-claims/{id}/nhcx/cancel` — ask the payer to
/// cancel the claim.
///
/// # Errors
/// 403 without `insurance.nhcx.cancel`; 400 without a reason; 409 for a
/// claim never sent, settled or cancelled; otherwise as [`claim_status`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn cancel_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ClaimTaskRequest>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(claim_task(&state, &claims, id, (&body, true)).await?))
}

/// `POST /api/billing/insurance-claims/{id}/nhcx/reprocess` — ask the payer
/// to look at the claim again, after its deductions are answered.
///
/// # Errors
/// As [`cancel_claim`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn reprocess_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ClaimTaskRequest>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(claim_task(&state, &claims, id, (&body, false)).await?))
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub recipient_code: String,
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub claim_number: Option<String>,
}

/// `POST /api/insurance/nhcx/search` — ask a payer for its claims from this
/// hospital in a date range. The answer arrives as `hcx/on_search`.
///
/// # Errors
/// 403 without `insurance.nhcx.submit`; 400 for a range that runs backwards
/// or is wider than 92 days; 503 until the hospital is onboarded.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn search_claims(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SearchRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let recipient = nhcx_common::required_recipient(&body.recipient_code)?;
    let days = (body.to_date - body.from_date).num_days();
    if !(0..=MAX_SEARCH_DAYS).contains(&days) {
        return Err(AppError::BadRequest(format!(
            "pick a range that ends after it starts, at most {MAX_SEARCH_DAYS} days"
        )));
    }
    let number = body
        .claim_number
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    let mut tx = begin(&state, &claims).await?;
    let spec = TaskSpec {
        ask: TaskAsk::Search {
            from: body.from_date,
            to: body.to_date,
            claim_number: number,
        },
        operation: NhcxOperation::Search,
        claim_id: None,
        prior_auth_id: None,
        recipient,
        request: json!({ "from_date": body.from_date, "to_date": body.to_date,
                         "claim_number": number }),
    };
    let queued = queue_task(&mut tx, &claims, &spec).await?;
    tx.commit().await?;
    Ok(Json(queued))
}
