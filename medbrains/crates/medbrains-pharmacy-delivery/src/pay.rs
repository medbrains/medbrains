//! Pay-now for a delivery the patient chose: the payment link made when the
//! pharmacist approves the refill, and the release of the delivery once a
//! payment settles its bill.

use medbrains_core::payment::RAZORPAY_LINK_EVENT;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::choice::open_delivery;
use crate::facts::bill_balance;
use crate::source::Source;

/// Pay-now requests one payment can settle, at most.
const RELEASE_LIMIT: i64 = 20;

/// A pay-now payment row for `amount`, and its link made off-thread by the
/// shared Razorpay client (`medbrains_payment_gateway::payment_link`), which
/// reads the amount from the row and files the URL on its notes.
pub(crate) async fn payment_link(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Option<Uuid>,
    amount: Decimal,
    phone: Option<&str>,
    source: Source,
) -> Result<Uuid, AppError> {
    let txn: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
           (tenant_id, invoice_id, gateway, gateway_order_id, amount, currency, status, notes, \
            idempotency_key) \
         VALUES ($1, $2, 'razorpay', '', $3, 'INR', 'pending_gateway', \
                 jsonb_build_object('purpose', 'pharmacy_delivery', $5::text, $4::uuid), \
                 'delivery:' || $4::uuid) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(amount)
    .bind(source.id())
    .bind(source.key())
    .fetch_one(&mut **tx)
    .await?;
    medbrains_outbox::queue::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "payment_gateway_transaction",
            aggregate_id: Some(txn),
            event_type: RAZORPAY_LINK_EVENT,
            payload: serde_json::json!({
                "internal_payment_id": txn,
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

/// Pay-now refill requests waiting on a payment to `invoice_id`: the
/// request, its order, and the delivery fee billed for it.
const WAITING_REFILLS: &str = "SELECT r.id, q.pharmacy_order_id, \
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
  ORDER BY r.created_at LIMIT $3";

/// The same for storefront orders.
const WAITING_STORE_ORDERS: &str = "SELECT s.id, s.pharmacy_order_id, \
        COALESCE((SELECT ii.unit_price FROM invoice_items ii \
                   WHERE ii.tenant_id = s.tenant_id AND ii.source_id = s.id \
                     AND ii.is_reversal = false LIMIT 1), 0) \
   FROM pharmacy_store_orders s \
   JOIN payment_gateway_transactions t ON t.id = s.payment_txn_id \
  WHERE s.tenant_id = $1 AND t.invoice_id = $2 AND s.deleted_at IS NULL \
    AND s.pharmacy_order_id IS NOT NULL \
    AND NOT EXISTS (SELECT 1 FROM pharmacy_deliveries d \
                     WHERE d.tenant_id = s.tenant_id AND d.store_order_id = s.id \
                       AND d.deleted_at IS NULL) \
  ORDER BY s.created_at LIMIT $3";

/// Builds the delivery source from the waiting row's id.
type SourceOf = fn(Uuid) -> Source;

/// A payment landed on `invoice_id`: open each pay-now delivery whose order
/// is now paid for. Called by every gateway path that records a payment.
pub async fn release_paid(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    let sources: [(&str, SourceOf); 2] = [
        (WAITING_REFILLS, Source::Refill),
        (WAITING_STORE_ORDERS, Source::Store),
    ];
    for (sql, source) in sources {
        let waiting: Vec<(Uuid, Uuid, Decimal)> = sqlx::query_as(sql)
            .bind(tenant_id)
            .bind(invoice_id)
            .bind(RELEASE_LIMIT)
            .fetch_all(&mut **tx)
            .await?;
        for (id, order_id, fee) in waiting {
            if bill_balance(tx, tenant_id, order_id).await? <= Decimal::ZERO {
                let src = source(id);
                open_delivery(tx, tenant_id, src, order_id, fee, Decimal::ZERO, None).await?;
            }
        }
    }
    Ok(())
}
