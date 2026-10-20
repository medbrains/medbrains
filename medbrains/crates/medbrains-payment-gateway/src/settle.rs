//! Settling gateway money onto bills, exactly once.
//!
//! Every way a provider tells us a payment is in — the browser's verify call,
//! Razorpay's `payment.captured` / `order.paid` / `payment_link.paid`
//! webhooks, the other providers' callbacks — goes through
//! [`settle_capture`]. Its conditional `UPDATE … WHERE status NOT IN
//! ('captured','refunded') RETURNING` is the single decision: whichever
//! arrives first wins the row and posts; every later one finds it settled
//! and posts nothing. Refunds go through [`settle_refund`], deduplicated by
//! the gateway's refund id.
//!
//! Money a gateway has moved but that cannot honestly be posted (a captured
//! amount other than the one asked for, more than the bill owes, a method
//! with no payment mode) is never posted as something else and never
//! dropped: it is parked in `payment_webhook_exceptions` for finance.

use medbrains_billing::posting::{PostPayment, PostRefund, Posted, post_payment, post_refund};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use crate::razorpay::mode_for_method;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// How much the provider says it took.
#[derive(Debug, Clone, Copy)]
pub enum Received {
    /// It does not say; the amount asked for stands.
    AsRequested,
    /// An order's capture: it must equal the amount asked for.
    Exactly(Decimal),
    /// A credit of whatever the payer sent (a bank transfer to a virtual
    /// account); posted as received, within the bill's balance.
    Credited(Decimal),
}

/// A provider's word that a payment is in.
#[derive(Debug)]
pub struct Capture<'a> {
    pub provider: &'a str,
    pub payment_id: &'a str,
    /// The provider's method word (`card`, `upi`, `netbanking`…).
    pub method: Option<&'a str>,
    pub received: Received,
    pub signature: Option<&'a str>,
    pub payload: Option<&'a Value>,
}

/// What settling did.
#[derive(Debug)]
pub enum Settled {
    /// This call won the row (and posted it, or parked it for finance).
    Now(Box<PaymentGatewayTransaction>),
    /// Already settled by an earlier call; nothing was posted.
    Already,
}

/// Paise to rupees.
pub fn rupees(paise: i64) -> Decimal {
    Decimal::new(paise, 2)
}

/// Settle a payment row as captured, and post it to its bill if this call is
/// the one that settled it.
///
/// # Errors
/// A database fault.
pub async fn settle_capture(
    tx: &mut Tx<'_>,
    txn_id: Uuid,
    c: &Capture<'_>,
) -> Result<Settled, AppError> {
    let won = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions SET \
         status = 'captured', gateway_payment_id = $2, \
         payment_method = COALESCE($3, payment_method), \
         gateway_signature = COALESCE($4, gateway_signature), \
         webhook_payload = COALESCE($5, webhook_payload), \
         verified_at = now(), updated_at = now() \
         WHERE id = $1 AND status NOT IN ('captured', 'refunded') \
         RETURNING *",
    )
    .bind(txn_id)
    .bind(c.payment_id)
    .bind(c.method)
    .bind(c.signature)
    .bind(c.payload)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(mut txn) = won else {
        return Ok(Settled::Already);
    };
    if let Some(invoice_id) = txn.invoice_id
        && !post_capture(tx, &txn, invoice_id, c).await?
    {
        txn = mark_held(tx, txn.id).await?;
    }
    announce_capture(tx, &txn).await?;
    Ok(Settled::Now(Box::new(txn)))
}

/// The money is in but not on the bill: say so on the row, so the cashier's
/// screen tells them finance has it rather than that the bill is paid.
async fn mark_held(tx: &mut Tx<'_>, txn_id: Uuid) -> Result<PaymentGatewayTransaction, AppError> {
    Ok(sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions \
         SET notes = notes || jsonb_build_object('held_for_finance', true) \
         WHERE id = $1 RETURNING *",
    )
    .bind(txn_id)
    .fetch_one(&mut **tx)
    .await?)
}

async fn post_capture(
    tx: &mut Tx<'_>,
    txn: &PaymentGatewayTransaction,
    invoice_id: Uuid,
    c: &Capture<'_>,
) -> Result<bool, AppError> {
    let amount = match c.received {
        Received::AsRequested => txn.amount,
        Received::Exactly(a) | Received::Credited(a) => a,
    };
    let posting = GatewayPosting {
        tenant_id: txn.tenant_id,
        invoice_id,
        provider: c.provider,
        order_ref: &txn.gateway_order_id,
        amount,
        method: c.method,
        reference: c.payment_id,
        payload: c.payload,
    };
    if matches!(c.received, Received::Exactly(a) if a != txn.amount) {
        let why = format!("Captured {amount} against an order for {}", txn.amount);
        park(tx, &posting, "amount_mismatch", &why).await?;
        return Ok(false);
    }
    record_invoice_payment(tx, &posting).await
}

/// Gateway money to post to a bill.
#[derive(Debug)]
pub struct GatewayPosting<'a> {
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub provider: &'a str,
    /// The provider's order / link / account reference, for finance.
    pub order_ref: &'a str,
    pub amount: Decimal,
    pub method: Option<&'a str>,
    /// The provider's payment id, filed as the payment's reference.
    pub reference: &'a str,
    pub payload: Option<&'a Value>,
}

/// Post gateway money to a bill through billing's own posting — the
/// balance check a cashier's payment gets — with the mode it was paid by.
/// Returns whether it posted; what could not be posted is parked for
/// finance.
///
/// # Errors
/// A database fault.
pub async fn record_invoice_payment(
    tx: &mut Tx<'_>,
    p: &GatewayPosting<'_>,
) -> Result<bool, AppError> {
    let Some(mode) = p.method.and_then(mode_for_method) else {
        let why = format!(
            "Paid by '{}', which has no payment mode",
            p.method.unwrap_or("an unreported method")
        );
        park(tx, p, "unknown_method", &why).await?;
        return Ok(false);
    };
    // The invoice screen offers a refund on payments filed with this note
    // (`ONLINE_PAYMENT_NOTE_PREFIX` in gateway-refund-modal.tsx).
    let notes = format!("Online payment ({})", p.provider);
    let posted = post_payment(
        tx,
        &PostPayment {
            tenant_id: p.tenant_id,
            invoice_id: p.invoice_id,
            amount: p.amount,
            mode,
            reference_number: Some(p.reference),
            notes: Some(notes.as_str()),
            received_by: None,
            counter_id: None,
            shift: None,
        },
    )
    .await?;
    match posted {
        Posted::Done(_) => {
            // A home delivery the patient paid for in advance goes out once paid.
            medbrains_pharmacy_delivery::pay::release_paid(tx, p.tenant_id, p.invoice_id).await?;
            Ok(true)
        }
        Posted::Refused(why) => {
            park(tx, p, "over_capture", &why).await?;
            Ok(false)
        }
    }
}

/// Park gateway money for finance, under the hospital it belongs to.
///
/// # Errors
/// A database fault.
pub async fn park(
    tx: &mut Tx<'_>,
    p: &GatewayPosting<'_>,
    reason: &str,
    why: &str,
) -> Result<(), AppError> {
    tracing::warn!(
        provider = p.provider,
        order_ref = p.order_ref,
        reason,
        "gateway money parked"
    );
    sqlx::query(
        "INSERT INTO payment_webhook_exceptions \
         (tenant_id, provider, order_ref, reason, amount, raw_payload, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, '{}'::jsonb), $7)",
    )
    .bind(p.tenant_id)
    .bind(p.provider)
    .bind(p.order_ref)
    .bind(reason)
    .bind(p.amount)
    .bind(p.payload)
    .bind(why)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The outbox events a payment may ask to have queued when it is captured.
/// An allowlist: a payment row never names an arbitrary event.
pub const CAPTURE_EVENTS: [&str; 1] = ["uhi.payment_captured"];

/// Tell whoever opened the payment that it is in: a payment raised for
/// something other than a bill names, in `notes.on_captured`, the outbox
/// event that finishes its work (a UHI booking: `uhi.payment_captured`).
async fn announce_capture(
    tx: &mut Tx<'_>,
    txn: &PaymentGatewayTransaction,
) -> Result<(), AppError> {
    let named = txn.notes.get("on_captured").and_then(Value::as_str);
    let Some(event) = CAPTURE_EVENTS.into_iter().find(|e| Some(*e) == named) else {
        return Ok(());
    };
    medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::OutboxRow {
            tenant_id: txn.tenant_id,
            aggregate_type: "payment_gateway_transaction",
            aggregate_id: Some(txn.id),
            event_type: event,
            payload: serde_json::json!({ "payment_transaction_id": txn.id }),
            idempotency_key: Some(format!("captured:{}", txn.id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
    Ok(())
}

/// Lock a payment row for the rest of the transaction.
///
/// # Errors
/// A database fault, or no such row.
pub async fn lock_txn(tx: &mut Tx<'_>, id: Uuid) -> Result<PaymentGatewayTransaction, AppError> {
    sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// A refund the gateway made.
#[derive(Debug)]
pub struct RefundMade<'a> {
    pub refund_id: &'a str,
    pub amount: Decimal,
    pub reason: &'a str,
    /// Who asked for it; `None` when it was made from the gateway's dashboard.
    pub refunded_by: Option<Uuid>,
    pub payload: Option<&'a Value>,
}

/// Whether this refund id has been taken into the books (posted or parked).
async fn refund_known(tx: &mut Tx<'_>, tenant_id: Uuid, refund_id: &str) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM refunds \
                        WHERE tenant_id = $1 AND reference_number = $2 AND deleted_at IS NULL) \
             OR EXISTS(SELECT 1 FROM payment_webhook_exceptions \
                        WHERE tenant_id = $1 AND order_ref = $2)",
    )
    .bind(tenant_id)
    .bind(refund_id)
    .fetch_one(&mut **tx)
    .await?)
}

/// Take a gateway refund into the books once: the payment row's refunded
/// total, and the bill's paid amount through billing's refund posting. The
/// caller holds the payment row's lock ([`lock_txn`]), so the check for an
/// already-known refund id and the posting cannot interleave.
///
/// Returns whether this call took it in.
///
/// # Errors
/// A database fault.
pub async fn settle_refund(
    tx: &mut Tx<'_>,
    txn: &PaymentGatewayTransaction,
    r: &RefundMade<'_>,
) -> Result<bool, AppError> {
    if refund_known(tx, txn.tenant_id, r.refund_id).await? {
        return Ok(false);
    }
    mark_refunded(tx, txn, r).await?;
    let Some(invoice_id) = txn.invoice_id else {
        return Ok(true);
    };
    let parking = GatewayPosting {
        tenant_id: txn.tenant_id,
        invoice_id,
        provider: &txn.gateway,
        order_ref: r.refund_id,
        amount: r.amount,
        method: txn.payment_method.as_deref(),
        reference: r.refund_id,
        payload: r.payload,
    };
    let paid: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, mode::text FROM payments \
         WHERE tenant_id = $1 AND invoice_id = $2 AND reference_number = $3 \
           AND deleted_at IS NULL LIMIT 1",
    )
    .bind(txn.tenant_id)
    .bind(invoice_id)
    .bind(txn.gateway_payment_id.as_deref())
    .fetch_optional(&mut **tx)
    .await?;
    let Some((payment_id, mode)) = paid else {
        let why = "Refunded a payment that was never posted to the bill";
        park(tx, &parking, "refund_not_posted", why).await?;
        return Ok(true);
    };
    let posted = post_refund(
        tx,
        &PostRefund {
            tenant_id: txn.tenant_id,
            invoice_id,
            payment_id: Some(payment_id),
            amount: r.amount,
            reason: r.reason,
            mode: &mode,
            reference_number: Some(r.refund_id),
            refunded_by: r.refunded_by,
        },
    )
    .await?;
    if let Posted::Refused(why) = posted {
        park(tx, &parking, "refund_not_posted", &why).await?;
    }
    Ok(true)
}

async fn mark_refunded(
    tx: &mut Tx<'_>,
    txn: &PaymentGatewayTransaction,
    r: &RefundMade<'_>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         refund_id = $2, refund_amount = COALESCE(refund_amount, 0) + $3, \
         status = CASE WHEN COALESCE(refund_amount, 0) + $3 >= amount \
                       THEN 'refunded' ELSE status END, \
         webhook_payload = COALESCE($4, webhook_payload), updated_at = now() \
         WHERE id = $1",
    )
    .bind(txn.id)
    .bind(r.refund_id)
    .bind(r.amount)
    .bind(r.payload)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
