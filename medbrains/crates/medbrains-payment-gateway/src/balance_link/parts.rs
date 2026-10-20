//! What the provider says about one of our balance links: a part paid, the
//! link expired or cancelled.
//!
//! A part posts once: the `payment_link_parts` row keyed by the provider's
//! payment id is the single decision, taken under the link's row lock. Only
//! the captured amount posts, across the link's bills oldest first, each
//! slice through `settle::settle_capture` on its own payment row (so it is
//! refundable like any online payment). What the bills no longer owe is
//! parked for finance: `refund_due` when they were already settled (a link
//! paid after the counter took the money), `over_capture` otherwise.

use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{LIVE_SQL, close_parent};
use crate::online::{ProviderEvent, Via};
use crate::settle::{self, Capture, GatewayPosting, Received, Settled};
use medbrains_billing::collect::allocate::allocate;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, sqlx::FromRow)]
struct LinkRow {
    id: Uuid,
    tenant_id: Uuid,
    invoice_ids: Vec<Uuid>,
    provider: String,
    provider_link_id: Option<String>,
    payment_transaction_id: Option<Uuid>,
}

/// A part the provider took.
struct Part<'a> {
    payment_id: &'a str,
    amount: Decimal,
    method: Option<&'a str>,
    /// The provider's own order for this payment (a Cashfree link's
    /// `CFPay_…`, which its refunds go to), else `link/payment`.
    order_ref: String,
}

/// Settle a verified provider notice if it is about a balance link. `false`
/// when the payment row is not one of ours (a booking's or a delivery's
/// link) or the notice is not about a part or the link's end, so the caller
/// handles it as before.
///
/// # Errors
/// A database fault.
pub async fn on_event(
    tx: &mut Tx<'_>,
    txn: &PaymentGatewayTransaction,
    event: &ProviderEvent,
    payload: &Value,
) -> Result<bool, AppError> {
    let wanted = matches!(
        event,
        ProviderEvent::Captured { via: Via::Link, .. } | ProviderEvent::LinkClosed { .. }
    );
    if !wanted {
        return Ok(false);
    }
    let link = sqlx::query_as::<_, LinkRow>(
        "SELECT id, tenant_id, invoice_ids, provider, provider_link_id, payment_transaction_id \
           FROM payment_links WHERE tenant_id = $1 AND payment_transaction_id = $2 FOR UPDATE",
    )
    .bind(txn.tenant_id)
    .bind(txn.id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(link) = link else {
        return Ok(false);
    };
    match event {
        ProviderEvent::Captured {
            payment_id,
            amount_paise,
            method,
            lookup,
            ..
        } => {
            let Some(amount) = amount_paise.filter(|p| *p > 0).map(settle::rupees) else {
                tracing::warn!(link = %link.id, "a link payment without an amount");
                return Ok(true);
            };
            let plink = link.provider_link_id.as_deref().unwrap_or_default();
            let part = Part {
                payment_id,
                amount,
                method: method.as_deref(),
                order_ref: lookup
                    .clone()
                    .unwrap_or_else(|| format!("{plink}/{payment_id}")),
            };
            take_part(tx, &link, &part, payload).await?;
        }
        ProviderEvent::LinkClosed { expired } => {
            close(tx, &link, if *expired { "expired" } else { "cancelled" }).await?;
        }
        _ => {}
    }
    Ok(true)
}

/// The provider closed the link: it takes no more money.
async fn close(tx: &mut Tx<'_>, link: &LinkRow, status: &str) -> Result<(), AppError> {
    sqlx::query(&format!(
        "UPDATE payment_links SET status = $2, end_reason = COALESCE(end_reason, $2) \
          WHERE id = $1 AND status IN {LIVE_SQL}"
    ))
    .bind(link.id)
    .bind(status)
    .execute(&mut **tx)
    .await?;
    close_parent(tx, link.payment_transaction_id, status).await?;
    Ok(())
}

async fn take_part(
    tx: &mut Tx<'_>,
    link: &LinkRow,
    part: &Part<'_>,
    payload: &Value,
) -> Result<(), AppError> {
    let first: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO payment_link_parts (tenant_id, link_id, provider_payment_id, amount, method) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id, provider_payment_id) WHERE deleted_at IS NULL DO NOTHING \
         RETURNING id",
    )
    .bind(link.tenant_id)
    .bind(link.id)
    .bind(part.payment_id)
    .bind(part.amount)
    .bind(part.method)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(part_id) = first else {
        return Ok(()); // this payment was taken already
    };
    // The link is counted first, so the balance trigger never sees the bills
    // paid down while the link still asks for the old amount.
    sqlx::query(&format!(
        "UPDATE payment_links SET amount_paid = amount_paid + $2, \
                status = CASE WHEN status NOT IN {LIVE_SQL} THEN status \
                              WHEN amount_paid + $2 >= amount THEN 'paid' \
                              ELSE 'partially_paid' END \
          WHERE id = $1"
    ))
    .bind(link.id)
    .bind(part.amount)
    .execute(&mut **tx)
    .await?;
    let (posted, parked) = post_part(tx, link, part, payload).await?;
    sqlx::query("UPDATE payment_link_parts SET posted = $2, parked = $3 WHERE id = $1")
        .bind(part_id)
        .bind(posted)
        .bind(parked)
        .execute(&mut **tx)
        .await?;
    let paid: bool = sqlx::query_scalar("SELECT status = 'paid' FROM payment_links WHERE id = $1")
        .bind(link.id)
        .fetch_one(&mut **tx)
        .await?;
    if paid {
        close_parent(tx, link.payment_transaction_id, "paid").await?;
    }
    Ok(())
}

#[derive(sqlx::FromRow)]
struct OpenBill {
    id: Uuid,
    balance: Decimal,
}

/// Post the part over the link's bills; returns (posted, parked).
async fn post_part(
    tx: &mut Tx<'_>,
    link: &LinkRow,
    part: &Part<'_>,
    payload: &Value,
) -> Result<(Decimal, Decimal), AppError> {
    let bills = sqlx::query_as::<_, OpenBill>(
        "SELECT id, total_amount - paid_amount AS balance FROM invoices \
          WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL \
            AND status IN ('issued', 'partially_paid') AND total_amount > paid_amount \
          ORDER BY COALESCE(issued_at, created_at), id FOR UPDATE",
    )
    .bind(link.tenant_id)
    .bind(&link.invoice_ids)
    .fetch_all(&mut **tx)
    .await?;
    let balances: Vec<Decimal> = bills.iter().map(|b| b.balance).collect();
    let owed: Decimal = balances.iter().sum();
    let fill = part.amount.min(owed);
    let slices = allocate(&balances, &[fill]).unwrap_or_default();
    let mut posted = Decimal::ZERO;
    for (n, slice) in slices.iter().enumerate() {
        let Some(bill) = bills.get(slice.bill) else {
            continue;
        };
        if post_slice(tx, link, part, (n, bill.id, slice.amount), payload).await? {
            posted += slice.amount;
        }
    }
    let excess = part.amount - fill;
    if excess > Decimal::ZERO {
        let (reason, why) = if owed <= Decimal::ZERO {
            (
                "refund_due",
                "Paid by link after the bills were settled — refund the patient".to_owned(),
            )
        } else {
            (
                "over_capture",
                format!("Paid {} by link; the bills owed only {owed}", part.amount),
            )
        };
        let parking = GatewayPosting {
            tenant_id: link.tenant_id,
            invoice_id: link.invoice_ids.first().copied().unwrap_or_default(),
            provider: &link.provider,
            order_ref: link.provider_link_id.as_deref().unwrap_or_default(),
            amount: excess,
            method: part.method,
            reference: part.payment_id,
            payload: Some(payload),
        };
        settle::park(tx, &parking, reason, &why).await?;
    }
    Ok((posted, part.amount - posted))
}

/// One slice of a part onto one bill, through the exactly-once settle path.
/// Returns whether it posted (else it is parked for finance).
async fn post_slice(
    tx: &mut Tx<'_>,
    link: &LinkRow,
    part: &Part<'_>,
    (n, invoice_id, amount): (usize, Uuid, Decimal),
    payload: &Value,
) -> Result<bool, AppError> {
    let txn_id: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
           (tenant_id, invoice_id, gateway, gateway_order_id, amount, currency, status, \
            idempotency_key, notes) \
         VALUES ($1, $2, $7, $3, $4, 'INR', 'created', $5, $6) RETURNING id",
    )
    .bind(link.tenant_id)
    .bind(invoice_id)
    .bind(&part.order_ref)
    .bind(amount)
    .bind(format!("plink:{}:{n}", part.payment_id))
    .bind(json!({ "payment_link_id": link.id }))
    .bind(&link.provider)
    .fetch_one(&mut **tx)
    .await?;
    let settled = settle::settle_capture(
        tx,
        txn_id,
        &Capture {
            provider: &link.provider,
            payment_id: part.payment_id,
            method: part.method,
            received: Received::Exactly(amount),
            signature: None,
            payload: Some(payload),
        },
    )
    .await?;
    Ok(match settled {
        Settled::Now(txn) => txn.notes.get("held_for_finance").is_none(),
        Settled::Already => false,
    })
}
