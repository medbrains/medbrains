//! Pharmacy free dispensings + cashier overrides + supplier payments + margins.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

// ── pharmacy_free_dispensings ───────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FreeDispensing {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pharmacy_order_id: Uuid,
    pub category: String,
    pub scheme_code: Option<String>,
    pub approving_user_id: Uuid,
    pub cost_value: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFreeDispensingRequest {
    pub pharmacy_order_id: Uuid,
    pub category: String,
    pub scheme_code: Option<String>,
    pub cost_value: Decimal,
    pub notes: Option<String>,
}

pub async fn approve_free_dispensing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFreeDispensingRequest>,
) -> Result<Json<FreeDispensing>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::free_dispensing::APPROVE,
    )?;
    if body.cost_value < Decimal::ZERO {
        return Err(AppError::BadRequest("cost_value must be >= 0".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FreeDispensing>(
        "INSERT INTO pharmacy_free_dispensings \
         (tenant_id, pharmacy_order_id, category, scheme_code, approving_user_id, cost_value, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_order_id)
    .bind(&body.category)
    .bind(&body.scheme_code)
    .bind(claims.sub)
    .bind(body.cost_value)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListFreeDispensingQuery {
    pub category: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub limit: Option<i64>,
}

pub async fn list_free_dispensings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListFreeDispensingQuery>,
) -> Result<Json<Vec<FreeDispensing>>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::free_dispensing::VIEW,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, FreeDispensing>(
        "SELECT * FROM pharmacy_free_dispensings \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR category = $2) \
           AND ($3::date IS NULL OR created_at::date >= $3) \
         ORDER BY created_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.category.as_deref())
    .bind(q.from_date)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_cashier_overrides ──────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CashierOverride {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub cashier_user_id: Uuid,
    pub cash_drawer_id: Option<Uuid>,
    pub pharmacy_order_id: Option<Uuid>,
    pub override_type: String,
    pub original_value: Option<serde_json::Value>,
    pub override_value: Option<serde_json::Value>,
    pub reason: String,
    pub approved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOverrideRequest {
    pub cashier_user_id: Uuid,
    pub cash_drawer_id: Option<Uuid>,
    pub pharmacy_order_id: Option<Uuid>,
    pub override_type: String,
    pub original_value: Option<serde_json::Value>,
    pub override_value: Option<serde_json::Value>,
    pub reason: String,
}

pub async fn create_cashier_override(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOverrideRequest>,
) -> Result<Json<CashierOverride>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::cashier_audit::VIEW,
    )?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("reason required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CashierOverride>(
        "INSERT INTO pharmacy_cashier_overrides \
         (tenant_id, cashier_user_id, cash_drawer_id, pharmacy_order_id, \
          override_type, original_value, override_value, reason, approved_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.cashier_user_id)
    .bind(body.cash_drawer_id)
    .bind(body.pharmacy_order_id)
    .bind(&body.override_type)
    .bind(&body.original_value)
    .bind(&body.override_value)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListOverridesQuery {
    pub cashier_user_id: Option<Uuid>,
    pub override_type: Option<String>,
    pub limit: Option<i64>,
}

pub async fn list_cashier_overrides(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListOverridesQuery>,
) -> Result<Json<Vec<CashierOverride>>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cashier_audit::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, CashierOverride>(
        "SELECT * FROM pharmacy_cashier_overrides \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR cashier_user_id = $2) \
           AND ($3::text IS NULL OR override_type = $3) \
         ORDER BY created_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.cashier_user_id)
    .bind(q.override_type.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_supplier_payments ──────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SupplierPayment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub supplier_id: Uuid,
    pub purchase_order_id: Option<Uuid>,
    pub grn_id: Option<Uuid>,
    pub invoice_number: String,
    pub invoice_date: NaiveDate,
    pub due_date: NaiveDate,
    pub gross_amount: Decimal,
    pub tds_amount: Decimal,
    pub tds_section: Option<String>,
    pub net_payable: Decimal,
    pub status: String,
    pub payment_mode: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub paid_amount: Option<Decimal>,
    pub utr_number: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplierPaymentRequest {
    pub supplier_id: Uuid,
    pub purchase_order_id: Option<Uuid>,
    pub grn_id: Option<Uuid>,
    pub invoice_number: String,
    pub invoice_date: NaiveDate,
    pub due_date: NaiveDate,
    pub gross_amount: Decimal,
    pub tds_amount: Option<Decimal>,
    pub tds_section: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_supplier_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSupplierPaymentRequest>,
) -> Result<Json<SupplierPayment>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::supplier_payments::MANAGE,
    )?;
    if body.gross_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest("gross_amount must be > 0".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SupplierPayment>(
        "INSERT INTO pharmacy_supplier_payments \
         (tenant_id, supplier_id, purchase_order_id, grn_id, invoice_number, \
          invoice_date, due_date, gross_amount, tds_amount, tds_section, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.supplier_id)
    .bind(body.purchase_order_id)
    .bind(body.grn_id)
    .bind(&body.invoice_number)
    .bind(body.invoice_date)
    .bind(body.due_date)
    .bind(body.gross_amount)
    .bind(body.tds_amount.unwrap_or(Decimal::ZERO))
    .bind(&body.tds_section)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct PaySupplierRequest {
    pub paid_amount: Decimal,
    pub payment_mode: String,
    pub utr_number: Option<String>,
}

pub async fn pay_supplier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PaySupplierRequest>,
) -> Result<Json<SupplierPayment>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::supplier_payments::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SupplierPayment>(
        "UPDATE pharmacy_supplier_payments SET \
           status = 'paid', paid_at = now(), paid_amount = $3, \
           payment_mode = $4, utr_number = $5 \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('scheduled', 'approved') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.paid_amount)
    .bind(&body.payment_mode)
    .bind(&body.utr_number)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListSupplierPaymentsQuery {
    pub status: Option<String>,
    pub supplier_id: Option<Uuid>,
    pub overdue_only: Option<bool>,
    pub limit: Option<i64>,
}

pub async fn list_supplier_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListSupplierPaymentsQuery>,
) -> Result<Json<Vec<SupplierPayment>>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::supplier_payments::VIEW,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let overdue = q.overdue_only.unwrap_or(false);
    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, SupplierPayment>(
        "SELECT * FROM pharmacy_supplier_payments \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
           AND ($3::uuid IS NULL OR supplier_id = $3) \
           AND ($4::bool = false OR (status IN ('scheduled','approved') AND due_date < CURRENT_DATE)) \
         ORDER BY due_date LIMIT $5",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .bind(q.supplier_id)
    .bind(overdue)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_drug_margin_daily ──────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DrugMarginDaily {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub drug_id: Uuid,
    pub snapshot_date: NaiveDate,
    pub avg_cost: Decimal,
    pub mrp: Decimal,
    pub sale_price: Decimal,
    pub margin_pct: Decimal,
    pub qty_sold: i32,
    pub revenue: Decimal,
    pub cost_total: Decimal,
    pub margin_total: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct ListMarginsQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub drug_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_margins(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListMarginsQuery>,
) -> Result<Json<Vec<DrugMarginDaily>>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_finance::finance_reports::VIEW,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(200).min(2000);
    let rows = sqlx::query_as::<_, DrugMarginDaily>(
        "SELECT * FROM pharmacy_drug_margin_daily \
         WHERE tenant_id = $1 \
           AND ($2::date IS NULL OR snapshot_date >= $2) \
           AND ($3::date IS NULL OR snapshot_date <= $3) \
           AND ($4::uuid IS NULL OR drug_id = $4) \
         ORDER BY snapshot_date DESC, margin_total DESC LIMIT $5",
    )
    .bind(claims.tenant_id)
    .bind(q.from_date)
    .bind(q.to_date)
    .bind(q.drug_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
