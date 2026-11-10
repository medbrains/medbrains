//! Flow setup, for the facility admin: zones come from the location
//! hierarchy (the `zone` level under each floor); this sets each zone's
//! limits, attendant factor, wait goal and grid place, and maps the
//! departments and token queues that feed it.
//!
//! ponytail: a schematic grid (row, column) rather than polygons drawn on an
//! uploaded floor plan. The grid works on day one with no drawing; add plan
//! upload + polygons when a pilot hospital asks for its real outline.

use std::collections::{HashMap, HashSet};

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions::flow;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{Tx, begin, gate, live::FloorSummary};

/// Token queues a zone can take. The same boards a paired screen can show.
pub const TOKEN_MODULES: [&str; 6] = [
    "registration",
    "opd",
    "lab",
    "radiology",
    "pharmacy",
    "billing",
];
const MAX_SOURCES_PER_ZONE: usize = 50;

/// `GET /api/flow/config/floors` — every floor, with how many zones it has.
pub async fn list_config_floors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FloorSummary>>, AppError> {
    gate(&state, &claims, flow::MANAGE).await?;
    let mut tx = begin(&state, &claims).await?;
    let floors = sqlx::query_as::<_, FloorSummary>(
        "WITH RECURSIVE sub AS ( \
             SELECT id AS floor_id, id, level::text AS level, 0 AS depth FROM locations \
              WHERE tenant_id = $1 AND level = 'floor' AND deleted_at IS NULL \
             UNION ALL \
             SELECT sub.floor_id, l.id, l.level::text, sub.depth + 1 \
               FROM locations l JOIN sub ON l.parent_id = sub.id \
              WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND sub.depth < 2 \
                AND l.level IN ('wing', 'zone')) \
         SELECT f.id, f.name, b.name AS building_name, \
                COUNT(sub.id) FILTER (WHERE sub.level = 'zone') AS zone_count \
           FROM locations f LEFT JOIN locations b ON b.id = f.parent_id \
           LEFT JOIN sub ON sub.floor_id = f.id \
          WHERE f.tenant_id = $1 AND f.level = 'floor' AND f.deleted_at IS NULL \
          GROUP BY f.id, f.name, b.name ORDER BY b.name NULLS LAST, f.name LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(floors))
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ZoneSource {
    pub id: Uuid,
    pub zone_location_id: Uuid,
    pub kind: String,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub token_module: Option<String>,
    pub counter_label: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConfigZone {
    pub location_id: Uuid,
    pub name: String,
    pub code: String,
    pub configured: bool,
    pub capacity: Option<i32>,
    pub comfort_limit: Option<i32>,
    pub attendant_factor: f64,
    pub goal_wait_minutes: Option<i32>,
    pub grid_row: Option<i32>,
    pub grid_col: Option<i32>,
    #[sqlx(skip)]
    pub sources: Vec<ZoneSource>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentOption {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct FloorSetup {
    pub zones: Vec<ConfigZone>,
    pub departments: Vec<DepartmentOption>,
    pub token_modules: [&'static str; 6],
}

/// `GET /api/flow/config/floors/{id}/zones` — the floor's zones (directly or
/// through a wing), configured or not, with what feeds each.
pub async fn list_config_zones(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(floor_id): Path<Uuid>,
) -> Result<Json<FloorSetup>, AppError> {
    gate(&state, &claims, flow::MANAGE).await?;
    let mut tx = begin(&state, &claims).await?;
    let zones = config_zones(&mut tx, claims.tenant_id, floor_id, None).await?;
    let departments = sqlx::query_as::<_, DepartmentOption>(
        "SELECT id, name FROM departments \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active ORDER BY name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(FloorSetup {
        zones,
        departments,
        token_modules: TOKEN_MODULES,
    }))
}

/// Zones under `floor_id` (or exactly `only`), each with its sources.
async fn config_zones(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    floor_id: Uuid,
    only: Option<Uuid>,
) -> Result<Vec<ConfigZone>, AppError> {
    let mut zones = sqlx::query_as::<_, ConfigZone>(
        "WITH RECURSIVE sub AS ( \
             SELECT id, level::text AS level, 0 AS depth FROM locations \
              WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL \
             UNION ALL \
             SELECT l.id, l.level::text, sub.depth + 1 FROM locations l JOIN sub ON l.parent_id = sub.id \
              WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND sub.depth < 2) \
         SELECT l.id AS location_id, l.name, l.code, (c.id IS NOT NULL) AS configured, \
                c.capacity, c.comfort_limit, \
                COALESCE(c.attendant_factor, 1.80)::float8 AS attendant_factor, \
                c.goal_wait_minutes, c.grid_row::int AS grid_row, c.grid_col::int AS grid_col \
           FROM sub JOIN locations l ON l.id = sub.id \
           LEFT JOIN flow_zone_config c ON c.tenant_id = l.tenant_id AND c.location_id = l.id \
                AND c.deleted_at IS NULL \
          WHERE sub.level = 'zone' AND ($3::uuid IS NULL OR l.id = $3) \
          ORDER BY l.name LIMIT 500",
    )
    .bind(tenant_id)
    .bind(floor_id)
    .bind(only)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = zones.iter().map(|z| z.location_id).collect();
    let sources = sqlx::query_as::<_, ZoneSource>(
        "SELECT s.id, s.zone_location_id, s.kind, s.department_id, d.name AS department_name, \
                s.token_module, s.counter_label \
           FROM flow_zone_sources s LEFT JOIN departments d ON d.id = s.department_id \
          WHERE s.tenant_id = $1 AND s.zone_location_id = ANY($2) AND s.deleted_at IS NULL \
          ORDER BY s.kind, d.name, s.token_module, s.counter_label LIMIT 2000",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_zone: HashMap<Uuid, Vec<ZoneSource>> = HashMap::new();
    for s in sources {
        by_zone.entry(s.zone_location_id).or_default().push(s);
    }
    for zone in &mut zones {
        zone.sources = by_zone.remove(&zone.location_id).unwrap_or_default();
    }
    Ok(zones)
}

/// A zone's level, its parent's id and level, and its grandparent's id.
type ZoneParents = (String, Option<Uuid>, Option<String>, Option<Uuid>);

/// A mapping normalised: kind, department, token module, counter label.
type Source = (String, Option<Uuid>, Option<String>, Option<String>);

/// The floor a zone is on, refusing anything that is not a live zone here.
async fn floor_of_zone(tx: &mut Tx<'_>, tenant_id: Uuid, zone_id: Uuid) -> Result<Uuid, AppError> {
    let row: Option<ZoneParents> = sqlx::query_as(
        "SELECT z.level::text, p.id, p.level::text, p.parent_id FROM locations z \
           LEFT JOIN locations p ON p.id = z.parent_id \
          WHERE z.tenant_id = $1 AND z.id = $2 AND z.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(zone_id)
    .fetch_optional(&mut **tx)
    .await?;
    match row {
        Some((level, Some(parent), Some(parent_level), _))
            if level == "zone" && parent_level == "floor" =>
        {
            Ok(parent)
        }
        Some((level, _, Some(parent_level), Some(grandparent)))
            if level == "zone" && parent_level == "wing" =>
        {
            Ok(grandparent)
        }
        Some(_) => Err(AppError::BadRequest(
            "Only a zone on a floor (directly or in a wing) can be set up for Flow".to_owned(),
        )),
        None => Err(AppError::NotFound),
    }
}

#[derive(Debug, Deserialize)]
pub struct ZoneConfigInput {
    pub capacity: Option<i32>,
    pub comfort_limit: Option<i32>,
    pub attendant_factor: f64,
    pub goal_wait_minutes: Option<i32>,
    pub grid_row: Option<i32>,
    pub grid_col: Option<i32>,
}

/// The first rule an input breaks, in words the admin can act on.
pub fn validate_zone_input(input: &ZoneConfigInput) -> Option<&'static str> {
    let positive = |v: Option<i32>| v.is_none_or(|n| n > 0);
    let in_grid = |v: Option<i32>| v.is_none_or(|n| (1..=12).contains(&n));
    if !positive(input.capacity) || !positive(input.comfort_limit) {
        Some("Capacity and comfort limit must be more than zero")
    } else if input
        .comfort_limit
        .zip(input.capacity)
        .is_some_and(|(c, cap)| c > cap)
    {
        Some("The comfort limit cannot be above the capacity")
    } else if !(1.0..=5.0).contains(&input.attendant_factor) {
        Some("The attendant factor must be between 1 and 5")
    } else if input
        .goal_wait_minutes
        .is_some_and(|g| !(1..=240).contains(&g))
    {
        Some("A wait goal must be between 1 and 240 minutes")
    } else if !in_grid(input.grid_row) || !in_grid(input.grid_col) {
        Some("Grid row and column must be between 1 and 12")
    } else {
        None
    }
}

/// `PUT /api/flow/config/zones/{id}` — set a zone's limits, factor, goal and place.
pub async fn update_zone(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(zone_id): Path<Uuid>,
    Json(body): Json<ZoneConfigInput>,
) -> Result<Json<ConfigZone>, AppError> {
    gate(&state, &claims, flow::MANAGE).await?;
    if let Some(problem) = validate_zone_input(&body) {
        return Err(AppError::BadRequest(problem.to_owned()));
    }
    let mut tx = begin(&state, &claims).await?;
    let floor_id = floor_of_zone(&mut tx, claims.tenant_id, zone_id).await?;
    sqlx::query(
        "INSERT INTO flow_zone_config (tenant_id, location_id, capacity, comfort_limit, \
             attendant_factor, goal_wait_minutes, grid_row, grid_col, updated_by) \
         VALUES ($1, $2, $3, $4, $5::numeric(3,2), $6, $7::smallint, $8::smallint, $9) \
         ON CONFLICT (tenant_id, location_id) WHERE deleted_at IS NULL DO UPDATE SET \
             capacity = EXCLUDED.capacity, comfort_limit = EXCLUDED.comfort_limit, \
             attendant_factor = EXCLUDED.attendant_factor, \
             goal_wait_minutes = EXCLUDED.goal_wait_minutes, grid_row = EXCLUDED.grid_row, \
             grid_col = EXCLUDED.grid_col, updated_by = EXCLUDED.updated_by",
    )
    .bind(claims.tenant_id)
    .bind(zone_id)
    .bind(body.capacity)
    .bind(body.comfort_limit)
    .bind(body.attendant_factor)
    .bind(body.goal_wait_minutes)
    .bind(body.grid_row)
    .bind(body.grid_col)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let zone = one_zone(&mut tx, claims.tenant_id, floor_id, zone_id).await?;
    tx.commit().await?;
    Ok(Json(zone))
}

async fn one_zone(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    floor: Uuid,
    zone: Uuid,
) -> Result<ConfigZone, AppError> {
    config_zones(tx, tenant_id, floor, Some(zone))
        .await?
        .into_iter()
        .next()
        .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct SourceInput {
    pub kind: String,
    pub department_id: Option<Uuid>,
    pub token_module: Option<String>,
    pub counter_label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SourcesInput {
    pub sources: Vec<SourceInput>,
}

/// One mapping, normalised, or the reason it is refused.
fn normalise(s: &SourceInput) -> Result<Source, &'static str> {
    let label = s
        .counter_label
        .as_deref()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_owned);
    match (s.kind.as_str(), s.department_id, s.token_module.as_deref()) {
        ("department", Some(dept), None) if label.is_none() => {
            Ok(("department".to_owned(), Some(dept), None, None))
        }
        ("token_queue", None, Some(m)) if TOKEN_MODULES.contains(&m) => {
            Ok(("token_queue".to_owned(), None, Some(m.to_owned()), label))
        }
        _ => Err("Each mapping is a department, or a token queue (with an optional counter)"),
    }
}

/// `PUT /api/flow/config/zones/{id}/sources` — replace what feeds the zone.
pub async fn replace_sources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(zone_id): Path<Uuid>,
    Json(body): Json<SourcesInput>,
) -> Result<Json<ConfigZone>, AppError> {
    gate(&state, &claims, flow::MANAGE).await?;
    if body.sources.len() > MAX_SOURCES_PER_ZONE {
        return Err(AppError::BadRequest(
            "At most 50 mappings per zone".to_owned(),
        ));
    }
    let rows = body
        .sources
        .iter()
        .map(normalise)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|m| AppError::BadRequest(m.to_owned()))?;
    let depts: HashSet<Uuid> = rows.iter().filter_map(|r| r.1).collect();
    let tenant_id = claims.tenant_id;
    let mut tx = begin(&state, &claims).await?;
    let floor_id = floor_of_zone(&mut tx, tenant_id, zone_id).await?;
    let depts: Vec<Uuid> = depts.into_iter().collect();
    let known: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM departments WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&depts)
    .fetch_one(&mut *tx)
    .await?;
    if usize::try_from(known).ok() != Some(depts.len()) {
        return Err(AppError::BadRequest(
            "A department in the list does not exist here".to_owned(),
        ));
    }
    // A zone that gets a mapping is a zone Flow counts.
    sqlx::query(
        "INSERT INTO flow_zone_config (tenant_id, location_id, updated_by) VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id, location_id) WHERE deleted_at IS NULL DO NOTHING",
    )
    .bind(tenant_id)
    .bind(zone_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE flow_zone_sources SET deleted_at = now(), deleted_by = $3, delete_reason = 'replaced' \
          WHERE tenant_id = $1 AND zone_location_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(zone_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    insert_sources(&mut tx, tenant_id, zone_id, claims.sub, &rows).await?;
    let zone = one_zone(&mut tx, tenant_id, floor_id, zone_id).await?;
    tx.commit().await?;
    Ok(Json(zone))
}

type SourceRow = (String, Option<Uuid>, Option<String>, Option<String>);

async fn insert_sources(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zone_id: Uuid,
    actor: Uuid,
    rows: &[SourceRow],
) -> Result<(), AppError> {
    let kinds: Vec<&str> = rows.iter().map(|r| r.0.as_str()).collect();
    let depts: Vec<Option<Uuid>> = rows.iter().map(|r| r.1).collect();
    let modules: Vec<Option<&str>> = rows.iter().map(|r| r.2.as_deref()).collect();
    let labels: Vec<Option<&str>> = rows.iter().map(|r| r.3.as_deref()).collect();
    sqlx::query(
        "INSERT INTO flow_zone_sources (tenant_id, zone_location_id, kind, department_id, \
             token_module, counter_label, created_by) \
         SELECT $1, $2, s.kind, s.dept, s.module, s.label, $3 \
           FROM UNNEST($4::text[], $5::uuid[], $6::text[], $7::text[]) AS s(kind, dept, module, label)",
    )
    .bind(tenant_id)
    .bind(zone_id)
    .bind(actor)
    .bind(&kinds)
    .bind(&depts)
    .bind(&modules)
    .bind(&labels)
    .execute(&mut **tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505") => AppError::Conflict(
            "A department or queue in this list already feeds another zone, or is listed twice. \
             Remove it there first."
                .to_owned(),
        ),
        other => other.into(),
    })?;
    Ok(())
}
