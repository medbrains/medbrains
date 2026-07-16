//! Generic location/station handoff (open-pickup). A staff member posts a
//! handoff for a location (OT room, ward, bed, pharmacy/billing counter, …);
//! it sits OPEN until whoever staffs that location next acknowledges it.
//!
//! Self-service — any authenticated staff can post/see/acknowledge handoffs
//! for the stations they work (tenant-scoped via RLS), like the my-shift API.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StationHandoff {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub module: String,
    pub station_type: String,
    pub station_key: String,
    pub station_label: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub items: serde_json::Value,
    pub status: String,
    pub handed_off_by: Uuid,
    pub handed_off_at: DateTime<Utc>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct StationHandoffQuery {
    pub module: String,
    pub station_type: String,
    pub station_key: String,
    /// `open` (default) or `all` (include recently-acknowledged).
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStationHandoffRequest {
    pub module: String,
    pub station_type: String,
    pub station_key: String,
    pub station_label: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub items: Option<serde_json::Value>,
}

/// `GET /api/station-handoffs` — handoffs for a station (open by default).
pub async fn list_station_handoffs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<StationHandoffQuery>,
) -> Result<Json<Vec<StationHandoff>>, AppError> {
    let open_only = params.status.as_deref() != Some("all");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StationHandoff>(
        "SELECT * FROM station_handoffs \
         WHERE tenant_id = $1 AND module = $2 AND station_type = $3 AND station_key = $4 \
           AND ($5 = false OR status = 'open') \
         ORDER BY handed_off_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(&params.module)
    .bind(&params.station_type)
    .bind(&params.station_key)
    .bind(open_only)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/station-handoffs` — post a handoff for a station (status open).
pub async fn create_station_handoff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStationHandoffRequest>,
) -> Result<Json<StationHandoff>, AppError> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("A handoff title is required.".to_owned()));
    }
    let items = body.items.unwrap_or_else(|| serde_json::Value::Array(Vec::new()));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StationHandoff>(
        "INSERT INTO station_handoffs \
           (tenant_id, module, station_type, station_key, station_label, title, summary, \
            items, status, handed_off_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.module.trim())
    .bind(body.station_type.trim())
    .bind(body.station_key.trim())
    .bind(&body.station_label)
    .bind(body.title.trim())
    .bind(&body.summary)
    .bind(&items)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/station-handoffs/{id}/acknowledge` — pick up an open handoff.
pub async fn acknowledge_station_handoff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StationHandoff>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StationHandoff>(
        "UPDATE station_handoffs SET \
           status = 'acknowledged', acknowledged_by = $3, acknowledged_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}
