use axum::{
    Json,
    extract::{Path, Query, State},
};
use medbrains_core::geo::{
    GeoCountry, GeoDistrict, GeoState, GeoSubdistrict, GeoTown, PincodeResult, RegulatoryBody,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

// ── GET /api/geo/countries ──────────────────────────────────

pub async fn list_countries(
    State(state): State<AppState>,
) -> Result<Json<Vec<GeoCountry>>, AppError> {
    let rows = sqlx::query_as::<_, GeoCountry>(
        "SELECT * FROM geo_countries WHERE is_active = true ORDER BY name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/countries/:id/states ───────────────────────

pub async fn list_states(
    State(state): State<AppState>,
    Path(country_id): Path<Uuid>,
) -> Result<Json<Vec<GeoState>>, AppError> {
    let rows = sqlx::query_as::<_, GeoState>(
        "SELECT * FROM geo_states WHERE country_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(country_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/states/:id/districts ───────────────────────

pub async fn list_districts(
    State(state): State<AppState>,
    Path(state_id): Path<Uuid>,
) -> Result<Json<Vec<GeoDistrict>>, AppError> {
    let rows = sqlx::query_as::<_, GeoDistrict>(
        "SELECT * FROM geo_districts WHERE state_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(state_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/regulators ─────────────────────────────────

pub async fn list_regulators(
    State(state): State<AppState>,
) -> Result<Json<Vec<RegulatoryBody>>, AppError> {
    let rows = sqlx::query_as::<_, RegulatoryBody>(
        "SELECT * FROM regulatory_bodies WHERE is_active = true ORDER BY level, name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/regulators/auto-detect ─────────────────────

#[derive(Debug, Deserialize)]
pub struct AutoDetectQuery {
    pub country_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AutoDetectResponse {
    pub regulators: Vec<RegulatoryBody>,
}

pub async fn auto_detect_regulators(
    State(state): State<AppState>,
    Query(params): Query<AutoDetectQuery>,
) -> Result<Json<AutoDetectResponse>, AppError> {
    // Return all applicable regulators for the given geography
    let rows = sqlx::query_as::<_, RegulatoryBody>(
        "SELECT * FROM regulatory_bodies \
         WHERE is_active = true \
         AND (country_id IS NULL OR country_id = $1) \
         AND (state_id IS NULL OR state_id = $2) \
         ORDER BY level, name",
    )
    .bind(params.country_id)
    .bind(params.state_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(AutoDetectResponse { regulators: rows }))
}

// ── GET /api/geo/districts/:id/subdistricts ──────────────

pub async fn list_subdistricts(
    State(state): State<AppState>,
    Path(district_id): Path<Uuid>,
) -> Result<Json<Vec<GeoSubdistrict>>, AppError> {
    let rows = sqlx::query_as::<_, GeoSubdistrict>(
        "SELECT * FROM geo_subdistricts WHERE district_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(district_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/subdistricts/:id/towns ──────────────────

pub async fn list_towns(
    State(state): State<AppState>,
    Path(subdistrict_id): Path<Uuid>,
) -> Result<Json<Vec<GeoTown>>, AppError> {
    let rows = sqlx::query_as::<_, GeoTown>(
        "SELECT * FROM geo_towns WHERE subdistrict_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(subdistrict_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── GET /api/geo/pincode/:code ──────────────────────────

pub async fn search_pincode(
    State(state): State<AppState>,
    Path(pincode): Path<String>,
) -> Result<Json<Vec<PincodeResult>>, AppError> {
    let rows = sqlx::query_as::<_, PincodeResult>(
        "SELECT \
            t.id       AS town_id, \
            t.name     AS town_name, \
            t.pincode  AS pincode, \
            sd.id      AS subdistrict_id, \
            sd.name    AS subdistrict_name, \
            d.id       AS district_id, \
            d.name     AS district_name, \
            s.id       AS state_id, \
            s.name     AS state_name, \
            c.id       AS country_id, \
            c.name     AS country_name \
         FROM geo_towns t \
         JOIN geo_subdistricts sd ON sd.id = t.subdistrict_id \
         JOIN geo_districts d     ON d.id  = sd.district_id \
         JOIN geo_states s        ON s.id  = d.state_id \
         JOIN geo_countries c     ON c.id  = s.country_id \
         WHERE t.pincode = $1 AND t.is_active = true \
         ORDER BY t.name",
    )
    .bind(&pincode)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}
