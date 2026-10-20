//! Paying online for a teleconsultation — UHI's `ON-ORDER` payment.
//!
//! 1. confirm: the slot is held — a real appointment left `scheduled`, with
//!    its video session — a gateway payment row is opened, and
//!    `uhi.payment_link` is queued.
//! 2. `uhi.payment_link`: the provider makes a hosted payment link, and the
//!    app gets `on_confirm` carrying it (`PENDING`, `NOT-PAID`).
//! 3. The provider's webhook — the one every Razorpay payment already comes
//!    through — marks the payment captured and queues `uhi.payment_captured`:
//!    the appointment is confirmed, the fee is charged to the patient's bill
//!    and the payment posted against it as every gateway payment posts, and
//!    the app gets `on_confirm` and `on_status`, `PAID`.
//! 4. A hold not paid in time is let go by the next UHI call or look at the
//!    requests screen (a bounded read-time sweep, no timer): the appointment
//!    is cancelled and the app gets `on_status`, `CANCELLED`.
//!
//! Through the hospital's online provider when it makes payment links
//! (`medbrains_payment_gateway::payment_link`). A provider without links,
//! or none, keeps pay-at-hospital.

use chrono::{DateTime, Duration, Utc};
use medbrains_core::secrets::SecretResolver;
use medbrains_outbox::{OutboxRow, queue_in_tx};
use medbrains_payment_gateway::payment_link::link_provider;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    fees::Fee,
    inbound::set_state,
    outbox::{Tell, tell},
    protocol::{STATE_CANCELLED, STATE_PENDING},
    settings::Subscription,
    slots::{Slot, now_local},
};
use crate::error::AppError;

pub const LINK_EVENT: &str = "uhi.payment_link";
/// Named in the payment row's `notes.on_captured`; the gateway's webhook
/// queues it (`medbrains_payment_gateway::CAPTURE_EVENTS`).
pub const CAPTURED_EVENT: &str = "uhi.payment_captured";
/// How long a booking is held for its payment. Razorpay refuses a link that
/// expires in under fifteen minutes (the strictest of the providers).
pub const HOLD_MINUTES: i64 = 30;
/// The most lapsed holds one sweep lets go of.
const SWEEP_LIMIT: i64 = 20;
const LET_GO_UNPAID: &str = "Not paid in time — the slot has been released";
pub(super) const LINK_REFUSED: &str =
    "Online payment could not be set up — book again or pay at the hospital";

pub(super) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Whether this slot is paid online: a teleconsultation with a fee, far
/// enough off to hold, at a hospital whose online provider makes payment links.
///
/// # Errors
/// A database fault.
pub async fn pays_online(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    slot: &Slot,
) -> Result<bool, AppError> {
    let starts = slot.date.and_time(slot.start);
    if slot.physical || slot.fee.is_none() || starts < now_local() + Duration::minutes(HOLD_MINUTES)
    {
        return Ok(false);
    }
    Ok(link_provider(tx, secrets, tenant_id).await?.is_some())
}

/// A booking to hold for its payment.
#[derive(Debug)]
pub struct Hold<'a> {
    pub txn_id: Uuid,
    pub appointment_id: Uuid,
    pub fee: Fee,
    pub name: &'a str,
    pub phone: &'a str,
}

/// Hold the booking and ask for its payment link.
///
/// # Errors
/// A database fault.
pub async fn hold(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    hold: &Hold<'_>,
    order: &mut Value,
) -> Result<(), AppError> {
    sqlx::query("UPDATE appointments SET status = 'scheduled' WHERE id = $1")
        .bind(hold.appointment_id)
        .execute(&mut **tx)
        .await?;
    let paying = Uuid::new_v4();
    let notes = json!({ "on_captured": CAPTURED_EVENT, "uhi_transaction_id": hold.txn_id,
        "fee_amount": hold.fee.amount.to_string(), "tax_percent": hold.fee.tax_percent.to_string(),
        "customer_name": hold.name, "customer_phone": hold.phone });
    sqlx::query(
        "INSERT INTO payment_gateway_transactions (id, tenant_id, gateway, gateway_order_id, \
            amount, currency, status, notes, idempotency_key) \
         VALUES ($1, $2, 'razorpay', '', $3, 'INR', 'pending_gateway', $4, $1::text)",
    )
    .bind(paying)
    .bind(tenant_id)
    .bind(hold.fee.total())
    .bind(&notes)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE uhi_transactions SET payment_transaction_id = $2, \
                hold_expires_at = now() + make_interval(mins => $3::int) WHERE id = $1",
    )
    .bind(hold.txn_id)
    .bind(paying)
    .bind(HOLD_MINUTES)
    .execute(&mut **tx)
    .await?;
    order["state"] = json!(STATE_PENDING);
    set_state(tx, hold.txn_id, "awaiting_payment", order).await?;
    queue_in_tx(
        tx,
        OutboxRow {
            tenant_id,
            aggregate_type: "uhi_transaction",
            aggregate_id: Some(hold.txn_id),
            event_type: LINK_EVENT,
            payload: json!({ "uhi_transaction_id": hold.txn_id }),
            idempotency_key: Some(format!("paylink:{}", hold.txn_id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue uhi payment link: {e}")))?;
    Ok(())
}

/// A payment that will not be taken any more is closed, unless it is in.
///
/// # Errors
/// A database fault.
pub async fn release(tx: &mut Tx<'_>, paying: Uuid) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'expired', updated_at = now() \
          WHERE id = $1 AND status IN ('pending_gateway', 'created')",
    )
    .bind(paying)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, sqlx::FromRow)]
pub(super) struct Held {
    pub(super) id: Uuid,
    pub(super) state: String,
    pub(super) amount: Option<Decimal>,
    pub(super) payment_status: Option<String>,
    pub(super) payment_transaction_id: Option<Uuid>,
    pub(super) payment_uri: Option<String>,
    pub(super) hold_expires_at: Option<DateTime<Utc>>,
    pub(super) appointment_id: Option<Uuid>,
    pub(super) tele_consultation_id: Option<Uuid>,
    pub(super) order_details: Option<Value>,
    pub(super) payload: Value,
}

pub(super) const HELD: &str = "SELECT id, state, amount, payment_status, payment_transaction_id, \
    payment_uri, hold_expires_at, appointment_id, tele_consultation_id, order_details, payload \
    FROM uhi_transactions";

/// Cancel a held booking and close its payment; the order as the app is told.
pub(super) async fn let_go(tx: &mut Tx<'_>, held: &Held, reason: &str) -> Result<Value, AppError> {
    if let Some(appointment) = held.appointment_id {
        sqlx::query(
            "UPDATE appointments SET status = 'cancelled', cancelled_at = now(), \
                    cancel_reason = $2 WHERE id = $1 AND status = 'scheduled'",
        )
        .bind(appointment)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
        sqlx::query(
            "UPDATE tele_consultations SET status = 'cancelled', cancel_reason = $2 \
              WHERE appointment_id = $1 AND status = 'scheduled'",
        )
        .bind(appointment)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
    }
    if let Some(paying) = held.payment_transaction_id {
        release(tx, paying).await?;
    }
    let mut order = held.order_details.clone().unwrap_or_else(|| json!({}));
    order["state"] = json!(STATE_CANCELLED);
    order["cancellation"] = json!({ "reason": { "descriptor": { "name": reason } } });
    Ok(order)
}

/// Let go of holds whose time ran out unpaid, and tell their apps. Bounded:
/// at most [`SWEEP_LIMIT`] per call; the rest go on the next.
///
/// # Errors
/// A database fault.
pub async fn expire_holds(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    sub: &Subscription,
) -> Result<(), AppError> {
    let lapsed = sqlx::query_as::<_, Held>(&format!(
        "{HELD} WHERE tenant_id = $1 AND state = 'awaiting_payment' AND hold_expires_at < now() \
            AND deleted_at IS NULL ORDER BY hold_expires_at LIMIT $2 FOR UPDATE SKIP LOCKED"
    ))
    .bind(sub.tenant_id)
    .bind(SWEEP_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    // ponytail: a few statements per lapsed hold, ≤ SWEEP_LIMIT of them.
    for held in lapsed {
        let order = let_go(tx, &held, LET_GO_UNPAID).await?;
        set_state(tx, held.id, "expired", &order).await?;
        let key = format!("expired|{}", held.id);
        tell(tx, secrets, sub, told(&held, "status", order, key)).await?;
    }
    Ok(())
}

pub(super) fn told<'a>(held: &'a Held, action: &'a str, order: Value, key: String) -> Tell<'a> {
    Tell {
        transaction_row: held.id,
        request: &held.payload,
        action,
        order,
        idempotency_key: key,
    }
}

#[cfg(test)]
mod tests {
    use super::CAPTURED_EVENT;

    #[test]
    fn the_gateway_queues_our_event_when_a_payment_is_captured() {
        assert!(medbrains_payment_gateway::CAPTURE_EVENTS.contains(&CAPTURED_EVENT));
    }
}
