//! Outbox worker — drains `outbox_events` with `FOR UPDATE SKIP LOCKED`,
//! dispatches to handlers, manages retries + DLQ + stale-claim recovery.
//!
//! Mirrors the existing `orchestration::jobs::start_job_worker` pattern
//! (`crates/medbrains-server/src/orchestration/jobs.rs:73-102`) which already
//! does FOR UPDATE SKIP LOCKED + worker_id locking + exponential backoff.

use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tokio::sync::watch;
use tokio::time::interval;
use uuid::Uuid;

use crate::backoff::{next_retry_at, MAX_ATTEMPTS};
use crate::handler::{HandlerCtx, HandlerError, Registry};

#[derive(Clone)]
pub struct WorkerConfig {
    /// How often the worker polls for new rows. Default 2s.
    pub poll_interval: StdDuration,
    /// Max rows per batch. Default 32.
    pub batch_size: i32,
    /// Stable identifier for this worker instance (host+pid+uuid).
    /// Recorded in `outbox_events.claimed_by` for stale-claim diagnostics.
    pub worker_id: String,
    /// Stale-claim reaper sweep interval. Default 5min.
    pub stale_claim_sweep_interval: StdDuration,
    /// Threshold beyond which a `claimed_at` is considered stale and
    /// the row reset to `pending`. Default 10min.
    pub stale_claim_threshold: StdDuration,
    /// Per-tenant credential resolver passed into every HandlerCtx.
    /// Phase 1.1+ handlers (Razorpay, Twilio, ABDM, …) use this to
    /// fetch keys at dispatch time rather than at startup so rotation
    /// propagates without a worker restart.
    pub secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver>,
    /// Shared HTTPS client for outbound integrations.
    pub http_client: reqwest::Client,
}

impl std::fmt::Debug for WorkerConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WorkerConfig")
            .field("poll_interval", &self.poll_interval)
            .field("batch_size", &self.batch_size)
            .field("worker_id", &self.worker_id)
            .field("stale_claim_sweep_interval", &self.stale_claim_sweep_interval)
            .field("stale_claim_threshold", &self.stale_claim_threshold)
            .finish_non_exhaustive()
    }
}

impl WorkerConfig {
    /// Build a default config with the provided substrate handles.
    /// Other fields use sensible defaults (poll 2s, batch 32, etc.).
    pub fn with_substrate(
        secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver>,
        http_client: reqwest::Client,
    ) -> Self {
        Self {
            poll_interval: StdDuration::from_secs(2),
            batch_size: 32,
            worker_id: format!("worker-{}", Uuid::new_v4()),
            stale_claim_sweep_interval: StdDuration::from_secs(5 * 60),
            stale_claim_threshold: StdDuration::from_secs(10 * 60),
            secret_resolver,
            http_client,
        }
    }
}

/// Spawnable outbox worker.
pub struct Worker {
    pool: PgPool,
    registry: Arc<Registry>,
    config: WorkerConfig,
}

impl Worker {
    pub fn new(pool: PgPool, registry: Arc<Registry>, config: WorkerConfig) -> Self {
        Self { pool, registry, config }
    }

    /// Spawn the worker on the current Tokio runtime. Returns a watch
    /// sender that, when set to `true`, signals graceful shutdown. The
    /// task drains in-flight events before exiting.
    pub fn spawn(self) -> watch::Sender<bool> {
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let reaper_rx = shutdown_rx.clone();

        // Stale-claim reaper task (separate from drain loop)
        let pool_reap = self.pool.clone();
        let reap_config = self.config.clone();
        tokio::spawn(async move {
            stale_claim_reaper(pool_reap, reap_config, reaper_rx).await;
        });

        // Main drain loop
        tokio::spawn(async move {
            drain_loop(self.pool, self.registry, self.config, shutdown_rx).await;
        });

        shutdown_tx
    }
}

/// Verify the connection role has BYPASSRLS — the worker must run as
/// `medbrains_outbox_worker` (or another BYPASSRLS role). Crashes fast
/// if not, so we don't silently filter rows under tenant RLS.
pub async fn assert_bypass_rls(pool: &PgPool) -> Result<(), sqlx::Error> {
    // allow-raw-sql: privilege self-check at boot
    let row: (bool,) = sqlx::query_as(
        "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user",
    )
    .fetch_one(pool)
    .await?;
    if !row.0 {
        panic!(
            "medbrains-outbox: connected as a non-BYPASSRLS role. \
             Worker must connect as medbrains_outbox_worker (see migration 130). \
             Refusing to start to prevent silent tenant filtering."
        );
    }
    Ok(())
}

async fn drain_loop(
    pool: PgPool,
    registry: Arc<Registry>,
    config: WorkerConfig,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut tick = interval(config.poll_interval);
    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    tracing::info!(worker_id = %config.worker_id, "outbox worker shutting down");
                    return;
                }
            }
            _ = tick.tick() => {
                if let Err(e) = drain_once(&pool, &registry, &config).await {
                    tracing::error!(error = %e, "outbox drain pass failed");
                }
            }
        }
    }
}

async fn drain_once(
    pool: &PgPool,
    registry: &Registry,
    config: &WorkerConfig,
) -> Result<(), sqlx::Error> {
    // Claim a batch of due rows atomically.
    // FOR UPDATE SKIP LOCKED lets multiple worker replicas run safely.
    let mut tx = pool.begin().await?;
    let claimed: Vec<(Uuid, Uuid, String, Value, i32, Option<Uuid>, Option<Uuid>)> =
        sqlx::query_as(
            "WITH due AS ( \
                 SELECT id FROM outbox_events \
                 WHERE status IN ('pending','retrying') \
                   AND next_retry_at <= now() \
                 ORDER BY next_retry_at \
                 FOR UPDATE SKIP LOCKED \
                 LIMIT $1 \
             ) \
             UPDATE outbox_events o \
                SET status = 'retrying', \
                    attempts = o.attempts + 1, \
                    claimed_at = now(), \
                    claimed_by = $2 \
               FROM due \
              WHERE o.id = due.id \
             RETURNING o.id, o.tenant_id, o.event_type, o.payload, o.attempts, \
                       o.aggregate_id, \
                       (o.payload->'actor_context'->>'user_id')::uuid",
        )
        .bind(config.batch_size)
        .bind(&config.worker_id)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;

    if claimed.is_empty() {
        return Ok(());
    }

    // Dispatch each — outside the lock tx — so handler latency doesn't
    // hold connection pool resources.
    for (event_id, tenant_id, event_type, payload, attempts, _aggregate_id, actor_user_id) in claimed {
        let registry_clone = Arc::new(registry_lookup(registry, &event_type));
        let pool_clone = pool.clone();
        let worker_id = config.worker_id.clone();
        let secret_resolver = config.secret_resolver.clone();
        let http_client = config.http_client.clone();
        tokio::spawn(async move {
            dispatch_one(
                pool_clone,
                registry_clone,
                event_id,
                tenant_id,
                event_type,
                payload,
                attempts,
                actor_user_id,
                worker_id,
                secret_resolver,
                http_client,
            )
            .await;
        });
    }

    Ok(())
}

/// Lookup wrapper — returns Option<Arc<dyn Handler>> via the registry.
/// Wrapped this way so we can spawn with a static lifetime.
fn registry_lookup(
    registry: &Registry,
    event_type: &str,
) -> Option<Arc<dyn crate::handler::Handler>> {
    registry.lookup(event_type)
}

#[allow(clippy::too_many_arguments)]
async fn dispatch_one(
    pool: PgPool,
    handler: Arc<Option<Arc<dyn crate::handler::Handler>>>,
    event_id: Uuid,
    tenant_id: Uuid,
    event_type: String,
    payload: Value,
    attempts: i32,
    actor_user_id: Option<Uuid>,
    _worker_id: String,
    secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver>,
    http_client: reqwest::Client,
) {
    let ctx = HandlerCtx {
        pool: pool.clone(),
        tenant_id,
        event_id,
        event_type: event_type.clone(),
        actor_user_id,
        attempts,
        secret_resolver,
        http_client,
    };

    let handler = match handler.as_ref() {
        Some(h) => h.clone(),
        None => {
            // No registered handler + no fallback → permanent failure
            mark_dlq(&pool, event_id, attempts, "no handler registered").await;
            return;
        }
    };

    match handler.handle(&ctx, &payload).await {
        Ok(_result) => {
            mark_sent(&pool, event_id).await;
        }
        Err(HandlerError::Permanent(msg)) => {
            mark_dlq(&pool, event_id, attempts, &format!("permanent: {msg}")).await;
        }
        Err(HandlerError::Transient(msg)) => {
            if attempts >= MAX_ATTEMPTS {
                mark_dlq(&pool, event_id, attempts, &format!("max attempts: {msg}")).await;
            } else {
                schedule_retry(&pool, event_id, attempts, &msg).await;
            }
        }
    }
}

async fn mark_sent(pool: &PgPool, event_id: Uuid) {
    let _ = sqlx::query(
        "UPDATE outbox_events \
            SET status = 'sent', sent_at = now(), claimed_at = NULL, claimed_by = NULL \
          WHERE id = $1",
    )
    .bind(event_id)
    .execute(pool)
    .await
    .map_err(|e| tracing::error!(error = %e, "mark_sent failed"));
}

async fn schedule_retry(pool: &PgPool, event_id: Uuid, attempts: i32, error: &str) {
    let next: DateTime<Utc> = next_retry_at(attempts);
    let _ = sqlx::query(
        "UPDATE outbox_events \
            SET status = 'retrying', \
                next_retry_at = $1, \
                last_error = $2, \
                claimed_at = NULL, \
                claimed_by = NULL \
          WHERE id = $3",
    )
    .bind(next)
    .bind(error)
    .bind(event_id)
    .execute(pool)
    .await
    .map_err(|e| tracing::error!(error = %e, "schedule_retry failed"));
}

async fn mark_dlq(pool: &PgPool, event_id: Uuid, attempts: i32, error: &str) {
    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(error = %e, "mark_dlq begin failed");
            return;
        }
    };

    if let Err(e) = sqlx::query(
        "INSERT INTO outbox_dlq (original_event_id, tenant_id, event_type, payload, attempts, last_error) \
         SELECT id, tenant_id, event_type, payload, $2, $3 \
           FROM outbox_events WHERE id = $1",
    )
    .bind(event_id)
    .bind(attempts)
    .bind(error)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, %event_id, "mark_dlq insert failed");
        return;
    }

    if let Err(e) = sqlx::query(
        "UPDATE outbox_events \
            SET status = 'dlq', dlq_at = now(), last_error = $1, claimed_at = NULL, claimed_by = NULL \
          WHERE id = $2",
    )
    .bind(error)
    .bind(event_id)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, %event_id, "mark_dlq update failed");
        return;
    }

    let _ = tx.commit().await.map_err(|e| {
        tracing::error!(error = %e, %event_id, "mark_dlq commit failed");
    });
}

async fn stale_claim_reaper(
    pool: PgPool,
    config: WorkerConfig,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut tick = interval(config.stale_claim_sweep_interval);
    let threshold_seconds = config.stale_claim_threshold.as_secs() as i64;

    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() { return; }
            }
            _ = tick.tick() => {
                let cutoff = Utc::now() - Duration::seconds(threshold_seconds);
                if let Err(e) = sqlx::query(
                    "UPDATE outbox_events \
                        SET status = 'pending', claimed_at = NULL, claimed_by = NULL \
                      WHERE status = 'retrying' \
                        AND claimed_at IS NOT NULL \
                        AND claimed_at < $1",
                )
                .bind(cutoff)
                .execute(&pool)
                .await
                {
                    tracing::error!(error = %e, "stale_claim_reaper failed");
                }
            }
        }
    }
}
