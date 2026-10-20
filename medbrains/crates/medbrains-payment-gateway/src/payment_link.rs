//! Razorpay Payment Links — the one client every pay-now link goes through
//! (a UHI booking, a home delivery). A link is made for a
//! `payment_gateway_transactions` row: its id becomes the row's
//! `gateway_order_id`, so the `payment_link.paid` webhook finds that row and
//! only that row, and its URL goes on the row's `notes.payment_link`.
//!
//! Request and response fields per Razorpay's Payment Links API docs
//! (`POST /v1/payment_links`); not exercised against the live service.

use async_trait::async_trait;
use medbrains_core::payment::RAZORPAY_LINK_EVENT;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub use crate::razorpay::API_BASE_OVERRIDE;
use crate::razorpay_link_credentials;

/// What a link is for.
#[derive(Debug)]
pub struct LinkRequest {
    /// The `payment_gateway_transactions` row it pays; Razorpay's
    /// `reference_id`, unique per link, so a retry cannot make a second.
    pub payment_transaction_id: Uuid,
    pub amount: Decimal,
    pub description: String,
    /// When the link stops working (Unix seconds).
    pub expire_by: Option<i64>,
    /// The payer's phone, prefilled at checkout.
    pub contact: Option<String>,
    pub notes: Value,
}

/// What Razorpay said.
#[derive(Debug)]
pub enum Link {
    Made { id: String, url: String },
    Refused(String),
}

fn transient(e: impl std::fmt::Display) -> HandlerError {
    HandlerError::Transient(e.to_string())
}

/// Ask Razorpay for a link. Rate limits, outages and network faults are
/// transient (the worker retries); any other refusal is an answer.
pub async fn request_link(
    ctx: &HandlerCtx,
    (key_id, key_secret): (String, String),
    req: &LinkRequest,
) -> Result<Link, HandlerError> {
    let base = crate::razorpay::api_base(ctx.secret_resolver.as_ref()).await;
    let paise = (req.amount * Decimal::ONE_HUNDRED)
        .round()
        .to_i64()
        .filter(|p| *p > 0)
        .ok_or_else(|| HandlerError::Permanent(format!("no amount to pay: {}", req.amount)))?;
    let mut body = json!({
        "amount": paise, "currency": "INR", "accept_partial": false,
        "reference_id": req.payment_transaction_id.to_string(),
        "description": req.description,
        // The payer sees the link in their app; Razorpay sends nothing of its own.
        "notify": { "sms": false, "email": false }, "reminder_enable": false,
        "notes": req.notes,
    });
    if let Some(at) = req.expire_by {
        body["expire_by"] = json!(at);
    }
    if let Some(contact) = &req.contact {
        body["customer"] = json!({ "contact": contact });
    }
    let response = ctx
        .http_client
        .post(format!("{base}/payment_links"))
        .basic_auth(key_id, Some(key_secret))
        .json(&body)
        .send()
        .await
        .map_err(transient)?;
    let status = response.status();
    if status.as_u16() == 429 || status.is_server_error() {
        return Err(transient(format!("razorpay payment link: {status}")));
    }
    let answer: Value = response.json().await.unwrap_or(Value::Null);
    Ok(
        match (answer["id"].as_str(), answer["short_url"].as_str()) {
            (Some(id), Some(url)) if status.is_success() => Link::Made {
                id: id.to_owned(),
                url: url.to_owned(),
            },
            _ => Link::Refused(format!("razorpay payment link refused: {status}")),
        },
    )
}

/// File a made link on its payment row.
pub async fn record_link(
    tx: &mut Transaction<'_, Postgres>,
    payment_transaction_id: Uuid,
    link_id: &str,
    url: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET gateway_order_id = $2, status = 'created', \
                notes = notes || jsonb_build_object('payment_link', $3::text), updated_at = now() \
          WHERE id = $1",
    )
    .bind(payment_transaction_id)
    .bind(link_id)
    .bind(url)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn begin(ctx: &HandlerCtx) -> Result<Transaction<'static, Postgres>, HandlerError> {
    let mut tx = ctx.pool.begin().await.map_err(transient)?;
    medbrains_db::pool::set_tenant_context(&mut tx, &ctx.tenant_id)
        .await
        .map_err(transient)?;
    Ok(tx)
}

/// `payment.razorpay.create_link` — the link for a payment row that needs
/// nothing more than the link (a home delivery). The amount is the row's.
#[derive(Debug, Default)]
pub struct PaymentLinkHandler;

#[async_trait]
impl Handler for PaymentLinkHandler {
    fn event_type(&self) -> &'static str {
        RAZORPAY_LINK_EVENT
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let id = payload["internal_payment_id"]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".to_owned()))?;
        let mut tx = begin(ctx).await?;
        let row: Option<(Decimal, String)> =
            sqlx::query_as("SELECT amount, status FROM payment_gateway_transactions WHERE id = $1")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(transient)?;
        let credentials =
            razorpay_link_credentials(&mut tx, ctx.secret_resolver.as_ref(), &ctx.tenant_id)
                .await
                .map_err(transient)?;
        tx.commit().await.map_err(transient)?;
        let Some((amount, _)) = row.filter(|(_, s)| s == "pending_gateway") else {
            return Ok(json!({ "skipped": "no longer waiting for a link" }));
        };
        let link = match credentials {
            Some(c) => {
                let req = LinkRequest {
                    payment_transaction_id: id,
                    amount,
                    description: payload["description"]
                        .as_str()
                        .unwrap_or("MedBrains payment")
                        .to_owned(),
                    expire_by: None,
                    contact: payload["contact"].as_str().map(str::to_owned),
                    notes: json!({ "tenant_id": ctx.tenant_id.to_string(),
                                   "internal_payment_id": id.to_string() }),
                };
                request_link(ctx, c, &req).await?
            }
            None => Link::Refused("online payment is no longer set up".to_owned()),
        };
        let mut tx = begin(ctx).await?;
        match &link {
            Link::Made { id: link_id, url } => {
                record_link(&mut tx, id, link_id, url)
                    .await
                    .map_err(transient)?;
            }
            Link::Refused(why) => {
                tracing::warn!(payment = %id, %why, "payment link refused");
                sqlx::query(
                    "UPDATE payment_gateway_transactions SET status = 'failed', \
                            error_description = $2, updated_at = now() WHERE id = $1",
                )
                .bind(id)
                .bind(why)
                .execute(&mut *tx)
                .await
                .map_err(transient)?;
            }
        }
        tx.commit().await.map_err(transient)?;
        Ok(json!({ "payment_transaction_id": id, "made": matches!(link, Link::Made { .. }) }))
    }
}
