//! What recording, approving, rejecting and reversing an insurer settlement
//! do to the bill, the claim and the posting — each in the caller's one
//! transaction, so a posting and its money land together or not at all.
//!
//! Approving posts the gross settled amount (transfer + TDS: the insurer has
//! discharged that much of the bill) as an `insurance` payment through
//! `posting::post_payment`, capped at what the bill has open. Deductions the
//! hospital absorbs become an approved write-off; deductions the patient
//! bears are not posted at all — they stay outstanding on the patient, which
//! is what the claim-money trigger already reports as `patient_payable`.

use medbrains_core::billing::AuditAction;
use rust_decimal::Decimal;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims};

use crate::claim_settlements::{
    ClaimSettlementPosting, Deduction, POSTING_SELECT, RecordSettlementRequest,
};
use crate::posting::{PostPayment, Posted, post_payment};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

pub(crate) enum Decision {
    /// Approve; `true` accepts posting less than the settlement when it is
    /// more than the bill has open.
    Approve(bool),
    Reject(String),
    Reverse(String),
}

/// A reason a person can act on: at least three characters.
pub(crate) fn reason(text: &str) -> Result<String, AppError> {
    let t = text.trim();
    if t.chars().count() < 3 {
        return Err(AppError::BadRequest(
            "Give a reason of at least 3 characters".into(),
        ));
    }
    Ok(t.to_owned())
}

/// What a desk-entered settlement must say before it is filed.
pub(crate) fn validate_record(b: &RecordSettlementRequest) -> Result<(), AppError> {
    let tds = b.tds_amount.unwrap_or_default();
    if b.settled_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "The settled amount must be more than zero".into(),
        ));
    }
    if tds < Decimal::ZERO || tds > b.settled_amount {
        return Err(AppError::BadRequest(
            "TDS must be between zero and the settled amount".into(),
        ));
    }
    if b.payment_reference.trim().is_empty() {
        return Err(AppError::BadRequest("Give the UTR or cheque number".into()));
    }
    for d in &b.deductions {
        reason(&d.reason)?;
        if d.amount <= Decimal::ZERO || !matches!(d.treatment.as_str(), "patient" | "write_off") {
            return Err(AppError::BadRequest(
                "Each deduction needs an amount above zero and who bears it".into(),
            ));
        }
    }
    Ok(())
}

/// The total of the deductions that `treatment` bears.
pub(crate) fn deducted(lines: &[Deduction], treatment: &str) -> Decimal {
    lines
        .iter()
        .filter(|d| d.treatment == treatment)
        .map(|d| d.amount)
        .sum()
}

/// File a desk-entered settlement as a pending posting. A second filing of
/// the same UTR against the same claim is refused, not duplicated.
pub(crate) async fn record(
    tx: &mut Tx<'_>,
    claims: &Claims,
    b: &RecordSettlementRequest,
) -> Result<Uuid, AppError> {
    let id: Option<Uuid> = sqlx::query_scalar(
        "SELECT file_claim_settlement($1, $2, 'manual', $3, $4, $5, $3, $6, $7)",
    )
    .bind(claims.tenant_id)
    .bind(b.insurance_claim_id)
    .bind(b.payment_reference.trim())
    .bind(b.settled_amount)
    .bind(b.tds_amount.unwrap_or_default())
    .bind(b.settlement_date)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    let id = id.ok_or_else(|| {
        AppError::Conflict("This settlement is already recorded against the claim".into())
    })?;
    let total = deducted(&b.deductions, "patient") + deducted(&b.deductions, "write_off");
    sqlx::query(
        "UPDATE claim_settlement_postings SET deductions = $1, deduction_total = $2, notes = $3 \
          WHERE id = $4 AND tenant_id = $5",
    )
    .bind(serde_json::to_value(&b.deductions).map_err(|e| AppError::Internal(e.to_string()))?)
    .bind(total.round_dp(2))
    .bind(b.notes.as_deref().map(str::trim).filter(|n| !n.is_empty()))
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

pub(crate) async fn fetch(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<ClaimSettlementPosting, AppError> {
    sqlx::query_as::<_, ClaimSettlementPosting>(&format!(
        "{POSTING_SELECT} WHERE s.id = $1 AND s.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

#[derive(sqlx::FromRow)]
pub(crate) struct Locked {
    pub(crate) status: String,
    pub(crate) recorded_by: Option<Uuid>,
    pub(crate) insurance_claim_id: Uuid,
    pub(crate) invoice_id: Uuid,
    pub(crate) patient_id: Uuid,
    pub(crate) source: String,
    pub(crate) settled_amount: Decimal,
    pub(crate) payment_reference: Option<String>,
    pub(crate) payer: Option<String>,
    pub(crate) deductions: serde_json::Value,
    pub(crate) posted_amount: Option<Decimal>,
    pub(crate) payment_id: Option<Uuid>,
    pub(crate) write_off_id: Option<Uuid>,
    pub(crate) claim_applied: bool,
}

async fn lock(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<Locked, AppError> {
    sqlx::query_as::<_, Locked>(
        "SELECT status, recorded_by, insurance_claim_id, invoice_id, patient_id, source, \
                settled_amount, payment_reference, payer, deductions, posted_amount, payment_id, \
                write_off_id, claim_applied \
           FROM claim_settlement_postings \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Approve, reject or reverse a posting.
pub(crate) async fn apply(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Uuid,
    decision: Decision,
) -> Result<(), AppError> {
    let p = lock(tx, claims.tenant_id, id).await?;
    let wanted = if matches!(decision, Decision::Reverse(_)) {
        "approved"
    } else {
        "pending"
    };
    if p.status != wanted {
        return Err(AppError::Conflict(format!(
            "This settlement is already {}",
            p.status
        )));
    }
    if !matches!(decision, Decision::Reverse(_)) && p.recorded_by == Some(claims.sub) {
        return Err(AppError::ForbiddenReason(
            "You recorded this settlement, so someone else must approve or reject it".into(),
        ));
    }
    match decision {
        Decision::Approve(accept_excess) => approve(tx, claims, id, &p, accept_excess).await?,
        Decision::Reject(why) => {
            sqlx::query(
                "UPDATE claim_settlement_postings SET status = 'rejected', reject_reason = $1, \
                        decided_by = $2, decided_at = now() WHERE id = $3 AND tenant_id = $4",
            )
            .bind(why)
            .bind(claims.sub)
            .bind(id)
            .bind(claims.tenant_id)
            .execute(&mut **tx)
            .await?;
        }
        Decision::Reverse(why) => {
            crate::claim_settlement_reverse::reverse(tx, claims, id, &p, &why).await?;
        }
    }
    medbrains_doctor_payouts::accrual::sync_after_money(tx, claims.tenant_id, p.invoice_id).await?;
    Ok(())
}

async fn open_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<Decimal, AppError> {
    Ok(sqlx::query_scalar::<_, Decimal>(
        "SELECT total_amount - paid_amount FROM invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?
    .max(Decimal::ZERO))
}

/// How much of `settled` the bill can take, and how much is left over.
pub(crate) fn split_excess(settled: Decimal, open: Decimal) -> (Decimal, Decimal) {
    let post = settled.min(open.max(Decimal::ZERO));
    (post, settled - post)
}

async fn approve(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Uuid,
    p: &Locked,
    accept_excess: bool,
) -> Result<(), AppError> {
    let open = open_balance(tx, claims.tenant_id, p.invoice_id).await?;
    let (pay, excess) = split_excess(p.settled_amount, open);
    if excess > Decimal::ZERO && !accept_excess {
        return Err(AppError::Conflict(format!(
            "The settlement is {excess} more than the bill's open {open}; accept the excess to post {pay} and keep the rest for review"
        )));
    }
    let lines: Vec<Deduction> = serde_json::from_value(p.deductions.clone())
        .map_err(|e| AppError::Internal(format!("settlement deductions: {e}")))?;
    let write_off = deducted(&lines, "write_off").round_dp(2);
    if write_off > open - pay {
        return Err(AppError::Conflict(format!(
            "The write-off {write_off} is more than the {} left on the bill after the settlement",
            open - pay
        )));
    }
    let payment_id = if pay > Decimal::ZERO {
        let notes = format!(
            "Insurance settlement from {}",
            p.payer.as_deref().unwrap_or("insurer")
        );
        let posted = post_payment(
            tx,
            &PostPayment {
                tenant_id: claims.tenant_id,
                invoice_id: p.invoice_id,
                amount: pay,
                mode: "insurance",
                reference_number: p.payment_reference.as_deref(),
                notes: Some(&notes),
                received_by: Some(claims.sub),
                counter_id: None,
                shift: None,
                collection_id: None,
                station_id: None,
                shift_id: None,
            },
        )
        .await?;
        match posted {
            Posted::Done(payment) => Some(payment.id),
            Posted::Refused(why) => return Err(AppError::Conflict(why)),
        }
    } else {
        None
    };
    let write_off_id = if write_off > Decimal::ZERO {
        Some(post_write_off(tx, claims, p, write_off).await?)
    } else {
        None
    };
    let claim_applied = p.source == "manual";
    if claim_applied {
        settle_claim(tx, claims.tenant_id, p.insurance_claim_id, p.settled_amount).await?;
    }
    sqlx::query(
        "UPDATE claim_settlement_postings SET status = 'approved', decided_by = $1, \
                decided_at = now(), posted_amount = $2, excess_amount = $3, payment_id = $4, \
                write_off_id = $5, claim_applied = $6, \
                needs_review = needs_review OR $3 > 0 \
          WHERE id = $7 AND tenant_id = $8",
    )
    .bind(claims.sub)
    .bind(pay)
    .bind(excess)
    .bind(payment_id)
    .bind(write_off_id)
    .bind(claim_applied)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    crate::log_billing_audit(
        tx,
        claims.tenant_id,
        AuditAction::PaymentRecorded,
        "claim_settlement",
        id,
        Some(p.invoice_id),
        Some(p.patient_id),
        Some(pay),
        Some(serde_json::json!({ "excess": excess, "write_off": write_off, "approved_by": claims.sub })),
        claims.sub,
    )
    .await;
    Ok(())
}

/// The hospital's share of the deductions, as a write-off already approved —
/// requested by whoever recorded the settlement, approved by this approver.
async fn post_write_off(
    tx: &mut Tx<'_>,
    claims: &Claims,
    p: &Locked,
    amount: Decimal,
) -> Result<Uuid, AppError> {
    let number = crate::credit::generate_write_off_number(tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO bad_debt_write_offs (tenant_id, invoice_id, write_off_number, amount, reason, \
             status, requested_by, approved_by, approved_at, notes) \
         VALUES ($1, $2, $3, $4, 'Insurer deduction the hospital absorbs', \
             'approved'::write_off_status, $5, $6, now(), $7) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(p.invoice_id)
    .bind(&number)
    .bind(amount)
    .bind(p.recorded_by.unwrap_or(claims.sub))
    .bind(claims.sub)
    .bind(format!(
        "Claim settlement {}",
        p.payment_reference.as_deref().unwrap_or("")
    ))
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE invoices SET paid_amount = paid_amount + $1, \
                written_off_amount = written_off_amount + $1, \
                status = CASE WHEN total_amount - (paid_amount + $1) <= 0.01 \
                              THEN 'paid'::invoice_status ELSE status END, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(amount)
    .bind(p.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// Raise the claim's settled amount by a desk-entered settlement (negative
/// to take a reversed one back off).
pub(crate) async fn settle_claim(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    claim_id: Uuid,
    by: Decimal,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE insurance_claims SET \
            settled_amount = GREATEST(COALESCE(settled_amount, 0) + $1, 0), \
            settled_at = CASE WHEN COALESCE(settled_amount, 0) + $1 > 0 \
                              THEN COALESCE(settled_at, now()) END, \
            status = CASE \
              WHEN COALESCE(settled_amount, 0) + $1 <= 0 \
                THEN CASE WHEN approved_amount IS NULL THEN 'claim_submitted' ELSE 'claim_approved' END \
              WHEN approved_amount IS NULL OR COALESCE(settled_amount, 0) + $1 >= approved_amount - 1 \
                THEN 'settled' \
              ELSE 'partially_settled' END, \
            updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(by)
    .bind(claim_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Decimal, Deduction, deducted, split_excess};

    fn line(amount: i64, treatment: &str) -> Deduction {
        Deduction {
            reason: "Room rent cap".into(),
            amount: Decimal::from(amount),
            treatment: treatment.into(),
        }
    }

    #[test]
    fn a_settlement_never_posts_past_the_bill() {
        assert_eq!(
            split_excess(Decimal::from(800), Decimal::from(1000)),
            (Decimal::from(800), Decimal::ZERO)
        );
        assert_eq!(
            split_excess(Decimal::from(1200), Decimal::from(1000)),
            (Decimal::from(1000), Decimal::from(200))
        );
        assert_eq!(
            split_excess(Decimal::from(500), Decimal::ZERO),
            (Decimal::ZERO, Decimal::from(500))
        );
    }

    #[test]
    fn deductions_split_by_who_bears_them() {
        let lines = [
            line(300, "patient"),
            line(200, "write_off"),
            line(50, "patient"),
        ];
        assert_eq!(deducted(&lines, "patient"), Decimal::from(350));
        assert_eq!(deducted(&lines, "write_off"), Decimal::from(200));
    }
}
