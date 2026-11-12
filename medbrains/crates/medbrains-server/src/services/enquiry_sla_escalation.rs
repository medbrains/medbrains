//! Callback SLA escalation.
//!
//! `mkt_tasks.escalated_at` and `mkt_pipeline_stages.sla_minutes` have both
//! existed since the marketing schema landed and neither was ever written or
//! read. So a callback owed since Tuesday looked exactly like one owed since
//! ten minutes ago: same row, same colour, sorted only by age. The desk had no
//! way to tell a queue that is merely busy from one that has quietly dropped
//! somebody.
//!
//! # Why this is worth a background pass
//!
//! The breach could be computed on read — the worklist already knows `due_at`.
//! It is written down instead because escalating twice is worse than not
//! escalating: `escalated_at` is what makes the notification fire once, and
//! what lets "how many did we breach last month" be answered at all. A
//! computed-on-read breach leaves no history, so the desk can never see
//! whether it is getting better.
//!
//! # Who hears about it
//!
//! The assigned agent's supervisor, because telling the agent who already
//! missed it is not escalation. An unassigned callback has no supervisor to
//! find, so it is still marked — the worklist is the guaranteed surface and
//! the notification is only the nudge — and counted separately, since an
//! unassigned breach is the one nobody owns.
//!
//! Modelled on `critical_alert_escalation`: same spawn shape, same
//! escalate-once discipline. Not merged with it, because a lab critical value
//! is a patient-safety event on a fifteen-minute clock and a missed callback
//! is a commercial one — sharing a pass would eventually mean sharing a
//! failure.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 300;

/// Grace period when the enquiry's stage does not name one.
///
/// An hour past due. Short enough that a morning's neglect surfaces before
/// lunch, long enough that a desk working steadily through a queue is not
/// told it is failing.
const DEFAULT_SLA_MINUTES: i32 = 60;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_breached_callbacks(&pool).await {
                Ok(count) if count > 0 => {
                    tracing::warn!(escalated = count, "callbacks breached their SLA");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "callback SLA escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct BreachedCallback {
    id: Uuid,
    tenant_id: Uuid,
    contact_id: Uuid,
    display_name: Option<String>,
    supervisor_id: Option<Uuid>,
    overdue_minutes: i64,
}

/// One pass. Returns how many callbacks were escalated.
///
/// # Errors
/// Propagates the database error rather than swallowing it — a pass that
/// cannot read the queue must not report zero breaches, because zero is what
/// a healthy desk also reports.
async fn escalate_breached_callbacks(pool: &PgPool) -> Result<u64, AppError> {
    // Marked and collected in one statement. Doing it as a SELECT then an
    // UPDATE would let two passes overlap on a slow database and notify the
    // same supervisor twice about the same callback.
    let breached = sqlx::query_as::<_, BreachedCallback>(
        "WITH due AS ( \
            SELECT t.id \
            FROM mkt_tasks t \
            JOIN mkt_contacts c ON c.id = t.contact_id AND c.tenant_id = t.tenant_id \
            LEFT JOIN mkt_pipeline_stages s \
                   ON s.id = c.stage_id AND s.tenant_id = c.tenant_id \
            WHERE t.status = 'open' AND t.escalated_at IS NULL \
              AND now() > t.due_at \
                  + make_interval(mins => COALESCE(s.sla_minutes, $1)) \
            LIMIT 500 \
         ) \
         UPDATE mkt_tasks t SET escalated_at = now() \
         FROM due \
         JOIN mkt_tasks t2 ON t2.id = due.id \
         JOIN mkt_contacts c ON c.id = t2.contact_id AND c.tenant_id = t2.tenant_id \
         LEFT JOIN users a ON a.id = t2.assigned_to \
         WHERE t.id = due.id \
         RETURNING t.id, t.tenant_id, t.contact_id, c.display_name, \
                   a.supervisor_id, \
                   EXTRACT(EPOCH FROM (now() - t.due_at))::bigint / 60 \
                       AS overdue_minutes",
    )
    .bind(DEFAULT_SLA_MINUTES)
    .fetch_all(pool)
    .await?;

    if breached.is_empty() {
        return Ok(0);
    }

    let escalated = breached.len() as u64;
    let unowned = breached.iter().filter(|b| b.supervisor_id.is_none()).count();

    for callback in &breached {
        // No supervisor, no recipient. The row is still marked, so the
        // worklist shows it — the notification is the nudge, not the record.
        let Some(supervisor_id) = callback.supervisor_id else {
            continue;
        };
        let who = callback.display_name.as_deref().unwrap_or("An enquiry");
        let hours = callback.overdue_minutes / 60;

        // A notification failure must not abandon the rest of the batch, and
        // must not roll back the marks — an unsent nudge is recoverable, a
        // callback silently un-escalated is not.
        if let Err(error) = sqlx::query(
            "INSERT INTO notifications \
                (tenant_id, user_id, kind, title, body, category, \
                 entity_type, entity_id, action_url) \
             VALUES ($1, $2, 'sla_breach', $3, $4, 'marketing', \
                     'mkt_contact', $5, '/marketing#callbacks')",
        )
        .bind(callback.tenant_id)
        .bind(supervisor_id)
        .bind("Callback overdue")
        .bind(format!(
            "{who} has been waiting {} for a call back.",
            if hours >= 1 {
                format!("{hours} hour{}", if hours == 1 { "" } else { "s" })
            } else {
                format!("{} minutes", callback.overdue_minutes)
            }
        ))
        .bind(callback.contact_id)
        .execute(pool)
        .await
        {
            tracing::error!(%error, callback = %callback.id, "could not notify about a breached callback");
        }
    }

    if unowned > 0 {
        // The ones nobody owns are the ones most likely to stay unanswered,
        // so they are named in the log rather than folded into the total.
        tracing::warn!(unowned, "breached callbacks with no assignee to escalate to");
    }

    Ok(escalated)
}
