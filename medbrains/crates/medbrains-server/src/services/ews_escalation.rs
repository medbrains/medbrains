//! Early-warning escalations nobody acknowledged go further — the pass
//! itself lives with the scores in `medbrains_nursing::nurse_ews_overdue`.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 60;

/// Start the pass; the handle lets the brick-job supervisor stop it when its brick goes off.
pub fn spawn(pool: PgPool) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match medbrains_nursing::nurse_ews_overdue::escalate_due(&pool).await {
                Ok(moved) if moved > 0 => {
                    tracing::warn!(
                        moved,
                        "early-warning escalations unacknowledged — escalated"
                    );
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "early-warning escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    })
}
