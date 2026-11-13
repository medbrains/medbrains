//! Hourly pre-auth used-up sweep: every hospital's insured inpatients are
//! re-checked against their approval (`medbrains_billing::preauth_sweep`),
//! so a check the invoice trigger could not run is caught within the hour.

use std::collections::HashMap;
use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 3600;

/// Run the sweep now and then every hour, for the life of the server. Each
/// hospital's place in its visits is kept between passes, so one with more
/// visits than a pass checks is covered over the following passes.
/// Runs on `spawn_forever`: the loop cannot return and stop the pass unseen.
pub fn spawn(pool: PgPool) {
    medbrains_server_core::background::spawn_forever(module_path!(), async move {
        let mut cursors = HashMap::new();
        loop {
            match medbrains_billing::preauth_sweep::sweep_all(&pool, &mut cursors).await {
                Ok(r) if r.used_up + r.missing + r.unknown > 0 => {
                    tracing::info!(
                        checked = r.checked,
                        used_up = r.used_up,
                        missing = r.missing,
                        unknown = r.unknown,
                        trigger_failures = r.trigger_failures,
                        "pre-auth sweep complete"
                    );
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "pre-auth sweep failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}
