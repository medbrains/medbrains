//! Hospital micro-site module. Ticket #2953: health packages / promotions catalog + booking.
//! Booking a package auto-charges its price (reusing the billing seam) so the patient can settle
//! it online. Gated by the `specialty.health_packages.*` permission.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

const HP_COLS: &str = "id, name, description, price, includes, category, is_active, is_promoted, \
     valid_until, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HealthPackage {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub includes: Option<String>,
    pub category: Option<String>,
    pub is_active: bool,
    pub is_promoted: bool,
    pub valid_until: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PackageQuery {
    pub active_only: Option<bool>,
}

/// `GET /api/microsite/packages?active_only=` — the health-package catalog.
pub async fn list_health_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PackageQuery>,
) -> Result<Json<Vec<HealthPackage>>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HealthPackage>(&format!(
        "SELECT {HP_COLS} FROM health_packages \
         WHERE tenant_id = $1 AND ($2::bool IS NOT TRUE OR is_active = true) \
         ORDER BY is_promoted DESC, name LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.active_only)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertPackageRequest {
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub includes: Option<String>,
    pub category: Option<String>,
    pub is_active: Option<bool>,
    pub is_promoted: Option<bool>,
    pub valid_until: Option<NaiveDate>,
}

/// `POST /api/microsite/packages` — create a health package.
pub async fn create_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertPackageRequest>,
) -> Result<Json<HealthPackage>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Package name is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HealthPackage>(&format!(
        "INSERT INTO health_packages \
         (tenant_id, name, description, price, includes, category, is_active, is_promoted, valid_until) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), COALESCE($8, false), $9) \
         RETURNING {HP_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.description)
    .bind(body.price)
    .bind(&body.includes)
    .bind(&body.category)
    .bind(body.is_active)
    .bind(body.is_promoted)
    .bind(body.valid_until)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/microsite/packages/{id}` — update a health package.
pub async fn update_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertPackageRequest>,
) -> Result<Json<HealthPackage>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HealthPackage>(&format!(
        "UPDATE health_packages SET name = $3, description = $4, price = $5, includes = $6, \
            category = $7, is_active = COALESCE($8, is_active), \
            is_promoted = COALESCE($9, is_promoted), valid_until = $10, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {HP_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.description)
    .bind(body.price)
    .bind(&body.includes)
    .bind(&body.category)
    .bind(body.is_active)
    .bind(body.is_promoted)
    .bind(body.valid_until)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/microsite/packages/{id}` — deactivate a package (soft).
pub async fn delete_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query_scalar::<_, Uuid>(
        "UPDATE health_packages SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deactivated": done })))
}

#[derive(Debug, Deserialize)]
pub struct BookPackageRequest {
    pub patient_id: Uuid,
}

/// `POST /api/microsite/packages/{id}/book` — book a package for a patient; auto-charges the price
/// so it can be paid online. Returns the booking + the payable invoice.
pub async fn book_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<BookPackageRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pkg = sqlx::query_as::<_, (String, Decimal, bool)>(
        "SELECT name, price, is_active FROM health_packages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if !pkg.2 {
        return Err(AppError::BadRequest("Package is not active".to_owned()));
    }

    let booking_id: Uuid = sqlx::query_scalar(
        "INSERT INTO health_package_bookings (tenant_id, package_id, patient_id, booked_by) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let charge = super::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        super::billing::AutoChargeInput {
            patient_id: body.patient_id,
            encounter_id: None,
            charge_code: "HEALTH_PKG".to_owned(),
            source: "procedure".to_owned(),
            source_id: booking_id,
            quantity: 1,
            description_override: Some(pkg.0),
            unit_price_override: Some(pkg.1),
            tax_percent_override: None,
        },
    )
    .await?;

    sqlx::query("UPDATE health_package_bookings SET invoice_id = $2 WHERE id = $1")
        .bind(booking_id)
        .bind(charge.invoice_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(
        serde_json::json!({ "booking_id": booking_id, "invoice_id": charge.invoice_id }),
    ))
}
