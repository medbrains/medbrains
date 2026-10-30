//! Reads shared by the aggregator and the screens: the configured zones, what
//! feeds each, and where each zone sits in the location hierarchy. Every walk
//! of the hierarchy is one recursive query with a depth cap, never a loop of
//! queries.

use std::collections::HashMap;

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{Tx, model::ZoneMap};

/// Most zones a tenant may configure. A 300-zone campus is the brief's worst case.
pub const MAX_ZONES: i64 = 500;
/// Most mappings a tenant may hold.
const MAX_SOURCES: i64 = 2000;
/// Levels between a floor and a zone (floor > wing > zone) and between a zone
/// and anything a visitor pass can name inside it (zone > room > bed > station).
pub const MAX_DEPTH: i32 = 4;

/// A configured zone, as the aggregator needs it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ZoneSetup {
    pub location_id: Uuid,
    pub name: String,
    pub attendant_factor: f64,
    pub comfort_limit: Option<i32>,
    pub capacity: Option<i32>,
    pub goal_wait_minutes: Option<i32>,
}

#[derive(sqlx::FromRow)]
struct SourceRow {
    zone_location_id: Uuid,
    kind: String,
    department_id: Option<Uuid>,
    token_module: Option<String>,
    counter_label: Option<String>,
}

/// Every configured zone of the tenant whose location is still live.
pub async fn zones(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<ZoneSetup>, AppError> {
    Ok(sqlx::query_as::<_, ZoneSetup>(
        "SELECT c.location_id, l.name, c.attendant_factor::float8 AS attendant_factor, \
                c.comfort_limit, c.capacity, c.goal_wait_minutes \
           FROM flow_zone_config c \
           JOIN locations l ON l.id = c.location_id AND l.deleted_at IS NULL AND l.is_active \
          WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
          ORDER BY l.name LIMIT $2",
    )
    .bind(tenant_id)
    .bind(MAX_ZONES)
    .fetch_all(&mut **tx)
    .await?)
}

/// What feeds each zone, plus every location inside a zone (for visitor passes
/// that name a ward or room).
pub async fn zone_map(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zone_ids: &[Uuid],
) -> Result<ZoneMap, AppError> {
    let sources = sqlx::query_as::<_, SourceRow>(
        "SELECT zone_location_id, kind, department_id, token_module, counter_label \
           FROM flow_zone_sources WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND zone_location_id = ANY($2) LIMIT $3",
    )
    .bind(tenant_id)
    .bind(zone_ids)
    .bind(MAX_SOURCES)
    .fetch_all(&mut **tx)
    .await?;
    let inside: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "WITH RECURSIVE sub AS ( \
             SELECT id, id AS zone_id, 0 AS depth FROM locations \
              WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL \
             UNION ALL \
             SELECT l.id, sub.zone_id, sub.depth + 1 FROM locations l \
               JOIN sub ON l.parent_id = sub.id \
              WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND sub.depth < $3) \
         SELECT id, zone_id FROM sub LIMIT 20000",
    )
    .bind(tenant_id)
    .bind(zone_ids)
    .bind(MAX_DEPTH)
    .fetch_all(&mut **tx)
    .await?;

    let mut map = ZoneMap {
        locations: inside.into_iter().collect(),
        ..ZoneMap::default()
    };
    for s in sources {
        match (s.kind.as_str(), s.department_id, s.token_module) {
            ("department", Some(dept), _) => {
                map.departments.insert(dept, s.zone_location_id);
            }
            ("token_queue", _, Some(module)) => {
                map.queues
                    .insert((module, s.counter_label), s.zone_location_id);
            }
            _ => {}
        }
    }
    Ok(map)
}

/// The configured zones under one floor (through wings), by name.
pub async fn zones_on_floor(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    floor_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "WITH RECURSIVE sub AS ( \
             SELECT id, 0 AS depth FROM locations \
              WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL \
             UNION ALL \
             SELECT l.id, sub.depth + 1 FROM locations l JOIN sub ON l.parent_id = sub.id \
              WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND sub.depth < $3) \
         SELECT c.location_id FROM sub \
           JOIN flow_zone_config c ON c.location_id = sub.id \
                                  AND c.tenant_id = $1 AND c.deleted_at IS NULL \
           JOIN locations l ON l.id = c.location_id \
          ORDER BY l.name LIMIT $4",
    )
    .bind(tenant_id)
    .bind(floor_id)
    .bind(MAX_DEPTH)
    .bind(MAX_ZONES)
    .fetch_all(&mut **tx)
    .await?)
}

/// For each configured zone, the floor it is on (the nearest `floor` above it).
pub async fn floor_of_zones(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<HashMap<Uuid, Uuid>, AppError> {
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "WITH RECURSIVE up AS ( \
             SELECT c.location_id AS zone_id, l.id, l.parent_id, l.level::text AS level, 0 AS depth \
               FROM flow_zone_config c JOIN locations l ON l.id = c.location_id \
              WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
             UNION ALL \
             SELECT up.zone_id, p.id, p.parent_id, p.level::text, up.depth + 1 \
               FROM up JOIN locations p ON p.id = up.parent_id \
              WHERE up.level <> 'floor' AND up.depth < $2) \
         SELECT zone_id, id FROM up WHERE level = 'floor' LIMIT $3",
    )
    .bind(tenant_id)
    .bind(MAX_DEPTH)
    .bind(MAX_ZONES)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().collect())
}
