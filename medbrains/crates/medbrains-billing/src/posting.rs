//! The one way money lands on, and comes back off, a bill.
//!
//! The cashier's payment and refund screens and every online gateway post
//! through these, so a bill is never overpaid or over-refunded whichever door
//! the money came in by.
//!
//! Each takes the bill's row lock first (`FOR UPDATE`), so two postings to the
//! same bill are applied one after the other against the balance the first
//! one left. A refusal is an answer, not a fault: the caller decides whether
//! it is a 400 for a cashier or an exception for finance (money a gateway has
//! already moved).

use medbrains_core::billing::{InvoiceStatus, Payment, Refund};
use medbrains_server_core::error::AppError;
use medbrains_server_services::billing::SeqResult;
use rust_decimal::Decimal;
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// What a posting did.
#[derive(Debug)]
pub enum Posted<T> {
    Done(T),
    /// Not posted, and why — in words a cashier or finance can act on.
    Refused(String),
}

/// A payment to post.
#[derive(Debug)]
pub struct PostPayment<'a> {
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub amount: Decimal,
    /// A `payment_mode` value (`cash`, `card`, `upi`, `bank_transfer`, `wallet`…).
    pub mode: &'a str,
    pub reference_number: Option<&'a str>,
    pub notes: Option<&'a str>,
    /// The cashier; `None` for money a gateway posted on its own.
    pub received_by: Option<Uuid>,
    pub counter_id: Option<&'a str>,
    pub shift: Option<&'a str>,
    /// The patient payment act it is part of (#4885), and where and in which
    /// shift it was taken.
    pub collection_id: Option<Uuid>,
    pub station_id: Option<Uuid>,
    pub shift_id: Option<Uuid>,
}

#[derive(sqlx::FromRow)]
struct Balance {
    status: InvoiceStatus,
    total_amount: Decimal,
    paid_amount: Decimal,
}

async fn lock_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<Balance, AppError> {
    sqlx::query_as::<_, Balance>(
        "SELECT status, total_amount, paid_amount FROM invoices \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Why a payment of `amount` cannot land on this bill, if it cannot.
fn payment_refusal(bill: &Balance, amount: Decimal) -> Option<String> {
    if amount <= Decimal::ZERO {
        return Some("Payment amount must be greater than zero".to_owned());
    }
    if matches!(
        bill.status,
        InvoiceStatus::Cancelled | InvoiceStatus::Refunded
    ) {
        return Some("The bill is cancelled or refunded and takes no payment".to_owned());
    }
    let outstanding = (bill.total_amount - bill.paid_amount).round_dp(2);
    if outstanding <= Decimal::ZERO {
        return Some("Invoice has no outstanding balance".to_owned());
    }
    (amount > outstanding).then(|| format!("Payment exceeds outstanding balance of {outstanding}"))
}

/// Post a payment: the payment row, then the bill's paid amount and status.
///
/// # Errors
/// A database fault, or no such bill.
pub async fn post_payment(
    tx: &mut Tx<'_>,
    p: &PostPayment<'_>,
) -> Result<Posted<Payment>, AppError> {
    let amount = p.amount.round_dp(2);
    let bill = lock_balance(tx, p.tenant_id, p.invoice_id).await?;
    if let Some(why) = payment_refusal(&bill, amount) {
        return Ok(Posted::Refused(why));
    }
    let payment = sqlx::query_as::<_, Payment>(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, \
          counter_id, shift, collection_id, station_id, shift_id, paid_at) \
         VALUES ($1, $2, $3, $4::payment_mode, $5, $6, $7, $8, $9, $10, $11, $12, now()) \
         RETURNING *",
    )
    .bind(p.tenant_id)
    .bind(p.invoice_id)
    .bind(amount)
    .bind(p.mode)
    .bind(p.reference_number)
    .bind(p.received_by)
    .bind(p.notes)
    .bind(p.counter_id)
    .bind(p.shift)
    .bind(p.collection_id)
    .bind(p.station_id)
    .bind(p.shift_id)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(amount)
    .bind(p.invoice_id)
    .bind(p.tenant_id)
    .execute(&mut **tx)
    .await?;
    // Doctors paid on collection earn their share of what came in.
    medbrains_doctor_payouts::accrual::sync_after_money(tx, p.tenant_id, p.invoice_id).await?;
    Ok(Posted::Done(payment))
}

/// A refund to post.
#[derive(Debug)]
pub struct PostRefund<'a> {
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    /// The payment it returns, which must belong to this bill.
    pub payment_id: Option<Uuid>,
    pub amount: Decimal,
    pub reason: &'a str,
    /// A `payment_mode` value — how the money goes back.
    pub mode: &'a str,
    pub reference_number: Option<&'a str>,
    /// Who refunded; `None` for a refund a gateway reported on its own.
    pub refunded_by: Option<Uuid>,
}

fn refund_refusal(bill: &Balance, amount: Decimal) -> Option<String> {
    if amount <= Decimal::ZERO {
        return Some("Refund amount must be greater than zero".to_owned());
    }
    if matches!(
        bill.status,
        InvoiceStatus::Draft | InvoiceStatus::Cancelled | InvoiceStatus::Refunded
    ) {
        return Some(
            "Refunds can be processed only against paid or partially paid invoices".to_owned(),
        );
    }
    (amount > bill.paid_amount).then(|| {
        format!(
            "Refund exceeds refundable paid amount of {}",
            bill.paid_amount
        )
    })
}

async fn next_refund_number(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'REFUND' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        return Ok(format!("{}{:0>pad$}", s.prefix, s.current_val));
    }
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM refunds WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(format!("RFD{:0>6}", count + 1))
}

/// Post a refund: the refund row, then the bill's paid amount and status.
///
/// # Errors
/// A database fault, or no such bill.
pub async fn post_refund(tx: &mut Tx<'_>, r: &PostRefund<'_>) -> Result<Posted<Refund>, AppError> {
    let amount = r.amount.round_dp(2);
    let bill = lock_balance(tx, r.tenant_id, r.invoice_id).await?;
    if let Some(why) = refund_refusal(&bill, amount) {
        return Ok(Posted::Refused(why));
    }
    if let Some(payment_id) = r.payment_id {
        let belongs = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM payments \
             WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3)",
        )
        .bind(payment_id)
        .bind(r.invoice_id)
        .bind(r.tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        if !belongs {
            return Ok(Posted::Refused(
                "Refund payment reference does not belong to this invoice".to_owned(),
            ));
        }
    }
    let number = next_refund_number(tx, r.tenant_id).await?;
    let refund = sqlx::query_as::<_, Refund>(
        "INSERT INTO refunds \
         (tenant_id, invoice_id, payment_id, refund_number, amount, reason, \
          mode, reference_number, refunded_by, refunded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::payment_mode, $8, $9, now()) \
         RETURNING *",
    )
    .bind(r.tenant_id)
    .bind(r.invoice_id)
    .bind(r.payment_id)
    .bind(&number)
    .bind(amount)
    .bind(r.reason)
    .bind(r.mode)
    .bind(r.reference_number)
    .bind(r.refunded_by)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount - $1, \
         status = CASE \
           WHEN paid_amount - $1 <= 0 THEN 'refunded'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(amount)
    .bind(r.invoice_id)
    .bind(r.tenant_id)
    .execute(&mut **tx)
    .await?;
    // A refund takes back the doctor's share of it: reversal rows, never edits.
    medbrains_doctor_payouts::accrual::sync_after_money(tx, r.tenant_id, r.invoice_id).await?;
    Ok(Posted::Done(refund))
}

#[cfg(test)]
mod tests {
    use super::{Balance, Decimal, InvoiceStatus, payment_refusal, refund_refusal};

    fn bill(status: InvoiceStatus, total: i64, paid: i64) -> Balance {
        Balance {
            status,
            total_amount: Decimal::from(total),
            paid_amount: Decimal::from(paid),
        }
    }

    #[test]
    fn a_payment_never_takes_a_bill_past_its_total() {
        let open = bill(InvoiceStatus::Issued, 1000, 400);
        assert!(payment_refusal(&open, Decimal::from(600)).is_none());
        assert!(payment_refusal(&open, Decimal::from(601)).is_some());
        assert!(payment_refusal(&bill(InvoiceStatus::Paid, 1000, 1000), Decimal::ONE).is_some());
        assert!(payment_refusal(&bill(InvoiceStatus::Cancelled, 1000, 0), Decimal::ONE).is_some());
        // A bill still being made (a UHI booking paid online) takes its payment.
        assert!(payment_refusal(&bill(InvoiceStatus::Draft, 500, 0), Decimal::from(500)).is_none());
    }

    #[test]
    fn a_refund_never_returns_more_than_was_paid() {
        let paid = bill(InvoiceStatus::Paid, 1000, 1000);
        assert!(refund_refusal(&paid, Decimal::from(300)).is_none());
        assert!(refund_refusal(&paid, Decimal::from(1001)).is_some());
        assert!(refund_refusal(&bill(InvoiceStatus::Draft, 1000, 0), Decimal::ONE).is_some());
    }
}
