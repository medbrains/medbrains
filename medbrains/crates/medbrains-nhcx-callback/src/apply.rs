//! What a verified, decrypted callback changes — one function per callback
//! kind. Each finds its record by correlation id *and* the payer it was sent
//! to, so one payer cannot answer for another's request, and returns the
//! record it matched for the callback log.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::parse;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
/// The record a callback landed on: `(table, id)`.
pub(crate) type Matched = Option<(&'static str, Uuid)>;

/// A callback after decryption, with its routing headers read.
pub(crate) struct Inbound<'a> {
    pub(crate) tenant_id: Uuid,
    pub(crate) correlation_id: Uuid,
    pub(crate) workflow_id: Option<Uuid>,
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
        ("claim", "on_submit") => claim(tx, m).await,
        ("communication", "request") => payer_query(tx, m).await,
        _ => {
            let id: Option<Uuid> = sqlx::query_scalar(
                "SELECT id FROM insurance_claims WHERE tenant_id = $1 \
                   AND nhcx_correlation_id = $2 AND deleted_at IS NULL",
            )
            .bind(m.tenant_id)
            .bind(m.correlation_id)
            .fetch_optional(&mut **tx)
            .await?;
            Ok(id.map(|id| ("insurance_claims", id)))
        }
    }
}

async fn claim(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let id: Option<Uuid> = sqlx::query_scalar(
        "UPDATE insurance_claims SET nhcx_response_payload = $1, nhcx_response_at = now(), \
                nhcx_status = $2, nhcx_outcome = COALESCE($3, nhcx_outcome), \
                approved_amount = COALESCE($4, approved_amount), updated_at = now() \
         WHERE tenant_id = $5 AND nhcx_correlation_id = $6 AND nhcx_recipient_code = $7 \
           AND deleted_at IS NULL \
         RETURNING id",
    )
    .bind(m.response)
    .bind(m.status)
    .bind(parse::outcome(m.response))
    .bind(parse::approved_amount(m.response))
    .bind(m.tenant_id)
    .bind(m.correlation_id)
    .bind(m.sender)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(id.map(|id| ("insurance_claims", id)))
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
    let Some((id, current, requested)) = found else {
        return Ok(None);
    };
    let outcome = parse::outcome(m.response);
    let approved = parse::approved_amount(m.response);
    // A cancelled request stays cancelled whatever the payer says later.
    let decision = (current != "cancelled")
        .then(|| parse::preauth_decision(outcome.as_deref(), approved, requested))
        .flatten()
        .filter(|d| *d != current);
    let disposition = parse::disposition(m.response).or_else(|| parse::protocol_error(m.response));
    sqlx::query(
        "UPDATE prior_auth_requests SET nhcx_response_payload = $1, nhcx_response_at = now(), \
                nhcx_status = $2, nhcx_disposition = COALESCE($3, nhcx_disposition), \
                status = COALESCE($4::prior_auth_status, status), \
                approved_amount = COALESCE($5, approved_amount), \
                auth_number = COALESCE($6, auth_number), \
                denial_reason = CASE WHEN $4 = 'denied' THEN $3 ELSE denial_reason END, \
                responded_at = CASE WHEN $4 IN ('approved', 'partially_approved', 'denied') \
                                    THEN now() ELSE responded_at END \
         WHERE id = $7 AND tenant_id = $8",
    )
    .bind(m.response)
    .bind(m.status)
    .bind(&disposition)
    .bind(decision)
    .bind(approved)
    .bind(parse::pre_auth_ref(m.response))
    .bind(id)
    .bind(m.tenant_id)
    .execute(&mut **tx)
    .await?;
    if let Some(to) = decision {
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

/// The pre-authorisation (else the claim) a payer query is about: the
/// request with this correlation id, or one in the same workflow.
async fn query_subject(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
) -> Result<Option<(Option<Uuid>, Option<Uuid>)>, AppError> {
    let pa: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM prior_auth_requests \
         WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
           AND (nhcx_correlation_id = $3 OR ($4::uuid IS NOT NULL AND nhcx_workflow_id = $4)) \
         ORDER BY (nhcx_correlation_id = $3) DESC, created_at DESC LIMIT 1",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .bind(m.workflow_id)
    .fetch_optional(&mut **tx)
    .await?;
    if pa.is_some() {
        return Ok(Some((pa, None)));
    }
    let claim: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM insurance_claims \
         WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
           AND (nhcx_correlation_id = $3 OR ($4::uuid IS NOT NULL AND nhcx_workflow_id = $4)) \
         ORDER BY (nhcx_correlation_id = $3) DESC, created_at DESC LIMIT 1",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .bind(m.workflow_id)
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
