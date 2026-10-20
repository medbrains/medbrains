//! Making a balance link, or sending the live one again.
//!
//! In order, so that two links for one bill are never both payable:
//! 1. read the bills, the terms and any live link on these bills;
//! 2. the same bills and amount on a live link → send that one again;
//! 3. otherwise cancel every live link on these bills at the provider —
//!    stopping if one cannot be cancelled;
//! 4. under the patient's lock, close those links and open the new one;
//! 5. ask the provider for it, file its URL and queue the message.

use std::{sync::Arc, time::Duration};

use chrono::{DateTime, Utc};
use medbrains_outbox::handler::{HandlerCtx, HandlerError};
use medbrains_server_core::{error::AppError, state::AppState};
use rust_decimal::Decimal;
use serde_json::json;
use uuid::Uuid;

use super::message::{self, Channel, LinkMessage};
use super::settings::{self, LinkSettings};
use super::{LIVE_SQL, PaymentLinkView, close_parent, view};
use crate::payment_link::{
    Link, LinkRequest, LinkTerms, cancel_link, record_link, request_link_on,
};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
type Keys = (String, String);

/// Inferred: long enough for a provider round trip, short enough that a link
/// abandoned by a crashed request does not block the bill for long.
const PENDING_GRACE_SECS: i64 = 120;
/// Inferred, as checkout's: a cashier is not left watching a spinner.
const PROVIDER_TIMEOUT: Duration = Duration::from_secs(15);

/// What to make a link for. The caller has checked who may.
#[derive(Debug, Clone)]
pub struct LinkSpec {
    pub tenant_id: Uuid,
    pub actor: Option<Uuid>,
    pub patient_id: Uuid,
    /// `department` | `all` | `bills`.
    pub scope: String,
    pub lane: Option<String>,
    pub invoice_ids: Vec<Uuid>,
    /// `None` asks for everything due on the bills.
    pub amount: Option<Decimal>,
    pub channel: Channel,
    /// The link this one takes over from, when it is a replacement.
    pub replaces: Option<Uuid>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct Live {
    id: Uuid,
    provider_link_id: Option<String>,
    invoice_ids: Vec<Uuid>,
    amount: Decimal,
    amount_paid: Decimal,
    expires_at: DateTime<Utc>,
    status: String,
    created_at: DateTime<Utc>,
}

struct Plan {
    settings: LinkSettings,
    amount: Decimal,
    to: Option<String>,
    keys: Keys,
    live: Vec<Live>,
}

/// A provider context for a request (the outbox worker builds its own).
// ponytail: the link client takes an outbox context; #4884's provider trait
// takes this place.
#[must_use]
pub fn ctx_for(state: &AppState, tenant_id: Uuid, actor: Option<Uuid>) -> HandlerCtx {
    HandlerCtx {
        pool: state.db.clone(),
        tenant_id,
        event_id: Uuid::new_v4(),
        event_type: "payment.balance_link.issue".to_owned(),
        actor_user_id: actor,
        attempts: 0,
        secret_resolver: Arc::clone(&state.secret_resolver),
        http_client: reqwest::Client::builder()
            .timeout(PROVIDER_TIMEOUT)
            .build()
            .unwrap_or_default(),
        object_store: Arc::clone(&state.documents_store),
    }
}

pub(super) async fn begin(ctx: &HandlerCtx) -> Result<Tx<'static>, AppError> {
    let mut tx = ctx.pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &ctx.tenant_id).await?;
    Ok(tx)
}

pub(super) fn provider_fault(e: &HandlerError) -> AppError {
    AppError::ServiceUnavailable(format!("The payment provider could not be reached: {e}"))
}

/// Make a link for `spec`, or send the live one again; see the module docs.
///
/// # Errors
/// The bills, amount or channel refused; online payment not set up; the
/// provider unreachable or refusing; a database fault.
pub async fn issue(ctx: &HandlerCtx, spec: &LinkSpec) -> Result<PaymentLinkView, AppError> {
    let plan = plan(ctx, spec).await?;
    if let Some(same) = reusable(&plan, spec) {
        return resend(ctx, spec, plan.to.as_deref(), same.id).await;
    }
    for old in &plan.live {
        if let Some(link_id) = &old.provider_link_id {
            // Cancelled now or already closed: either way it takes no more money.
            cancel_link(ctx, plan.keys.clone(), link_id)
                .await
                .map_err(|e| provider_fault(&e))?;
        }
    }
    let (link_id, txn_id, expires_at) = open(ctx, spec, &plan).await?;
    let req = LinkRequest {
        payment_transaction_id: txn_id,
        amount: plan.amount,
        description: "Hospital bill balance".to_owned(),
        expire_by: Some(expires_at.timestamp()),
        contact: plan.to.clone(),
        notes: json!({ "tenant_id": spec.tenant_id.to_string(),
                       "payment_link_id": link_id.to_string() }),
    };
    let made = request_link_on(ctx, plan.keys.clone(), &req, terms(&plan)).await;
    finish(ctx, spec, &plan, (link_id, txn_id), made).await
}

fn terms(plan: &Plan) -> LinkTerms {
    let min = plan.settings.min_part();
    let partial = plan.settings.accept_partial && plan.amount > min;
    LinkTerms {
        accept_partial: partial,
        min_part: (partial && min > Decimal::ZERO).then_some(min),
        remind: plan.settings.reminders,
    }
}

/// The live link that already asks for exactly this: same bills, same
/// amount still open, not expired.
fn reusable<'a>(plan: &'a Plan, spec: &LinkSpec) -> Option<&'a Live> {
    let [only] = plan.live.as_slice() else {
        return None;
    };
    let mut theirs = only.invoice_ids.clone();
    let mut ours = spec.invoice_ids.clone();
    theirs.sort_unstable();
    ours.sort_unstable();
    (only.status != "pending"
        && theirs == ours
        && only.amount - only.amount_paid == plan.amount
        && only.expires_at > Utc::now())
    .then_some(only)
}

#[derive(sqlx::FromRow)]
struct Bill {
    status: String,
    balance: Decimal,
}

async fn plan(ctx: &HandlerCtx, spec: &LinkSpec) -> Result<Plan, AppError> {
    let mut tx = begin(ctx).await?;
    let settings = settings::load(&mut tx, spec.tenant_id).await?;
    let bills = sqlx::query_as::<_, Bill>(
        "SELECT status::text AS status, total_amount - paid_amount AS balance FROM invoices \
          WHERE tenant_id = $1 AND patient_id = $2 AND id = ANY($3) AND deleted_at IS NULL",
    )
    .bind(spec.tenant_id)
    .bind(spec.patient_id)
    .bind(&spec.invoice_ids)
    .fetch_all(&mut *tx)
    .await?;
    if bills.is_empty() || bills.len() != spec.invoice_ids.len() {
        return Err(AppError::BadRequest("Pick the patient's own open bills".to_owned()));
    }
    if bills.iter().any(|b| b.status == "draft") {
        return Err(AppError::BadRequest(
            "Issue the bills before sending a link — a draft can still change".to_owned(),
        ));
    }
    if bills
        .iter()
        .any(|b| !matches!(b.status.as_str(), "issued" | "partially_paid") || b.balance <= Decimal::ZERO)
    {
        return Err(AppError::BadRequest("Nothing is due on one of these bills".to_owned()));
    }
    let due: Decimal = bills.iter().map(|b| b.balance).sum();
    let amount = spec.amount.map_or(due, |a| a.round_dp(2));
    check_amount(amount, due, settings.min_part())?;
    let to = message::recipient(&mut tx, spec.tenant_id, spec.patient_id, spec.channel).await?;
    let keys = crate::razorpay_link_credentials(&mut tx, ctx.secret_resolver.as_ref(), &spec.tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::ServiceUnavailable(
                "Online payment is not set up at this hospital, so no link can be made".to_owned(),
            )
        })?;
    let live = live_on(&mut tx, spec.tenant_id, &spec.invoice_ids).await?;
    tx.commit().await?;
    let grace = Utc::now() - chrono::Duration::seconds(PENDING_GRACE_SECS);
    if live.iter().any(|l| l.status == "pending" && l.created_at > grace) {
        return Err(AppError::Conflict(
            "A link for these bills is being made — try again in a moment".to_owned(),
        ));
    }
    Ok(Plan {
        settings,
        amount,
        to,
        keys,
        live,
    })
}

fn check_amount(amount: Decimal, due: Decimal, min: Decimal) -> Result<(), AppError> {
    if amount <= Decimal::ZERO || amount > due {
        return Err(AppError::BadRequest(format!(
            "The link can ask for up to Rs {due}"
        )));
    }
    if amount < due && amount < min {
        return Err(AppError::BadRequest(format!(
            "A part must be at least Rs {min}"
        )));
    }
    Ok(())
}

async fn live_on(tx: &mut Tx<'_>, tenant_id: Uuid, invoice_ids: &[Uuid]) -> Result<Vec<Live>, AppError> {
    Ok(sqlx::query_as::<_, Live>(&format!(
        "SELECT id, provider_link_id, invoice_ids, amount, amount_paid, expires_at, status, \
                created_at \
           FROM payment_links WHERE tenant_id = $1 AND invoice_ids && $2 \
            AND status IN {LIVE_SQL} AND deleted_at IS NULL"
    ))
    .bind(tenant_id)
    .bind(invoice_ids)
    .fetch_all(&mut **tx)
    .await?)
}

async fn resend(
    ctx: &HandlerCtx,
    spec: &LinkSpec,
    to: Option<&str>,
    id: Uuid,
) -> Result<PaymentLinkView, AppError> {
    let mut tx = begin(ctx).await?;
    let link = view(&mut tx, spec.tenant_id, id).await?;
    if let (Some(to), Some(url)) = (to, link.short_url.as_deref()) {
        let n: i32 = sqlx::query_scalar(
            "UPDATE payment_links SET sent_count = sent_count + 1, last_sent_at = now(), \
                    channel = $2 WHERE id = $1 RETURNING sent_count",
        )
        .bind(id)
        .bind(spec.channel.as_str())
        .fetch_one(&mut *tx)
        .await?;
        let m = message_for(&link, url);
        message::queue(&mut tx, spec.tenant_id, (spec.channel, to, n), &m).await?;
    }
    let link = view(&mut tx, spec.tenant_id, id).await?;
    tx.commit().await?;
    Ok(link)
}

fn message_for<'a>(link: &PaymentLinkView, url: &'a str) -> LinkMessage<'a> {
    LinkMessage {
        link_id: link.id,
        patient_id: link.patient_id,
        amount: link.amount - link.amount_paid,
        url,
        expires_at: link.expires_at,
        partial: link.accept_partial,
    }
}

/// Close the links being replaced and open the new one, under the patient's
/// lock; refuse if another link appeared on these bills meanwhile.
async fn open(
    ctx: &HandlerCtx,
    spec: &LinkSpec,
    plan: &Plan,
) -> Result<(Uuid, Uuid, DateTime<Utc>), AppError> {
    let mut tx = begin(ctx).await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('plink:' || $1::text))")
        .bind(spec.patient_id)
        .execute(&mut *tx)
        .await?;
    let now_live = live_on(&mut tx, spec.tenant_id, &spec.invoice_ids).await?;
    if now_live.iter().any(|l| !plan.live.iter().any(|p| p.id == l.id)) {
        return Err(AppError::Conflict(
            "Another link was just made for these bills — refresh and try again".to_owned(),
        ));
    }
    let old: Vec<Uuid> = plan.live.iter().map(|l| l.id).collect();
    let parents: Vec<Option<Uuid>> = sqlx::query_scalar(&format!(
        "UPDATE payment_links SET status = CASE WHEN status = 'pending' THEN 'failed' \
                ELSE 'cancelled' END, end_reason = 'replaced' \
          WHERE tenant_id = $1 AND id = ANY($2) AND status IN {LIVE_SQL} \
          RETURNING payment_transaction_id"
    ))
    .bind(spec.tenant_id)
    .bind(&old)
    .fetch_all(&mut *tx)
    .await?;
    for parent in parents {
        close_parent(&mut tx, parent, "replaced").await?;
    }
    let txn_id: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
           (tenant_id, gateway, gateway_order_id, amount, currency, status, created_by, notes) \
         VALUES ($1, 'razorpay', '', $2, 'INR', 'pending_gateway', $3, \
                 jsonb_build_object('purpose', 'balance_link')) RETURNING id",
    )
    .bind(spec.tenant_id)
    .bind(plan.amount)
    .bind(spec.actor)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE payment_gateway_transactions SET idempotency_key = id::text WHERE id = $1")
        .bind(txn_id)
        .execute(&mut *tx)
        .await?;
    let t = terms(plan);
    let (link_id, expires_at): (Uuid, DateTime<Utc>) = sqlx::query_as(
        "INSERT INTO payment_links (tenant_id, patient_id, invoice_ids, scope, lane, amount, \
                accept_partial, min_part_amount, status, provider, expires_at, channel, \
                payment_transaction_id, replaces_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'razorpay', \
                 now() + make_interval(days => $9), $10, $11, $12, $13) \
         RETURNING id, expires_at",
    )
    .bind(spec.tenant_id)
    .bind(spec.patient_id)
    .bind(&spec.invoice_ids)
    .bind(&spec.scope)
    .bind(spec.lane.as_deref())
    .bind(plan.amount)
    .bind(t.accept_partial)
    .bind(t.min_part)
    .bind(i32::try_from(plan.settings.expiry_days()).unwrap_or(7))
    .bind(spec.channel.as_str())
    .bind(txn_id)
    .bind(spec.replaces.or_else(|| old.first().copied()))
    .bind(spec.actor)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((link_id, txn_id, expires_at))
}

async fn finish(
    ctx: &HandlerCtx,
    spec: &LinkSpec,
    plan: &Plan,
    (link_id, txn_id): (Uuid, Uuid),
    made: Result<Link, HandlerError>,
) -> Result<PaymentLinkView, AppError> {
    let mut tx = begin(ctx).await?;
    let (provider_id, url) = match made {
        Ok(Link::Made { id, url }) => (id, url),
        Ok(Link::Refused(why)) => return failed(tx, (link_id, txn_id), why).await,
        Err(e) => {
            let why = format!("the payment provider could not be reached: {e}");
            return failed(tx, (link_id, txn_id), why).await;
        }
    };
    record_link(&mut tx, txn_id, &provider_id, &url).await?;
    let sends = plan.to.is_some();
    sqlx::query(
        "UPDATE payment_links SET status = 'created', provider_link_id = $2, short_url = $3, \
                sent_count = $4, last_sent_at = CASE WHEN $4 > 0 THEN now() END \
          WHERE id = $1",
    )
    .bind(link_id)
    .bind(&provider_id)
    .bind(&url)
    .bind(i32::from(sends))
    .execute(&mut *tx)
    .await?;
    let link = view(&mut tx, spec.tenant_id, link_id).await?;
    if let Some(to) = plan.to.as_deref() {
        let m = message_for(&link, &url);
        message::queue(&mut tx, spec.tenant_id, (spec.channel, to, 1), &m).await?;
    }
    // The balance may have moved while the provider was asked.
    sqlx::query("SELECT public.payment_link_queue_if_stale($1)")
        .bind(link_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(link)
}

/// The provider made no link: say so on the link and its payment row.
async fn failed(
    mut tx: Tx<'static>,
    (link_id, txn_id): (Uuid, Uuid),
    why: String,
) -> Result<PaymentLinkView, AppError> {
    sqlx::query("UPDATE payment_links SET status = 'failed', error = $2 WHERE id = $1")
        .bind(link_id)
        .bind(&why)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'failed', error_description = $2 \
          WHERE id = $1",
    )
    .bind(txn_id)
    .bind(&why)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Err(AppError::ServiceUnavailable(format!("No link was made: {why}")))
}

#[cfg(test)]
mod tests {
    use super::check_amount;
    use rust_decimal::Decimal;

    #[test]
    fn a_link_asks_for_the_due_or_a_part_no_smaller_than_the_minimum() {
        let d = Decimal::from;
        assert!(check_amount(d(1000), d(1000), d(100)).is_ok());
        assert!(check_amount(d(300), d(1000), d(100)).is_ok());
        assert!(check_amount(d(50), d(1000), d(100)).is_err());
        // The whole of a small balance is never "too small".
        assert!(check_amount(d(50), d(50), d(100)).is_ok());
        assert!(check_amount(d(1001), d(1000), d(100)).is_err());
        assert!(check_amount(d(0), d(1000), d(100)).is_err());
    }
}
