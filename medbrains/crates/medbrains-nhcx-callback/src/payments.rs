//! A payer's `paymentnotice/request`: record the payment against each claim
//! it pays, settle those claims the way insurer money already settles, and
//! acknowledge with `paymentnotice/on_request`.
//!
//! Insurer money settles on the claim, not the invoice: `settled_amount`
//! rises by the gross paid (the transfer plus the TDS withheld — the insurer
//! has discharged that much), the claim becomes `settled` or
//! `partially_settled`, and the TDS is a `tds_deductions` row on the claim's
//! invoice. `invoices.paid_amount` is the patient's side; the claim-money
//! trigger already takes the insurer's share off what the patient owes.
//! Bank-statement auto-match later finds the notice by its UTR and matches
//! the credit without settling twice.

use chrono::{Datelike, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::{
    FINANCIAL_TASK_CODE_SYSTEM, NDHM_TASK_OUTPUT_TYPE_SYSTEM, NDHM_TASK_OUTPUT_VALUE_SYSTEM,
    NhcxOperation, NhcxRecord, TASK_BUNDLE_PROFILE,
};
use medbrains_server_core::error::AppError;

use crate::apply::{Inbound, Matched, Tx};
use crate::parse_claim::{self, PaymentLine};

/// Insurers deduct TDS on a hospital's fees under s.194J of the Income-tax
/// Act; the notice does not say which section, so this is the default.
const TDS_SECTION: &str = "194J";
/// Income-tax's own placeholder when the deductee's PAN is not on file.
const PAN_NOT_AVAILABLE: &str = "PANNOTAVBL";
/// Paid and approved within a rupee is a match.
const MATCH_TOLERANCE: Decimal = Decimal::ONE;

/// The Indian financial year (April–March) and quarter a date falls in, as
/// `tds_deductions` stores them: `("2026-27", "Q3")`.
pub(crate) fn financial_year(on: NaiveDate) -> (String, &'static str) {
    let start = if on.month() >= 4 {
        on.year()
    } else {
        on.year() - 1
    };
    let quarter = match on.month() {
        4..=6 => "Q1",
        7..=9 => "Q2",
        10..=12 => "Q3",
        _ => "Q4",
    };
    (format!("{start}-{:02}", (start + 1) % 100), quarter)
}

/// Whether a claim's payments add up to something other than what the payer
/// approved — or it approved nothing at all.
pub(crate) fn is_mismatch(settled: Decimal, approved: Option<Decimal>) -> bool {
    approved.is_none_or(|a| (settled - a).abs() >= MATCH_TOLERANCE)
}

#[derive(Debug, sqlx::FromRow)]
struct ClaimMoney {
    invoice_id: Uuid,
    approved_amount: Option<Decimal>,
    settled_amount: Option<Decimal>,
}

#[derive(Debug, sqlx::FromRow)]
struct Allocation {
    gross_amount: Decimal,
    tds_amount: Decimal,
    payment_date: Option<NaiveDate>,
}

/// Post one allocation to its claim: settle it, record the TDS, flag a
/// mismatch. The caller has checked the claim belongs to the paying payer.
pub(crate) async fn post(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    (allocation_id, claim_id): (Uuid, Uuid),
    posted_by: Option<Uuid>,
) -> Result<(), AppError> {
    let a = sqlx::query_as::<_, Allocation>(
        "SELECT a.gross_amount, a.tds_amount, n.payment_date \
           FROM nhcx_payment_allocations a JOIN nhcx_payment_notices n ON n.id = a.notice_id \
          WHERE a.id = $1 AND a.tenant_id = $2 AND a.status = 'unmatched' FOR UPDATE OF a",
    )
    .bind(allocation_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Conflict("this payment has already been posted".into()))?;
    let c = sqlx::query_as::<_, ClaimMoney>(
        "SELECT invoice_id, approved_amount, settled_amount FROM insurance_claims \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(claim_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let settled = c.settled_amount.unwrap_or_default() + a.gross_amount;
    let mismatch = is_mismatch(settled, c.approved_amount);
    sqlx::query(
        "UPDATE insurance_claims SET settled_amount = $1, settled_at = COALESCE(settled_at, now()), \
                status = CASE WHEN NOT $2 THEN 'settled' ELSE 'partially_settled' END, \
                updated_at = now() \
          WHERE id = $3 AND tenant_id = $4",
    )
    .bind(settled)
    .bind(mismatch)
    .bind(claim_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    let deducted_on = a.payment_date.unwrap_or_else(|| Utc::now().date_naive());
    let tds_id = if a.tds_amount > Decimal::ZERO {
        Some(record_tds(tx, tenant_id, (c.invoice_id, &a, deducted_on), posted_by).await?)
    } else {
        None
    };
    sqlx::query(
        "UPDATE nhcx_payment_allocations SET insurance_claim_id = $1, approved_amount = $2, \
                is_mismatch = $3, status = 'posted', posted_at = now(), posted_by = $4, \
                tds_deduction_id = $5 \
          WHERE id = $6 AND tenant_id = $7",
    )
    .bind(claim_id)
    .bind(c.approved_amount)
    .bind(mismatch)
    .bind(posted_by)
    .bind(tds_id)
    .bind(allocation_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    // Doctors paid on insurer realisation earn their share as it settles.
    medbrains_doctor_payouts::accrual::sync_after_money(tx, tenant_id, c.invoice_id).await?;
    Ok(())
}

/// The TDS the insurer withheld, on the claim's invoice, with the hospital
/// as deductee.
async fn record_tds(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    (invoice_id, a, on): (Uuid, &Allocation, NaiveDate),
    created_by: Option<Uuid>,
) -> Result<Uuid, AppError> {
    let (fy, quarter) = financial_year(on);
    let rate = if a.gross_amount > Decimal::ZERO {
        (a.tds_amount * Decimal::ONE_HUNDRED / a.gross_amount).round_dp(2)
    } else {
        Decimal::ZERO
    };
    Ok(sqlx::query_scalar(
        "INSERT INTO tds_deductions (tenant_id, invoice_id, deductee_name, deductee_pan, \
             tds_section, tds_rate, base_amount, tds_amount, deducted_date, financial_year, \
             quarter, created_by) \
         SELECT $1, $2, t.name, COALESCE(NULLIF(btrim(t.pan), ''), $3), $4, $5, $6, $7, $8, $9, \
                $10, $11 \
           FROM tenants t WHERE t.id = $1 \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(PAN_NOT_AVAILABLE)
    .bind(TDS_SECTION)
    .bind(rate)
    .bind(a.gross_amount)
    .bind(a.tds_amount)
    .bind(on)
    .bind(fy)
    .bind(quarter)
    .bind(created_by)
    .fetch_one(&mut **tx)
    .await?)
}

/// The claims this payer was sent that the notice's references name — one
/// query for all — and, for a line naming none, the claim of this exchange.
async fn claims_named(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    lines: &[PaymentLine],
) -> Result<(std::collections::HashMap<String, Uuid>, Option<Uuid>), AppError> {
    let refs: Vec<String> = lines.iter().filter_map(|l| l.claim_ref.clone()).collect();
    let rows: Vec<(String, Uuid)> = sqlx::query_as(
        "SELECT r, id FROM insurance_claims, unnest($3::text[]) AS r \
          WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
            AND (claim_number = r OR id::text = r)",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(&refs)
    .fetch_all(&mut **tx)
    .await?;
    let exchange: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM insurance_claims \
          WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
            AND (nhcx_correlation_id = $3 OR ($4::uuid IS NOT NULL AND nhcx_workflow_id = $4)) \
          ORDER BY (nhcx_correlation_id = $3) DESC LIMIT 1",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .bind(m.workflow_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok((rows.into_iter().collect(), exchange))
}

/// `paymentnotice/request`. A retried delivery of the same api call files
/// and posts nothing new, and is not acknowledged twice.
pub(crate) async fn receive(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let api_call = m
        .api_call_id
        .ok_or_else(|| AppError::BadRequest("x-hcx-api_call_id is missing".into()))?;
    let notice = parse_claim::payment_notice(m.response);
    let tds: Decimal = notice.lines.iter().map(|l| l.tds).sum();
    let paid = notice
        .amount
        .unwrap_or_else(|| notice.lines.iter().map(|l| l.gross - l.tds).sum());
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO nhcx_payment_notices (tenant_id, sender_code, request_api_call_id, \
             nhcx_correlation_id, nhcx_workflow_id, payment_reference, payment_date, paid_amount, \
             tds_amount, notice_identifier, disposition, payload) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         ON CONFLICT (tenant_id, request_api_call_id) WHERE deleted_at IS NULL DO NOTHING \
         RETURNING id",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(api_call)
    .bind(m.correlation_id)
    .bind(m.workflow_id)
    .bind(&notice.reference)
    .bind(notice.date)
    .bind(paid)
    .bind(tds)
    .bind(&notice.identifier)
    .bind(&notice.disposition)
    .bind(m.response)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(notice_id) = inserted else {
        let earlier: Uuid = sqlx::query_scalar(
            "SELECT id FROM nhcx_payment_notices WHERE tenant_id = $1 \
               AND request_api_call_id = $2 AND deleted_at IS NULL",
        )
        .bind(m.tenant_id)
        .bind(api_call)
        .fetch_one(&mut **tx)
        .await?;
        return Ok(Some(("nhcx_payment_notices", earlier)));
    };
    let (named, exchange) = claims_named(tx, m, &notice.lines).await?;
    for line in &notice.lines {
        let claim = match &line.claim_ref {
            Some(r) => named.get(r).copied(),
            None => exchange,
        };
        let allocation: Uuid = sqlx::query_scalar(
            "INSERT INTO nhcx_payment_allocations (tenant_id, notice_id, claim_reference, \
                 gross_amount, tds_amount, net_amount) \
             VALUES ($1, $2, $3, $4, $5, $4 - $5) RETURNING id",
        )
        .bind(m.tenant_id)
        .bind(notice_id)
        .bind(&line.claim_ref)
        .bind(line.gross)
        .bind(line.tds)
        .fetch_one(&mut **tx)
        .await?;
        if let Some(claim_id) = claim {
            post(tx, m.tenant_id, (allocation, claim_id), None).await?;
        }
    }
    acknowledge(tx, m, notice_id).await?;
    Ok(Some(("nhcx_payment_notices", notice_id)))
}

/// The acknowledgement — a completed Task with output `paymentack`, as in
/// NRCeS `TaskBundleForPaymentNoticeResponse-example-01`.
pub(crate) fn ack_bundle(notice_id: Uuid) -> Value {
    let task = Uuid::new_v4();
    json!({
        "resourceType": "Bundle",
        "id": Uuid::new_v4(),
        "meta": { "profile": [TASK_BUNDLE_PROFILE] },
        "identifier": { "value": notice_id },
        "type": "collection",
        "timestamp": Utc::now().to_rfc3339(),
        "entry": [{ "fullUrl": format!("urn:uuid:{task}"), "resource": {
            "resourceType": "Task", "id": task, "status": "completed", "intent": "order",
            "code": { "coding": [{ "system": FINANCIAL_TASK_CODE_SYSTEM, "code": "status" }] },
            "description": "response for payment status Check",
            "authoredOn": Utc::now().to_rfc3339(),
            "output": [{
                "type": { "coding": [{ "system": NDHM_TASK_OUTPUT_TYPE_SYSTEM, "code": "status" }] },
                "valueCodeableConcept": { "coding": [{ "system": NDHM_TASK_OUTPUT_VALUE_SYSTEM,
                    "code": "paymentack", "display": "Payment is acknowledged" }] }
            }]
        }}]
    })
}

/// Queue `paymentnotice/on_request` in the callback's transaction, on the
/// payer's correlation id.
async fn acknowledge(tx: &mut Tx<'_>, m: &Inbound<'_>, notice_id: Uuid) -> Result<(), AppError> {
    let api_call_id = Uuid::new_v4();
    let workflow_id = m.workflow_id.unwrap_or_else(Uuid::new_v4);
    sqlx::query(
        "UPDATE nhcx_payment_notices SET nhcx_api_call_id = $1, nhcx_status = 'queued' \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(api_call_id)
    .bind(notice_id)
    .bind(m.tenant_id)
    .execute(&mut **tx)
    .await?;
    let operation = NhcxOperation::PaymentAck;
    let record = NhcxRecord::PaymentNotice;
    medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: m.tenant_id,
            aggregate_type: record.table(),
            aggregate_id: Some(notice_id),
            event_type: operation.event_type(),
            payload: json!({
                "record": record,
                "record_id": notice_id,
                "recipient_code": m.sender,
                "correlation_id": m.correlation_id,
                "api_call_id": api_call_id,
                "workflow_id": workflow_id,
                "bundle": ack_bundle(notice_id),
                "hcx_status": "response.complete",
            }),
            idempotency_key: Some(format!("nhcx-payment-ack-{notice_id}")),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("nhcx ack queue failed: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_financial_year_runs_april_to_march() {
        let d = |y, m, day| NaiveDate::from_ymd_opt(y, m, day).unwrap_or_default();
        assert_eq!(
            financial_year(d(2026, 10, 19)),
            ("2026-27".to_owned(), "Q3")
        );
        assert_eq!(financial_year(d(2027, 3, 31)), ("2026-27".to_owned(), "Q4"));
        assert_eq!(financial_year(d(2026, 4, 1)), ("2026-27".to_owned(), "Q1"));
        assert_eq!(financial_year(d(2099, 8, 1)), ("2099-00".to_owned(), "Q2"));
    }

    #[test]
    fn a_payment_off_the_approved_amount_by_a_rupee_or_more_is_a_mismatch() {
        let d = |s: &str| s.parse::<Decimal>().unwrap_or_default();
        assert!(!is_mismatch(d("90000"), Some(d("90000"))));
        assert!(!is_mismatch(d("89999.50"), Some(d("90000"))));
        assert!(is_mismatch(d("80000"), Some(d("90000"))));
        assert!(
            is_mismatch(d("95000"), Some(d("90000"))),
            "overpaid is a mismatch too"
        );
        assert!(
            is_mismatch(d("90000"), None),
            "paid without an approval on file"
        );
    }
}
