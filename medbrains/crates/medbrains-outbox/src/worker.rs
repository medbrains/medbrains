//! Outbox worker — drains `outbox_events` with `FOR UPDATE SKIP LOCKED`,
//! dispatches to handlers, manages retries + DLQ + stale-claim recovery.
//!
//! Mirrors the existing `orchestration::jobs::start_job_worker` pattern
//! (`crates/medbrains-server/src/orchestration/jobs.rs:73-102`) which already
//! does FOR UPDATE SKIP LOCKED + `worker_id` locking + exponential backoff.

use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tokio::sync::watch;
use tokio::time::interval;
use uuid::Uuid;

use crate::backoff::{MAX_ATTEMPTS, next_retry_at};
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
    /// Per-tenant credential resolver passed into every `HandlerCtx`.
    /// Phase 1.1+ handlers (Razorpay, Twilio, ABDM, …) use this to
    /// fetch keys at dispatch time rather than at startup so rotation
    /// propagates without a worker restart.
    pub secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver>,
    /// Shared HTTPS client for outbound integrations.
    pub http_client: reqwest::Client,
    /// Object storage — handlers that attach stored documents
    /// (email attachments) read through this.
    pub object_store: Arc<dyn medbrains_core::object_store::ObjectStore>,
}

impl std::fmt::Debug for WorkerConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WorkerConfig")
            .field("poll_interval", &self.poll_interval)
            .field("batch_size", &self.batch_size)
            .field("worker_id", &self.worker_id)
            .field(
                "stale_claim_sweep_interval",
                &self.stale_claim_sweep_interval,
            )
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
        object_store: Arc<dyn medbrains_core::object_store::ObjectStore>,
    ) -> Self {
        Self {
            poll_interval: StdDuration::from_secs(2),
            batch_size: 32,
            worker_id: format!("worker-{}", Uuid::new_v4()),
            stale_claim_sweep_interval: StdDuration::from_secs(5 * 60),
            stale_claim_threshold: StdDuration::from_secs(10 * 60),
            secret_resolver,
            http_client,
            object_store,
        }
    }
}

/// Spawnable outbox worker.
#[derive(Debug)]
pub struct Worker {
    pool: PgPool,
    registry: Arc<Registry>,
    config: WorkerConfig,
}

impl Worker {
    pub const fn new(pool: PgPool, registry: Arc<Registry>, config: WorkerConfig) -> Self {
        Self {
            pool,
            registry,
            config,
        }
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
/// Boot-time deployment guard.
#[allow(clippy::panic)]
pub async fn assert_bypass_rls(pool: &PgPool) -> Result<(), sqlx::Error> {
    // allow-raw-sql: privilege self-check at boot
    let row: (bool,) =
        sqlx::query_as("SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user")
            .fetch_one(pool)
            .await?;
    assert!(
        row.0,
        "medbrains-outbox: connected as a non-BYPASSRLS role. \
         Worker must connect as medbrains_outbox_worker (see migration 130). \
         Refusing to start to prevent silent tenant filtering."
    );
    Ok(())
}

async fn drain_loop(
    pool: PgPool,
    registry: Arc<Registry>,
    config: WorkerConfig,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut tick = interval(config.poll_interval);
    // An emergency page wakes the worker at once (`pg_notify('outbox_wake')`
    // from migration 1410) instead of waiting for the next poll. Without a
    // listener the poll still runs; the wake only makes it sooner.
    let mut wake = listen_for_wake(&pool).await;
    loop {
        tokio::select! {
            woken = next_wake(&mut wake) => {
                if let Err(e) = woken {
                    tracing::warn!(error = %e, "outbox wake listener lost; polling only");
                    wake = None;
                } else if let Err(e) = drain_once(&pool, &registry, &config).await {
                    tracing::error!(error = %e, "outbox drain pass failed");
                }
            }
            // `res`, not `_`: `changed()` returns Err once every sender has
            // been dropped, and then resolves instantly, forever. Discarding
            // that error turns this select into a busy-loop that pins a whole
            // core - it held 100% of both CPUs on the shared box until
            // 2026-09-01. A caller that has dropped the sender can never
            // signal shutdown, so the only sane reading of Err is "shut down".
            res = shutdown_rx.changed() => {
                if res.is_err() || *shutdown_rx.borrow() {
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

/// The channel emergency pages notify on.
const WAKE_CHANNEL: &str = "outbox_wake";

/// Listen for wake-ups; `None` (logged) if the listener cannot connect.
async fn listen_for_wake(pool: &PgPool) -> Option<sqlx::postgres::PgListener> {
    let listener = async {
        let mut l = sqlx::postgres::PgListener::connect_with(pool).await?;
        l.listen(WAKE_CHANNEL).await?;
        Ok::<_, sqlx::Error>(l)
    }
    .await;
    listener
        .map_err(|e| tracing::warn!(error = %e, "outbox wake listener unavailable"))
        .ok()
}

/// The next wake-up, or never when there is no listener.
async fn next_wake(wake: &mut Option<sqlx::postgres::PgListener>) -> Result<(), sqlx::Error> {
    match wake {
        Some(listener) => listener.recv().await.map(|_| ()),
        None => std::future::pending().await,
    }
}

/// Row shape returned by the `claimed` CTE in [`drain_once`]:
/// (`event_id`, `tenant_id`, `event_type`, payload, attempts, `aggregate_id`, `actor_user_id`).
type ClaimedRow = (Uuid, Uuid, String, Value, i32, Option<Uuid>, Option<Uuid>);

async fn drain_once(
    pool: &PgPool,
    registry: &Registry,
    config: &WorkerConfig,
) -> Result<(), sqlx::Error> {
    // Claim a batch of due rows atomically.
    // FOR UPDATE SKIP LOCKED lets multiple worker replicas run safely.
    let mut tx = pool.begin().await?;
    let claimed: Vec<ClaimedRow> = sqlx::query_as(
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
    for (event_id, tenant_id, event_type, payload, attempts, _aggregate_id, actor_user_id) in
        claimed
    {
        let registry_clone = Arc::new(registry_lookup(registry, &event_type));
        let pool_clone = pool.clone();
        let worker_id = config.worker_id.clone();
        let secret_resolver = Arc::clone(&config.secret_resolver);
        let object_store = Arc::clone(&config.object_store);
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
                object_store,
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

/// Run one claimed row through its handler and record the outcome.
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
    object_store: Arc<dyn medbrains_core::object_store::ObjectStore>,
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
        object_store,
        http_client,
    };

    let handler = if let Some(h) = handler.as_ref() {
        Arc::clone(h)
    } else {
        // No registered handler + no fallback → permanent failure
        mark_dlq(&pool, event_id, attempts, "no handler registered").await;
        return;
    };

    let result = handler.handle(&ctx, &payload).await;
    match decide(result, attempts) {
        Decision::Sent => mark_sent(&pool, event_id).await,
        Decision::Terminal(status, reason) => mark_terminal(&pool, event_id, status, &reason).await,
        Decision::Dlq(reason) => mark_dlq(&pool, event_id, attempts, &reason).await,
        Decision::Retry(msg) => schedule_retry(&pool, event_id, attempts, &msg).await,
    }
}

/// What the worker does with a row once its handler has answered.
#[derive(Debug, PartialEq, Eq)]
enum Decision {
    Sent,
    /// A terminal status that is neither `sent` nor `dlq`, with the reason.
    Terminal(&'static str, String),
    Dlq(String),
    Retry(String),
}

/// Map a handler's answer to the row's next state. `sent` only for a real
/// send: a stub is `skipped_unconfigured` (it told every screen a message was
/// delivered when nobody was messaged), and nothing acting on the row is
/// `undelivered` (how a code-blue SMS with no handler read as delivered).
fn decide(result: Result<Value, HandlerError>, attempts: i32) -> Decision {
    match result {
        Ok(value) => unconfigured_reason(&value).map_or(Decision::Sent, |reason| {
            Decision::Terminal("skipped_unconfigured", reason)
        }),
        Err(HandlerError::Undelivered(reason)) => Decision::Terminal("undelivered", reason),
        Err(HandlerError::Permanent(msg)) => Decision::Dlq(format!("permanent: {msg}")),
        Err(HandlerError::Transient(msg)) if attempts >= MAX_ATTEMPTS => {
            Decision::Dlq(format!("max attempts: {msg}"))
        }
        Err(HandlerError::Transient(msg)) => Decision::Retry(msg),
    }
}

/// A handler that stubbed for want of a provider says so in its result
/// (`{"stub": true, "provider": .., "reason": ..}`). Returns why, or `None`
/// for a real send.
fn unconfigured_reason(result: &Value) -> Option<String> {
    if result.get("stub").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    let field = |key: &str| result.get(key).and_then(Value::as_str);
    Some(format!(
        "not configured: {} ({})",
        field("provider").unwrap_or("provider"),
        field("reason").unwrap_or("stub"),
    ))
}

/// End a row in a terminal status that is neither `sent` nor `dlq`
/// (`skipped_unconfigured`, `undelivered`), with the reason in `last_error`.
async fn mark_terminal(pool: &PgPool, event_id: Uuid, status: &str, reason: &str) {
    let _ = sqlx::query(
        "UPDATE outbox_events \
            SET status = $3, last_error = $2, \
                claimed_at = NULL, claimed_by = NULL \
          WHERE id = $1",
    )
    .bind(event_id)
    .bind(reason)
    .bind(status)
    .execute(pool)
    .await
    .map_err(|e| tracing::error!(error = %e, status, "mark_terminal failed"));
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
            // Same trap as drain_loop: a dropped sender resolves `changed()`
            // instantly forever, so discarding the Err spins a second core.
            res = shutdown_rx.changed() => {
                if res.is_err() || *shutdown_rx.borrow() { return; }
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

#[cfg(test)]
mod shutdown_channel_tests {
    use super::*;

    /// A dropped sender must end the loop, not spin on it.
    ///
    /// The bug: `select!` used `_ = shutdown_rx.changed()`, discarding the
    /// `Err` that `changed()` returns once every sender is gone. Err resolves
    /// instantly and forever, so the loop span at full speed and pinned a core.
    /// `spawn()` handed the sender to a binding that died immediately, so this
    /// happened on every boot.
    ///
    /// No database needed: dropping the sender before the loop starts is the
    /// exact condition, and a spinning loop simply never returns.
    #[tokio::test]
    async fn a_dropped_shutdown_sender_ends_the_loop_instead_of_spinning() {
        let (tx, mut rx) = watch::channel(false);
        drop(tx);

        // The fixed select arm, in isolation.
        let loop_exits = async {
            loop {
                let res = rx.changed().await;
                if res.is_err() || *rx.borrow() {
                    return "exited";
                }
            }
        };

        let outcome = tokio::time::timeout(StdDuration::from_secs(2), loop_exits).await;
        assert_eq!(
            outcome.expect("loop span instead of exiting on a closed channel"),
            "exited"
        );
    }
}

#[cfg(test)]
mod unconfigured_tests {
    use super::unconfigured_reason;
    use serde_json::json;

    #[test]
    fn a_stubbed_send_is_not_a_sent_one() {
        assert!(unconfigured_reason(&json!({ "sid": "SM123" })).is_none());
        assert_eq!(
            unconfigured_reason(
                &json!({ "provider": "twilio", "stub": true, "reason": "creds_unset" })
            )
            .as_deref(),
            Some("not configured: twilio (creds_unset)")
        );
    }
}

#[cfg(test)]
mod decide_tests {
    use super::{Decision, decide};
    use crate::handler::HandlerError;
    use serde_json::json;

    #[test]
    fn only_a_real_send_is_sent() {
        assert_eq!(decide(Ok(json!({ "sid": "SM1" })), 1), Decision::Sent);
        assert_eq!(
            decide(
                Err(HandlerError::Undelivered("SMS is not set up".to_owned())),
                1
            ),
            Decision::Terminal("undelivered", "SMS is not set up".to_owned())
        );
        assert!(matches!(
            decide(Ok(json!({ "stub": true, "provider": "twilio" })), 1),
            Decision::Terminal("skipped_unconfigured", _)
        ));
        assert!(matches!(
            decide(Err(HandlerError::Transient("x".into())), 1),
            Decision::Retry(_)
        ));
        assert!(matches!(
            decide(Err(HandlerError::Transient("x".into())), 99),
            Decision::Dlq(_)
        ));
    }
}
