//! The bounded report runner: every report, analytics, KPI and dashboard read
//! goes through here, so none of them can slow the clinical screens.
//!
//! Each read gets a transaction on the **reader pool** (`REPORTS_DATABASE_URL`
//! when set — a replica or a low-priority role — else a small pool of its own
//! on the primary, so reports cannot exhaust the request pool), with the
//! tenant's RLS context and the kernel's [`read_only`] bounds: a statement
//! timeout (default 15 s, a tenant setting, never above [`TIMEOUT_CEILING`]),
//! an idle-in-transaction timeout, and read-only mode.
//!
//! Heavy reads ([`begin_report`]) also take one of a few per-tenant slots;
//! when none is free the caller gets 429, not a queue that grows. Light reads
//! ([`begin_tile`]: dashboard tiles a whole shift opens at once) are bounded
//! the same way but take no slot.
//!
//! A statement that runs past the timeout surfaces as SQLSTATE 57014, which
//! `AppError` answers as 503 `report_timeout` with a message that says what to
//! do — never as empty data. Each run logs its duration and row count under
//! the `reports` tracing target.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use medbrains_kernel::bounds::{ReadBounds, read_only};
use medbrains_kernel::config::setting_in;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;

/// No setting, from any tenant or operator, may let a report run longer.
pub const TIMEOUT_CEILING: Duration = Duration::from_secs(60);
/// A tenant may not set a timeout so short that every report fails.
const TIMEOUT_FLOOR: Duration = Duration::from_secs(1);
/// The statement timeout when neither the operator nor the tenant set one.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);
/// Heavy reports one tenant may run at once when the operator sets nothing.
const DEFAULT_PER_TENANT: usize = 2;
/// How long a heavy report waits for a slot before 429. Long enough for a
/// reports page loading its tiles together to take turns; short enough that
/// waiters cannot pile up behind a slow report.
const DEFAULT_SLOT_WAIT: Duration = Duration::from_secs(5);
/// A run slower than this is logged as a warning, for the slow-report list.
const SLOW_RUN: Duration = Duration::from_secs(5);
/// Where a tenant overrides the timeout: `tenant_settings` category and key.
const SETTING: (&str, &str) = ("reports", "statement_timeout_ms");

/// The answer when a tenant already has its share of heavy reports running.
pub const BUSY_MESSAGE: &str =
    "Too many reports are running for this hospital right now. Wait a moment and try again.";

/// The operator's limits for every report run.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReportLimits {
    /// Statement timeout when the tenant sets none.
    pub default_timeout: Duration,
    /// Heavy reports per tenant at once.
    pub per_tenant: usize,
    /// How long a heavy report waits for a free slot before 429.
    pub slot_wait: Duration,
}

impl Default for ReportLimits {
    /// 15 s, two at a time per tenant, 5 s wait for a slot.
    fn default() -> Self {
        Self {
            default_timeout: DEFAULT_TIMEOUT,
            per_tenant: DEFAULT_PER_TENANT,
            slot_wait: DEFAULT_SLOT_WAIT,
        }
    }
}

impl ReportLimits {
    /// `REPORTS_STATEMENT_TIMEOUT_MS`, `REPORTS_MAX_CONCURRENT_PER_TENANT` and
    /// `REPORTS_SLOT_WAIT_MS`, each falling back to its default when unset or
    /// unparseable; the timeout never above [`TIMEOUT_CEILING`].
    pub fn from_env() -> Self {
        let read = |key: &str| {
            std::env::var(key)
                .ok()
                .and_then(|v| v.trim().parse::<u64>().ok())
        };
        let defaults = Self::default();
        Self {
            default_timeout: read("REPORTS_STATEMENT_TIMEOUT_MS")
                .map_or(defaults.default_timeout, Duration::from_millis)
                .min(TIMEOUT_CEILING),
            per_tenant: read("REPORTS_MAX_CONCURRENT_PER_TENANT")
                .and_then(|n| usize::try_from(n).ok())
                .filter(|&n| n > 0)
                .unwrap_or(defaults.per_tenant),
            slot_wait: read("REPORTS_SLOT_WAIT_MS")
                .map_or(defaults.slot_wait, Duration::from_millis)
                .min(TIMEOUT_CEILING),
        }
    }

    /// The timeout for a tenant whose `reports/statement_timeout_ms` setting
    /// is `setting`: the setting clamped to [1 s, ceiling], else the default.
    pub fn timeout_for(&self, setting: Option<&Value>) -> Duration {
        setting
            .and_then(Value::as_u64)
            .map_or(self.default_timeout, |ms| {
                Duration::from_millis(ms).clamp(TIMEOUT_FLOOR, TIMEOUT_CEILING)
            })
    }
}

/// The limits plus the per-tenant slots for heavy reports. Cheap to clone;
/// clones share the slots.
#[derive(Debug, Clone, Default)]
pub struct ReportGate {
    limits: ReportLimits,
    // ponytail: one entry per tenant that ever ran a report — bounded by the
    // tenants in this database; evict idle entries if that ever reaches thousands.
    slots: Arc<Mutex<HashMap<Uuid, Arc<Semaphore>>>>,
}

impl ReportGate {
    /// A gate enforcing `limits`.
    pub fn new(limits: ReportLimits) -> Self {
        Self {
            limits,
            slots: Arc::default(),
        }
    }

    /// The limits this gate enforces.
    pub const fn limits(&self) -> ReportLimits {
        self.limits
    }

    /// One heavy-report slot for `tenant_id`, waiting at most `slot_wait`
    /// (first come, first served); 429 when none frees up in time.
    pub async fn slot(&self, tenant_id: Uuid) -> Result<OwnedSemaphorePermit, AppError> {
        let semaphore = {
            let mut slots = self.slots.lock().unwrap_or_else(PoisonError::into_inner);
            Arc::clone(
                slots
                    .entry(tenant_id)
                    .or_insert_with(|| Arc::new(Semaphore::new(self.limits.per_tenant))),
            )
        };
        match tokio::time::timeout(self.limits.slot_wait, semaphore.acquire_owned()).await {
            Ok(Ok(permit)) => Ok(permit),
            // Elapsed, or (never: the semaphore is never closed) closed.
            Ok(Err(_)) | Err(_) => Err(AppError::TooManyRequests(BUSY_MESSAGE.to_owned())),
        }
    }
}

/// One report run in flight: holds its slot, and logs how it went.
#[derive(Debug)]
pub struct ReportRun {
    name: &'static str,
    tenant_id: Uuid,
    started: Instant,
    finished: bool,
    _slot: Option<OwnedSemaphorePermit>,
}

impl ReportRun {
    /// End the run: commit the read and log its duration and `rows`.
    pub async fn finish(
        mut self,
        tx: Transaction<'static, Postgres>,
        rows: usize,
    ) -> Result<(), AppError> {
        tx.commit().await?;
        self.finished = true;
        self.log("ok", Some(rows));
        Ok(())
    }

    /// One structured line per run; a warning when it was slow or failed.
    fn log(&self, outcome: &str, rows: Option<usize>) {
        let elapsed = self.started.elapsed();
        let duration_ms = u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX);
        if outcome != "ok" || elapsed >= SLOW_RUN {
            tracing::warn!(target: "reports", report = self.name, tenant_id = %self.tenant_id,
                duration_ms, rows, outcome, "slow or failed report");
        } else {
            tracing::info!(target: "reports", report = self.name, tenant_id = %self.tenant_id,
                duration_ms, rows, outcome, "report ran");
        }
    }
}

impl Drop for ReportRun {
    /// A run dropped without [`ReportRun::finish`] failed (an error returned
    /// with `?`, a timeout); it is logged so a failing report is visible.
    fn drop(&mut self) {
        if !self.finished {
            self.log("failed", None);
        }
    }
}

/// Begin a heavy report: takes a per-tenant slot (429 when none is free),
/// then a bounded read-only transaction on the reader pool.
pub async fn begin_report(
    state: &AppState,
    claims: &Claims,
    name: &'static str,
) -> Result<(Transaction<'static, Postgres>, ReportRun), AppError> {
    let slot = state.reports.slot(claims.tenant_id).await?;
    open(state, claims, name, Some(slot)).await
}

/// Begin a light read (a dashboard tile): bounded and read-only on the
/// reader pool, but no slot, because a whole shift opens them at once.
pub async fn begin_tile(
    state: &AppState,
    claims: &Claims,
    name: &'static str,
) -> Result<(Transaction<'static, Postgres>, ReportRun), AppError> {
    open(state, claims, name, None).await
}

/// The reader pool for `tenant_id`; an unreachable topology is an outage.
pub async fn reader_pool(state: &AppState, tenant_id: Uuid) -> Result<Arc<sqlx::PgPool>, AppError> {
    state
        .topology
        .reader_pool(tenant_id)
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("report database unavailable: {e}")))
}

/// The shared opening: pool, tenant context, tenant timeout, bounds.
async fn open(
    state: &AppState,
    claims: &Claims,
    name: &'static str,
    slot: Option<OwnedSemaphorePermit>,
) -> Result<(Transaction<'static, Postgres>, ReportRun), AppError> {
    let run = ReportRun {
        name,
        tenant_id: claims.tenant_id,
        started: Instant::now(),
        finished: false,
        _slot: slot,
    };
    let pool = reader_pool(state, claims.tenant_id).await?;
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_audit_context(&mut tx, &claims.tenant_id, &claims.sub, None).await?;
    let setting = setting_in(&mut tx, &claims.tenant_id, SETTING.0, SETTING.1).await?;
    let timeout = state.reports.limits().timeout_for(setting.as_ref());
    let bounds = ReadBounds {
        statement_timeout: timeout,
        idle_timeout: timeout,
    };
    read_only(&mut tx, bounds).await?;
    Ok((tx, run))
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::{ReportGate, ReportLimits, TIMEOUT_CEILING};
    use serde_json::json;
    use std::time::Duration;
    use uuid::Uuid;

    #[test]
    fn a_tenant_setting_is_clamped_to_the_ceiling_and_floor() {
        let limits = ReportLimits::default();
        assert_eq!(limits.timeout_for(None), Duration::from_secs(15));
        assert_eq!(
            limits.timeout_for(Some(&json!(30_000))),
            Duration::from_secs(30)
        );
        assert_eq!(limits.timeout_for(Some(&json!(3_600_000))), TIMEOUT_CEILING);
        assert_eq!(limits.timeout_for(Some(&json!(5))), Duration::from_secs(1));
        assert_eq!(
            limits.timeout_for(Some(&json!("fast"))),
            Duration::from_secs(15)
        );
    }

    #[tokio::test]
    async fn slots_are_per_tenant_and_freed_on_drop() {
        let gate = ReportGate::new(ReportLimits {
            per_tenant: 1,
            slot_wait: Duration::from_millis(20),
            ..ReportLimits::default()
        });
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let held = gate.slot(a).await.expect("first slot");
        assert!(
            gate.slot(a).await.is_err(),
            "second heavy report for the tenant is refused"
        );
        assert!(gate.slot(b).await.is_ok(), "another tenant is not affected");
        drop(held);
        assert!(
            gate.slot(a).await.is_ok(),
            "the slot comes back when the run ends"
        );
    }

    #[tokio::test]
    async fn a_waiting_report_gets_the_slot_when_it_frees() {
        let gate = ReportGate::new(ReportLimits {
            per_tenant: 1,
            ..ReportLimits::default()
        });
        let tenant = Uuid::new_v4();
        let held = gate.slot(tenant).await.expect("first slot");
        let waiter = tokio::spawn({
            let gate = gate.clone();
            async move { gate.slot(tenant).await.is_ok() }
        });
        tokio::time::sleep(Duration::from_millis(20)).await;
        drop(held);
        assert!(
            waiter.await.expect("join"),
            "the waiter runs instead of a 429"
        );
    }
}
