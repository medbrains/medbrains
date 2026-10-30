//! Vaccination reminder SMS: once an hour, each hospital that sends them
//! queues `sms.vaccination_reminder` for every child's next dose falling
//! due within its reminder window (`medbrains_patients::immunization_schedule`).
//! The outbox idempotency key sends each dose's reminder once.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 3600;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match medbrains_patients::immunization_schedule::send_due_reminders(&pool).await {
                Ok(n) if n > 0 => {
                    tracing::info!(considered = n, "vaccination reminder pass complete");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "vaccination reminder pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}
