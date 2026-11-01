//! Watch the watchers (RFC-OSINT §3a): every minute, every other check must
//! have reported within twice its interval, and its last run must not have
//! failed. "No news" is never "good news".

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde_json::json;
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};
use crate::{CHECKS, CheckInfo};

pub const KEY: &str = "watchers";
/// Failed runs in a row before "could not run" becomes "keeps failing".
pub const FAILING_STREAK: i64 = 3;

/// A check's most recent run, as the watchers see it.
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct Latest {
    pub check_key: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub findings_count: i32,
    pub outcome: String,
    pub error: Option<String>,
    /// Errors among the last [`FAILING_STREAK`] runs.
    pub recent_errors: i64,
}

/// The watchers' check. `since` is when this runner started: a check that
/// has never reported is only overdue once it has had the chance.
#[derive(Debug)]
pub struct Watchers {
    pub since: DateTime<Utc>,
}

#[async_trait::async_trait]
impl Check for Watchers {
    fn key(&self) -> &'static str {
        KEY
    }

    fn per_tenant(&self) -> bool {
        true
    }

    async fn run(&self, ctx: &Ctx, tenant: Option<Uuid>) -> Result<Report, CheckError> {
        let tenant = tenant.ok_or_else(|| CheckError("no hospital given".into()))?;
        let latest = latest_runs(&ctx.worker, tenant).await?;
        let findings = assess(Utc::now(), self.since, &latest);
        Ok(Report::found(
            findings,
            json!({ "checks_watched": CHECKS.len() - 1 }),
        ))
    }
}

/// Each check's latest run for one hospital, with its recent error count.
///
/// # Errors
/// The heartbeats could not be read.
pub async fn latest_runs<'e, E: sqlx::PgExecutor<'e>>(
    db: E,
    tenant: Uuid,
) -> Result<HashMap<String, Latest>, sqlx::Error> {
    let keys: Vec<&str> = CHECKS.iter().map(|c| c.key).collect();
    let rows = sqlx::query_as::<_, Latest>(
        "SELECT c.key AS check_key, r.started_at, r.finished_at, r.findings_count, r.outcome, r.error, \
                (SELECT count(*) FROM (SELECT outcome FROM security_check_runs \
                    WHERE tenant_id = $1 AND check_key = c.key \
                    ORDER BY started_at DESC LIMIT $3) last WHERE last.outcome = 'error') AS recent_errors \
           FROM unnest($2::text[]) AS c(key) \
           CROSS JOIN LATERAL (SELECT started_at, finished_at, findings_count, outcome, error \
                FROM security_check_runs \
                WHERE tenant_id = $1 AND check_key = c.key ORDER BY started_at DESC LIMIT 1) r",
    )
    .bind(tenant)
    .bind(&keys)
    .bind(FAILING_STREAK)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|r| (r.check_key.clone(), r)).collect())
}

fn overdue_after(check: &CheckInfo) -> chrono::Duration {
    chrono::Duration::seconds(i64::try_from(check.every_secs.saturating_mul(2)).unwrap_or(i64::MAX))
}

/// What is wrong with the checks, from their latest runs. Pure, so the rules
/// are tested without a database.
#[must_use]
pub fn assess<S: std::hash::BuildHasher>(
    now: DateTime<Utc>,
    since: DateTime<Utc>,
    latest: &HashMap<String, Latest, S>,
) -> Vec<Found> {
    let finding = |check: &CheckInfo, key: &str, title: String, severity, evidence| Found {
        asset: format!("Security check: {}", check.label),
        key: key.to_owned(),
        title,
        severity,
        evidence,
        how_to_fix: "Look for this check in the server log (\"security check\"). Until it \
                     runs again, treat what it watches as unchecked."
            .to_owned(),
        cve_id: None,
    };
    let mut out = Vec::new();
    for check in CHECKS.iter().filter(|c| c.key != KEY) {
        let limit = overdue_after(check);
        let Some(run) = latest.get(check.key) else {
            if now - since > limit {
                out.push(finding(
                    check,
                    "never_ran",
                    format!("{} has never run", check.label),
                    Severity::High,
                    json!({ "runner_started": since }),
                ));
            }
            continue;
        };
        if now - run.started_at > limit {
            out.push(finding(
                check,
                "missed",
                format!("{} has missed its schedule", check.label),
                Severity::High,
                json!({ "last_started": run.started_at, "every_secs": check.every_secs }),
            ));
        }
        if run.outcome == "error" {
            let keeps = run.recent_errors >= FAILING_STREAK;
            out.push(finding(
                check,
                "failing",
                if keeps {
                    format!("{} keeps failing", check.label)
                } else {
                    format!("{} could not run", check.label)
                },
                if keeps {
                    Severity::High
                } else {
                    Severity::Medium
                },
                json!({ "error": run.error, "last_started": run.started_at }),
            ));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(key: &str, ago_secs: i64, outcome: &str, errors: i64) -> (String, Latest) {
        (
            key.to_owned(),
            Latest {
                check_key: key.to_owned(),
                started_at: Utc::now() - chrono::Duration::seconds(ago_secs),
                finished_at: Utc::now(),
                findings_count: 0,
                outcome: outcome.to_owned(),
                error: (outcome == "error").then(|| "boom".to_owned()),
                recent_errors: errors,
            },
        )
    }

    fn all_fresh() -> HashMap<String, Latest> {
        CHECKS.iter().map(|c| run(c.key, 1, "ok", 0)).collect()
    }

    #[test]
    fn fresh_successful_checks_raise_nothing() {
        assert_eq!(assess(Utc::now(), Utc::now(), &all_fresh()), Vec::new());
    }

    #[test]
    fn a_check_past_twice_its_interval_is_missed() {
        let mut latest = all_fresh();
        latest.extend([run(crate::honeytokens::KEY, 11 * 60, "ok", 0)]);
        let found = assess(Utc::now(), Utc::now(), &latest);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].key, "missed");
        assert_eq!(found[0].severity, Severity::High);
    }

    #[test]
    fn one_error_is_medium_and_a_streak_is_high() {
        let mut latest = all_fresh();
        latest.extend([run(crate::POSTURE, 1, "error", 1)]);
        let found = assess(Utc::now(), Utc::now(), &latest);
        assert_eq!(
            (found[0].key.as_str(), found[0].severity),
            ("failing", Severity::Medium)
        );
        latest.extend([run(crate::POSTURE, 1, "error", FAILING_STREAK)]);
        let found = assess(Utc::now(), Utc::now(), &latest);
        assert_eq!(found[0].severity, Severity::High);
        assert!(found[0].title.contains("keeps failing"));
    }

    #[test]
    fn a_check_that_never_reported_is_flagged_once_it_had_the_chance() {
        let mut latest = all_fresh();
        latest.remove(crate::honeytokens::KEY);
        assert_eq!(assess(Utc::now(), Utc::now(), &latest), Vec::new());
        let started = Utc::now() - chrono::Duration::hours(1);
        let found = assess(Utc::now(), started, &latest);
        assert_eq!(found[0].key, "never_ran");
    }
}
