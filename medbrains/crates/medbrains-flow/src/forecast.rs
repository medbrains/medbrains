//! Time on the floor: scrub back through today, and play forward a few hours.
//!
//! The scrub reads today's `flow_zone_minute` rows in 15-minute steps. The
//! forecast is seasonal-naive plus appointments (brief §4.5): the usual crowd
//! at that time on the same weekday over the last 4 weeks, never fewer than
//! the patients booked in the hour ahead. Labelled an estimate on screen.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Duration, DurationRound, Utc};
use medbrains_core::permissions::flow;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    LOCAL_TZ, begin, gate,
    live::zones_live,
    model::{ForecastInput, forecast_people},
    queries,
};

const STEP_MINUTES: i64 = 15;
const MAX_HOURS: i32 = 8;
const DEFAULT_HOURS: i32 = 4;

/// Shown with the forecast so a supervisor knows what it is built from.
pub const FORECAST_BASIS: &str = "Estimate: the usual crowd at this time on the same weekday \
     over the last 4 weeks (or now, with no history), and at least the patients booked in the \
     hour ahead who usually come, with their attendants.";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HistoryPoint {
    pub location_id: Uuid,
    pub at: DateTime<Utc>,
    pub people_est: Option<f64>,
    pub waiting: Option<f64>,
    pub wait_minutes: Option<f64>,
}

/// `GET /api/flow/floors/{id}/history` — today, every zone on the floor, in
/// 15-minute steps.
pub async fn floor_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(floor_id): Path<Uuid>,
) -> Result<Json<Vec<HistoryPoint>>, AppError> {
    gate(&state, &claims, flow::history::VIEW).await?;
    let mut tx = begin(&state, &claims).await?;
    let ids = queries::zones_on_floor(&mut tx, claims.tenant_id, floor_id).await?;
    let points = sqlx::query_as::<_, HistoryPoint>(&format!(
        "SELECT location_id, date_bin('15 minutes', minute, TIMESTAMPTZ '2000-01-01') AS at, \
                AVG(people_est)::float8 AS people_est, AVG(waiting)::float8 AS waiting, \
                AVG(wait_minutes)::float8 AS wait_minutes \
           FROM flow_zone_minute \
          WHERE tenant_id = $1 AND location_id = ANY($2) \
            AND minute >= date_trunc('day', now() AT TIME ZONE '{LOCAL_TZ}') AT TIME ZONE '{LOCAL_TZ}' \
          GROUP BY 1, 2 ORDER BY 2, 1 LIMIT 50000"
    ))
    .bind(claims.tenant_id)
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(points))
}

#[derive(Debug, Deserialize)]
pub struct ForecastQuery {
    pub hours: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ForecastPoint {
    pub location_id: Uuid,
    pub at: DateTime<Utc>,
    pub people_est: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct Forecast {
    pub start: DateTime<Utc>,
    pub step_minutes: i64,
    pub hours: i32,
    pub basis: &'static str,
    pub points: Vec<ForecastPoint>,
}

/// `GET /api/flow/floors/{id}/forecast?hours=4` — play forward up to 8 hours.
pub async fn floor_forecast(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(floor_id): Path<Uuid>,
    Query(q): Query<ForecastQuery>,
) -> Result<Json<Forecast>, AppError> {
    gate(&state, &claims, flow::VIEW).await?;
    let hours = q.hours.unwrap_or(DEFAULT_HOURS).clamp(1, MAX_HOURS);
    let tenant_id = claims.tenant_id;
    let start = Utc::now()
        .duration_trunc(Duration::minutes(STEP_MINUTES))
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut tx = begin(&state, &claims).await?;
    let ids = queries::zones_on_floor(&mut tx, tenant_id, floor_id).await?;
    let zones = zones_live(&mut tx, tenant_id, &ids).await?;
    let map = queries::zone_map(&mut tx, tenant_id, &ids).await?;
    let departments: Vec<Uuid> = map.departments.keys().copied().collect();

    let booked: Vec<(Uuid, DateTime<Utc>, i64)> = sqlx::query_as(&format!(
        "SELECT department_id, (appointment_date + slot_start) AT TIME ZONE '{LOCAL_TZ}' AS at, \
                COUNT(*)::bigint FROM appointments \
          WHERE tenant_id = $1 AND department_id = ANY($2) AND deleted_at IS NULL \
            AND appointment_date = (now() AT TIME ZONE '{LOCAL_TZ}')::date \
            AND status IN ('scheduled', 'confirmed') AND checked_in_at IS NULL \
            AND (appointment_date + slot_start) AT TIME ZONE '{LOCAL_TZ}' >= $3 \
          GROUP BY 1, 2 LIMIT 5000"
    ))
    .bind(tenant_id)
    .bind(&departments)
    .bind(start)
    .fetch_all(&mut *tx)
    .await?;
    // Same weekday, 1-4 weeks back, aligned to today's steps.
    let history: Vec<(Uuid, i32, f64)> = sqlx::query_as(
        "SELECT m.location_id, \
                FLOOR(EXTRACT(EPOCH FROM (m.minute + make_interval(days => 7 * k.k) - $3)) / 900)::int, \
                AVG(m.people_est)::float8 \
           FROM generate_series(1, 4) AS k(k) \
           JOIN flow_zone_minute m \
             ON m.minute >= $3 - make_interval(days => 7 * k.k) \
            AND m.minute < $3 - make_interval(days => 7 * k.k) + make_interval(hours => $4) \
          WHERE m.tenant_id = $1 AND m.location_id = ANY($2) AND m.people_est IS NOT NULL \
          GROUP BY 1, 2 LIMIT 20000",
    )
    .bind(tenant_id)
    .bind(&ids)
    .bind(start)
    .bind(hours)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let history: HashMap<(Uuid, i32), f64> = history
        .into_iter()
        .map(|(z, step, avg)| ((z, step), avg))
        .collect();
    let mut booked_by_zone: HashMap<Uuid, Vec<(DateTime<Utc>, i64)>> = HashMap::new();
    for (dept, at, n) in booked {
        if let Some(zone) = map.departments.get(&dept) {
            booked_by_zone.entry(*zone).or_default().push((at, n));
        }
    }
    let steps = hours * 60 / STEP_MINUTES as i32;
    let mut points = Vec::with_capacity(zones.len() * steps as usize);
    for zone in &zones {
        let slots = booked_by_zone
            .get(&zone.location_id)
            .map_or(&[][..], Vec::as_slice);
        for step in 0..steps {
            let at = start + Duration::minutes(i64::from(step) * STEP_MINUTES);
            let horizon = at + Duration::hours(1);
            let booked_next_hour = slots
                .iter()
                .filter(|(t, _)| *t >= at && *t < horizon)
                .map(|(_, n)| n)
                .sum();
            let input = ForecastInput {
                history_avg: history.get(&(zone.location_id, step)).copied(),
                booked_next_hour,
            };
            points.push(ForecastPoint {
                location_id: zone.location_id,
                at,
                people_est: forecast_people(zone.people_est, input, zone.attendant_factor),
            });
        }
    }
    Ok(Json(Forecast {
        start,
        step_minutes: STEP_MINUTES,
        hours,
        basis: FORECAST_BASIS,
        points,
    }))
}
