//! Reconciling a queued marketing message with what the outbox did to it.
//!
//! # The defect this closes
//!
//! The dispatcher mints `mkt_messages` rows at `queued` and hands the outbox
//! an event per sendable recipient. The outbox worker then does its job and
//! stamps its *own* `outbox_events.sent_at` — and nothing ever went back to
//! say so on the marketing side. So `mkt_messages.sent_at` stayed NULL
//! forever.
//!
//! That is not cosmetic. The consent gate's frequency cap counts promotional
//! messages `WHERE sent_at IS NOT NULL`, over an index built for exactly that
//! predicate. With nothing writing the column the count is always zero, so a
//! cap that is correct in every test could never fire against a real send.
//!
//! # Why a reconciliation pass and not a hook
//!
//! The outbox is generic infrastructure — pharmacy, notifications and camp
//! sync all ride on it. Teaching its worker about `mkt_messages` would put a
//! marketing table in the hot path of every other module's delivery, and the
//! next module to want the same thing would add a second branch.
//!
//! A pass that reads `outbox_events` and writes back is one-directional: the
//! outbox does not know this exists, and deleting this file breaks nothing but
//! the cap.
//!
//! # Failure is recorded as failure, not as silence
//!
//! An event in `dlq` has exhausted its retries. Leaving those rows at `queued`
//! would make a run look permanently in-flight, and would let a message that
//! never arrived count against somebody's frequency cap — punishing them for
//! a send they did not receive.

use std::time::Duration;

use sqlx::PgPool;

use crate::error::AppError;

/// Every two minutes. The outbox worker's own cadence is faster; this only has
/// to be quick enough that a cap reflects reality before the next campaign,
/// and a tighter loop would scan the same rows to no purpose.
const PASS_INTERVAL_SECS: u64 = 120;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match reconcile(&pool).await {
                Ok((sent, failed)) if sent > 0 || failed > 0 => {
                    tracing::debug!(sent, failed, "marketing message statuses reconciled");
                }
                Ok(_) => {}
                Err(error) => {
                    tracing::error!(%error, "marketing message reconciliation failed");
                }
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// One pass. Returns how many messages were marked sent and failed.
///
/// # Errors
/// Propagates the database error. A failed pass must not report zero, which is
/// also what a quiet system reports.
async fn reconcile(pool: &PgPool) -> Result<(u64, u64), AppError> {
    // `aggregate_id` is the message id — the dispatcher sets it, and its
    // string form is the idempotency key. Matching on that rather than on the
    // key keeps this a uuid comparison.
    let sent = sqlx::query(
        "UPDATE mkt_messages m SET status = 'sent', sent_at = o.sent_at \
         FROM outbox_events o \
         WHERE o.aggregate_type = 'mkt_message' AND o.aggregate_id = m.id \
           AND o.tenant_id = m.tenant_id \
           AND o.status = 'sent' AND o.sent_at IS NOT NULL \
           AND m.status = 'queued'",
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Exhausted retries. Recorded as failed rather than left queued: a run
    // that looks permanently in-flight tells an operator nothing, and a
    // message that never arrived must not count against a frequency cap.
    let failed = sqlx::query(
        "UPDATE mkt_messages m \
            SET status = 'failed', failed_at = now(), \
                failure_code = left(COALESCE(o.last_error, 'delivery failed'), 200) \
         FROM outbox_events o \
         WHERE o.aggregate_type = 'mkt_message' AND o.aggregate_id = m.id \
           AND o.tenant_id = m.tenant_id \
           AND o.status = 'dlq' AND m.status = 'queued'",
    )
    .execute(pool)
    .await?
    .rows_affected();

    if sent > 0 || failed > 0 {
        // The run's two integers are a cache of the ledger. Refreshed here so
        // the outreach list and the ledger cannot disagree about the same run.
        sqlx::query(
            "UPDATE mkt_outreach_runs r SET \
                sent_count = agg.sent, failed_count = agg.failed, \
                status = CASE WHEN agg.pending = 0 THEN 'completed' ELSE r.status END, \
                completed_at = CASE WHEN agg.pending = 0 THEN now() ELSE r.completed_at END \
             FROM ( \
                 SELECT run_id, tenant_id, \
                        count(*) FILTER (WHERE status IN ('sent', 'delivered'))::int AS sent, \
                        count(*) FILTER (WHERE status = 'failed')::int AS failed, \
                        count(*) FILTER (WHERE status = 'queued')::int AS pending \
                 FROM mkt_messages GROUP BY run_id, tenant_id \
             ) agg \
             WHERE agg.run_id = r.id AND agg.tenant_id = r.tenant_id \
               AND r.status = 'sending'",
        )
        .execute(pool)
        .await?;
    }

    Ok((sent, failed))
}
