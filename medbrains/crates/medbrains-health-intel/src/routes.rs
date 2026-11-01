//! Health → Intelligence: one round trip for the whole screen, plus the
//! environment alone for the header's weather pill.

use axum::extract::State;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, AppError, Claims, Tx, require_permission};
use medbrains_server_core::state::AppState;
use serde::Serialize;
use uuid::Uuid;

use crate::baseline::suppress;
use crate::environment::{self, EnvironmentView, Reading, Stored};
use crate::job::{ENVIRONMENT_SETTING, fetch_enabled};
use crate::status::{self, CheckStatus, Heartbeat};

/// Notices shown, local first.
const NOTICE_LIMIT: i64 = 20;
/// Feeds and jobs read for the status line.
const HEARTBEAT_LIMIT: i64 = 100;
/// Conditions listed.
const CONDITION_LIMIT: i64 = 50;

#[derive(Debug, Serialize)]
pub struct ConditionSignal {
    pub condition: String,
    /// `None` means 1–4 cases ("fewer than 5"): small counts are suppressed.
    pub this_week: Option<i64>,
    /// The usual weekly count, rounded; `None` when under 5 or no history.
    pub usual: Option<i64>,
    /// `same_weeks_previous_years`, `rolling_8_weeks`, `not_enough_history`.
    pub method: String,
    /// `usual`, `higher`, `much_higher`.
    pub level: String,
    /// Weekly counts, oldest first; `None` for a suppressed week.
    pub series: Vec<Option<i64>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HealthNotice {
    pub id: Uuid,
    pub source: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub published_at: Option<DateTime<Utc>>,
    pub conditions: Vec<String>,
    pub regions: Vec<String>,
    /// Mentions the hospital's state or India.
    pub is_local: bool,
}

#[derive(Debug, Serialize)]
pub struct HealthIntel {
    pub conditions: Vec<ConditionSignal>,
    /// When the counts were last recomputed successfully; `None` if never.
    pub computed_at: Option<DateTime<Utc>>,
    /// The hospital's state, used to put local notices first.
    pub region: Option<String>,
    pub notices: Vec<HealthNotice>,
    pub environment: EnvironmentView,
    /// Every job and feed, worst first.
    pub checks: Vec<CheckStatus>,
}

#[derive(sqlx::FromRow)]
struct SignalRow {
    condition: String,
    this_week: i32,
    usual: Option<f64>,
    method: String,
    level: String,
    series: Vec<i32>,
}

fn present(row: SignalRow) -> ConditionSignal {
    let usual = row.usual.map(|u| {
        #[allow(clippy::cast_possible_truncation)] // a weekly count
        let rounded = u.round() as i64;
        rounded
    });
    ConditionSignal {
        condition: row.condition,
        this_week: suppress(i64::from(row.this_week)),
        usual: usual.and_then(suppress),
        method: row.method,
        level: row.level,
        series: row
            .series
            .into_iter()
            .map(|n| suppress(i64::from(n)))
            .collect(),
    }
}

async fn read_environment(tx: &mut Tx) -> Result<EnvironmentView, AppError> {
    let fetch_on = medbrains_kernel::config::get(tx, ENVIRONMENT_SETTING).await?;
    let tenant_id = tx.actor().tenant_id;
    #[allow(clippy::type_complexity)]
    let row: Option<(
        DateTime<Utc>,
        Option<DateTime<Utc>>,
        Option<String>,
        Option<f64>,
        Option<i32>,
        Option<f64>,
        Option<chrono::NaiveDate>,
        Option<f64>,
        Option<f64>,
    )> = sqlx::query_as(
        "SELECT attempted_at, ok_at, error, temperature_c::float8, weather_code, \
                forecast_max_c::float8, forecast_max_on, pm2_5::float8, pm10::float8 \
           FROM health_intel_environment WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let stored = row.map(|r| Stored {
        attempted_at: Some(r.0),
        ok_at: r.1,
        error: r.2,
        reading: Reading {
            temperature_c: r.3,
            weather_code: r.4,
            forecast_max_c: r.5,
            forecast_max_on: r.6,
            pm2_5: r.7,
            pm10: r.8,
        },
    });
    Ok(environment::view(
        stored.as_ref(),
        fetch_enabled(fetch_on.as_ref()),
        Utc::now(),
    ))
}

async fn read_checks(tx: &mut Tx) -> Result<Vec<CheckStatus>, AppError> {
    #[allow(clippy::type_complexity)]
    let rows: Vec<(
        String,
        String,
        String,
        i32,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT name, kind, label, interval_secs, last_attempt_at, last_ok_at, last_error \
           FROM health_intel_heartbeats ORDER BY name LIMIT $1",
    )
    .bind(HEARTBEAT_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let beats: Vec<Heartbeat> = rows
        .into_iter()
        .map(|r| Heartbeat {
            name: r.0,
            kind: r.1,
            label: r.2,
            interval_secs: r.3,
            last_attempt_at: r.4,
            last_ok_at: r.5,
            last_error: r.6,
        })
        .collect();
    Ok(status::statuses(&beats, Utc::now()))
}

async fn read_region(tx: &mut Tx) -> Result<Option<String>, AppError> {
    let tenant_id = tx.actor().tenant_id;
    Ok(sqlx::query_scalar(
        "SELECT s.name FROM ( \
             SELECT state_id, 0 AS rank FROM tenants WHERE id = $1 \
             UNION ALL \
             SELECT state_id, 1 FROM facilities \
              WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active) p \
           JOIN geo_states s ON s.id = p.state_id \
          ORDER BY p.rank LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn read_notices(tx: &mut Tx, region: Option<&str>) -> Result<Vec<HealthNotice>, AppError> {
    let local: Vec<&str> = region.into_iter().chain(["India"]).collect();
    Ok(sqlx::query_as::<_, HealthNotice>(
        "SELECT id, source, title, summary, url, published_at, conditions, regions, \
                regions && $1::text[] AS is_local \
           FROM ( \
             SELECT DISTINCT ON (url) id, source, title, summary, url, published_at, \
                    conditions, regions \
               FROM news_feed_articles \
              WHERE (conditions <> '{}' OR topic = 'Outbreak notices') \
                AND COALESCE(published_at, fetched_at) > now() - interval '30 days' \
              ORDER BY url, published_at DESC NULLS LAST) d \
          ORDER BY is_local DESC, published_at DESC NULLS LAST \
          LIMIT $2",
    )
    .bind(&local)
    .bind(NOTICE_LIMIT)
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/health-intel` — this week vs usual, public notices, weather and
/// air, and the state of every job and feed behind them.
pub async fn get_health_intel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<HealthIntel>, AppError> {
    require_permission(&claims, permissions::health::intel::VIEW)?;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let rows = sqlx::query_as::<_, SignalRow>(
            "SELECT condition, this_week, usual::float8 AS usual, method, level, series \
               FROM health_intel_condition_signals WHERE tenant_id = $1 \
              ORDER BY CASE level WHEN 'much_higher' THEN 0 WHEN 'higher' THEN 1 ELSE 2 END, \
                       this_week DESC, condition LIMIT $2",
        )
        .bind(claims.tenant_id)
        .bind(CONDITION_LIMIT)
        .fetch_all(&mut **tx)
        .await?;
        let region = read_region(tx).await?;
        let notices = read_notices(tx, region.as_deref()).await?;
        let environment = read_environment(tx).await?;
        let checks = read_checks(tx).await?;
        let computed_at = checks
            .iter()
            .find(|c| c.name == status::JOB_CONDITIONS)
            .and_then(|c| c.last_ok_at);
        Ok(Json(HealthIntel {
            conditions: rows.into_iter().map(present).collect(),
            computed_at,
            region,
            notices,
            environment,
            checks,
        }))
    })
    .await
}

/// `GET /api/health-intel/environment` — the weather and air reading alone.
pub async fn get_health_environment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<EnvironmentView>, AppError> {
    require_permission(&claims, permissions::health::intel::VIEW)?;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        read_environment(tx).await.map(Json)
    })
    .await
}
