//! The hospital's codes on public-health portals: its Ni-kshay Health
//! Establishment code and its IHIP reporting-unit ID. Each heads the sheets
//! the hospital prepares for that portal.

use axum::{Extension, Json, extract::State};
use serde::{Deserialize, Serialize};

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Facility {
    pub name: String,
    pub registration_no: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub nikshay_he_code: Option<String>,
    pub ihip_unit_id: Option<String>,
}

pub const FACILITY_SQL: &str = "SELECT name, registration_no, phone, \
       NULLIF(concat_ws(', ', address_line1, address_line2, city, pincode), '') AS address, \
       nikshay_he_code, ihip_unit_id FROM tenants WHERE id = $1";

/// GET /api/ckb/facility-codes — the hospital's codes on public-health portals.
pub async fn facility_codes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::ckb::reports::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Both codes, as they should now read; blank clears one.
#[derive(Debug, Deserialize)]
pub struct FacilityCodes {
    pub nikshay_he_code: Option<String>,
    pub ihip_unit_id: Option<String>,
}

/// PUT /api/ckb/facility-codes — set them.
pub async fn set_facility_codes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<FacilityCodes>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::ckb::reports::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE tenants SET nikshay_he_code = NULLIF(btrim($2), ''), \
                ihip_unit_id = NULLIF(btrim($3), '') WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .bind(body.nikshay_he_code.as_deref())
    .bind(body.ihip_unit_id.as_deref())
    .execute(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}
