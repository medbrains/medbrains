//! Stations master — the concrete place a device/app instance sits (nurse station, OPD counter,
//! ward console, kiosk point, reception). Department-scoped; devices bind to a station so the boot
//! manifest resolves the real station instead of a free-text label. Gated `admin.settings.locations`.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const STATION_TYPES: &[&str] = &[
    "nurse_station",
    "opd_counter",
    "ward_console",
    "kiosk_point",
    "billing_counter",
    "pharmacy_counter",
    "lab_counter",
    "reception",
    "display",
    "other",
];

const STATION_COLS: &str =
    "id, department_id, code, name, station_type, location_scope, is_active, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Station {
    pub id: Uuid,
    pub department_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub station_type: String,
    pub location_scope: serde_json::Value,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/stations`
pub async fn list_stations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Station>>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Station>(&format!(
        "SELECT {STATION_COLS} FROM stations \
         WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT 5000"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateStationRequest {
    pub department_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub station_type: Option<String>,
    pub location_scope: Option<serde_json::Value>,
}

fn validate_type(t: &str) -> Result<(), AppError> {
    if STATION_TYPES.contains(&t) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("invalid station_type '{t}'")))
    }
}

/// `POST /api/stations`
pub async fn create_station(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStationRequest>,
) -> Result<Json<Station>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::CREATE)?;
    if body.code.trim().is_empty() || body.name.trim().is_empty() {
        return Err(AppError::BadRequest("code and name are required".to_owned()));
    }
    let station_type = body.station_type.as_deref().unwrap_or("other");
    validate_type(station_type)?;
    let scope = body.location_scope.unwrap_or_else(|| serde_json::json!({}));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Station>(&format!(
        "INSERT INTO stations \
         (tenant_id, department_id, code, name, station_type, location_scope, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {STATION_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(station_type)
    .bind(&scope)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateStationRequest {
    pub department_id: Option<Uuid>,
    pub name: Option<String>,
    pub station_type: Option<String>,
    pub location_scope: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

/// `PUT /api/stations/{id}`
pub async fn update_station(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStationRequest>,
) -> Result<Json<Station>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::UPDATE)?;
    if let Some(t) = body.station_type.as_deref() {
        validate_type(t)?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Station>(&format!(
        "UPDATE stations SET \
            department_id = COALESCE($3, department_id), \
            name = COALESCE($4, name), \
            station_type = COALESCE($5, station_type), \
            location_scope = COALESCE($6, location_scope), \
            is_active = COALESCE($7, is_active), \
            updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING {STATION_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.name.as_deref())
    .bind(body.station_type.as_deref())
    .bind(body.location_scope)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/stations/{id}` — soft delete.
pub async fn delete_station(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE stations SET deleted_at = now(), deleted_by = $3 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
