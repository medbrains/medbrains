//! The runner: one background task that starts each check when it is due,
//! records a heartbeat per hospital, and merges what it found.
//!
//! Crash-only: when a check last ran is read from `security_check_runs`, not
//! remembered, so a restart neither repeats a daily check nor skips one.
//! Idempotent: findings merge on their identity, so a repeated run (or two
//! server processes running the same check) changes counts, not rows.

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use medbrains_kernel::{Actor, AppError};
use sqlx::PgPool;
use uuid::Uuid;

use crate::model::{CheckError, Report};
use crate::{CHECKS, info};

/// How often the runner looks for due checks.
const TICK: Duration = Duration::from_secs(30);
/// Heartbeats kept per check per hospital; older ones are deleted.
pub const RETENTION_DAYS: i32 = 7;
/// Findings recorded from one run; the rest are summarised in the detail.
pub const MAX_FINDINGS_PER_RUN: usize = 500;
/// Hospitals a pass reaches.
const MAX_TENANTS: i64 = 10_000;

/// The databases a check may use: the request pool (row level security
/// applies to it — what the app itself sees) and the worker pool, which
/// reaches every hospital.
#[derive(Debug, Clone)]
pub struct Ctx {
    pub request: PgPool,
    pub worker: PgPool,
}

/// One named check. Its key and cadence come from [`CHECKS`].
#[async_trait::async_trait]
pub trait Check: Send + Sync {
    fn key(&self) -> &'static str;
    /// Run once per hospital (`Some(tenant)`), or once for the install
    /// (`None`) with the result written to every hospital.
    fn per_tenant(&self) -> bool {
        false
    }
    async fn run(&self, ctx: &Ctx, tenant: Option<Uuid>) -> Result<Report, CheckError>;
}

/// The registered checks.
pub struct Runner {
    ctx: Ctx,
    checks: Vec<Box<dyn Check>>,
}

impl std::fmt::Debug for Runner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let keys: Vec<&str> = self.checks.iter().map(|c| c.key()).collect();
        f.debug_struct("Runner")
            .field("checks", &keys)
            .finish_non_exhaustive()
    }
}

impl Runner {
    #[must_use]
    pub fn new(ctx: Ctx, checks: Vec<Box<dyn Check>>) -> Self {
        Self { ctx, checks }
    }

    /// Run forever in the background.
    pub fn spawn(self) {
        tokio::spawn(async move {
            loop {
                if let Err(error) = self.tick().await {
                    tracing::error!(%error, "security check runner could not read its schedule");
                }
                tokio::time::sleep(TICK).await;
            }
        });
    }

    /// Start every check that is due.
    ///
    /// # Errors
    /// The schedule could not be read.
    pub async fn tick(&self) -> Result<(), sqlx::Error> {
        let last = last_runs(&self.ctx.worker).await?;
        let now = Utc::now();
        for check in &self.checks {
            let Some(every) = info(check.key()).map(|i| i.every_secs) else {
                tracing::error!(check = check.key(), "security check missing from CHECKS");
                continue;
            };
            if is_due(last.get(check.key()).copied(), every, now) {
                self.run_one(check.as_ref()).await;
            }
        }
        Ok(())
    }

    /// Run one check now and record it for every hospital.
    pub async fn run_one(&self, check: &dyn Check) {
        let tenants = match active_tenants(&self.ctx.worker).await {
            Ok(t) => t,
            Err(error) => {
                tracing::error!(%error, check = check.key(), "could not list hospitals");
                return;
            }
        };
        if check.per_tenant() {
            for tenant in tenants {
                let started = Utc::now();
                let result = check.run(&self.ctx, Some(tenant)).await;
                self.record_logged(tenant, check.key(), started, &result)
                    .await;
            }
        } else {
            let started = Utc::now();
            let result = check.run(&self.ctx, None).await;
            for tenant in tenants {
                self.record_logged(tenant, check.key(), started, &result)
                    .await;
            }
        }
    }

    async fn record_logged(
        &self,
        tenant: Uuid,
        key: &'static str,
        started: DateTime<Utc>,
        result: &Result<Report, CheckError>,
    ) {
        if let Err(e) = &result {
            tracing::warn!(check = key, %tenant, error = %e, "security check could not run");
        }
        if let Err(error) = record(&self.ctx.worker, tenant, key, started, result).await {
            tracing::error!(%error, check = key, %tenant, "security check heartbeat not recorded");
        }
    }
}

/// Due when it never ran or its interval has passed since it last started.
#[must_use]
pub fn is_due(last_started: Option<DateTime<Utc>>, every_secs: u64, now: DateTime<Utc>) -> bool {
    let every = chrono::Duration::seconds(i64::try_from(every_secs).unwrap_or(i64::MAX));
    last_started.is_none_or(|at| now - at >= every)
}

async fn last_runs(pool: &PgPool) -> Result<HashMap<String, DateTime<Utc>>, sqlx::Error> {
    let keys: Vec<&str> = CHECKS.iter().map(|c| c.key).collect();
    let rows = sqlx::query_as::<_, (String, DateTime<Utc>)>(
        "SELECT c.key, r.started_at FROM unnest($1::text[]) AS c(key) \
           CROSS JOIN LATERAL (SELECT started_at FROM security_check_runs \
                                WHERE check_key = c.key ORDER BY started_at DESC LIMIT 1) r",
    )
    .bind(&keys)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().collect())
}

async fn active_tenants(pool: &PgPool) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE deleted_at IS NULL AND is_active ORDER BY id LIMIT $1",
    )
    .bind(MAX_TENANTS)
    .fetch_all(pool)
    .await
}

/// The system actor a background pass writes as.
const fn system(tenant_id: Uuid) -> Actor {
    Actor {
        tenant_id,
        user_id: Uuid::nil(),
    }
}

/// Write one run for one hospital.
///
/// The heartbeat, the findings merged, the findings it no longer sees
/// resolved (only after a successful run — an error resolves nothing), and
/// heartbeats past retention deleted.
///
/// # Errors
/// The write failed; nothing of it is kept.
pub async fn record(
    pool: &PgPool,
    tenant: Uuid,
    key: &str,
    started: DateTime<Utc>,
    result: &Result<Report, CheckError>,
) -> Result<(), AppError> {
    medbrains_kernel::work(pool, system(tenant), async |tx| {
        let (outcome, count, detail, error) = match result {
            Err(e) => ("error", 0, serde_json::json!({}), Some(e.0.as_str())),
            Ok(report) => {
                let kept = &report.findings[..report.findings.len().min(MAX_FINDINGS_PER_RUN)];
                for f in kept {
                    sqlx::query("SELECT security_upsert_finding($1, $2, $3, $4, $5, $6, $7, $8, $9)")
                        .bind(tenant)
                        .bind(key)
                        .bind(&f.asset)
                        .bind(&f.key)
                        .bind(&f.title)
                        .bind(f.severity.as_str())
                        .bind(&f.evidence)
                        .bind(&f.how_to_fix)
                        .bind(f.cve_id.as_deref())
                        .execute(&mut **tx)
                        .await?;
                }
                resolve_absent(tx, tenant, key, kept).await?;
                let mut detail = report.detail.clone();
                if report.findings.len() > kept.len()
                    && let Some(obj) = detail.as_object_mut()
                {
                    obj.insert("findings_not_recorded".into(), (report.findings.len() - kept.len()).into());
                }
                let outcome = if report.not_applicable { "not_applicable" } else { "ok" };
                (outcome, i32::try_from(report.findings.len()).unwrap_or(i32::MAX), detail, None)
            }
        };
        sqlx::query(
            "INSERT INTO security_check_runs \
               (tenant_id, check_key, started_at, finished_at, outcome, findings_count, detail, error) \
             VALUES ($1, $2, $3, now(), $4, $5, $6, $7)",
        )
        .bind(tenant)
        .bind(key)
        .bind(started)
        .bind(outcome)
        .bind(count)
        .bind(&detail)
        .bind(error)
        .execute(&mut **tx)
        .await?;
        sqlx::query(
            "DELETE FROM security_check_runs WHERE tenant_id = $1 AND check_key = $2 \
               AND started_at < now() - make_interval(days => $3)",
        )
        .bind(tenant)
        .bind(key)
        .bind(RETENTION_DAYS)
        .execute(&mut **tx)
        .await?;
        Ok(())
    })
    .await
}

async fn resolve_absent(
    tx: &mut medbrains_kernel::Tx,
    tenant: Uuid,
    key: &str,
    seen: &[crate::Found],
) -> Result<(), AppError> {
    let assets: Vec<&str> = seen.iter().map(|f| f.asset.as_str()).collect();
    let keys: Vec<&str> = seen.iter().map(|f| f.key.as_str()).collect();
    sqlx::query(
        "UPDATE vulnerabilities SET remediation_status = 'resolved', remediated_at = now(), \
                remediation_notes = 'No longer found by the check', updated_at = now() \
          WHERE tenant_id = $1 AND check_key = $2 AND deleted_at IS NULL \
            AND remediation_status IN ('open', 'in_progress') \
            AND (affected_component, finding_key) NOT IN \
                (SELECT a, k FROM unnest($3::text[], $4::text[]) AS s(a, k))",
    )
    .bind(tenant)
    .bind(key)
    .bind(&assets)
    .bind(&keys)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
