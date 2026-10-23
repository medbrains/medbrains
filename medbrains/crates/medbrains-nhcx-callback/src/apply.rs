//! What a verified, decrypted callback changes — one function per callback
//! kind. Each finds its record by correlation id *and* the payer it was sent
//! to, so one payer cannot answer for another's request, and returns the
//! record it matched for the callback log.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::apply_claim::{claim, task};
use crate::parse::{self, Decision};

pub(crate) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
/// The record a callback landed on: `(table, id)`.
pub(crate) type Matched = Option<(&'static str, Uuid)>;

/// A callback after decryption, with its routing headers read.
pub(crate) struct Inbound<'a> {
    pub(crate) tenant_id: Uuid,
    pub(crate) correlation_id: Uuid,
    /// `x-hcx-workflow_id`: the step code ("21", "24", "33").
    pub(crate) workflow_id: Option<&'a str>,
    pub(crate) api_call_id: Option<Uuid>,
    pub(crate) sender: &'a str,
    /// `x-hcx-status`.
    pub(crate) status: &'a str,
    pub(crate) response: &'a Value,
}

/// Route a callback to the record it answers.
pub(crate) async fn apply(
    tx: &mut Tx<'_>,
    resource: &str,
    action: &str,
    m: &Inbound<'_>,
) -> Result<Matched, AppError> {
    match (resource, action) {
        ("coverageeligibility", "on_check") => eligibility(tx, m).await,
        ("preauth", "on_submit") => match preauth(tx, m).await? {
            Some(found) => Ok(Some(found)),
            // A pre-auth sent from the claim desk lives on the claim.
            None => claim(tx, m).await,
        },
        ("claim", "on_submit") => match claim(tx, m).await? {
            Some(found) => Ok(Some(found)),
            // A reprocessed claim's new decision may come as an on_submit.
            None => task(tx, m).await,
        },
        ("communication", "request") => payer_query(tx, m).await,
        // Every Task's answer — status, search, cancel, reprocess.
        ("task" | "search", "on_submit") | ("", "on_status") => task(tx, m).await,
        ("paymentnotice", "request") => crate::payments::receive(tx, m).await,
        ("", "error") => undelivered(tx, m).await,
        _ => Ok(None),
    }
}

fn date(s: Option<&str>) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s?.get(..10)?, "%Y-%m-%d").ok()
}

async fn eligibility(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let mut result = parse::eligibility_result(m.response);
    if m.status == "response.error" && result.errors.is_empty() {
        result
            .errors
            .push("The payer returned an error.".to_owned());
    }
    let status = parse::verification_status(&result);
    let errors = (!result.errors.is_empty()).then(|| result.errors.join("; "));
    let stored = serde_json::to_value(&result)
        .map_err(|e| AppError::Internal(format!("eligibility result: {e}")))?;
    let id: Option<Uuid> = sqlx::query_scalar(
        "UPDATE insurance_verifications SET nhcx_result = $1, raw_response = $2, \
                nhcx_response_at = now(), nhcx_status = $3, \
                status = $4::verification_status, verified_at = now(), \
                coverage_start = COALESCE($5, coverage_start), \
                coverage_end = COALESCE($6, coverage_end), error_message = $7 \
         WHERE tenant_id = $8 AND nhcx_correlation_id = $9 AND nhcx_recipient_code = $10 \
           AND deleted_at IS NULL \
         RETURNING id",
    )
    .bind(&stored)
    .bind(m.response)
    .bind(m.status)
    .bind(status)
    .bind(date(result.coverage_start.as_deref()))
    .bind(date(result.coverage_end.as_deref()))
    .bind(errors)
    .bind(m.tenant_id)
    .bind(m.correlation_id)
    .bind(m.sender)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(id.map(|id| ("insurance_verifications", id)))
}

async fn log_status(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    pa_id: Uuid,
    (from, to): (&str, &str),
    notes: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO prior_auth_status_log (tenant_id, prior_auth_id, from_status, to_status, notes) \
         VALUES ($1, $2, $3::prior_auth_status, $4::prior_auth_status, $5)",
    )
    .bind(m.tenant_id)
    .bind(pa_id)
    .bind(from)
    .bind(to)
    .bind(notes)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn preauth(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let found: Option<(Uuid, String, Option<Decimal>)> = sqlx::query_as(
        "SELECT id, status::text, estimated_cost FROM prior_auth_requests \
         WHERE tenant_id = $1 AND nhcx_correlation_id = $2 AND nhcx_recipient_code = $3 \
           AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(m.tenant_id)
    .bind(m.correlation_id)
    .bind(m.sender)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(found) = found else {
        return Ok(None);
    };
    decide(tx, m, found).await
}

/// A payer's answer about a pre-authorisation reached through one of the
/// hospital's Tasks (a status reply).
pub(crate) async fn preauth_by_id(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    id: Uuid,
) -> Result<Matched, AppError> {
    let found: (Uuid, String, Option<Decimal>) = sqlx::query_as(
        "SELECT id, status::text, estimated_cost FROM prior_auth_requests \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(m.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    decide(tx, m, found).await
}

/// `prior_auth_requests.status` for a decision; `None` leaves it. A
/// decided request (approved, denied, cancelled) moves only on another
/// decision — a late acknowledgement or an enhancement query never reopens
/// it.
fn preauth_status(decision: Decision, current: &str) -> Option<&'static str> {
    let to = match decision {
        Decision::Received => "in_review",
        Decision::Approved => "approved",
        Decision::PartiallyApproved => "partially_approved",
        Decision::Rejected => "denied",
        Decision::Queried => "pending_info",
        Decision::Cancelled => "cancelled",
        Decision::Error | Decision::Unknown => return None,
    };
    let is_decided = matches!(
        current,
        "approved" | "partially_approved" | "denied" | "cancelled"
    );
    if current == "cancelled" || (is_decided && !decision.is_final()) || to == current {
        return None;
    }
    Some(to)
}

/// `nhcx_decision`: the latest answer, except that an acknowledgement
/// arriving after a decision does not hide it.
pub(crate) const DECISION_SQL: &str = "CASE WHEN $D = 'received' AND nhcx_decision IN \
     ('approved', 'partially_approved', 'rejected', 'cancelled') THEN nhcx_decision ELSE $D END";

async fn decide(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    (id, current, requested): (Uuid, String, Option<Decimal>),
) -> Result<Matched, AppError> {
    let decision = parse::decision(m.response, m.workflow_id, m.status, requested);
    let to = preauth_status(decision, &current);
    // A query's benefit total is not an approval; only an approval's is.
    let approved = parse::approved_amount(m.response).filter(|_| decision.is_approval());
    let disposition = parse::disposition(m.response).or_else(|| parse::protocol_error(m.response));
    let sql = format!(
        "UPDATE prior_auth_requests SET nhcx_response_payload = $1, nhcx_response_at = now(), \
                nhcx_status = $2, nhcx_disposition = COALESCE($3, nhcx_disposition), \
                status = COALESCE($4::prior_auth_status, status), \
                approved_amount = COALESCE($5, approved_amount), \
                auth_number = COALESCE($6, auth_number), \
                denial_reason = CASE WHEN $4 = 'denied' THEN $3 ELSE denial_reason END, \
                responded_at = CASE WHEN $4 IN ('approved', 'partially_approved', 'denied') \
                                    THEN now() ELSE responded_at END, \
                nhcx_decision = {} \
         WHERE id = $7 AND tenant_id = $8",
        DECISION_SQL.replace("$D", "$9")
    );
    sqlx::query(&sql)
        .bind(m.response)
        .bind(m.status)
        .bind(&disposition)
        .bind(to)
        .bind(approved)
        .bind(parse::pre_auth_ref(m.response))
        .bind(id)
        .bind(m.tenant_id)
        .bind(decision.as_str())
        .execute(&mut **tx)
        .await?;
    if let Some(to) = to {
        log_status(
            tx,
            m,
            id,
            (current.as_str(), to),
            "Payer's answer through NHCX",
        )
        .await?;
    }
    Ok(Some(("prior_auth_requests", id)))
}

/// The correlation id the record carries for one a retry went out under;
/// any other id is its own.
pub(crate) async fn canonical_correlation(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    sent: Uuid,
) -> Result<Uuid, AppError> {
    let canonical: Option<Uuid> = sqlx::query_scalar(
        "SELECT canonical_correlation_id FROM nhcx_correlation_aliases \
          WHERE tenant_id = $1 AND correlation_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(sent)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(canonical.unwrap_or(sent))
}

/// The records an outbound message may belong to — where `/v1/error`
/// marks the one NHCX could not deliver.
const SENT_FROM: [&str; 6] = [
    "insurance_claims",
    "prior_auth_requests",
    "insurance_verifications",
    "nhcx_tasks",
    "nhcx_payer_queries",
    "nhcx_payment_notices",
];

/// `/v1/error`: NHCX gave up delivering a message after five tries and
/// retired its correlation. The record it names is `undelivered`, so the
/// desk does not wait for an answer that will not come.
async fn undelivered(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let reason = parse::protocol_error(m.response)
        .unwrap_or_else(|| "NHCX could not deliver it to the payer".to_owned());
    for table in SENT_FROM {
        // The table name is one of the constants above.
        let sql = format!(
            "UPDATE {table} SET nhcx_status = 'undelivered', nhcx_disposition = $1 \
              WHERE tenant_id = $2 AND nhcx_correlation_id = $3 RETURNING id"
        );
        let id: Option<Uuid> = sqlx::query_scalar(&sql)
            .bind(&reason)
            .bind(m.tenant_id)
            .bind(m.correlation_id)
            .fetch_optional(&mut **tx)
            .await?;
        if let Some(id) = id {
            return Ok(Some((table, id)));
        }
    }
    Ok(None)
}

/// The pre-authorisation (else the claim) a payer query is about: the
/// request with this correlation id, or one in the same workflow.
async fn query_subject(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
) -> Result<Option<(Option<Uuid>, Option<Uuid>)>, AppError> {
    let pa: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM prior_auth_requests \
         WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
           AND nhcx_correlation_id = $3 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .fetch_optional(&mut **tx)
    .await?;
    if pa.is_some() {
        return Ok(Some((pa, None)));
    }
    let claim: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM insurance_claims \
         WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
           AND nhcx_correlation_id = $3 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(claim.map(|c| (None, Some(c))))
}

/// A payer's `communication/request`: file the question on its
/// pre-authorisation or claim, and mark the pre-authorisation as waiting
/// for information.
async fn payer_query(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let Some((pa, claim)) = query_subject(tx, m).await? else {
        return Ok(None);
    };
    let q = parse::payer_question(m.response);
    // A retried delivery of the same api call files nothing new.
    sqlx::query(
        "INSERT INTO nhcx_payer_queries \
             (tenant_id, prior_auth_id, insurance_claim_id, sender_code, nhcx_correlation_id, \
              nhcx_workflow_id, request_api_call_id, question, requested_items, due_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         ON CONFLICT (tenant_id, request_api_call_id) \
             WHERE request_api_call_id IS NOT NULL AND deleted_at IS NULL DO NOTHING",
    )
    .bind(m.tenant_id)
    .bind(pa)
    .bind(claim)
    .bind(m.sender)
    .bind(m.correlation_id)
    .bind(m.workflow_id)
    .bind(m.api_call_id)
    .bind(&q.question)
    .bind(&q.requested_items)
    .bind(q.due_at)
    .execute(&mut **tx)
    .await?;
    let Some(pa_id) = pa else {
        return Ok(claim.map(|c| ("insurance_claims", c)));
    };
    let current: String = sqlx::query_scalar(
        "SELECT status::text FROM prior_auth_requests WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(pa_id)
    .bind(m.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if current == "submitted" || current == "in_review" {
        sqlx::query("UPDATE prior_auth_requests SET status = 'pending_info' WHERE id = $1 AND tenant_id = $2")
            .bind(pa_id)
            .bind(m.tenant_id)
            .execute(&mut **tx)
            .await?;
        let change = (current.as_str(), "pending_info");
        log_status(tx, m, pa_id, change, "Payer asked for information").await?;
    }
    Ok(Some(("prior_auth_requests", pa_id)))
}
