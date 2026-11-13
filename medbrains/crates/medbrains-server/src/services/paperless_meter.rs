//! Nightly paperless-meter pass.
//!
//! Every quarter hour it recounts the hospitals whose clock is in the meter's
//! off-peak hour (`medbrains_analytics::paperless::NIGHTLY_HOUR`, 02:00), once
//! per hospital per local day: their last week of clinical documents,
//! signatures and paper. Nothing runs at startup, so a restart at noon adds
//! no load.

use std::collections::HashMap;
use std::time::Duration;

use sqlx::PgPool;

/// How often the pass looks for hospitals in their off-peak hour; a quarter
/// hour catches every time zone offset, whole or half hour.
const TICK_SECS: u64 = 15 * 60;

/// Look every quarter hour, for the life of the server.
/// Runs on `spawn_forever`: the loop cannot return and stop the pass unseen.
pub fn spawn(pool: PgPool) {
    medbrains_server_core::background::spawn_forever(module_path!(), async move {
        let mut done = HashMap::new();
        loop {
            tokio::time::sleep(Duration::from_secs(TICK_SECS)).await;
            match medbrains_analytics::paperless::run_nightly(&pool, &mut done).await {
                Ok(0) => {}
                Ok(counted) => tracing::info!(counted, "paperless meter recounted"),
                Err(error) => tracing::error!(%error, "paperless meter pass failed"),
            }
        }
    });
}
