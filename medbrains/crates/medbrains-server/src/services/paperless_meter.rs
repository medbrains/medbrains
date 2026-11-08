//! Daily paperless-meter pass: every hospital's last week of clinical
//! documents, signatures and paper recounted into `paperless_daily`
//! (`medbrains_analytics::paperless`). Idempotent, so the pass that runs at
//! every start as well as every day changes nothing it has already counted.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 24 * 3600;

/// Run the pass now and then once a day, for the life of the server.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match medbrains_analytics::paperless::run_daily(&pool).await {
                Ok(counted) => tracing::info!(counted, "paperless meter recounted"),
                Err(error) => tracing::error!(%error, "paperless meter pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}
