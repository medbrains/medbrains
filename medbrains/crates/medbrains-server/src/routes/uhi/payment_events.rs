//! The two outbox events of an online payment (see `payment`):
//! `uhi.payment_link` asks Razorpay for the hosted link (through the shared
//! `medbrains_payment_gateway::payment_link` client) and sends it in
//! `on_confirm`; `uhi.payment_captured` — queued by the gateway's webhook —
//! confirms the booking, bills it and says so in `on_confirm` and
//! `on_status`.

use async_trait::async_trait;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_payment_gateway::payment_link::{Link, LinkRequest, record_link, request_link};
use medbrains_payment_gateway::{razorpay_link_credentials, record_invoice_payment};
use medbrains_server_services::billing::{AutoChargeInput, auto_charge};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    fees::{TELECONSULT_CODE, money},
    inbound::set_state,
    outbox::tell,
    payment::{CAPTURED_EVENT, HELD, Held, LINK_EVENT, LINK_REFUSED, Tx, let_go, told},
    protocol::{
        PAYMENT_NOT_PAID, PAYMENT_ON_ORDER, PAYMENT_PAID, PAYMENT_TL_METHOD, STATE_CONFIRMED,
    },
    settings::{self, Subscription},
};
use crate::error::AppError;

fn transient(e: impl std::fmt::Display) -> HandlerError {
    HandlerError::Transient(e.to_string())
}

fn id_in(payload: &Value, key: &str) -> Result<Uuid, HandlerError> {
    payload[key]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| HandlerError::Permanent(format!("payload.{key} missing")))
}

async fn begin(ctx: &HandlerCtx) -> Result<Tx<'static>, HandlerError> {
    let mut tx = ctx.pool.begin().await.map_err(transient)?;
    medbrains_db::pool::set_tenant_context(&mut tx, &ctx.tenant_id)
        .await
        .map_err(transient)?;
    Ok(tx)
}

async fn subscription(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Subscription, HandlerError> {
    settings::load(tx, tenant_id)
        .await
        .map_err(transient)?
        .ok_or_else(|| HandlerError::Permanent("UHI is no longer set up".to_owned()))
}

/// The link for a held booking: its payment row, its amount, until the hold ends.
fn link_request(ctx: &HandlerCtx, held: &Held) -> Result<LinkRequest, HandlerError> {
    Ok(LinkRequest {
        payment_transaction_id: held.payment_transaction_id.unwrap_or_default(),
        amount: held
            .amount
            .ok_or_else(|| HandlerError::Permanent("the held booking has no amount".to_owned()))?,
        description: "Teleconsultation booked through UHI".to_owned(),
        expire_by: held.hold_expires_at.map(|t| t.timestamp()),
        contact: None,
        notes: json!({ "tenant_id": ctx.tenant_id.to_string(),
                       "uhi_transaction_id": held.id.to_string() }),
    })
}

/// `uhi.payment_link` — make the link, send `on_confirm` with it.
#[derive(Debug)]
pub struct UhiPaymentLinkHandler;

#[async_trait]
impl Handler for UhiPaymentLinkHandler {
    fn event_type(&self) -> &'static str {
        LINK_EVENT
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let id = id_in(payload, "uhi_transaction_id")?;
        let mut tx = begin(ctx).await?;
        let held = sqlx::query_as::<_, Held>(&format!("{HELD} WHERE id = $1"))
            .bind(id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(transient)?;
        let credentials = razorpay_link_credentials(&mut tx, &ctx.tenant_id)
            .await
            .map_err(transient)?;
        tx.commit().await.map_err(transient)?;
        let Some(held) = held.filter(|h| h.state == "awaiting_payment" && h.payment_uri.is_none())
        else {
            return Ok(json!({ "skipped": "no longer waiting for a link" }));
        };
        // The provider is called outside any transaction; what it answers is
        // applied only if the booking is still held.
        let link = match credentials {
            Some(c) => request_link(ctx, c, &link_request(ctx, &held)?).await?,
            None => Link::Refused("online payment is no longer set up".to_owned()),
        };
        let mut tx = begin(ctx).await?;
        let Some(held) = sqlx::query_as::<_, Held>(&format!("{HELD} WHERE id = $1 FOR UPDATE"))
            .bind(id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(transient)?
            .filter(|h| h.state == "awaiting_payment")
        else {
            return Ok(json!({ "skipped": "the hold ended meanwhile" }));
        };
        let sub = subscription(&mut tx, ctx.tenant_id).await?;
        let secrets = ctx.secret_resolver.as_ref();
        let outcome = match link {
            Link::Made { id: link_id, url } => {
                let order = linked(&mut tx, &held, &link_id, &url)
                    .await
                    .map_err(transient)?;
                let key = format!("paylink|{}", held.id);
                tell(&mut tx, secrets, &sub, told(&held, "confirm", order, key)).await
            }
            Link::Refused(why) => {
                tracing::warn!(uhi_transaction = %held.id, %why, "uhi payment link refused");
                let order = let_go(&mut tx, &held, LINK_REFUSED)
                    .await
                    .map_err(transient)?;
                sqlx::query("UPDATE uhi_transactions SET decline_reason = $2 WHERE id = $1")
                    .bind(held.id)
                    .bind(LINK_REFUSED)
                    .execute(&mut *tx)
                    .await
                    .map_err(transient)?;
                set_state(&mut tx, held.id, "declined", &order)
                    .await
                    .map_err(transient)?;
                let key = format!("paylink-refused|{}", held.id);
                tell(&mut tx, secrets, &sub, told(&held, "confirm", order, key)).await
            }
        };
        outcome.map_err(transient)?;
        tx.commit().await.map_err(transient)?;
        Ok(json!({ "uhi_transaction_id": held.id }))
    }
}

/// File the link against the payment and the booking; the order the app
/// gets, with the link to pay at.
async fn linked(tx: &mut Tx<'_>, held: &Held, link_id: &str, url: &str) -> Result<Value, AppError> {
    let paying = held.payment_transaction_id.unwrap_or_default();
    record_link(tx, paying, link_id, url).await?;
    let mut order = held.order_details.clone().unwrap_or_else(|| json!({}));
    let amount = held.amount.map(money);
    order["payment"] = json!({ "type": PAYMENT_ON_ORDER, "status": PAYMENT_NOT_PAID,
        "uri": url, "tl_method": PAYMENT_TL_METHOD,
        "params": { "transaction_id": paying, "amount": amount, "currency": "INR" },
        "time": { "timestamp": held.hold_expires_at.map(|t| t.to_rfc3339()) } });
    sqlx::query("UPDATE uhi_transactions SET payment_uri = $2, order_details = $3 WHERE id = $1")
        .bind(held.id)
        .bind(url)
        .bind(&order)
        .execute(&mut **tx)
        .await?;
    Ok(order)
}

#[derive(Debug, sqlx::FromRow)]
struct Captured {
    status: String,
    amount: Decimal,
    gateway_payment_id: Option<String>,
    notes: Value,
}

/// `uhi.payment_captured` — the payment is in: confirm, bill, tell.
#[derive(Debug)]
pub struct UhiPaymentCapturedHandler;

#[async_trait]
impl Handler for UhiPaymentCapturedHandler {
    fn event_type(&self) -> &'static str {
        CAPTURED_EVENT
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let paying = id_in(payload, "payment_transaction_id")?;
        let mut tx = begin(ctx).await?;
        let held = sqlx::query_as::<_, Held>(&format!(
            "{HELD} WHERE payment_transaction_id = $1 AND deleted_at IS NULL FOR UPDATE"
        ))
        .bind(paying)
        .fetch_optional(&mut *tx)
        .await
        .map_err(transient)?;
        let payment = sqlx::query_as::<_, Captured>(
            "SELECT status, amount, gateway_payment_id, notes \
               FROM payment_gateway_transactions WHERE id = $1",
        )
        .bind(paying)
        .fetch_optional(&mut *tx)
        .await
        .map_err(transient)?;
        let (Some(held), Some(payment)) = (held, payment) else {
            return Ok(json!({ "skipped": "not a UHI booking" }));
        };
        if payment.status != "captured" || held.payment_status.as_deref() == Some(PAYMENT_PAID) {
            return Ok(json!({ "skipped": "nothing new" }));
        }
        let sub = subscription(&mut tx, ctx.tenant_id).await?;
        let secrets = ctx.secret_resolver.as_ref();
        let mut order = held.order_details.clone().unwrap_or_else(|| json!({}));
        order["payment"]["status"] = json!(PAYMENT_PAID);
        order["payment"]["params"]["transaction_id"] = json!(payment.gateway_payment_id);
        let still_held = held.state == "awaiting_payment";
        if still_held {
            order["state"] = json!(STATE_CONFIRMED);
            bill(&mut tx, ctx.tenant_id, &held, &payment)
                .await
                .map_err(transient)?;
            set_state(&mut tx, held.id, "confirmed", &order)
                .await
                .map_err(transient)?;
        } else {
            // Paid after the hold was let go: the money is in, the slot is
            // not. The requests screen shows it as a refund to make.
            sqlx::query("UPDATE uhi_transactions SET order_details = $2 WHERE id = $1")
                .bind(held.id)
                .bind(&order)
                .execute(&mut *tx)
                .await
                .map_err(transient)?;
        }
        sqlx::query("UPDATE uhi_transactions SET payment_status = 'PAID' WHERE id = $1")
            .bind(held.id)
            .execute(&mut *tx)
            .await
            .map_err(transient)?;
        let mut answers = vec![("status", format!("paid|{}|status", held.id))];
        if still_held {
            answers.push(("confirm", format!("paid|{}|confirm", held.id)));
        }
        for (action, key) in answers {
            tell(
                &mut tx,
                secrets,
                &sub,
                told(&held, action, order.clone(), key),
            )
            .await
            .map_err(transient)?;
        }
        tx.commit().await.map_err(transient)?;
        Ok(json!({ "uhi_transaction_id": held.id, "confirmed": still_held }))
    }
}

/// Confirm the held appointment, charge the fee to the patient's bill and
/// post the payment against it. The charge is filed under the video session,
/// so telemedicine's own billing at the end of the call charges nothing more.
async fn bill(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    held: &Held,
    payment: &Captured,
) -> Result<(), AppError> {
    let patient_id: Uuid = sqlx::query_scalar(
        "UPDATE appointments SET status = 'confirmed' WHERE id = $1 RETURNING patient_id",
    )
    .bind(held.appointment_id)
    .fetch_one(&mut **tx)
    .await?;
    let decimal = |key: &str| {
        payment.notes[key]
            .as_str()
            .and_then(|s| s.parse::<Decimal>().ok())
    };
    let charged = auto_charge(
        tx,
        &tenant_id,
        AutoChargeInput {
            patient_id,
            encounter_id: None,
            charge_code: TELECONSULT_CODE.to_owned(),
            source: "opd".to_owned(),
            source_id: held
                .tele_consultation_id
                .or(held.appointment_id)
                .unwrap_or(held.id),
            quantity: 1,
            description_override: Some("Teleconsultation (paid online through UHI)".to_owned()),
            unit_price_override: Some(decimal("fee_amount").unwrap_or(payment.amount)),
            tax_percent_override: decimal("tax_percent"),
        },
    )
    .await?;
    let reference = payment.gateway_payment_id.as_deref().unwrap_or_default();
    record_invoice_payment(tx, tenant_id, charged.invoice_id, payment.amount, reference).await?;
    sqlx::query("UPDATE payment_gateway_transactions SET invoice_id = $2 WHERE id = $1")
        .bind(held.payment_transaction_id)
        .bind(charged.invoice_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query("UPDATE uhi_transactions SET invoice_id = $2 WHERE id = $1")
        .bind(held.id)
        .bind(charged.invoice_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
