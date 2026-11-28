//! Brick-aware background work: a brick's jobs run only while some hospital on this server has
//! the brick on (`medbrains_core::bricks::BRICK_JOBS`).
//!
//! The switches are read with [`read_bricks_on`] and applied with [`reconcile`], which starts a
//! wanted job that is not running and aborts one no longer wanted. Aborting is the crash-only
//! stop: every pass is idempotent and transactional, so stopping one mid-pass is the same as the
//! server restarting there. When the switches cannot be read, every job runs (fail-safe: a
//! clinical escalation is never silenced by a database fault). See `docs/architecture/MODULE-BRICKS.md`.

use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, PoisonError};

use medbrains_authz::decision::Outcome;
use medbrains_core::bricks::{self, BRICK_JOBS, BRICKS, BrickJob};
use medbrains_core::onboarding::{BackgroundJobStatus, ModuleConfig, ModuleStatus};
use sqlx::PgPool;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::middleware::entitlement::effective_outcome;

/// Rows read at most: 4096 hospitals with every brick. Past it the read counts as unreadable.
const MAX_ROWS: i64 = 4096 * 64;

/// Whether each brick job is running on this server, as the last [`reconcile`] left it.
static RUNNING: Mutex<Option<HashMap<&'static str, bool>>> = Mutex::new(None);

/// Bricks on for at least one hospital, from `(tenant, code, status)` rows. A hospital with no
/// rows has every edition brick on, as the request gate judges it.
#[must_use]
pub fn bricks_on(rows: &[(Uuid, Option<String>, Option<String>)]) -> HashSet<&'static str> {
    let mut by_tenant: HashMap<Uuid, HashMap<String, String>> = HashMap::new();
    for (tenant, code, status) in rows {
        let statuses = by_tenant.entry(*tenant).or_default();
        if let (Some(code), Some(status)) = (code, status) {
            statuses.insert(code.clone(), status.clone());
        }
    }
    let mut on = HashSet::new();
    for statuses in by_tenant.values() {
        on.extend(
            BRICKS
                .iter()
                .filter(|b| effective_outcome(b.id, statuses) == Outcome::Allow)
                .map(|b| b.id),
        );
    }
    on
}

/// Every active hospital's module switches, one query. `Err` when the read failed or was cut
/// off at [`MAX_ROWS`]; the caller then runs everything.
///
/// # Errors
/// The read failed, or more rows exist than it may hold.
pub async fn read_bricks_on(worker: &PgPool) -> Result<HashSet<&'static str>, sqlx::Error> {
    let rows: Vec<(Uuid, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT t.id, m.code, m.status::text FROM tenants t \
         LEFT JOIN module_config m ON m.tenant_id = t.id AND m.deleted_at IS NULL \
         WHERE t.deleted_at IS NULL AND t.is_active LIMIT $1",
    )
    .bind(MAX_ROWS)
    .fetch_all(worker)
    .await?;
    if i64::try_from(rows.len()).unwrap_or(i64::MAX) >= MAX_ROWS {
        return Err(sqlx::Error::Protocol(
            "module switches exceed the read bound".into(),
        ));
    }
    Ok(bricks_on(&rows))
}

/// Whether `job` should run. `None` means the switches could not be read: run it.
#[must_use]
pub fn should_run(job: &BrickJob, on: Option<&HashSet<&'static str>>) -> bool {
    on.is_none_or(|on| job.bricks.iter().any(|b| on.contains(b)))
}

/// Starts wanted jobs that are not running (or have died) and aborts unwanted ones, then records
/// what runs. Idempotent: a second call with the same switches changes nothing.
pub fn reconcile(
    running: &mut HashMap<&'static str, JoinHandle<()>>,
    on: Option<&HashSet<&'static str>>,
    start: impl Fn(&BrickJob) -> Option<JoinHandle<()>>,
) {
    for job in BRICK_JOBS {
        let live = running.get(job.id).is_some_and(|h| !h.is_finished());
        if should_run(job, on) {
            if !live && let Some(handle) = start(job) {
                tracing::info!(job = job.id, "brick job started");
                running.insert(job.id, handle);
            }
        } else if let Some(handle) = running.remove(job.id) {
            handle.abort();
            tracing::info!(
                job = job.id,
                "brick job stopped: no hospital has its brick on"
            );
        }
        record(job.id, running.contains_key(job.id));
    }
}

/// Notes whether a job is running, for [`is_running`].
fn record(id: &'static str, running: bool) {
    RUNNING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get_or_insert_with(HashMap::new)
        .insert(id, running);
}

/// Whether this server runs job `id`; `None` before the supervisor has looked at it.
#[must_use]
pub fn is_running(id: &str) -> Option<bool> {
    RUNNING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()?
        .get(id)
        .copied()
}

/// Fills a module row from the brick table: `depends_on` (rows created before the table agree
/// with it) and the brick's jobs this server has decided on, for the Modules screen.
pub fn fill_from_bricks(row: &mut ModuleConfig) {
    if let Some(brick) = bricks::find(&row.code) {
        row.depends_on = brick.depends_on.iter().map(|d| (*d).to_owned()).collect();
    }
    row.background_jobs = bricks::jobs_for(&row.code)
        .into_iter()
        .filter_map(|job| {
            is_running(job.id).map(|running| BackgroundJobStatus {
                id: job.id.to_owned(),
                label: job.label.to_owned(),
                running,
            })
        })
        .collect();
}

/// The Modules screen's list: every brick this server knows, set up or not.
///
/// Bricks come in table order, then any other stored row by name, each filled from the brick
/// table and with `on` set to what the module check answers. A brick the hospital never set up
/// has no row but is served all the same, so it is listed as `available` (which the check reads
/// exactly as no row) with a nil id.
#[must_use]
pub fn every_brick(tenant_id: Uuid, stored: Vec<ModuleConfig>) -> Vec<ModuleConfig> {
    let by_code: HashMap<String, String> = stored
        .iter()
        .map(|row| (row.code.clone(), row.status.as_str().to_owned()))
        .collect();
    let mut by_id: HashMap<String, ModuleConfig> = stored
        .into_iter()
        .map(|row| (row.code.clone(), row))
        .collect();
    let mut rows: Vec<ModuleConfig> = BRICKS
        .iter()
        .map(|brick| {
            by_id
                .remove(brick.id)
                .unwrap_or_else(|| never_set_up(tenant_id, brick))
        })
        .collect();
    let mut rest: Vec<ModuleConfig> = by_id.into_values().collect();
    rest.sort_by(|a, b| a.name.cmp(&b.name));
    rows.extend(rest);
    for row in &mut rows {
        fill_from_bricks(row);
        row.on = effective_outcome(&row.code, &by_code) == Outcome::Allow;
    }
    rows
}

/// The row a brick with no `module_config` row is listed as.
fn never_set_up(tenant_id: Uuid, brick: &bricks::Brick) -> ModuleConfig {
    let now = chrono::Utc::now();
    ModuleConfig {
        id: Uuid::nil(),
        tenant_id,
        code: brick.id.to_owned(),
        name: brick.name.to_owned(),
        description: None,
        status: ModuleStatus::Available,
        config: serde_json::json!({}),
        depends_on: Vec::new(),
        created_at: now,
        updated_at: now,
        background_jobs: Vec::new(),
        on: false,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use uuid::Uuid;

    use medbrains_core::onboarding::ModuleStatus;

    use super::{bricks_on, every_brick, is_running, never_set_up, reconcile};

    /// A Registration + OPD hospital that set up only those two lists every brick: the ones it
    /// never set up as on, the add-on as off, and a disabled brick's dependents as off.
    #[test]
    #[allow(clippy::expect_used)]
    fn every_brick_lists_the_ones_with_no_row_by_what_the_check_answers() {
        let t = Uuid::nil();
        let stored = |code: &str, status| {
            let brick = medbrains_core::bricks::find(code).expect("brick");
            let mut row = never_set_up(t, brick);
            row.status = status;
            row
        };
        let rows = every_brick(
            t,
            vec![
                stored("opd", ModuleStatus::Enabled),
                stored("registration", ModuleStatus::Enabled),
                stored("ipd", ModuleStatus::Disabled),
            ],
        );
        assert_eq!(rows.len(), medbrains_core::bricks::BRICKS.len());
        assert_eq!(rows[0].code, "registration", "table order");
        let get = |code: &str| rows.iter().find(|r| r.code == code).expect(code);
        assert!(get("opd").on && get("registration").on);
        assert_eq!(get("dental").status, ModuleStatus::Available);
        assert!(get("dental").on, "no row: on, never set up");
        assert!(
            !get("ipd").on && !get("nursing").on,
            "IPD off takes Nursing with it"
        );
        assert!(!get("companion").on, "an add-on with no row is off");
    }

    /// A stand-in job that runs until aborted.
    fn idle(_: &medbrains_core::bricks::BrickJob) -> Option<tokio::task::JoinHandle<()>> {
        Some(tokio::spawn(std::future::pending()))
    }

    fn row(tenant: Uuid, code: &str, status: &str) -> (Uuid, Option<String>, Option<String>) {
        (tenant, Some(code.to_owned()), Some(status.to_owned()))
    }

    #[test]
    fn a_hospital_with_ipd_off_keeps_room_rent_off() {
        let t = Uuid::nil();
        let on = bricks_on(&[row(t, "ipd", "disabled"), row(t, "opd", "enabled")]);
        assert!(on.contains("opd") && !on.contains("ipd"));
        // A hospital with no rows has every edition brick on.
        assert!(bricks_on(&[(t, None, None)]).contains("ipd"));
        assert!(!bricks_on(&[(t, None, None)]).contains("companion"));
    }

    #[tokio::test]
    async fn jobs_follow_the_switch_and_run_when_it_is_unreadable() {
        let mut running = HashMap::new();
        let opd_only: HashSet<&'static str> = ["registration", "opd"].into();
        reconcile(&mut running, Some(&opd_only), idle);
        assert!(
            !running.contains_key("room_rent"),
            "disabled brick's job started"
        );
        assert!(running.contains_key("opd_auto_close"));
        assert_eq!(is_running("room_rent"), Some(false));

        let with_ipd: HashSet<&'static str> = ["registration", "opd", "ipd"].into();
        reconcile(&mut running, Some(&with_ipd), idle);
        assert!(
            running.contains_key("room_rent"),
            "switching IPD on did not start it"
        );
        assert_eq!(is_running("room_rent"), Some(true));

        reconcile(&mut running, Some(&opd_only), idle);
        assert!(
            !running.contains_key("room_rent"),
            "switching IPD off did not stop it"
        );

        reconcile(&mut running, None, idle);
        assert!(running.contains_key("room_rent") && running.contains_key("pacs_sync"));
        let restarts = std::cell::Cell::new(0);
        reconcile(&mut running, None, |_| {
            restarts.set(restarts.get() + 1);
            None
        });
        assert_eq!(restarts.get(), 0, "a second pass restarted a live job");
    }
}
