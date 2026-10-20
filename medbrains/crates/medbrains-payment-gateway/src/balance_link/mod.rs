//! Balance payment links (#4871): a link for what a patient owes on one bill,
//! a department's bills or all of them, paid in full or in parts, with the
//! rest taken at the counter in any mode.
//!
//! - One live link per bill: a new link for any of its bills cancels the old
//!   one at the provider first, so a stale amount is never paid.
//! - When a bill's balance falls below what a live link still asks (cash at
//!   the counter, a concession, a cancelled bill), a trigger on `invoices`
//!   queues [`REFRESH_EVENT`]; [`refresh`] cancels the link and, if anything
//!   is still owed, sends one for the new balance.
//! - Each part the patient pays posts once ([`parts`]): only the captured
//!   amount, across the link's bills oldest first, through `settle.rs`. What
//!   the bills no longer owe goes to finance as an exception — `refund_due`
//!   when they were already settled.
//!
//! Links are made by the counter's (or hospital's) online provider through
//! the `OnlineProvider` trait (#4884) — any provider whose capabilities
//! include `payment_links`; others answer 422.

pub mod issue;
pub mod message;
pub mod parts;
pub mod provider;
pub mod refresh;
pub mod routes;
pub mod settings;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

/// The outbox event a stale link raises (queued by the `invoices` trigger).
pub const REFRESH_EVENT: &str = "payment.balance_link.refresh";

/// A link that may still take money.
pub const LIVE_SQL: &str = "('pending', 'created', 'partially_paid')";

/// A balance link as the screens show it. `status` reads `expired` once the
/// expiry has passed, whether or not the provider has said so yet.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PaymentLinkView {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub invoice_ids: Vec<Uuid>,
    pub scope: String,
    pub lane: Option<String>,
    pub amount: Decimal,
    pub amount_paid: Decimal,
    pub accept_partial: bool,
    pub min_part_amount: Option<Decimal>,
    /// `pending` | `created` | `partially_paid` | `paid` | `expired` |
    /// `cancelled` | `failed`.
    pub status: String,
    pub provider: String,
    pub short_url: Option<String>,
    pub expires_at: DateTime<Utc>,
    /// `sms` | `whatsapp` | `copy` | `portal`.
    pub channel: String,
    pub sent_count: i32,
    pub last_sent_at: Option<DateTime<Utc>>,
    pub replaces_id: Option<Uuid>,
    /// Why it stopped: `replaced`, `settled`, `cancelled_by_staff`…
    pub end_reason: Option<String>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `SELECT … FROM payment_links l`, as [`PaymentLinkView`].
pub const VIEW_SELECT: &str = "SELECT l.id, l.patient_id, l.invoice_ids, l.scope, l.lane, \
        l.amount, l.amount_paid, l.accept_partial, l.min_part_amount, \
        CASE WHEN l.status IN ('created', 'partially_paid') AND l.expires_at < now() \
             THEN 'expired' ELSE l.status END AS status, \
        l.provider, l.short_url, l.expires_at, l.channel, l.sent_count, l.last_sent_at, \
        l.replaces_id, l.end_reason, l.error, l.created_at \
   FROM payment_links l";

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// One link, as the screens show it.
///
/// # Errors
/// A database fault, or no such link.
pub async fn view(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<PaymentLinkView, medbrains_server_core::error::AppError> {
    sqlx::query_as::<_, PaymentLinkView>(&format!(
        "{VIEW_SELECT} WHERE l.tenant_id = $1 AND l.id = $2 AND l.deleted_at IS NULL"
    ))
    .bind(tenant_id)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(medbrains_server_core::error::AppError::NotFound)
}

/// What the link's bills still owe together (issued and part-paid bills).
///
/// # Errors
/// A database fault.
pub async fn bills_due(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_ids: &[Uuid],
) -> Result<Decimal, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) FROM invoices \
          WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL \
            AND status IN ('issued', 'partially_paid')",
    )
    .bind(tenant_id)
    .bind(invoice_ids)
    .fetch_one(&mut **tx)
    .await
}

/// Close the payment row a link hangs on once the link takes no more money.
/// The money is on the parts' own rows; `expired` keeps this one out of the
/// captured and pending totals, and `link_closed` says how it ended.
///
/// # Errors
/// A database fault.
pub async fn close_parent(
    tx: &mut Tx<'_>,
    txn_id: Option<Uuid>,
    how: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'expired', \
                notes = notes || jsonb_build_object('link_closed', $2::text) \
          WHERE id = $1 AND status IN ('pending_gateway', 'created')",
    )
    .bind(txn_id)
    .bind(how)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
