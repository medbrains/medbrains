//! Admin endpoint to flip per-tenant DB topology (aurora ↔ patroni ↔ hybrid).
//!
//! Sprint B.4.3 per RFCs/sprints/SPRINT-B-patroni-ha.md §4.

use axum::{extract::State, Extension, Json};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct DbTopologyResponse {
    pub tenant_id: uuid::Uuid,
    pub topology: String,
    pub patroni_writer_url: Option<String>,
    pub patroni_reader_url: Option<String>,
    pub notes: Option<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDbTopologyRequest {
    pub topology: String,
    pub patroni_writer_url: Option<String>,
    pub patroni_reader_url: Option<String>,
    pub notes: Option<String>,
}

/// `GET /api/admin/db-topology` — read current topology for caller's tenant.
pub async fn get_db_topology(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DbTopologyResponse>, AppError> {
    require_permission(&claims, permissions::admin::db_topology::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: Option<(String, Option<String>, Option<String>, Option<String>, chrono::DateTime<chrono::Utc>)> =
        sqlx::query_as( // allow-raw-sql: admin endpoint reads tenant's own topology row
            "SELECT topology, patroni_writer_url, patroni_reader_url, notes, updated_at \
             FROM tenant_db_topology WHERE tenant_id = $1 LIMIT 1",
        )
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    tx.commit().await?;

    let resp = match row {
        Some((topology, w, r, notes, updated_at)) => DbTopologyResponse {
            tenant_id: claims.tenant_id,
            topology,
            patroni_writer_url: w,
            patroni_reader_url: r,
            notes,
            updated_at,
        },
        None => DbTopologyResponse {
            tenant_id: claims.tenant_id,
            topology: "aurora".to_string(),
            patroni_writer_url: None,
            patroni_reader_url: None,
            notes: None,
            updated_at: chrono::Utc::now(),
        },
    };
    Ok(Json(resp))
}

/// `POST /api/admin/db-topology` — flip topology.
pub async fn update_db_topology(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateDbTopologyRequest>,
) -> Result<Json<DbTopologyResponse>, AppError> {
    require_permission(&claims, permissions::admin::db_topology::MANAGE)?;

    let valid = ["aurora", "patroni", "aurora_with_patroni_reads"];
    if !valid.contains(&body.topology.as_str()) {
        return Err(AppError::BadRequest(format!(
            "invalid topology '{}': expected one of {}",
            body.topology,
            valid.join(", ")
        )));
    }
    if matches!(body.topology.as_str(), "patroni" | "aurora_with_patroni_reads")
        && (body.patroni_writer_url.is_none() || body.patroni_reader_url.is_none())
    {
        return Err(AppError::BadRequest(
            "patroni_writer_url and patroni_reader_url required for this topology".to_string(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: (String, Option<String>, Option<String>, Option<String>, chrono::DateTime<chrono::Utc>) =
        sqlx::query_as( // allow-raw-sql: admin endpoint upserts tenant's topology row
            "INSERT INTO tenant_db_topology \
                 (tenant_id, topology, patroni_writer_url, patroni_reader_url, notes, updated_by) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (tenant_id) DO UPDATE \
                 SET topology = EXCLUDED.topology, \
                     patroni_writer_url = EXCLUDED.patroni_writer_url, \
                     patroni_reader_url = EXCLUDED.patroni_reader_url, \
                     notes = EXCLUDED.notes, \
                     updated_by = EXCLUDED.updated_by, \
                     updated_at = now() \
             RETURNING topology, patroni_writer_url, patroni_reader_url, notes, updated_at",
        )
        .bind(claims.tenant_id)
        .bind(&body.topology)
        .bind(body.patroni_writer_url.as_deref())
        .bind(body.patroni_reader_url.as_deref())
        .bind(body.notes.as_deref())
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;

    // Phase B.4.4: when TopologyRouter is wired into AppState, also call
    // state.topology.invalidate(claims.tenant_id) here so the next request
    // hits the new pool. For now it propagates within 5min via the cache TTL.

    Ok(Json(DbTopologyResponse {
        tenant_id: claims.tenant_id,
        topology: row.0,
        patroni_writer_url: row.1,
        patroni_reader_url: row.2,
        notes: row.3,
        updated_at: row.4,
    }))
}
