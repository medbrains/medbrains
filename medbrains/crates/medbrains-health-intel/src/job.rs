//! The hourly health-intelligence pass.
//!
//! Condition counts per hospital, weather and air per hospital, and
//! condition/region tags on new public notices. Each part writes a heartbeat, so a pass that stops or fails is visible on
//! the screen instead of reading as "nothing unusual".
//!
//! Crash-only and idempotent: every write replaces the previous result in one
//! transaction, so a pass killed half-way leaves the last complete result and
//! a heartbeat that ages into "stopped".

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use medbrains_kernel::{Actor, AppError};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::baseline::{self, HISTORY_BLOCKS, SERIES_WEEKS};
use crate::environment::{self, FETCH_INTERVAL_SECS};
use crate::status::{EXPECTED_JOBS, JOB_CONDITIONS, JOB_ENVIRONMENT, JOB_TAGGING};

/// Hospitals visited per pass.
const TENANT_LIMIT: i64 = 1000;
/// Conditions kept per hospital (the most cases this week first).
const CONDITION_LIMIT: usize = 50;
/// (condition, week) cells read per hospital.
const CELL_LIMIT: i64 = 20_000;
/// Articles tagged per pass; the rest wait for the next one.
const TAG_LIMIT: i64 = 2000;
/// The tenant setting that allows the weather/air fetch (default on).
pub const ENVIRONMENT_SETTING: &str = "health_intel/environment_fetch";

/// Start the hourly pass. `pool` must be the worker pool (it lists hospitals).
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            run_pass(&pool).await;
            #[allow(clippy::cast_sign_loss)] // a positive constant
            tokio::time::sleep(Duration::from_secs(FETCH_INTERVAL_SECS as u64)).await;
        }
    });
}

async fn run_pass(pool: &PgPool) {
    let tenants: Result<Vec<Uuid>, sqlx::Error> =
        sqlx::query_scalar("SELECT id FROM tenants WHERE is_active ORDER BY id LIMIT $1")
            .bind(TENANT_LIMIT)
            .fetch_all(pool)
            .await;
    let (conditions, environment) = match tenants {
        Ok(ids) => per_tenant(pool, &ids).await,
        Err(e) => (Err(e.to_string()), Err(e.to_string())),
    };
    let tagging = tag_articles(pool)
        .await
        .map(drop)
        .map_err(|e| e.to_string());
    for (name, result) in [
        (JOB_CONDITIONS, conditions),
        (JOB_ENVIRONMENT, environment),
        (JOB_TAGGING, tagging),
    ] {
        if let Err(error) = &result {
            tracing::error!(job = name, %error, "health intelligence pass failed");
        }
        if let Err(error) = record(pool, name, result).await {
            tracing::error!(job = name, %error, "health intelligence heartbeat not written");
        }
    }
}

/// Summarise per-hospital failures as one heartbeat error.
fn summarise(failed: &[String], total: usize) -> Result<(), String> {
    failed.first().map_or(Ok(()), |first| {
        Err(format!(
            "{} of {total} hospitals failed: {first}",
            failed.len()
        ))
    })
}

async fn per_tenant(pool: &PgPool, ids: &[Uuid]) -> (Result<(), String>, Result<(), String>) {
    let (mut cond_failed, mut env_failed) = (Vec::new(), Vec::new());
    for &tenant_id in ids {
        if let Err(e) = recompute_conditions(pool, tenant_id, Utc::now()).await {
            cond_failed.push(e.to_string());
        }
        if let Err(e) = refresh_environment(pool, tenant_id).await {
            env_failed.push(e);
        }
    }
    (
        summarise(&cond_failed, ids.len()),
        summarise(&env_failed, ids.len()),
    )
}

/// Write a job heartbeat. On success the attempt and the success share one
/// time; on failure only the attempt moves, with the reason.
///
/// # Errors
/// A database fault.
pub async fn record(pool: &PgPool, name: &str, result: Result<(), String>) -> Result<(), AppError> {
    let label = EXPECTED_JOBS
        .iter()
        .find(|(n, _)| *n == name)
        .map_or(name, |(_, l)| l);
    let error = result.err();
    // The heartbeat table is global (no hospital data), so it is written on
    // the worker pool rather than inside one hospital's unit of work.
    sqlx::query(
        "INSERT INTO health_intel_heartbeats \
             (name, kind, label, interval_secs, last_attempt_at, last_ok_at, last_error) \
         VALUES ($1, 'job', $2, $3, now(), CASE WHEN $4::text IS NULL THEN now() END, $4) \
         ON CONFLICT (name) DO UPDATE SET \
             label = EXCLUDED.label, interval_secs = EXCLUDED.interval_secs, \
             last_attempt_at = EXCLUDED.last_attempt_at, \
             last_ok_at = COALESCE(EXCLUDED.last_ok_at, health_intel_heartbeats.last_ok_at), \
             last_error = EXCLUDED.last_error, updated_at = now()",
    )
    .bind(name)
    .bind(label)
    .bind(i32::try_from(FETCH_INTERVAL_SECS).unwrap_or(3600))
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

/// Tag new or changed public notices by condition and region from the
/// keyword map (`health_intel_terms`), in one bounded statement.
///
/// # Errors
/// A database fault.
pub async fn tag_articles(pool: &PgPool) -> Result<u64, AppError> {
    let done = sqlx::query(
        "UPDATE news_feed_articles a SET \
             conditions = COALESCE((SELECT array_agg(DISTINCT t.tag ORDER BY t.tag) \
                 FROM health_intel_terms t WHERE t.kind = 'condition' \
                  AND a.search_tsv @@ phraseto_tsquery('english', t.term)), '{}'), \
             regions = COALESCE((SELECT array_agg(DISTINCT t.tag ORDER BY t.tag) \
                 FROM health_intel_terms t WHERE t.kind = 'region' \
                  AND a.search_tsv @@ phraseto_tsquery('english', t.term)), '{}'), \
             tagged_at = now() \
         WHERE a.id IN (SELECT id FROM news_feed_articles \
                         WHERE tagged_at IS NULL OR tagged_at < updated_at \
                         ORDER BY updated_at DESC LIMIT $1)",
    )
    .bind(TAG_LIMIT)
    .execute(pool)
    .await?;
    Ok(done.rows_affected())
}

#[derive(sqlx::FromRow)]
struct Cell {
    condition: String,
    block: i32,
    n: i64,
    first_seen: Option<DateTime<Utc>>,
}

/// Recompute one hospital's "this week vs usual" from its notifiable-disease
/// worklist: one bounded query, then a full replace of its signals.
///
/// The worklist is the source because detection already folds every route a
/// case arrives by — OPD and admission diagnoses, discharge text, verified lab
/// results — into one row per patient, disease and 30-day episode (MIG 1230),
/// and the IHIP P- and L-form line lists are drawn from the same rows.
/// Counting diagnoses as well would count the same patient twice. Rows marked
/// `exempted` (not reportable) are left out.
///
/// # Errors
/// A database fault.
pub async fn recompute_conditions(
    pool: &PgPool,
    tenant_id: Uuid,
    now: DateTime<Utc>,
) -> Result<usize, AppError> {
    let actor = Actor {
        tenant_id,
        user_id: Uuid::nil(),
    };
    medbrains_kernel::work(pool, actor, async |tx| {
        let cells = sqlx::query_as::<_, Cell>(
            "SELECT r.disease_name AS condition, \
                    floor(extract(epoch FROM ($2 - r.detected_at)) / 604800)::int AS block, \
                    count(*)::bigint AS n, \
                    (SELECT min(f.detected_at) FROM notifiable_disease_reports f \
                      WHERE f.tenant_id = $1 AND f.status <> 'exempted') AS first_seen \
               FROM notifiable_disease_reports r \
              WHERE r.tenant_id = $1 AND r.status <> 'exempted' \
                AND r.detected_at > $2 - make_interval(weeks => $3) AND r.detected_at <= $2 \
              GROUP BY 1, 2 LIMIT $4",
        )
        .bind(tenant_id)
        .bind(now)
        .bind(i32::try_from(HISTORY_BLOCKS).unwrap_or(158))
        .bind(CELL_LIMIT)
        .fetch_all(&mut **tx)
        .await?;
        let rows = signals(&cells, now);
        let count = rows.len();
        sqlx::query("DELETE FROM health_intel_condition_signals WHERE tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut **tx)
            .await?;
        sqlx::query(
            "INSERT INTO health_intel_condition_signals \
                 (tenant_id, condition, this_week, usual, spread, method, level, series, computed_at) \
             SELECT $1, x.condition, x.this_week, x.usual, x.spread, x.method, x.level, \
                    ARRAY(SELECT jsonb_array_elements_text(x.series)::int), $3 \
               FROM jsonb_to_recordset($2) AS x(condition text, this_week int, usual numeric, \
                    spread numeric, method text, level text, series jsonb)",
        )
        .bind(tenant_id)
        .bind(serde_json::Value::Array(rows))
        .bind(now)
        .execute(&mut **tx)
        .await?;
        Ok(count)
    })
    .await
}

/// Fold the cells into one assessed row per condition seen in the last
/// twelve weeks, most cases this week first, at most [`CONDITION_LIMIT`].
fn signals(cells: &[Cell], now: DateTime<Utc>) -> Vec<serde_json::Value> {
    let mut by_condition: HashMap<&str, Vec<i64>> = HashMap::new();
    for c in cells {
        let Ok(block) = usize::try_from(c.block) else {
            continue;
        };
        if block >= HISTORY_BLOCKS {
            continue;
        }
        by_condition
            .entry(c.condition.as_str())
            .or_insert_with(|| vec![0; HISTORY_BLOCKS])[block] += c.n;
    }
    let history_weeks = cells
        .first()
        .and_then(|c| c.first_seen)
        .map_or(0, |f| usize::try_from((now - f).num_weeks()).unwrap_or(0));
    let mut rows: Vec<(String, baseline::Assessment, Vec<i64>)> = by_condition
        .into_iter()
        .filter(|(_, blocks)| blocks[..SERIES_WEEKS].iter().any(|&n| n > 0))
        .map(|(name, blocks)| {
            (
                name.to_owned(),
                baseline::assess(&blocks, history_weeks),
                baseline::series(&blocks),
            )
        })
        .collect();
    rows.sort_by(|a, b| {
        b.1.level
            .cmp(&a.1.level)
            .then(b.1.this_week.cmp(&a.1.this_week))
            .then(a.0.cmp(&b.0))
    });
    rows.truncate(CONDITION_LIMIT);
    rows.into_iter()
        .map(|(condition, a, series)| {
            json!({
                "condition": condition,
                "this_week": a.this_week,
                "usual": a.usual,
                "spread": a.spread,
                "method": a.method.as_str(),
                "level": a.level.as_str(),
                "series": series,
            })
        })
        .collect()
}

#[derive(sqlx::FromRow)]
struct Place {
    fetch_on: Option<serde_json::Value>,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

/// Fetch and store one hospital's weather and air quality, unless the
/// hospital turned the fetch off. The network call happens outside any
/// transaction.
///
/// # Errors
/// The reason, as recorded on the hospital's row.
pub async fn refresh_environment(pool: &PgPool, tenant_id: Uuid) -> Result<(), String> {
    let actor = Actor {
        tenant_id,
        user_id: Uuid::nil(),
    };
    let place = medbrains_kernel::work(pool, actor, async |tx| {
        let fetch_on = medbrains_kernel::config::get(tx, ENVIRONMENT_SETTING).await?;
        let coords: Option<(Option<f64>, Option<f64>)> = sqlx::query_as(
            "SELECT latitude::float8, longitude::float8 FROM ( \
                 SELECT latitude, longitude, 0 AS rank FROM tenants WHERE id = $1 \
                 UNION ALL \
                 SELECT latitude, longitude, 1 FROM facilities \
                  WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active) p \
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL \
              ORDER BY rank LIMIT 1",
        )
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
        let (latitude, longitude) = coords.unwrap_or((None, None));
        Ok(Place {
            fetch_on,
            latitude,
            longitude,
        })
    })
    .await
    .map_err(|e| e.to_string())?;
    if !fetch_enabled(place.fetch_on.as_ref()) {
        return Ok(());
    }
    let (Some(lat), Some(lon)) = (place.latitude, place.longitude) else {
        // A setup gap, not a job fault: the hospital's own view says "not
        // available" with this reason; the job heartbeat stays healthy.
        let reason = "No coordinates are set for the hospital or any campus".to_owned();
        return store_environment(pool, tenant_id, None, Err(reason)).await;
    };
    let fetched = environment::fetch(lat, lon).await;
    let failure = fetched.as_ref().err().cloned();
    store_environment(pool, tenant_id, Some((lat, lon)), fetched).await?;
    failure.map_or(Ok(()), Err)
}

/// The setting is on unless it is explicitly `false`.
pub const fn fetch_enabled(value: Option<&serde_json::Value>) -> bool {
    !matches!(value, Some(serde_json::Value::Bool(false)))
}

async fn store_environment(
    pool: &PgPool,
    tenant_id: Uuid,
    place: Option<(f64, f64)>,
    fetched: Result<environment::Reading, String>,
) -> Result<(), String> {
    let actor = Actor {
        tenant_id,
        user_id: Uuid::nil(),
    };
    let (ok, error) = match fetched {
        Ok(r) => (Some(r), None),
        Err(e) => (None, Some(e)),
    };
    let r = ok.unwrap_or_default();
    medbrains_kernel::work(pool, actor, async |tx| {
        // A failure moves only the attempt and the reason: the last good
        // reading stays, dated, and the view refuses to show it as current.
        sqlx::query(
            "INSERT INTO health_intel_environment AS e (tenant_id, attempted_at, ok_at, error, \
                 latitude, longitude, temperature_c, weather_code, forecast_max_c, \
                 forecast_max_on, pm2_5, pm10) \
             VALUES ($1, now(), CASE WHEN $2 THEN now() END, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
             ON CONFLICT (tenant_id) DO UPDATE SET \
                 attempted_at = EXCLUDED.attempted_at, error = EXCLUDED.error, \
                 ok_at = CASE WHEN $2 THEN EXCLUDED.ok_at ELSE e.ok_at END, \
                 latitude = COALESCE(EXCLUDED.latitude, e.latitude), \
                 longitude = COALESCE(EXCLUDED.longitude, e.longitude), \
                 temperature_c = CASE WHEN $2 THEN EXCLUDED.temperature_c ELSE e.temperature_c END, \
                 weather_code = CASE WHEN $2 THEN EXCLUDED.weather_code ELSE e.weather_code END, \
                 forecast_max_c = CASE WHEN $2 THEN EXCLUDED.forecast_max_c ELSE e.forecast_max_c END, \
                 forecast_max_on = CASE WHEN $2 THEN EXCLUDED.forecast_max_on ELSE e.forecast_max_on END, \
                 pm2_5 = CASE WHEN $2 THEN EXCLUDED.pm2_5 ELSE e.pm2_5 END, \
                 pm10 = CASE WHEN $2 THEN EXCLUDED.pm10 ELSE e.pm10 END",
        )
        .bind(tenant_id)
        .bind(ok.is_some())
        .bind(&error)
        .bind(place.map(|p| p.0))
        .bind(place.map(|p| p.1))
        .bind(r.temperature_c)
        .bind(r.weather_code)
        .bind(r.forecast_max_c)
        .bind(r.forecast_max_on)
        .bind(r.pm2_5)
        .bind(r.pm10)
        .execute(&mut **tx)
        .await?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::fetch_enabled;

    #[test]
    fn the_fetch_is_on_unless_explicitly_turned_off() {
        assert!(fetch_enabled(None));
        assert!(fetch_enabled(Some(&json!(true))));
        assert!(!fetch_enabled(Some(&json!(false))));
    }
}
