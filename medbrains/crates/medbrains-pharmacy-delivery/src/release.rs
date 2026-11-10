//! A patient's delivery choice goes on to delivery once their order exists:
//! a refill the pharmacist approved, or a storefront order released to
//! fulfilment. Pay at the door (or nothing owed) opens the delivery at once;
//! pay now sends a payment link, and the delivery opens once it is paid.

use medbrains_core::pharmacy_delivery::{PAY_ON_DELIVERY, patient_offer};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::arrange::charge_fee;
use crate::choice::open_delivery;
use crate::facts::{bill_balance, delivers_free, order_facts, order_invoice, settings};
use crate::pay::payment_link;
use crate::source::Source;

#[derive(sqlx::FromRow)]
struct Chosen {
    id: Uuid,
    delivery_payment: Option<String>,
    delivery_phone: Option<String>,
}

/// The pharmacist approved a refill and its order was made. If the patient
/// chose delivery, it goes on to delivery.
pub async fn on_order_approved(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    actor: Uuid,
    rx_queue_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let chosen = sqlx::query_as::<_, Chosen>(
        "SELECT id, delivery_payment, delivery_phone FROM prescription_refill_requests \
          WHERE tenant_id = $1 AND rx_queue_id = $2 AND fulfilment = 'delivery' \
            AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(rx_queue_id)
    .fetch_optional(&mut **tx)
    .await?;
    match chosen {
        Some(c) => {
            deliver(
                tx,
                tenant_id,
                Some(actor),
                Source::Refill(c.id),
                &c,
                order_id,
            )
            .await
        }
        None => Ok(()),
    }
}

/// A storefront order was released to fulfilment as `order_id`. If the
/// patient chose delivery at checkout, it goes on to delivery; `actor` is
/// the verifying pharmacist, or none when nothing needed verifying.
pub async fn on_store_order_released(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    actor: Option<Uuid>,
    store_order_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let chosen = sqlx::query_as::<_, Chosen>(
        "SELECT id, delivery_payment, delivery_phone FROM pharmacy_store_orders \
          WHERE tenant_id = $1 AND id = $2 AND fulfilment = 'delivery' AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(store_order_id)
    .fetch_optional(&mut **tx)
    .await?;
    match chosen {
        Some(c) => deliver(tx, tenant_id, actor, Source::Store(c.id), &c, order_id).await,
        None => Ok(()),
    }
}

/// Bill the fee and either open the delivery (they pay at the door, or
/// nothing is owed) or send them a payment link.
async fn deliver(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    actor: Option<Uuid>,
    source: Source,
    chosen: &Chosen,
    order_id: Uuid,
) -> Result<(), AppError> {
    let order = order_facts(tx, tenant_id, order_id).await?;
    // The order is what goes, as the pharmacist mapped it — checked again.
    if let Some(reason) = patient_offer(true, &order.lines, true, true).reason {
        sqlx::query(&format!(
            "UPDATE {} SET delivery_note = $3 WHERE id = $1 AND tenant_id = $2",
            source.table()
        ))
        .bind(source.id())
        .bind(tenant_id)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
        return Ok(());
    }
    let (mut fee, _) = settings(tx, tenant_id).await?;
    // An online order over the hospital's threshold delivers free.
    if matches!(source, Source::Store(_)) {
        let goods: Decimal = sqlx::query_scalar(
            "SELECT COALESCE(SUM(total_price), 0) FROM pharmacy_order_items \
              WHERE tenant_id = $1 AND order_id = $2",
        )
        .bind(tenant_id)
        .bind(order_id)
        .fetch_one(&mut **tx)
        .await?;
        if delivers_free(tx, tenant_id, goods).await? {
            fee = Decimal::ZERO;
        }
    }
    // Read before the fee is billed, so it isn't counted twice.
    let due = bill_balance(tx, tenant_id, order_id).await? + fee;
    let fee_invoice = if fee > Decimal::ZERO {
        Some(charge_fee(tx, tenant_id, &order, source.id(), fee).await?)
    } else {
        None
    };
    // Paid at the door, or nothing to pay: it goes on to the pharmacy now.
    if chosen.delivery_payment.as_deref() == Some(PAY_ON_DELIVERY) || due <= Decimal::ZERO {
        return open_delivery(tx, tenant_id, source, order_id, fee, due, actor).await;
    }
    let invoice = order_invoice(tx, tenant_id, order_id)
        .await?
        .or(fee_invoice);
    let txn = payment_link(
        tx,
        tenant_id,
        invoice,
        due,
        chosen.delivery_phone.as_deref(),
        source,
    )
    .await?;
    sqlx::query(&format!(
        "UPDATE {} SET payment_txn_id = $3 WHERE id = $1 AND tenant_id = $2",
        source.table()
    ))
    .bind(source.id())
    .bind(tenant_id)
    .bind(txn)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
