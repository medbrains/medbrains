//! What a hospital charges for, before anybody is charged it: the charge
//! master, procedure packages, and rate plans.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. This is
//! reference data, not transactions. It is maintained by finance in advance,
//! changes rarely, and is read by every invoice ever raised — the opposite
//! lifecycle to the rows it was sitting among.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::billing::{
    BillingPackage, BillingPackageItem, ChargeMaster, RatePlan, RatePlanItem,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
    },
    state::AppState,
};

// Request shapes and the field-access filters stay in `lib.rs` with the rest of
// the crate's shared surface, imported back rather than duplicated.
use crate::{
    CreateChargeMasterRequest, UpdateChargeMasterRequest, filter_billing_package_amounts,
    filter_billing_package_item_amounts, filter_charge_master_amounts,
    filter_rate_plan_item_amounts, resolve_billing_restricted_fields,
    validate_billing_amount_write_access,
};

// ══════════════════════════════════════════════════════════
//  Charge Master CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ChargeMaster>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChargeMaster>(
        "SELECT * FROM charge_master WHERE tenant_id = $1 ORDER BY category, name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_charge_master_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn create_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let tax_pct = body.tax_percent.unwrap_or(Decimal::ZERO);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ChargeMaster>(
        "INSERT INTO charge_master \
         (tenant_id, code, name, category, base_price, tax_percent, hsn_sac_code, gst_category) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.base_price)
    .bind(tax_pct)
    .bind(&body.hsn_sac_code)
    .bind(&body.gst_category)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_charge_master_amounts(row, &restricted_fields)))
}

pub async fn update_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.base_price.is_some() || body.tax_percent.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ChargeMaster>(
        "UPDATE charge_master SET \
         name = COALESCE($1, name), \
         category = COALESCE($2, category), \
         base_price = COALESCE($3, base_price), \
         tax_percent = COALESCE($4, tax_percent), \
         is_active = COALESCE($5, is_active), \
         hsn_sac_code = COALESCE($6, hsn_sac_code), \
         gst_category = COALESCE($7, gst_category), \
         updated_at = now() \
         WHERE id = $8 AND tenant_id = $9 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.base_price)
    .bind(body.tax_percent)
    .bind(body.is_active)
    .bind(&body.hsn_sac_code)
    .bind(&body.gst_category)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| Ok(Json(filter_charge_master_amounts(r, &restricted_fields))),
    )
}

pub async fn delete_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM charge_master WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Billing Packages
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreatePackageRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub total_price: Decimal,
    pub discount_percent: Option<Decimal>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub items: Vec<CreatePackageItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageItemRequest {
    pub charge_code: String,
    pub description: String,
    pub quantity: i32,
    pub unit_price: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePackageRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub total_price: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub is_active: Option<bool>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PackageDetailResponse {
    pub package: BillingPackage,
    pub items: Vec<BillingPackageItem>,
}

pub async fn list_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BillingPackage>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BillingPackage>(
        "SELECT * FROM billing_packages WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_billing_package_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn get_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PackageDetailResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::VIEW,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let package = sqlx::query_as::<_, BillingPackage>(
        "SELECT * FROM billing_packages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, BillingPackageItem>(
        "SELECT * FROM billing_package_items WHERE package_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let package = filter_billing_package_amounts(package, &restricted_fields);
    let items = items
        .into_iter()
        .map(|row| filter_billing_package_item_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(PackageDetailResponse { package, items }))
}

pub async fn create_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let disc = body.discount_percent.unwrap_or(Decimal::ZERO);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pkg = sqlx::query_as::<_, BillingPackage>(
        "INSERT INTO billing_packages \
         (tenant_id, code, name, description, total_price, discount_percent, \
          valid_from, valid_to) \
         VALUES ($1, $2, $3, $4, $5, $6, \
          $7::timestamptz, $8::timestamptz) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(disc)
    .bind(&body.valid_from)
    .bind(&body.valid_to)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO billing_package_items \
             (tenant_id, package_id, charge_code, description, quantity, unit_price) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(claims.tenant_id)
        .bind(pkg.id)
        .bind(&item.charge_code)
        .bind(&item.description)
        .bind(item.quantity)
        .bind(item.unit_price)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(filter_billing_package_amounts(
        pkg,
        &restricted_fields,
    )))
}

pub async fn update_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.total_price.is_some() || body.discount_percent.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BillingPackage>(
        "UPDATE billing_packages SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         total_price = COALESCE($3, total_price), \
         discount_percent = COALESCE($4, discount_percent), \
         is_active = COALESCE($5, is_active), \
         valid_from = COALESCE($6::timestamptz, valid_from), \
         valid_to = COALESCE($7::timestamptz, valid_to), \
         updated_at = now() \
         WHERE id = $8 AND tenant_id = $9 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(body.discount_percent)
    .bind(body.is_active)
    .bind(&body.valid_from)
    .bind(&body.valid_to)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| Ok(Json(filter_billing_package_amounts(r, &restricted_fields))),
    )
}

pub async fn delete_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM billing_packages WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Rate Plans
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRatePlanRequest {
    pub name: String,
    pub description: Option<String>,
    pub patient_category: Option<String>,
    pub is_default: Option<bool>,
    pub items: Vec<CreateRatePlanItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRatePlanItemRequest {
    pub charge_code: String,
    pub override_price: Decimal,
    pub override_tax_percent: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRatePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub patient_category: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RatePlanDetailResponse {
    pub plan: RatePlan,
    pub items: Vec<RatePlanItem>,
}

pub async fn list_rate_plans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RatePlan>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RatePlan>(
        "SELECT * FROM rate_plans WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RatePlanDetailResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::VIEW,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let plan =
        sqlx::query_as::<_, RatePlan>("SELECT * FROM rate_plans WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, RatePlanItem>(
        "SELECT * FROM rate_plan_items WHERE rate_plan_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let items = items
        .into_iter()
        .map(|row| filter_rate_plan_item_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(RatePlanDetailResponse { plan, items }))
}

pub async fn create_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRatePlanRequest>,
) -> Result<Json<RatePlan>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let plan = sqlx::query_as::<_, RatePlan>(
        "INSERT INTO rate_plans \
         (tenant_id, name, description, patient_category, is_default) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.patient_category)
    .bind(body.is_default.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO rate_plan_items \
             (tenant_id, rate_plan_id, charge_code, override_price, override_tax_percent) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(claims.tenant_id)
        .bind(plan.id)
        .bind(&item.charge_code)
        .bind(item.override_price)
        .bind(item.override_tax_percent)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(plan))
}

pub async fn update_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRatePlanRequest>,
) -> Result<Json<RatePlan>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RatePlan>(
        "UPDATE rate_plans SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         patient_category = COALESCE($3, patient_category), \
         is_default = COALESCE($4, is_default), \
         is_active = COALESCE($5, is_active), \
         updated_at = now() \
         WHERE id = $6 AND tenant_id = $7 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.patient_category)
    .bind(body.is_default)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM rate_plans WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
