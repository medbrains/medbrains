//! Daily revenue-leakage pass: every hospital's done-but-unbilled orders onto
//! the charge attention queue (`medbrains_billing::leakage`). Idempotent, so
//! the pass that runs at every start as well as every day repeats nothing.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 24 * 3600;

/// Run the pass now and then once a day, for the life of the server.
/// Runs on `spawn_forever`: the loop cannot return and stop the pass unseen.
pub fn spawn(pool: PgPool) {
    medbrains_server_core::background::spawn_forever(module_path!(), async move {
        loop {
            match medbrains_billing::leakage::run_daily(&pool).await {
                Ok(queued) if queued > 0 => tracing::warn!(queued, "unbilled orders queued"),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "unbilled-orders pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}
