//! `payment.balance_link.refresh` — a live link asks for more than its bills
//! still owe (queued by the `invoices` trigger in migration 1165).
//!
//! The stale link is cancelled at the provider first, so the old amount can
//! never be paid; then, if anything is still owed, a link for the new balance
//! goes out on the same channel. Nothing owed: the link simply closes
//! (`settled`) — cash at the counter finished the bill.

use async_trait::async_trait;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::issue::{LinkSpec, issue};
use super::message::Channel;
use super::provider::{begin, cancel_at};
use super::{LIVE_SQL, REFRESH_EVENT, bills_due, close_parent};
use crate::online::OnlineError;

#[derive(Debug, sqlx::FromRow)]
struct Stale {
    patient_id: Uuid,
    invoice_ids: Vec<Uuid>,
    scope: String,
    lane: Option<String>,
    amount: Decimal,
    amount_paid: Decimal,
    status: String,
    end_reason: Option<String>,
    provider: String,
    provider_link_id: Option<String>,
    payment_transaction_id: Option<Uuid>,
    channel: String,
    created_by: Option<Uuid>,
    replaced: bool,
}

fn transient(e: impl std::fmt::Display) -> HandlerError {
    HandlerError::Transient(e.to_string())
}

/// An outage is retried; a refusal (consent withdrawn, no phone, a provider
/// without links) is an answer.
fn handler_error(e: OnlineError) -> HandlerError {
    match e {
        OnlineError::App(AppError::ServiceUnavailable(why)) => HandlerError::Transient(why),
        OnlineError::Unavailable { detail, .. } => HandlerError::Transient(detail),
        OnlineError::App(other) => HandlerError::Permanent(other.to_string()),
        OnlineError::Unsupported { provider, .. } => {
            HandlerError::Permanent(format!("{provider} makes no payment links"))
        }
    }
}

#[derive(Debug, Default)]
pub struct BalanceLinkRefreshHandler;

#[async_trait]
impl Handler for BalanceLinkRefreshHandler {
    fn event_type(&self) -> &'static str {
        REFRESH_EVENT
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let id = payload["link_id"]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| HandlerError::Permanent("missing link_id".to_owned()))?;
        let (link, due) = read(ctx, id).await.map_err(transient)?;
        let Some(link) = link else {
            return Ok(json!({ "skipped": "no such link" }));
        };
        let live = matches!(link.status.as_str(), "created" | "partially_paid");
        if live {
            if link.amount - link.amount_paid <= due {
                return Ok(json!({ "skipped": "the link still fits the balance" }));
            }
            cancel(ctx, id, &link, due).await?;
        } else if link.end_reason.as_deref() != Some("balance_changed") || link.replaced {
            return Ok(json!({ "skipped": "the link was already dealt with" }));
        }
        if due <= Decimal::ZERO {
            return Ok(json!({ "link_id": id, "closed": "settled" }));
        }
        replace(ctx, id, &link).await
    }
}

async fn read(ctx: &HandlerCtx, id: Uuid) -> Result<(Option<Stale>, Decimal), AppError> {
    let mut tx = begin(ctx).await?;
    let link = sqlx::query_as::<_, Stale>(
        "SELECT l.patient_id, l.invoice_ids, l.scope, l.lane, l.amount, l.amount_paid, l.status, \
                l.end_reason, l.provider, l.provider_link_id, l.payment_transaction_id, l.channel, \
                l.created_by, \
                EXISTS (SELECT 1 FROM payment_links r WHERE r.replaces_id = l.id) AS replaced \
           FROM payment_links l WHERE l.tenant_id = $1 AND l.id = $2 AND l.deleted_at IS NULL",
    )
    .bind(ctx.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    let due = match &link {
        Some(l) => bills_due(&mut tx, ctx.tenant_id, &l.invoice_ids).await?,
        None => Decimal::ZERO,
    };
    tx.commit().await?;
    Ok((link, due))
}

/// Cancel at the provider, then close it here: `settled` when nothing is
/// owed, `balance_changed` when a replacement follows.
async fn cancel(
    ctx: &HandlerCtx,
    id: Uuid,
    link: &Stale,
    due: Decimal,
) -> Result<(), HandlerError> {
    if let Some(provider_id) = &link.provider_link_id {
        // Cancelled now or already closed: either way it takes no more money.
        cancel_at(ctx, &link.provider, provider_id)
            .await
            .map_err(|e| match e {
                AppError::ServiceUnavailable(w) => HandlerError::Transient(w),
                other => HandlerError::Permanent(other.to_string()),
            })?;
    }
    let why = if due <= Decimal::ZERO {
        "settled"
    } else {
        "balance_changed"
    };
    let mut tx = begin(ctx).await.map_err(transient)?;
    sqlx::query(&format!(
        "UPDATE payment_links SET status = 'cancelled', end_reason = $2 \
          WHERE id = $1 AND status IN {LIVE_SQL}"
    ))
    .bind(id)
    .bind(why)
    .execute(&mut *tx)
    .await
    .map_err(transient)?;
    close_parent(&mut tx, link.payment_transaction_id, why)
        .await
        .map_err(transient)?;
    tx.commit().await.map_err(transient)
}

/// A link for what the bills still owe, on the channel the old one went by.
async fn replace(ctx: &HandlerCtx, id: Uuid, link: &Stale) -> Result<Value, HandlerError> {
    let mut tx = begin(ctx).await.map_err(transient)?;
    let open: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM invoices WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL \
            AND status IN ('issued', 'partially_paid') AND total_amount > paid_amount",
    )
    .bind(ctx.tenant_id)
    .bind(&link.invoice_ids)
    .fetch_all(&mut *tx)
    .await
    .map_err(transient)?;
    tx.commit().await.map_err(transient)?;
    let spec = LinkSpec {
        tenant_id: ctx.tenant_id,
        actor: link.created_by,
        patient_id: link.patient_id,
        scope: link.scope.clone(),
        lane: link.lane.clone(),
        invoice_ids: open,
        amount: None,
        channel: Channel::stored(&link.channel),
        replaces: Some(id),
        station_id: None,
        expiry_days: None,
    };
    let made = issue(ctx, &spec).await.map_err(handler_error)?;
    Ok(json!({ "link_id": id, "replaced_by": made.id }))
}
