//! Doctor packages (admin) — package templates + inclusion lines.
//! See `RFCs/sprints/SPRINT-doctor-activities.md` §2.3.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorPackage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub total_price: Decimal,
    pub validity_days: i32,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorPackageInclusion {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub package_id: Uuid,
    pub inclusion_type: String,
    pub consultation_specialty_id: Option<Uuid>,
    pub consultation_doctor_id: Option<Uuid>,
    pub service_id: Option<Uuid>,
    pub test_id: Option<Uuid>,
    pub procedure_id: Option<Uuid>,
    pub included_quantity: i32,
    pub notes: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct PackageWithInclusions {
    #[serde(flatten)]
    pub package: DoctorPackage,
    pub inclusions: Vec<DoctorPackageInclusion>,
}

#[derive(Debug, Deserialize)]
pub struct ListPackagesQuery {
    pub is_active: Option<bool>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub total_price: Decimal,
    pub validity_days: Option<i32>,
    #[serde(default)]
    pub inclusions: Vec<CreateInclusionRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInclusionRequest {
    pub inclusion_type: String,
    pub consultation_specialty_id: Option<Uuid>,
    pub consultation_doctor_id: Option<Uuid>,
    pub service_id: Option<Uuid>,
    pub test_id: Option<Uuid>,
    pub procedure_id: Option<Uuid>,
    pub included_quantity: i32,
    pub notes: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePackageRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub total_price: Option<Decimal>,
    pub validity_days: Option<i32>,
    pub is_active: Option<bool>,
}

pub async fn list_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListPackagesQuery>,
) -> Result<Json<Vec<DoctorPackage>>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorPackage>(
        "SELECT * FROM doctor_packages \
         WHERE tenant_id = $1 \
           AND ($2::boolean IS NULL OR is_active = $2) \
           AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%' OR code ILIKE '%' || $3 || '%') \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .bind(q.is_active)
    .bind(q.search.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PackageWithInclusions>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let package = sqlx::query_as::<_, DoctorPackage>(
        "SELECT * FROM doctor_packages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let inclusions = sqlx::query_as::<_, DoctorPackageInclusion>(
        "SELECT * FROM doctor_package_inclusions \
         WHERE tenant_id = $1 AND package_id = $2 \
         ORDER BY sort_order, id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PackageWithInclusions { package, inclusions }))
}

pub async fn create_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePackageRequest>,
) -> Result<Json<PackageWithInclusions>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let package = sqlx::query_as::<_, DoctorPackage>(
        "INSERT INTO doctor_packages \
         (tenant_id, code, name, description, total_price, validity_days, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(body.validity_days.unwrap_or(365))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let mut inclusions = Vec::with_capacity(body.inclusions.len());
    for (i, inc) in body.inclusions.iter().enumerate() {
        let row = sqlx::query_as::<_, DoctorPackageInclusion>(
            "INSERT INTO doctor_package_inclusions ( \
                tenant_id, package_id, inclusion_type, \
                consultation_specialty_id, consultation_doctor_id, \
                service_id, test_id, procedure_id, \
                included_quantity, notes, sort_order \
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(package.id)
        .bind(&inc.inclusion_type)
        .bind(inc.consultation_specialty_id)
        .bind(inc.consultation_doctor_id)
        .bind(inc.service_id)
        .bind(inc.test_id)
        .bind(inc.procedure_id)
        .bind(inc.included_quantity)
        .bind(&inc.notes)
        .bind(inc.sort_order.unwrap_or(i as i32))
        .fetch_one(&mut *tx)
        .await?;
        inclusions.push(row);
    }

    tx.commit().await?;
    Ok(Json(PackageWithInclusions { package, inclusions }))
}

pub async fn update_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePackageRequest>,
) -> Result<Json<DoctorPackage>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorPackage>(
        "UPDATE doctor_packages SET \
           name = COALESCE($3, name), \
           description = COALESCE($4, description), \
           total_price = COALESCE($5, total_price), \
           validity_days = COALESCE($6, validity_days), \
           is_active = COALESCE($7, is_active), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(body.validity_days)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn add_inclusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(package_id): Path<Uuid>,
    Json(body): Json<CreateInclusionRequest>,
) -> Result<Json<DoctorPackageInclusion>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorPackageInclusion>(
        "INSERT INTO doctor_package_inclusions ( \
            tenant_id, package_id, inclusion_type, \
            consultation_specialty_id, consultation_doctor_id, \
            service_id, test_id, procedure_id, \
            included_quantity, notes, sort_order \
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(package_id)
    .bind(&body.inclusion_type)
    .bind(body.consultation_specialty_id)
    .bind(body.consultation_doctor_id)
    .bind(body.service_id)
    .bind(body.test_id)
    .bind(body.procedure_id)
    .bind(body.included_quantity)
    .bind(&body.notes)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_inclusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_pid, iid)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::doctor_packages::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let n = sqlx::query("DELETE FROM doctor_package_inclusions WHERE id = $1 AND tenant_id = $2")
        .bind(iid)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "deleted": true })))
}
