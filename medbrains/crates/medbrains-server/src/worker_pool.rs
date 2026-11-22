//! The background workers' own database pool: small and bounded.
//!
//! Every job's first tick takes a connection at boot, and the pool then keeps
//! what it opened: PostgreSQL holds a process of 4 to 6 MB for each. Sized like
//! the request pool, idle background work held 18 of them (about 110 MB) on a
//! server nobody was using. The request pool is untouched by this.

use std::time::Duration;

use medbrains_db::pool::{DbError, PoolConfig, create_pool_with_config};
use sqlx::PgPool;

/// Most connections background work may hold: one stays with the outbox wake
/// listener for good, the rest serve the jobs' short passes.
pub const MAX_CONNECTIONS: u32 = 6;
/// Nothing is kept open for work that is not running.
pub const MIN_CONNECTIONS: u32 = 0;
/// A connection no pass has used for this long is closed.
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(60);
/// A pass waits this long for a connection: unlike a request, nobody is
/// watching it, and a late escalation beats a skipped one.
pub const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(30);
/// Overrides [`MAX_CONNECTIONS`] for a hospital whose background load needs more.
const MAX_ENV: &str = "WORKER_DB_POOL_MAX_CONNECTIONS";
/// The listener's connection plus one to work with; fewer would stall every job.
const FLOOR_CONNECTIONS: u32 = 2;

/// The worker pool's settings: the request pool's statement cache, lifetime and
/// slow-query threshold, with the sizes above. `max` is the operator's override.
#[must_use]
pub fn config(base: &PoolConfig, max: Option<u32>) -> PoolConfig {
    PoolConfig {
        max_connections: max.unwrap_or(MAX_CONNECTIONS).max(FLOOR_CONNECTIONS),
        min_connections: MIN_CONNECTIONS,
        acquire_timeout: ACQUIRE_TIMEOUT,
        idle_timeout: IDLE_TIMEOUT,
        ..base.clone()
    }
}

/// Opens the worker pool on `url` (the role that crosses tenants).
pub async fn connect(url: &str, base: &PoolConfig) -> Result<PgPool, DbError> {
    let max = std::env::var(MAX_ENV)
        .ok()
        .and_then(|v| v.trim().parse().ok());
    create_pool_with_config(url, &config(base, max)).await
}

#[cfg(test)]
mod tests {
    use super::{Duration, PoolConfig, config};

    /// Fails when the worker pool goes back to holding many idle connections:
    /// each one is a PostgreSQL process on a 2 GB hospital box.
    #[test]
    fn worker_pool_stays_small_whatever_the_request_pool_is() {
        let request = PoolConfig {
            max_connections: 50,
            min_connections: 10,
            ..PoolConfig::default()
        };
        let worker = config(&request, None);
        assert!(worker.max_connections <= 6, "worker pool max grew");
        assert_eq!(
            worker.min_connections, 0,
            "worker pool keeps idle connections"
        );
        assert!(
            worker.idle_timeout <= Duration::from_secs(60),
            "idle connections linger"
        );
        assert!(
            worker.acquire_timeout > request.acquire_timeout,
            "a pass must wait, not fail"
        );
        assert_eq!(
            config(&request, Some(0)).max_connections,
            2,
            "override below the floor"
        );
        assert_eq!(config(&request, Some(12)).max_connections, 12);
    }
}
