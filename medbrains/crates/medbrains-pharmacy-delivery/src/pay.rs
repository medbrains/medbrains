//! Pay-now for a delivery the patient chose: the payment link made when the
//! pharmacist approves the refill, and the release of the delivery once a
//! payment settles its bill.

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::choice::open_delivery;
use crate::facts::bill_balance;

/// Pay-now requests one payment can settle, at most.
const RELEASE_LIMIT: i64 = 20;
/// Asks Razorpay for a payment link (`medbrains_outbox::handlers::razorpay`).
pub const PAYMENT_LINK_EVENT: &str = "payment.razorpay.create_link";

/// A pay-now link for `amount`, made off-thread through the payment
/// provider's outbox; the link's URL lands on the transaction's notes.
pub(crate) async fn payment_link(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Option<Uuid>,
    amount: Decimal,
    phone: Option<&str>,
    request_id: Uuid,
) -> Result<Uuid, AppError> {
    let paise = (amount * Decimal::ONE_HUNDRED)
        .round()
        .to_u64()
        .ok_or_else(|| AppError::Internal(format!("payment amount out of range: {amount}")))?;
    let txn: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
           (tenant_id, invoice_id, gateway, gateway_order_id, amount, currency, status, notes, \
            idempotency_key) \
         VALUES ($1, $2, 'razorpay', '', $3, 'INR', 'pending_gateway', \
                 jsonb_build_object('purpose', 'pharmacy_delivery', 'refill_request_id', $4::uuid), \
                 'delivery:' || $4::uuid) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(amount)
    .bind(request_id)
    .fetch_one(&mut **tx)
    .await?;
    medbrains_outbox::queue::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "payment_gateway_transaction",
            aggregate_id: Some(txn),
            event_type: PAYMENT_LINK_EVENT,
            payload: serde_json::json!({
                "internal_payment_id": txn,
                "amount_paise": paise,
                "currency": "INR",
                "description": "Medicines for home delivery",
                "contact": phone,
            }),
            idempotency_key: Some(txn.to_string()),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue the payment link: {e}")))?;
    Ok(txn)
}

/// A payment landed on `invoice_id`: open each pay-now delivery whose order
/// is now paid for. Called by every gateway path that records a payment.
pub async fn release_paid(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    let waiting: Vec<(Uuid, Uuid, Decimal)> = sqlx::query_as(
        "SELECT r.id, q.pharmacy_order_id, \
                COALESCE((SELECT ii.unit_price FROM invoice_items ii \
                           WHERE ii.tenant_id = r.tenant_id AND ii.source_id = r.id \
                             AND ii.is_reversal = false LIMIT 1), 0) \
           FROM prescription_refill_requests r \
           JOIN payment_gateway_transactions t ON t.id = r.payment_txn_id \
           JOIN pharmacy_prescriptions q ON q.id = r.rx_queue_id AND q.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND t.invoice_id = $2 AND r.deleted_at IS NULL \
            AND q.pharmacy_order_id IS NOT NULL \
            AND NOT EXISTS (SELECT 1 FROM pharmacy_deliveries d \
                             WHERE d.tenant_id = r.tenant_id AND d.refill_request_id = r.id \
                               AND d.deleted_at IS NULL) \
          ORDER BY r.created_at LIMIT $3",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(RELEASE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    for (request_id, order_id, fee) in waiting {
        if bill_balance(tx, tenant_id, order_id).await? <= Decimal::ZERO {
            open_delivery(
                tx,
                tenant_id,
                request_id,
                order_id,
                fee,
                Decimal::ZERO,
                None,
            )
            .await?;
        }
    }
    Ok(())
}
