//! The Flow aggregator: once a minute, per tenant with Flow enabled, read each
//! source with one bounded, index-backed, today-only aggregate query and write
//! one `flow_zone_minute` row per zone. Then raise or clear alerts and refresh
//! recommendations. ~0.02 added queries a second for a 1,000-OPD hospital
//! (brief §A).
//!
//! Each source is read in its own short transaction with a statement and lock
//! timeout, so one source being slow or locked makes that source "unknown" for
//! the minute instead of stalling the pass or the clinical pool.
//!
//! ponytail: periodic aggregation only; the in-process queue broadcaster is
//! per-department with no tenant id, so subscribing to it would cost more than
//! the one query a minute it saves. Shares the worker pool with timeouts rather
//! than opening its own; give Flow its own pool if the timeouts ever fire.

use std::{collections::HashMap, time::Duration};

use medbrains_server_core::error::AppError;
use sqlx::{PgPool, postgres::PgRow};
use uuid::Uuid;

use crate::{
    LOCAL_TZ, MODULE, Tx,
    model::{Readings, Source, TokenRow, ZoneMinute, zone_minutes},
    queries::{self, ZoneSetup},
};

/// Seconds between passes. `FLOW_TICK_SECS` overrides it within 5..=300.
pub const DEFAULT_TICK_SECS: u64 = 60;
const MAX_TENANTS: i64 = 1000;
/// Most rows one source read returns.
const MAX_SOURCE_ROWS: i64 = 5000;

/// Seconds between passes, from `FLOW_TICK_SECS` when set.
pub fn tick_secs() -> u64 {
    std::env::var("FLOW_TICK_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .map_or(DEFAULT_TICK_SECS, |s| s.clamp(5, 300))
}

/// Start the pass. Call once at boot with the worker pool.
pub fn spawn(pool: PgPool) {
    let every = Duration::from_secs(tick_secs());
    tokio::spawn(async move {
        loop {
            if let Err(error) = pass(&pool).await {
                tracing::error!(%error, "flow aggregation pass failed");
            }
            tokio::time::sleep(every).await;
        }
    });
}

async fn pass(pool: &PgPool) -> Result<(), AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT tenant_id FROM module_config \
          WHERE code = $1 AND status = 'enabled' AND deleted_at IS NULL \
          ORDER BY tenant_id LIMIT $2",
    )
    .bind(MODULE)
    .bind(MAX_TENANTS)
    .fetch_all(pool)
    .await?;
    for tenant_id in tenants {
        if let Err(error) = run_tick(pool, tenant_id).await {
            tracing::error!(%error, %tenant_id, "flow tick failed");
        }
    }
    Ok(())
}

/// What one tick did.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct TickSummary {
    pub zones: usize,
    pub alerts_raised: usize,
    pub recommendations: usize,
}

/// One tenant's minute. Public so tests (and an operator's "refresh") can run
/// it without waiting for the timer.
pub async fn run_tick(pool: &PgPool, tenant_id: Uuid) -> Result<TickSummary, AppError> {
    let mut tx = tenant_tx(pool, tenant_id).await?;
    let zones = queries::zones(&mut tx, tenant_id).await?;
    let ids: Vec<Uuid> = zones.iter().map(|z| z.location_id).collect();
    let map = queries::zone_map(&mut tx, tenant_id, &ids).await?;
    tx.commit().await?;
    if zones.is_empty() {
        return Ok(TickSummary::default());
    }

    let readings = Readings {
        tokens: read::<TokenRow>(pool, tenant_id, Source::Tokens, TOKENS_SQL).await,
        checked_in: read(pool, tenant_id, Source::Appointments, &checked_in_sql()).await,
        visitors: read(pool, tenant_id, Source::Visitors, VISITORS_SQL).await,
        staff: read(pool, tenant_id, Source::Roster, &roster_sql()).await,
    };
    let factors: Vec<(Uuid, f64)> = zones
        .iter()
        .map(|z| (z.location_id, z.attendant_factor))
        .collect();
    let minutes = zone_minutes(&factors, &map, &readings);

    let mut tx = tenant_tx(pool, tenant_id).await?;
    write_minutes(&mut tx, tenant_id, &zones, &minutes).await?;
    let alerts_raised = crate::actions::sync_alerts(&mut tx, tenant_id, &zones, &minutes).await?;
    let recommendations =
        crate::actions::sync_recommendations(&mut tx, tenant_id, &zones, &minutes).await?;
    tx.commit().await?;
    Ok(TickSummary {
        zones: zones.len(),
        alerts_raised,
        recommendations,
    })
}

async fn tenant_tx(pool: &PgPool, tenant_id: Uuid) -> Result<Tx<'_>, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // A Flow statement never holds the clinical pool hostage (brief §A).
    sqlx::query("SET LOCAL statement_timeout = '2s'")
        .execute(&mut *tx)
        .await?;
    sqlx::query("SET LOCAL lock_timeout = '1s'")
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

/// One source, or `None` when it could not be read this minute.
async fn read<T>(pool: &PgPool, tenant_id: Uuid, source: Source, sql: &str) -> Option<Vec<T>>
where
    T: for<'r> sqlx::FromRow<'r, PgRow> + Send + Unpin,
{
    match try_read(pool, tenant_id, sql).await {
        Ok(rows) => Some(rows),
        Err(error) => {
            tracing::warn!(%error, %tenant_id, source = source.name(), "flow source unreadable — unknown this minute");
            None
        }
    }
}

async fn try_read<T>(pool: &PgPool, tenant_id: Uuid, sql: &str) -> Result<Vec<T>, AppError>
where
    T: for<'r> sqlx::FromRow<'r, PgRow> + Send + Unpin,
{
    let mut tx = tenant_tx(pool, tenant_id).await?;
    let rows = sqlx::query_as::<_, T>(sql)
        .bind(tenant_id)
        .bind(MAX_SOURCE_ROWS)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(rows)
}

/// Today's tokens per queue and counter. `token_date` is written as the
/// database's `CURRENT_DATE`, so it is read the same way.
const TOKENS_SQL: &str = "SELECT module, scope, scope_id, counter_label, \
            COUNT(*) FILTER (WHERE status IN ('waiting', 'on_hold', 'called')) AS waiting, \
            COUNT(*) FILTER (WHERE called_at >= now() - interval '30 minutes') AS called_30m \
       FROM tokens \
      WHERE tenant_id = $1 AND token_date = CURRENT_DATE \
      GROUP BY module, scope, scope_id, counter_label LIMIT $2";

fn checked_in_sql() -> String {
    format!(
        "SELECT department_id, COUNT(*)::bigint FROM appointments \
          WHERE tenant_id = $1 AND appointment_date = (now() AT TIME ZONE '{LOCAL_TZ}')::date \
            AND deleted_at IS NULL AND checked_in_at IS NOT NULL AND completed_at IS NULL \
            AND status IN ('checked_in', 'in_consultation') \
          GROUP BY department_id LIMIT $2"
    )
}

/// Visitors checked in at a gate and not yet out, by the location their pass
/// names. A check-in older than a day without a checkout is a missed scan,
/// not a person still inside.
const VISITORS_SQL: &str = "SELECT p.ward_id, COUNT(*)::bigint FROM visitor_logs l \
       JOIN visitor_passes p ON p.id = l.pass_id AND p.tenant_id = l.tenant_id \
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND l.check_out_at IS NULL \
        AND l.check_in_at >= now() - interval '24 hours' AND p.ward_id IS NOT NULL \
      GROUP BY p.ward_id LIMIT $2";

/// Staff whose rostered shift is on now, by department; a night shift that
/// began yesterday is still on until it ends.
fn roster_sql() -> String {
    let now = format!("(now() AT TIME ZONE '{LOCAL_TZ}')");
    format!(
        "SELECT r.department_id, COUNT(*)::bigint FROM duty_rosters r \
           JOIN shift_definitions s ON s.id = r.shift_id AND s.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL AND r.department_id IS NOT NULL \
            AND ((r.roster_date = {now}::date \
                  AND {now}::time >= s.start_time \
                  AND (s.start_time > s.end_time OR {now}::time < s.end_time)) \
              OR (r.roster_date = {now}::date - 1 \
                  AND s.start_time > s.end_time AND {now}::time < s.end_time)) \
          GROUP BY r.department_id LIMIT $2"
    )
}

/// One row per zone for this minute, in one statement.
async fn write_minutes(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zones: &[ZoneSetup],
    minutes: &HashMap<Uuid, ZoneMinute>,
) -> Result<(), AppError> {
    let rows: Vec<(&Uuid, &ZoneMinute)> = zones
        .iter()
        .filter_map(|z| minutes.get(&z.location_id).map(|m| (&z.location_id, m)))
        .collect();
    let col =
        |f: fn(&ZoneMinute) -> Option<i32>| rows.iter().map(|(_, m)| f(m)).collect::<Vec<_>>();
    let ids: Vec<Uuid> = rows.iter().map(|(id, _)| **id).collect();
    let waits: Vec<Option<f64>> = rows
        .iter()
        .map(|(_, m)| m.wait_minutes.map(|w| w.min(9999.0)))
        .collect();
    let counters: Vec<serde_json::Value> = rows
        .iter()
        .map(|(_, m)| serde_json::json!(m.counters))
        .collect();
    let unknown: Vec<String> = rows
        .first()
        .map(|(_, m)| m.unknown_sources.iter().map(|s| (*s).to_owned()).collect())
        .unwrap_or_default();
    sqlx::query(
        "INSERT INTO flow_zone_minute (tenant_id, location_id, minute, people_est, patients, \
             waiting, checked_in, visitors, staff, wait_minutes, served_30m, open_counters, \
             counters, unknown_sources) \
         SELECT $1, z.loc, date_trunc('minute', now()), z.people, z.patients, z.waiting, \
                z.checked_in, z.visitors, z.staff, z.wait::numeric(6,1), z.served, z.open, \
                z.counters, $13 \
           FROM UNNEST($2::uuid[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], \
                       $8::int[], $9::float8[], $10::int[], $11::int[], $12::jsonb[]) \
                AS z(loc, people, patients, waiting, checked_in, visitors, staff, wait, \
                     served, open, counters) \
         ON CONFLICT (tenant_id, location_id, minute) DO UPDATE SET \
             people_est = EXCLUDED.people_est, patients = EXCLUDED.patients, \
             waiting = EXCLUDED.waiting, checked_in = EXCLUDED.checked_in, \
             visitors = EXCLUDED.visitors, staff = EXCLUDED.staff, \
             wait_minutes = EXCLUDED.wait_minutes, served_30m = EXCLUDED.served_30m, \
             open_counters = EXCLUDED.open_counters, counters = EXCLUDED.counters, \
             unknown_sources = EXCLUDED.unknown_sources",
    )
    .bind(tenant_id)
    .bind(&ids)
    .bind(col(|m| m.people_est))
    .bind(col(|m| m.patients))
    .bind(col(|m| m.waiting))
    .bind(col(|m| m.checked_in))
    .bind(col(|m| m.visitors))
    .bind(col(|m| m.staff))
    .bind(&waits)
    .bind(col(|m| m.served_30m))
    .bind(col(|m| m.open_counters))
    .bind(&counters)
    .bind(&unknown)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
