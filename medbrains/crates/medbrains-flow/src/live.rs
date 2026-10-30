//! The live floor: what the map, the table alternative, the inspect drawer
//! and the TV board read. Every read here is over `flow_*` tables and the
//! location hierarchy, bounded to one floor; the one clinical read is the
//! inspect drawer's count of appointments booked in the next hour.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::flow;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_board_read, entitlement},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    LOCAL_TZ, MODULE, Tx,
    actions::{ALERT_COLUMNS, FlowAlert, FlowRecommendation, RECOMMENDATION_COLUMNS},
    begin, gate,
    model::{DEFAULT_TARGET_WAIT_MINUTES, ZoneFacts, why_red},
    queries,
};

/// A snapshot older than this is shown as stale, never as current.
pub const STALE_AFTER_SECS: i64 = 180;
/// Only the last few minutes count as "now"; older than this a zone is unknown.
const LIVE_WINDOW: &str = "10 minutes";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FloorSummary {
    pub id: Uuid,
    pub name: String,
    pub building_name: Option<String>,
    pub zone_count: i64,
}

/// A zone now. Every count is `None` when unknown: no recent minute, or its
/// source could not be read.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ZoneLive {
    pub location_id: Uuid,
    pub name: String,
    pub code: String,
    pub grid_row: Option<i32>,
    pub grid_col: Option<i32>,
    pub capacity: Option<i32>,
    pub comfort_limit: Option<i32>,
    pub attendant_factor: f64,
    pub goal_wait_minutes: Option<i32>,
    pub minute: Option<DateTime<Utc>>,
    pub people_est: Option<i32>,
    pub patients: Option<i32>,
    pub waiting: Option<i32>,
    pub checked_in: Option<i32>,
    pub visitors: Option<i32>,
    pub staff: Option<i32>,
    pub wait_minutes: Option<f64>,
    pub served_30m: Option<i32>,
    pub open_counters: Option<i32>,
    pub counters: serde_json::Value,
    pub unknown_sources: Vec<String>,
}

/// The team goal of one zone today: minutes its wait was on target.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TeamGoal {
    pub location_id: Uuid,
    pub goal_wait_minutes: i32,
    pub minutes_met: i64,
    pub minutes_measured: i64,
}

#[derive(Debug, Serialize)]
pub struct FloorLive {
    pub floor_id: Uuid,
    pub floor_name: String,
    pub as_of: Option<DateTime<Utc>>,
    pub stale: bool,
    pub zones: Vec<ZoneLive>,
    pub alerts: Vec<FlowAlert>,
    pub recommendations: Vec<FlowRecommendation>,
    pub goals: Vec<TeamGoal>,
}

/// `GET /api/flow/floors` — floors with configured zones, for the picker.
pub async fn list_floors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FloorSummary>>, AppError> {
    gate(&state, &claims, flow::VIEW).await?;
    let mut tx = begin(&state, &claims).await?;
    let floors = floors(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(floors))
}

async fn floors(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<FloorSummary>, AppError> {
    let by_zone = queries::floor_of_zones(tx, tenant_id).await?;
    let floor_ids: Vec<Uuid> = by_zone.values().copied().collect();
    Ok(sqlx::query_as::<_, FloorSummary>(
        "SELECT f.id, f.name, b.name AS building_name, \
                (SELECT COUNT(*) FROM UNNEST($3::uuid[]) AS z(f) WHERE z.f = f.id) AS zone_count \
           FROM locations f LEFT JOIN locations b ON b.id = f.parent_id \
          WHERE f.tenant_id = $1 AND f.id = ANY($2) AND f.deleted_at IS NULL \
          ORDER BY b.name NULLS LAST, f.name LIMIT 200",
    )
    .bind(tenant_id)
    .bind(&floor_ids)
    .bind(&floor_ids)
    .fetch_all(&mut **tx)
    .await?)
}

/// The latest minute of each zone, with its configuration.
pub async fn zones_live(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zone_ids: &[Uuid],
) -> Result<Vec<ZoneLive>, AppError> {
    Ok(sqlx::query_as::<_, ZoneLive>(&format!(
        "SELECT c.location_id, l.name, l.code, c.grid_row::int AS grid_row, \
                c.grid_col::int AS grid_col, c.capacity, c.comfort_limit, \
                c.attendant_factor::float8 AS attendant_factor, c.goal_wait_minutes, \
                m.minute, m.people_est, m.patients, m.waiting, m.checked_in, m.visitors, \
                m.staff, m.wait_minutes::float8 AS wait_minutes, m.served_30m, m.open_counters, \
                COALESCE(m.counters, '[]'::jsonb) AS counters, \
                COALESCE(m.unknown_sources, '{{}}'::text[]) AS unknown_sources \
           FROM flow_zone_config c JOIN locations l ON l.id = c.location_id \
           LEFT JOIN LATERAL ( \
                SELECT * FROM flow_zone_minute fm \
                 WHERE fm.tenant_id = c.tenant_id AND fm.location_id = c.location_id \
                   AND fm.minute >= now() - interval '{LIVE_WINDOW}' \
                 ORDER BY fm.minute DESC LIMIT 1) m ON true \
          WHERE c.tenant_id = $1 AND c.location_id = ANY($2) AND c.deleted_at IS NULL \
          ORDER BY l.name LIMIT $3"
    ))
    .bind(tenant_id)
    .bind(zone_ids)
    .bind(queries::MAX_ZONES)
    .fetch_all(&mut **tx)
    .await?)
}

/// One floor now, or `NotFound` when the floor does not exist here.
async fn floor_snapshot(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    floor_id: Uuid,
    with_actions: bool,
) -> Result<FloorLive, AppError> {
    let floor_name: String = sqlx::query_scalar(
        "SELECT name FROM locations WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(floor_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let ids = queries::zones_on_floor(tx, tenant_id, floor_id).await?;
    let zones = zones_live(tx, tenant_id, &ids).await?;
    let as_of = zones.iter().filter_map(|z| z.minute).max();
    let stale = as_of.is_none_or(|t| (Utc::now() - t).num_seconds() > STALE_AFTER_SECS);
    let (alerts, recommendations, goals) = if with_actions {
        (
            open_alerts(tx, tenant_id, &ids).await?,
            open_recommendations(tx, tenant_id, &ids).await?,
            goals(tx, tenant_id, &ids).await?,
        )
    } else {
        (Vec::new(), Vec::new(), Vec::new())
    };
    Ok(FloorLive {
        floor_id,
        floor_name,
        as_of,
        stale,
        zones,
        alerts,
        recommendations,
        goals,
    })
}

async fn open_alerts(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    ids: &[Uuid],
) -> Result<Vec<FlowAlert>, AppError> {
    Ok(sqlx::query_as::<_, FlowAlert>(&format!(
        "SELECT {ALERT_COLUMNS} FROM flow_alerts \
          WHERE tenant_id = $1 AND location_id = ANY($2) AND resolved_at IS NULL \
            AND deleted_at IS NULL ORDER BY raised_at DESC LIMIT 100"
    ))
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?)
}

async fn open_recommendations(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    ids: &[Uuid],
) -> Result<Vec<FlowRecommendation>, AppError> {
    Ok(sqlx::query_as::<_, FlowRecommendation>(&format!(
        "SELECT {RECOMMENDATION_COLUMNS} FROM flow_recommendations \
          WHERE tenant_id = $1 AND location_id = ANY($2) AND decision IS NULL \
            AND expired_at IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 100"
    ))
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?)
}

/// Opt-in: only zones whose team set a wait goal.
async fn goals(tx: &mut Tx<'_>, tenant_id: Uuid, ids: &[Uuid]) -> Result<Vec<TeamGoal>, AppError> {
    Ok(sqlx::query_as::<_, TeamGoal>(&format!(
        "SELECT c.location_id, c.goal_wait_minutes, \
                COUNT(*) FILTER (WHERE m.wait_minutes <= c.goal_wait_minutes) AS minutes_met, \
                COUNT(m.wait_minutes) AS minutes_measured \
           FROM flow_zone_config c \
           JOIN flow_zone_minute m ON m.tenant_id = c.tenant_id AND m.location_id = c.location_id \
            AND m.minute >= date_trunc('day', now() AT TIME ZONE '{LOCAL_TZ}') AT TIME ZONE '{LOCAL_TZ}' \
          WHERE c.tenant_id = $1 AND c.location_id = ANY($2) AND c.deleted_at IS NULL \
            AND c.goal_wait_minutes IS NOT NULL \
          GROUP BY c.location_id, c.goal_wait_minutes LIMIT 500"
    ))
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/flow/floors/{id}/live` — one snapshot per screen: zones,
/// counters, open alerts, open recommendations and team goals.
pub async fn floor_live(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(floor_id): Path<Uuid>,
) -> Result<Json<FloorLive>, AppError> {
    gate(&state, &claims, flow::VIEW).await?;
    let mut tx = begin(&state, &claims).await?;
    let live = floor_snapshot(&mut tx, claims.tenant_id, floor_id, true).await?;
    tx.commit().await?;
    Ok(Json(live))
}

#[derive(Debug, Deserialize)]
pub struct BoardQuery {
    pub floor_id: Option<Uuid>,
}

/// `GET /api/flow/board` — the command-centre wall board: zones and counts
/// only, no recommendations. A paired screen without a floor shows the floor
/// its department's zone is on.
pub async fn board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<BoardQuery>,
) -> Result<Json<FloorLive>, AppError> {
    require_board_read(&claims)?;
    entitlement::require_module_enabled(&state.db, claims.tenant_id, MODULE).await?;
    let mut tx = begin(&state, &claims).await?;
    let floor_id = match q.floor_id {
        Some(id) => id,
        None => board_floor(&mut tx, &claims)
            .await?
            .ok_or(AppError::NotFound)?,
    };
    let live = floor_snapshot(&mut tx, claims.tenant_id, floor_id, false).await?;
    tx.commit().await?;
    Ok(Json(live))
}

async fn board_floor(tx: &mut Tx<'_>, claims: &Claims) -> Result<Option<Uuid>, AppError> {
    let by_zone = queries::floor_of_zones(tx, claims.tenant_id).await?;
    let device_zone: Option<Uuid> = match claims.paired_device_id {
        Some(device) => {
            sqlx::query_scalar(
                "SELECT s.zone_location_id FROM paired_devices p \
               JOIN flow_zone_sources s ON s.tenant_id = p.tenant_id \
                AND s.department_id = p.department_id AND s.deleted_at IS NULL \
              WHERE p.tenant_id = $1 AND p.id = $2",
            )
            .bind(claims.tenant_id)
            .bind(device)
            .fetch_optional(&mut **tx)
            .await?
        }
        None => None,
    };
    let first = floors(tx, claims.tenant_id).await?.first().map(|f| f.id);
    Ok(device_zone.and_then(|z| by_zone.get(&z).copied()).or(first))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SeriesPoint {
    pub at: DateTime<Utc>,
    pub people_est: Option<f64>,
    pub waiting: Option<f64>,
    pub wait_minutes: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct ZoneDetail {
    pub zone: ZoneLive,
    /// The last 4 hours in 15-minute steps, for the sparkline and its table.
    pub series: Vec<SeriesPoint>,
    pub booked_next_hour: i64,
    pub reasons: Vec<String>,
    pub alerts: Vec<FlowAlert>,
    pub recommendations: Vec<FlowRecommendation>,
}

/// `GET /api/flow/zones/{id}` — the inspect drawer: why this zone is red.
pub async fn zone_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(zone_id): Path<Uuid>,
) -> Result<Json<ZoneDetail>, AppError> {
    gate(&state, &claims, flow::VIEW).await?;
    let mut tx = begin(&state, &claims).await?;
    let tenant_id = claims.tenant_id;
    let zone = zones_live(&mut tx, tenant_id, &[zone_id])
        .await?
        .into_iter()
        .next()
        .ok_or(AppError::NotFound)?;
    let series = sqlx::query_as::<_, SeriesPoint>(
        "SELECT date_bin('15 minutes', minute, TIMESTAMPTZ '2000-01-01') AS at, \
                AVG(people_est)::float8 AS people_est, AVG(waiting)::float8 AS waiting, \
                AVG(wait_minutes)::float8 AS wait_minutes \
           FROM flow_zone_minute \
          WHERE tenant_id = $1 AND location_id = $2 AND minute >= now() - interval '4 hours' \
          GROUP BY 1 ORDER BY 1 LIMIT 16",
    )
    .bind(tenant_id)
    .bind(zone_id)
    .fetch_all(&mut *tx)
    .await?;
    let booked_next_hour: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM appointments a \
           JOIN flow_zone_sources s ON s.tenant_id = a.tenant_id AND s.department_id = a.department_id \
            AND s.kind = 'department' AND s.deleted_at IS NULL AND s.zone_location_id = $2 \
          WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
            AND a.appointment_date = (now() AT TIME ZONE '{LOCAL_TZ}')::date \
            AND a.status IN ('scheduled', 'confirmed') AND a.checked_in_at IS NULL \
            AND a.slot_start >= (now() AT TIME ZONE '{LOCAL_TZ}')::time \
            AND a.slot_start < ((now() + interval '1 hour') AT TIME ZONE '{LOCAL_TZ}')::time"
    ))
    .bind(tenant_id)
    .bind(zone_id)
    .fetch_one(&mut *tx)
    .await?;
    let facts = ZoneFacts {
        people: zone.people_est,
        comfort_limit: zone.comfort_limit,
        capacity: zone.capacity,
        waiting: zone.waiting,
        wait_minutes: zone.wait_minutes,
        target_minutes: zone
            .goal_wait_minutes
            .unwrap_or(DEFAULT_TARGET_WAIT_MINUTES),
        open_counters: zone.open_counters,
        served_30m: zone.served_30m,
        staff: zone.staff,
        booked_next_hour: Some(booked_next_hour),
        unknown_sources: zone.unknown_sources.clone(),
    };
    let alerts = open_alerts(&mut tx, tenant_id, &[zone_id]).await?;
    let recommendations = open_recommendations(&mut tx, tenant_id, &[zone_id]).await?;
    tx.commit().await?;
    Ok(Json(ZoneDetail {
        reasons: why_red(&facts),
        zone,
        series,
        booked_next_hour,
        alerts,
        recommendations,
    }))
}
