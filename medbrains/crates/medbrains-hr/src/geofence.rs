//! Attendance geofencing (#4850): where a self-service punch was made, the
//! hospital's mode, and the settings HR uses to draw each campus's fence.
//!
//! The geometry and the verdict live in `medbrains_core::geofence`; this
//! module loads the fences and the mode, keeps the verdict with the punch,
//! and refuses it when the hospital blocks.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::geofence::{Fence, Fix, GeofenceMode, PunchCheck, PunchPlace, check_punch};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::HrTx;

const SETTINGS_CATEGORY: &str = "attendance";
const MODE_KEY: &str = "geofence_mode";
/// Campuses a punch is measured against, and the settings list shows.
const MAX_CAMPUSES: i64 = 500;
/// Smallest fence: below this, ordinary phone GPS drift reads as "outside".
const MIN_RADIUS_M: i32 = 25;
/// Largest fence: past this the fence no longer says "on site".
const MAX_RADIUS_M: i32 = 5000;

/// The device's position, sent with a start or end of shift. Every field is
/// optional: a browser that was refused location access sends nothing.
#[derive(Debug, Deserialize)]
pub struct PunchRequest {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy_m: Option<f64>,
}

impl PunchRequest {
    fn fix(&self) -> Option<Fix> {
        Some(Fix {
            latitude: self.latitude?,
            longitude: self.longitude?,
            accuracy_m: self.accuracy_m?,
        })
    }
}

async fn load_mode(tx: &mut HrTx<'_>, tenant_id: &Uuid) -> Result<GeofenceMode, AppError> {
    let value: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(SETTINGS_CATEGORY)
    .bind(MODE_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

async fn load_fences(tx: &mut HrTx<'_>, tenant_id: &Uuid) -> Result<Vec<Fence>, AppError> {
    let rows: Vec<(Uuid, String, f64, f64, i32)> = sqlx::query_as(
        "SELECT id, name, latitude::float8, longitude::float8, geofence_radius_m \
         FROM facilities \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active \
           AND latitude IS NOT NULL AND longitude IS NOT NULL \
           AND geofence_radius_m IS NOT NULL \
         ORDER BY name LIMIT $2",
    )
    .bind(tenant_id)
    .bind(MAX_CAMPUSES)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(facility_id, name, latitude, longitude, radius)| Fence {
            facility_id,
            name,
            latitude,
            longitude,
            radius_m: f64::from(radius),
        })
        .collect())
}

/// What is kept with the punch.
fn location_doc(mode: GeofenceMode, check: &PunchCheck) -> Value {
    let inside = match check.place {
        PunchPlace::Inside => Some(true),
        PunchPlace::Outside => Some(false),
        _ => None,
    };
    json!({
        "lat": check.fix.map(|f| f.latitude),
        "lng": check.fix.map(|f| f.longitude),
        "accuracy_m": check.fix.map(|f| f.accuracy_m.round()),
        "distance_m": check.distance_m.map(f64::round),
        "inside": inside,
        "place": check.place,
        "facility_id": check.facility_id,
        "facility_name": check.facility_name,
        "flagged": mode.flags(check),
    })
}

/// Judge a punch against the campus fences: the location to keep with it,
/// or the refusal when the hospital blocks. A refusal writes nothing.
pub(crate) async fn judge_punch(
    tx: &mut HrTx<'_>,
    tenant_id: &Uuid,
    body: Option<&PunchRequest>,
) -> Result<Value, AppError> {
    let mode = load_mode(tx, tenant_id).await?;
    let fences = if mode == GeofenceMode::Off {
        Vec::new()
    } else {
        load_fences(tx, tenant_id).await?
    };
    let check = check_punch(body.and_then(PunchRequest::fix), &fences);
    if let Some(refusal) = mode.refusal(&check) {
        return Err(AppError::ForbiddenReason(refusal));
    }
    Ok(location_doc(mode, &check))
}

// ── Settings ────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampusFence {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub facility_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub geofence_radius_m: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct GeofenceSettings {
    pub mode: GeofenceMode,
    pub campuses: Vec<CampusFence>,
}

#[derive(Debug, Deserialize)]
pub struct SetModeRequest {
    pub mode: GeofenceMode,
}

#[derive(Debug, Deserialize)]
pub struct SetCampusFenceRequest {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    /// `None` takes the fence off this campus.
    pub radius_m: Option<i32>,
}

const CAMPUS_COLUMNS: &str = "id, code, name, facility_type::text AS facility_type, \
     latitude::float8 AS latitude, longitude::float8 AS longitude, geofence_radius_m";

/// `GET /api/hr/attendance/geofence`
pub async fn get_geofence_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<GeofenceSettings>, AppError> {
    require_permission(&claims, permissions::hr::attendance::geofence::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mode = load_mode(&mut tx, &claims.tenant_id).await?;
    let campuses = sqlx::query_as::<_, CampusFence>(&format!(
        "SELECT {CAMPUS_COLUMNS} FROM facilities \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active \
         ORDER BY name LIMIT $2"
    ))
    .bind(claims.tenant_id)
    .bind(MAX_CAMPUSES)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(GeofenceSettings { mode, campuses }))
}

/// `PUT /api/hr/attendance/geofence/mode`
pub async fn set_geofence_mode(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SetModeRequest>,
) -> Result<Json<SetModeResponse>, AppError> {
    require_permission(&claims, permissions::hr::attendance::geofence::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(SETTINGS_CATEGORY)
    .bind(MODE_KEY)
    .bind(json!(body.mode))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(SetModeResponse { mode: body.mode }))
}

#[derive(Debug, Serialize)]
pub struct SetModeResponse {
    pub mode: GeofenceMode,
}

fn validate_fence(body: &SetCampusFenceRequest) -> Result<(), AppError> {
    let bad = |msg: &str| Err(AppError::BadRequest(msg.to_owned()));
    if body.latitude.is_some() != body.longitude.is_some() {
        return bad("Give both latitude and longitude, or neither.");
    }
    if body.latitude.is_some_and(|v| !(-90.0..=90.0).contains(&v)) {
        return bad("Latitude must be between -90 and 90.");
    }
    if body
        .longitude
        .is_some_and(|v| !(-180.0..=180.0).contains(&v))
    {
        return bad("Longitude must be between -180 and 180.");
    }
    if body.radius_m.is_some() && body.latitude.is_none() {
        return bad("Set the campus location before its fence radius.");
    }
    if body
        .radius_m
        .is_some_and(|r| !(MIN_RADIUS_M..=MAX_RADIUS_M).contains(&r))
    {
        return Err(AppError::BadRequest(format!(
            "Fence radius must be between {MIN_RADIUS_M} and {MAX_RADIUS_M} metres."
        )));
    }
    Ok(())
}

/// `PUT /api/hr/attendance/geofence/campuses/{id}`
pub async fn set_campus_fence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetCampusFenceRequest>,
) -> Result<Json<CampusFence>, AppError> {
    require_permission(&claims, permissions::hr::attendance::geofence::MANAGE)?;
    validate_fence(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, CampusFence>(&format!(
        "UPDATE facilities SET latitude = $3, longitude = $4, geofence_radius_m = $5 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING {CAMPUS_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.radius_m)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{SetCampusFenceRequest, validate_fence};

    fn req(lat: Option<f64>, lng: Option<f64>, radius_m: Option<i32>) -> SetCampusFenceRequest {
        SetCampusFenceRequest {
            latitude: lat,
            longitude: lng,
            radius_m,
        }
    }

    #[test]
    fn a_fence_needs_a_whole_location_and_a_sane_radius() {
        assert!(validate_fence(&req(Some(13.08), Some(80.27), Some(300))).is_ok());
        assert!(
            validate_fence(&req(None, None, None)).is_ok(),
            "clearing is allowed"
        );
        assert!(validate_fence(&req(Some(13.08), None, None)).is_err());
        assert!(validate_fence(&req(None, None, Some(300))).is_err());
        assert!(validate_fence(&req(Some(91.0), Some(80.27), None)).is_err());
        assert!(validate_fence(&req(Some(13.08), Some(80.27), Some(10))).is_err());
        assert!(validate_fence(&req(Some(13.08), Some(80.27), Some(9000))).is_err());
    }
}
