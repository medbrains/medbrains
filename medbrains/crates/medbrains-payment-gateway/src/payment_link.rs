//! Payment links — the one client every pay-now link goes through (a UHI
//! booking, a home delivery), made by the hospital's online provider when it
//! has links. A link is made for a `payment_gateway_transactions` row: its
//! reference becomes the row's `gateway_order_id` (and the row's `gateway`
//! the provider that made it), so the provider's webhook finds that row and
//! only that row, and its URL goes on the row's `notes.payment_link`.

use async_trait::async_trait;
use medbrains_core::payment::PAYMENT_LINK_EVENT;
use medbrains_core::secrets::SecretResolver;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_server_core::error::AppError;
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::online::choose::{active_code, with_keys};
use crate::online::{Chosen, LinkAsk, ProviderError, provider_for};

/// What a link is for.
#[derive(Debug)]
pub struct LinkRequest {
    /// The `payment_gateway_transactions` row it pays; the provider's
    /// reference for the link, unique, so a retry cannot make a second.
    pub payment_transaction_id: Uuid,
    pub amount: Decimal,
    pub description: String,
    /// When the link stops working (Unix seconds).
    pub expire_by: Option<i64>,
    /// The payer's phone, prefilled at checkout.
    pub contact: Option<String>,
}

/// What the provider said.
#[derive(Debug)]
pub enum Link {
    Made { id: String, url: String },
    Refused(String),
}

fn transient(e: impl std::fmt::Display) -> HandlerError {
    HandlerError::Transient(e.to_string())
}

/// The hospital's provider, when it makes payment links and is set up.
///
/// # Errors
/// A database fault or an unreadable secret store.
pub async fn link_provider(
    tx: &mut Transaction<'_, Postgres>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
) -> Result<Option<Chosen>, AppError> {
    let (code, _) = active_code(tx, tenant_id, None).await?;
    let Some(provider) = provider_for(&code).filter(|p| p.capabilities().payment_links) else {
        return Ok(None);
    };
    Ok(with_keys(tx, secrets, tenant_id, provider)
        .await?
        .filter(|c| c.keys.missing(provider).is_empty()))
}

/// How a link may be paid: whole, or in parts (#4871).
#[derive(Debug, Clone, Copy)]
pub struct LinkTerms {
    /// The payer may pay part of the amount, several times over.
    pub accept_partial: bool,
    /// The least the first part may be, when parts are accepted.
    pub min_part: Option<Decimal>,
    /// The provider reminds the payer until the link is paid or expires.
    pub remind: bool,
}

impl LinkTerms {
    /// Paid in one go, no reminders — a booking or a delivery.
    pub const WHOLE: Self = Self {
        accept_partial: false,
        min_part: None,
        remind: false,
    };
}

fn paise(amount: Decimal) -> Option<i64> {
    (amount * Decimal::ONE_HUNDRED)
        .round()
        .to_i64()
        .filter(|p| *p > 0)
}

/// Ask the provider for a link. No answer is transient (the worker
/// retries); any other refusal is an answer.
pub async fn request_link(
    ctx: &HandlerCtx,
    chosen: &Chosen,
    req: &LinkRequest,
) -> Result<Link, HandlerError> {
    request_link_on(ctx, chosen, req, LinkTerms::WHOLE).await
}

/// [`request_link`], on the given terms.
pub async fn request_link_on(
    ctx: &HandlerCtx,
    chosen: &Chosen,
    req: &LinkRequest,
    terms: LinkTerms,
) -> Result<Link, HandlerError> {
    let amount = paise(req.amount)
        .ok_or_else(|| HandlerError::Permanent(format!("no amount to pay: {}", req.amount)))?;
    let ask = LinkAsk {
        txn_id: req.payment_transaction_id,
        tenant_id: ctx.tenant_id,
        amount_paise: amount,
        description: &req.description,
        expire_by: req.expire_by,
        contact: req.contact.as_deref(),
        accept_partial: terms.accept_partial,
        min_part_paise: terms.min_part.and_then(paise),
        remind: terms.remind,
    };
    match chosen
        .provider
        .create_payment_link(&chosen.ctx(), &ask)
        .await
    {
        Ok(made) => Ok(Link::Made {
            id: made.order_ref,
            url: made.url,
        }),
        Err(ProviderError::Unavailable(w)) => Err(transient(w)),
        Err(e) => Ok(Link::Refused(format!(
            "{} payment link refused: {}",
            chosen.provider.label(),
            e.words()
        ))),
    }
}

/// Stop a link so it can no longer be paid. An outage is transient: until
/// the provider says so the link may still be paid.
pub async fn cancel_link(chosen: &Chosen, order_ref: &str) -> Result<(), HandlerError> {
    match chosen
        .provider
        .cancel_payment_link(&chosen.ctx(), order_ref)
        .await
    {
        Ok(()) => Ok(()),
        Err(ProviderError::Unavailable(w)) => Err(transient(w)),
        Err(e) => Err(HandlerError::Permanent(e.words())),
    }
}

/// File a made link on its payment row, under the provider that made it.
pub async fn record_link(
    tx: &mut Transaction<'_, Postgres>,
    payment_transaction_id: Uuid,
    provider: &str,
    link_id: &str,
    url: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET gateway = $4, gateway_order_id = $2, \
                status = 'created', \
                notes = notes || jsonb_build_object('payment_link', $3::text), updated_at = now() \
          WHERE id = $1",
    )
    .bind(payment_transaction_id)
    .bind(link_id)
    .bind(url)
    .bind(provider)
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

/// `payment.razorpay.create_link` (the event's name predates other
/// providers; queued rows still carry it) — the link for a payment row that
/// needs nothing more than the link (a home delivery). The amount is the row's.
#[derive(Debug, Default)]
pub struct PaymentLinkHandler;

#[async_trait]
impl Handler for PaymentLinkHandler {
    fn event_type(&self) -> &'static str {
        PAYMENT_LINK_EVENT
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
        let chosen = link_provider(&mut tx, ctx.secret_resolver.as_ref(), ctx.tenant_id)
            .await
            .map_err(transient)?;
        tx.commit().await.map_err(transient)?;
        let Some((amount, _)) = row.filter(|(_, s)| s == "pending_gateway") else {
            return Ok(json!({ "skipped": "no longer waiting for a link" }));
        };
        let made = match &chosen {
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
                };
                match request_link(ctx, c, &req).await? {
                    Link::Made { id: link_id, url } => Ok((c.provider.code(), link_id, url)),
                    Link::Refused(why) => Err(why),
                }
            }
            None => Err("online payment is no longer set up".to_owned()),
        };
        let mut tx = begin(ctx).await?;
        match &made {
            Ok((provider, link_id, url)) => {
                record_link(&mut tx, id, provider, link_id, url)
                    .await
                    .map_err(transient)?;
            }
            Err(why) => {
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
        Ok(json!({ "payment_transaction_id": id, "made": made.is_ok() }))
    }
}
