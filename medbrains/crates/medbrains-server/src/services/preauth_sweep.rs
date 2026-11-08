//! Hourly pre-auth used-up sweep: every hospital's insured inpatients are
//! re-checked against their approval (`medbrains_billing::preauth_sweep`),
//! so a check the invoice trigger could not run is caught within the hour.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 3600;

/// Run the sweep now and then every hour, for the life of the server.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match medbrains_billing::preauth_sweep::sweep_all(&pool).await {
                Ok(r) if r.used_up + r.unknown > 0 => {
                    tracing::info!(
                        checked = r.checked,
                        used_up = r.used_up,
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
