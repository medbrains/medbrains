#![allow(clippy::too_many_lines)]

use axum::{Extension, Json, extract::{Path, Query, State}};
use medbrains_core::inventory::{SupplierPayment, VendorComparisonRow, VendorPerformanceRow};
use medbrains_core::permissions;
use medbrains_core::procurement::{
    BatchStock, GoodsReceiptNote, GrnItem, PurchaseOrder, PurchaseOrderItem,
    RateContract, RateContractItem, StoreLocation, Vendor,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

// ── Vendors ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVendorsQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub vendor_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVendorRequest {
    pub code: String,
    pub name: String,
    pub display_name: Option<String>,
    pub vendor_type: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub pincode: Option<String>,
    pub country: Option<String>,
    pub gst_number: Option<String>,
    pub pan_number: Option<String>,
    pub drug_license_number: Option<String>,
    pub fssai_license: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub payment_terms: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub categories: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVendorRequest {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub vendor_type: Option<String>,
    pub status: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub pincode: Option<String>,
    pub country: Option<String>,
    pub gst_number: Option<String>,
    pub pan_number: Option<String>,
    pub drug_license_number: Option<String>,
    pub fssai_license: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub payment_terms: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub categories: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
}

// ── Store Locations ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateStoreLocationRequest {
    pub code: String,
    pub name: String,
    pub location_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub facility_id: Option<Uuid>,
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoreLocationRequest {
    pub name: Option<String>,
    pub location_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub facility_id: Option<Uuid>,
    pub address: Option<String>,
    pub is_active: Option<bool>,
}

// ── Purchase Orders ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPoQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub indent_requisition_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct PoListResponse {
    pub purchase_orders: Vec<PurchaseOrder>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePoRequest {
    pub vendor_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub indent_requisition_id: Option<Uuid>,
    pub rate_contract_id: Option<Uuid>,
    pub expected_delivery: Option<String>,
    pub payment_terms: Option<String>,
    pub delivery_terms: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<CreatePoItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePoItemInput {
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub item_code: Option<String>,
    pub unit: Option<String>,
    pub quantity_ordered: i32,
    pub unit_price: Decimal,
    pub tax_percent: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub indent_item_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PoDetailResponse {
    pub purchase_order: PurchaseOrder,
    pub items: Vec<PurchaseOrderItem>,
}

// ── GRN ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListGrnQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub po_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct GrnListResponse {
    pub grns: Vec<GoodsReceiptNote>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateGrnRequest {
    pub po_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<String>,
    pub invoice_amount: Option<Decimal>,
    pub notes: Option<String>,
    pub items: Vec<CreateGrnItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGrnItemInput {
    pub po_item_id: Option<Uuid>,
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub quantity_received: i32,
    pub quantity_accepted: i32,
    pub quantity_rejected: Option<i32>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
    pub manufacture_date: Option<String>,
    pub unit_price: Decimal,
    pub rejection_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GrnDetailResponse {
    pub grn: GoodsReceiptNote,
    pub items: Vec<GrnItem>,
}

// ── Rate Contracts ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRcQuery {
    pub vendor_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRcRequest {
    pub vendor_id: Uuid,
    pub start_date: String,
    pub end_date: String,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<CreateRcItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRcItemInput {
    pub catalog_item_id: Uuid,
    pub contracted_price: Decimal,
    pub max_quantity: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RcDetailResponse {
    pub contract: RateContract,
    pub items: Vec<RateContractItem>,
}

// ── Batch Stock ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListBatchStockQuery {
    pub catalog_item_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub expiring_before: Option<String>,
    pub consignment_only: Option<bool>,
}

// ══════════════════════════════════════════════════════════
//  PO number generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SeqResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

async fn generate_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    seq_type: &str,
    fallback_prefix: &str,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = $2 \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
        Ok(format!("{fallback_prefix}-{ts}"))
    }
}

// ══════════════════════════════════════════════════════════
//  Vendor handlers
// ══════════════════════════════════════════════════════════

pub async fn list_vendors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVendorsQuery>,
) -> Result<Json<Vec<Vendor>>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vendors = if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        sqlx::query_as::<_, Vendor>(
            "SELECT * FROM vendors WHERE tenant_id = $1 \
             AND (name ILIKE $2 OR code ILIKE $2 OR contact_person ILIKE $2) \
             ORDER BY name",
        )
        .bind(claims.tenant_id)
        .bind(&pattern)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.status {
        sqlx::query_as::<_, Vendor>(
            "SELECT * FROM vendors WHERE tenant_id = $1 AND status = $2::vendor_status ORDER BY name",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, Vendor>(
            "SELECT * FROM vendors WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(vendors))
}

pub async fn get_vendor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vendor>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vendor = sqlx::query_as::<_, Vendor>(
        "SELECT * FROM vendors WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(vendor))
}

pub async fn create_vendor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVendorRequest>,
) -> Result<Json<Vendor>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let categories = body.categories.clone().unwrap_or(serde_json::json!([]));

    let vendor = sqlx::query_as::<_, Vendor>(
        "INSERT INTO vendors \
         (tenant_id, code, name, display_name, vendor_type, \
          contact_person, phone, email, website, \
          address_line1, address_line2, city, state, pincode, country, \
          gst_number, pan_number, drug_license_number, fssai_license, \
          bank_name, bank_account, bank_ifsc, \
          payment_terms, credit_limit, credit_days, categories, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.display_name)
    .bind(body.vendor_type.as_deref().unwrap_or("supplier"))
    .bind(&body.contact_person)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.website)
    .bind(&body.address_line1)
    .bind(&body.address_line2)
    .bind(&body.city)
    .bind(&body.state)
    .bind(&body.pincode)
    .bind(body.country.as_deref().unwrap_or("India"))
    .bind(&body.gst_number)
    .bind(&body.pan_number)
    .bind(&body.drug_license_number)
    .bind(&body.fssai_license)
    .bind(&body.bank_name)
    .bind(&body.bank_account)
    .bind(&body.bank_ifsc)
    .bind(body.payment_terms.as_deref().unwrap_or("net_30"))
    .bind(body.credit_limit.unwrap_or(Decimal::ZERO))
    .bind(body.credit_days.unwrap_or(30))
    .bind(&categories)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(vendor))
}

pub async fn update_vendor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVendorRequest>,
) -> Result<Json<Vendor>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vendor = sqlx::query_as::<_, Vendor>(
        "UPDATE vendors SET \
         name = COALESCE($3, name), \
         display_name = COALESCE($4, display_name), \
         vendor_type = COALESCE($5, vendor_type), \
         status = COALESCE($6::vendor_status, status), \
         contact_person = COALESCE($7, contact_person), \
         phone = COALESCE($8, phone), \
         email = COALESCE($9, email), \
         website = COALESCE($10, website), \
         address_line1 = COALESCE($11, address_line1), \
         address_line2 = COALESCE($12, address_line2), \
         city = COALESCE($13, city), \
         state = COALESCE($14, state), \
         pincode = COALESCE($15, pincode), \
         country = COALESCE($16, country), \
         gst_number = COALESCE($17, gst_number), \
         pan_number = COALESCE($18, pan_number), \
         drug_license_number = COALESCE($19, drug_license_number), \
         fssai_license = COALESCE($20, fssai_license), \
         bank_name = COALESCE($21, bank_name), \
         bank_account = COALESCE($22, bank_account), \
         bank_ifsc = COALESCE($23, bank_ifsc), \
         payment_terms = COALESCE($24, payment_terms), \
         credit_limit = COALESCE($25, credit_limit), \
         credit_days = COALESCE($26, credit_days), \
         categories = COALESCE($27, categories), \
         notes = COALESCE($28, notes), \
         is_active = COALESCE($29, is_active), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.display_name)
    .bind(&body.vendor_type)
    .bind(&body.status)
    .bind(&body.contact_person)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.website)
    .bind(&body.address_line1)
    .bind(&body.address_line2)
    .bind(&body.city)
    .bind(&body.state)
    .bind(&body.pincode)
    .bind(&body.country)
    .bind(&body.gst_number)
    .bind(&body.pan_number)
    .bind(&body.drug_license_number)
    .bind(&body.fssai_license)
    .bind(&body.bank_name)
    .bind(&body.bank_account)
    .bind(&body.bank_ifsc)
    .bind(&body.payment_terms)
    .bind(body.credit_limit)
    .bind(body.credit_days)
    .bind(&body.categories)
    .bind(&body.notes)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(vendor))
}

// ══════════════════════════════════════════════════════════
//  Store Location handlers
// ══════════════════════════════════════════════════════════

pub async fn list_store_locations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<StoreLocation>>, AppError> {
    require_permission(&claims, permissions::procurement::stores::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let locations = sqlx::query_as::<_, StoreLocation>(
        "SELECT * FROM store_locations WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(locations))
}

pub async fn create_store_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStoreLocationRequest>,
) -> Result<Json<StoreLocation>, AppError> {
    require_permission(&claims, permissions::procurement::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let location = sqlx::query_as::<_, StoreLocation>(
        "INSERT INTO store_locations \
         (tenant_id, code, name, location_type, department_id, facility_id, address) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.location_type.as_deref().unwrap_or("main_store"))
    .bind(body.department_id)
    .bind(body.facility_id)
    .bind(&body.address)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(location))
}

pub async fn update_store_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStoreLocationRequest>,
) -> Result<Json<StoreLocation>, AppError> {
    require_permission(&claims, permissions::procurement::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let location = sqlx::query_as::<_, StoreLocation>(
        "UPDATE store_locations SET \
         name = COALESCE($3, name), \
         location_type = COALESCE($4, location_type), \
         department_id = COALESCE($5, department_id), \
         facility_id = COALESCE($6, facility_id), \
         address = COALESCE($7, address), \
         is_active = COALESCE($8, is_active), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.location_type)
    .bind(body.department_id)
    .bind(body.facility_id)
    .bind(&body.address)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(location))
}

// ══════════════════════════════════════════════════════════
//  Purchase Order handlers
// ══════════════════════════════════════════════════════════

pub async fn list_purchase_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPoQuery>,
) -> Result<Json<PoListResponse>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx = 2;

    if params.status.is_some() {
        conditions.push(format!("status = ${bind_idx}::po_status"));
        bind_idx += 1;
    }
    if params.vendor_id.is_some() {
        conditions.push(format!("vendor_id = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.indent_requisition_id.is_some() {
        conditions.push(format!("indent_requisition_id = ${bind_idx}"));
        bind_idx += 1;
    }

    let where_sql = conditions.join(" AND ");
    let count_sql = format!("SELECT COUNT(*) FROM purchase_orders WHERE {where_sql}");
    let data_sql = format!(
        "SELECT * FROM purchase_orders WHERE {where_sql} ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1,
    );

    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    if let Some(status) = params.status.as_deref() {
        cq = cq.bind(status);
    }
    if let Some(vendor_id) = params.vendor_id {
        cq = cq.bind(vendor_id);
    }
    if let Some(indent_requisition_id) = params.indent_requisition_id {
        cq = cq.bind(indent_requisition_id);
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let mut dq = sqlx::query_as::<_, PurchaseOrder>(&data_sql).bind(claims.tenant_id);
    if let Some(status) = params.status.as_deref() {
        dq = dq.bind(status);
    }
    if let Some(vendor_id) = params.vendor_id {
        dq = dq.bind(vendor_id);
    }
    if let Some(indent_requisition_id) = params.indent_requisition_id {
        dq = dq.bind(indent_requisition_id);
    }
    let purchase_orders = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(PoListResponse { purchase_orders, total, page, per_page }))
}

pub async fn get_purchase_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PoDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let purchase_order = sqlx::query_as::<_, PurchaseOrder>(
        "SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let items = sqlx::query_as::<_, PurchaseOrderItem>(
        "SELECT * FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PoDetailResponse { purchase_order, items }))
}

pub async fn create_purchase_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePoRequest>,
) -> Result<Json<PoDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest("At least one item is required".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let po_number = generate_number(&mut tx, &claims.tenant_id, "PO", "PO").await?;

    let expected_delivery = body.expected_delivery.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let po = sqlx::query_as::<_, PurchaseOrder>(
        "INSERT INTO purchase_orders \
         (tenant_id, po_number, vendor_id, store_location_id, \
          indent_requisition_id, rate_contract_id, \
          expected_delivery, payment_terms, delivery_terms, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&po_number)
    .bind(body.vendor_id)
    .bind(body.store_location_id)
    .bind(body.indent_requisition_id)
    .bind(body.rate_contract_id)
    .bind(expected_delivery)
    .bind(&body.payment_terms)
    .bind(&body.delivery_terms)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        let tax_pct = item.tax_percent.unwrap_or(Decimal::ZERO);
        let disc_pct = item.discount_percent.unwrap_or(Decimal::ZERO);
        let line_total = item.unit_price * Decimal::from(item.quantity_ordered);
        let disc_amt = line_total * disc_pct / Decimal::from(100);
        let taxable = line_total - disc_amt;
        let tax_amt = taxable * tax_pct / Decimal::from(100);
        let total = taxable + tax_amt;

        sqlx::query(
            "INSERT INTO purchase_order_items \
             (tenant_id, po_id, catalog_item_id, item_name, item_code, unit, \
              quantity_ordered, unit_price, tax_percent, tax_amount, \
              discount_percent, discount_amount, total_amount, indent_item_id, notes) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        )
        .bind(claims.tenant_id)
        .bind(po.id)
        .bind(item.catalog_item_id)
        .bind(&item.item_name)
        .bind(&item.item_code)
        .bind(item.unit.as_deref().unwrap_or("unit"))
        .bind(item.quantity_ordered)
        .bind(item.unit_price)
        .bind(tax_pct)
        .bind(tax_amt)
        .bind(disc_pct)
        .bind(disc_amt)
        .bind(total)
        .bind(item.indent_item_id)
        .bind(&item.notes)
        .execute(&mut *tx)
        .await?;
    }

    // Recalculate PO totals
    sqlx::query(
        "UPDATE purchase_orders SET \
         subtotal = (SELECT COALESCE(SUM(unit_price * quantity_ordered), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         discount_amount = (SELECT COALESCE(SUM(discount_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let purchase_order = sqlx::query_as::<_, PurchaseOrder>(
        "SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, PurchaseOrderItem>(
        "SELECT * FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PoDetailResponse { purchase_order, items }))
}

pub async fn approve_purchase_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PurchaseOrder>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let po = sqlx::query_as::<_, PurchaseOrder>(
        "UPDATE purchase_orders SET \
         status = 'approved', approved_by = $3, approved_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'submitted') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("PO not found or not in approvable status".into()))?;

    tx.commit().await?;
    Ok(Json(po))
}

pub async fn send_purchase_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PurchaseOrder>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let po = sqlx::query_as::<_, PurchaseOrder>(
        "UPDATE purchase_orders SET \
         status = 'sent_to_vendor', sent_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'approved' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("PO not found or not approved".into()))?;

    tx.commit().await?;
    Ok(Json(po))
}

pub async fn cancel_purchase_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PurchaseOrder>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let po = sqlx::query_as::<_, PurchaseOrder>(
        "UPDATE purchase_orders SET \
         status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'submitted', 'approved') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("PO not found or cannot be cancelled".into()))?;

    tx.commit().await?;
    Ok(Json(po))
}

// ══════════════════════════════════════════════════════════
//  GRN handlers
// ══════════════════════════════════════════════════════════

pub async fn list_grns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListGrnQuery>,
) -> Result<Json<GrnListResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (count_sql, data_sql) = if params.po_id.is_some() {
        (
            "SELECT COUNT(*) FROM goods_receipt_notes WHERE tenant_id = $1 AND po_id = $2".to_owned(),
            "SELECT * FROM goods_receipt_notes WHERE tenant_id = $1 AND po_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4".to_owned(),
        )
    } else {
        (
            "SELECT COUNT(*) FROM goods_receipt_notes WHERE tenant_id = $1".to_owned(),
            "SELECT * FROM goods_receipt_notes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3".to_owned(),
        )
    };

    let total = if let Some(po_id) = params.po_id {
        sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(claims.tenant_id)
            .bind(po_id)
            .fetch_one(&mut *tx)
            .await?
    } else {
        sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?
    };

    let grns = if let Some(po_id) = params.po_id {
        sqlx::query_as::<_, GoodsReceiptNote>(&data_sql)
            .bind(claims.tenant_id)
            .bind(po_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&mut *tx)
            .await?
    } else {
        sqlx::query_as::<_, GoodsReceiptNote>(&data_sql)
            .bind(claims.tenant_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&mut *tx)
            .await?
    };

    tx.commit().await?;
    Ok(Json(GrnListResponse { grns, total, page, per_page }))
}

pub async fn get_grn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GrnDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "SELECT * FROM goods_receipt_notes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let items = sqlx::query_as::<_, GrnItem>(
        "SELECT * FROM grn_items WHERE grn_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(GrnDetailResponse { grn, items }))
}

pub async fn create_grn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGrnRequest>,
) -> Result<Json<GrnDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest("At least one item is required".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify PO exists and is receivable
    let po = sqlx::query_as::<_, PurchaseOrder>(
        "SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2 \
         AND status IN ('sent_to_vendor', 'partially_received')",
    )
    .bind(body.po_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("PO not found or not in receivable status".into()))?;

    let grn_number = generate_number(&mut tx, &claims.tenant_id, "GRN", "GRN").await?;

    let invoice_date = body.invoice_date.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "INSERT INTO goods_receipt_notes \
         (tenant_id, grn_number, po_id, vendor_id, store_location_id, \
          invoice_number, invoice_date, invoice_amount, notes, received_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&grn_number)
    .bind(body.po_id)
    .bind(po.vendor_id)
    .bind(body.store_location_id)
    .bind(&body.invoice_number)
    .bind(invoice_date)
    .bind(body.invoice_amount)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        let qty_rejected = item.quantity_rejected.unwrap_or(0);
        let total = item.unit_price * Decimal::from(item.quantity_accepted);
        let expiry = item.expiry_date.as_deref()
            .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
        let mfg = item.manufacture_date.as_deref()
            .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

        sqlx::query(
            "INSERT INTO grn_items \
             (tenant_id, grn_id, po_item_id, catalog_item_id, item_name, \
              quantity_received, quantity_accepted, quantity_rejected, \
              batch_number, expiry_date, manufacture_date, \
              unit_price, total_amount, rejection_reason, notes) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        )
        .bind(claims.tenant_id)
        .bind(grn.id)
        .bind(item.po_item_id)
        .bind(item.catalog_item_id)
        .bind(&item.item_name)
        .bind(item.quantity_received)
        .bind(item.quantity_accepted)
        .bind(qty_rejected)
        .bind(&item.batch_number)
        .bind(expiry)
        .bind(mfg)
        .bind(item.unit_price)
        .bind(total)
        .bind(&item.rejection_reason)
        .bind(&item.notes)
        .execute(&mut *tx)
        .await?;

        // Update PO item received quantity
        if let Some(po_item_id) = item.po_item_id {
            sqlx::query(
                "UPDATE purchase_order_items SET quantity_received = quantity_received + $1 \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(item.quantity_accepted)
            .bind(po_item_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
        }

        // Create batch stock for accepted items
        if item.quantity_accepted > 0 {
            if let Some(catalog_id) = item.catalog_item_id {
                let batch_num = item.batch_number.as_deref().unwrap_or("N/A");
                sqlx::query(
                    "INSERT INTO batch_stock \
                     (tenant_id, catalog_item_id, store_location_id, batch_number, \
                      expiry_date, manufacture_date, quantity, unit_cost, grn_id, vendor_id) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
                )
                .bind(claims.tenant_id)
                .bind(catalog_id)
                .bind(body.store_location_id)
                .bind(batch_num)
                .bind(expiry)
                .bind(mfg)
                .bind(item.quantity_accepted)
                .bind(item.unit_price)
                .bind(grn.id)
                .bind(po.vendor_id)
                .execute(&mut *tx)
                .await?;

                // Update store_catalog current_stock
                sqlx::query(
                    "UPDATE store_catalog SET current_stock = current_stock + $1, updated_at = now() \
                     WHERE id = $2 AND tenant_id = $3",
                )
                .bind(item.quantity_accepted)
                .bind(catalog_id)
                .bind(claims.tenant_id)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    // Update GRN total
    sqlx::query(
        "UPDATE goods_receipt_notes SET \
         total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM grn_items WHERE grn_id = $1 AND tenant_id = $2), \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(grn.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Check if all PO items are fully received
    let pending_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM purchase_order_items \
         WHERE po_id = $1 AND tenant_id = $2 AND quantity_received < quantity_ordered",
    )
    .bind(body.po_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let new_po_status = if pending_count == 0 { "fully_received" } else { "partially_received" };
    sqlx::query(
        "UPDATE purchase_orders SET status = $3::po_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.po_id)
    .bind(claims.tenant_id)
    .bind(new_po_status)
    .execute(&mut *tx)
    .await?;

    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "SELECT * FROM goods_receipt_notes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(grn.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, GrnItem>(
        "SELECT * FROM grn_items WHERE grn_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(grn.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(GrnDetailResponse { grn, items }))
}

pub async fn complete_grn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GoodsReceiptNote>, AppError> {
    require_permission(&claims, permissions::procurement::grn::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "UPDATE goods_receipt_notes SET \
         status = 'completed', inspected_by = $3, inspected_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'inspecting', 'accepted', 'partially_accepted') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("GRN not found or cannot be completed".into()))?;

    tx.commit().await?;
    Ok(Json(grn))
}

// ══════════════════════════════════════════════════════════
//  Rate Contract handlers
// ══════════════════════════════════════════════════════════

pub async fn list_rate_contracts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRcQuery>,
) -> Result<Json<Vec<RateContract>>, AppError> {
    require_permission(&claims, permissions::procurement::rate_contracts::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let contracts = if let Some(vendor_id) = params.vendor_id {
        sqlx::query_as::<_, RateContract>(
            "SELECT * FROM rate_contracts WHERE tenant_id = $1 AND vendor_id = $2 ORDER BY end_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(vendor_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, RateContract>(
            "SELECT * FROM rate_contracts WHERE tenant_id = $1 ORDER BY end_date DESC",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(contracts))
}

pub async fn get_rate_contract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RcDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::rate_contracts::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let contract = sqlx::query_as::<_, RateContract>(
        "SELECT * FROM rate_contracts WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let items = sqlx::query_as::<_, RateContractItem>(
        "SELECT * FROM rate_contract_items WHERE contract_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RcDetailResponse { contract, items }))
}

pub async fn create_rate_contract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRcRequest>,
) -> Result<Json<RcDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::rate_contracts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let contract_number = generate_number(&mut tx, &claims.tenant_id, "RC", "RC").await?;

    let start_date = chrono::NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid start_date format".into()))?;
    let end_date = chrono::NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid end_date format".into()))?;

    let contract = sqlx::query_as::<_, RateContract>(
        "INSERT INTO rate_contracts \
         (tenant_id, contract_number, vendor_id, start_date, end_date, \
          payment_terms, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&contract_number)
    .bind(body.vendor_id)
    .bind(start_date)
    .bind(end_date)
    .bind(&body.payment_terms)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO rate_contract_items \
             (tenant_id, contract_id, catalog_item_id, contracted_price, max_quantity, notes) \
             VALUES ($1,$2,$3,$4,$5,$6)",
        )
        .bind(claims.tenant_id)
        .bind(contract.id)
        .bind(item.catalog_item_id)
        .bind(item.contracted_price)
        .bind(item.max_quantity)
        .bind(&item.notes)
        .execute(&mut *tx)
        .await?;
    }

    let items = sqlx::query_as::<_, RateContractItem>(
        "SELECT * FROM rate_contract_items WHERE contract_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(contract.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RcDetailResponse { contract, items }))
}

// ══════════════════════════════════════════════════════════
//  Batch Stock handlers
// ══════════════════════════════════════════════════════════

pub async fn list_batch_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBatchStockQuery>,
) -> Result<Json<Vec<BatchStock>>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batches = if let Some(catalog_id) = params.catalog_item_id {
        sqlx::query_as::<_, BatchStock>(
            "SELECT * FROM batch_stock WHERE tenant_id = $1 AND catalog_item_id = $2 AND quantity > 0 \
             ORDER BY expiry_date ASC NULLS LAST",
        )
        .bind(claims.tenant_id)
        .bind(catalog_id)
        .fetch_all(&mut *tx)
        .await?
    } else if params.consignment_only.unwrap_or(false) {
        sqlx::query_as::<_, BatchStock>(
            "SELECT * FROM batch_stock WHERE tenant_id = $1 AND is_consignment = true AND quantity > 0 \
             ORDER BY expiry_date ASC NULLS LAST",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BatchStock>(
            "SELECT * FROM batch_stock WHERE tenant_id = $1 AND quantity > 0 \
             ORDER BY expiry_date ASC NULLS LAST LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(batches))
}

// ══════════════════════════════════════════════════════════
//  Vendor Performance & Comparison
// ══════════════════════════════════════════════════════════

pub async fn vendor_performance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<VendorPerformanceRow>>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VendorPerformanceRow>(
        "SELECT v.name AS vendor_name, \
         COUNT(DISTINCT po.id)::BIGINT AS total_orders, \
         COALESCE( \
           ROUND(100.0 * SUM(CASE WHEN g.receipt_date <= po.expected_delivery THEN 1 ELSE 0 END)::NUMERIC \
           / NULLIF(COUNT(g.id), 0), 1)::FLOAT8, 0 \
         ) AS on_time_pct, \
         COALESCE( \
           ROUND(100.0 * SUM(gi.quantity_rejected)::NUMERIC \
           / NULLIF(SUM(gi.quantity_received), 0), 1)::FLOAT8, 0 \
         ) AS rejection_rate, \
         COALESCE(AVG(EXTRACT(DAY FROM g.receipt_date::TIMESTAMP - po.order_date::TIMESTAMP))::FLOAT8, 0) AS avg_delivery_days \
         FROM vendors v \
         LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.tenant_id = v.tenant_id \
         LEFT JOIN goods_receipt_notes g ON g.po_id = po.id AND g.tenant_id = v.tenant_id \
         LEFT JOIN grn_items gi ON gi.grn_id = g.id AND gi.tenant_id = v.tenant_id \
         WHERE v.tenant_id = $1 AND v.is_active = true \
         GROUP BY v.id, v.name ORDER BY total_orders DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct VendorComparisonQuery {
    pub catalog_item_id: Uuid,
}

pub async fn vendor_comparison(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<VendorComparisonQuery>,
) -> Result<Json<Vec<VendorComparisonRow>>, AppError> {
    require_permission(&claims, permissions::procurement::vendors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VendorComparisonRow>(
        "SELECT v.name AS vendor_name, sc.name AS item_name, \
         COALESCE(rci.contracted_price, poi.unit_price) AS unit_price, \
         AVG(EXTRACT(DAY FROM g.receipt_date::TIMESTAMP - po.order_date::TIMESTAMP))::FLOAT8 AS delivery_days, \
         CASE WHEN SUM(gi.quantity_received) > 0 \
           THEN ROUND(100.0 * SUM(gi.quantity_rejected)::NUMERIC / SUM(gi.quantity_received), 1)::FLOAT8 \
           ELSE NULL END AS rejection_rate \
         FROM vendors v \
         JOIN store_catalog sc ON sc.id = $2 AND sc.tenant_id = $1 \
         LEFT JOIN rate_contract_items rci ON rci.catalog_item_id = $2 \
           AND rci.tenant_id = $1 \
           AND rci.contract_id IN (SELECT id FROM rate_contracts WHERE vendor_id = v.id AND status = 'active') \
         LEFT JOIN purchase_order_items poi ON poi.catalog_item_id = $2 AND poi.tenant_id = $1 \
           AND poi.po_id IN (SELECT id FROM purchase_orders WHERE vendor_id = v.id AND tenant_id = $1) \
         LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.tenant_id = $1 \
         LEFT JOIN goods_receipt_notes g ON g.po_id = po.id AND g.tenant_id = $1 \
         LEFT JOIN grn_items gi ON gi.grn_id = g.id AND gi.catalog_item_id = $2 AND gi.tenant_id = $1 \
         WHERE v.tenant_id = $1 AND v.is_active = true \
         AND (rci.id IS NOT NULL OR poi.id IS NOT NULL) \
         GROUP BY v.id, v.name, sc.name, rci.contracted_price, poi.unit_price \
         ORDER BY unit_price ASC NULLS LAST",
    )
    .bind(claims.tenant_id)
    .bind(params.catalog_item_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Emergency Purchase Order
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateEmergencyPoRequest {
    pub vendor_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub emergency_reason: String,
    pub expected_delivery: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<CreatePoItemInput>,
}

pub async fn create_emergency_po(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEmergencyPoRequest>,
) -> Result<Json<PoDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest("At least one item is required".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let po_number = generate_number(&mut tx, &claims.tenant_id, "PO", "EPO").await?;

    let expected_delivery = body.expected_delivery.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let po = sqlx::query_as::<_, PurchaseOrder>(
        "INSERT INTO purchase_orders \
         (tenant_id, po_number, vendor_id, store_location_id, \
          is_emergency, emergency_reason, expected_delivery, notes, created_by) \
         VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&po_number)
    .bind(body.vendor_id)
    .bind(body.store_location_id)
    .bind(&body.emergency_reason)
    .bind(expected_delivery)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        let tax_pct = item.tax_percent.unwrap_or(Decimal::ZERO);
        let disc_pct = item.discount_percent.unwrap_or(Decimal::ZERO);
        let line_total = item.unit_price * Decimal::from(item.quantity_ordered);
        let disc_amt = line_total * disc_pct / Decimal::from(100);
        let taxable = line_total - disc_amt;
        let tax_amt = taxable * tax_pct / Decimal::from(100);
        let total = taxable + tax_amt;

        sqlx::query(
            "INSERT INTO purchase_order_items \
             (tenant_id, po_id, catalog_item_id, item_name, item_code, unit, \
              quantity_ordered, unit_price, tax_percent, tax_amount, \
              discount_percent, discount_amount, total_amount, indent_item_id, notes) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        )
        .bind(claims.tenant_id)
        .bind(po.id)
        .bind(item.catalog_item_id)
        .bind(&item.item_name)
        .bind(&item.item_code)
        .bind(item.unit.as_deref().unwrap_or("unit"))
        .bind(item.quantity_ordered)
        .bind(item.unit_price)
        .bind(tax_pct)
        .bind(tax_amt)
        .bind(disc_pct)
        .bind(disc_amt)
        .bind(total)
        .bind(item.indent_item_id)
        .bind(&item.notes)
        .execute(&mut *tx)
        .await?;
    }

    // Recalculate PO totals
    sqlx::query(
        "UPDATE purchase_orders SET \
         subtotal = (SELECT COALESCE(SUM(unit_price * quantity_ordered), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         discount_amount = (SELECT COALESCE(SUM(discount_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2), \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let purchase_order = sqlx::query_as::<_, PurchaseOrder>(
        "SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, PurchaseOrderItem>(
        "SELECT * FROM purchase_order_items WHERE po_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(po.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PoDetailResponse { purchase_order, items }))
}

// ══════════════════════════════════════════════════════════
//  Supplier Payments
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListPaymentsQuery {
    pub vendor_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub vendor_id: Uuid,
    pub po_id: Option<Uuid>,
    pub grn_id: Option<Uuid>,
    pub invoice_amount: Decimal,
    pub paid_amount: Option<Decimal>,
    pub due_date: Option<String>,
    pub payment_method: Option<String>,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePaymentRequest {
    pub paid_amount: Decimal,
    pub payment_method: Option<String>,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

pub async fn list_supplier_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPaymentsQuery>,
) -> Result<Json<Vec<SupplierPayment>>, AppError> {
    require_permission(&claims, permissions::procurement::payments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(vendor_id) = params.vendor_id {
        sqlx::query_as::<_, SupplierPayment>(
            "SELECT * FROM supplier_payments WHERE tenant_id = $1 AND vendor_id = $2 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(vendor_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.status {
        sqlx::query_as::<_, SupplierPayment>(
            "SELECT * FROM supplier_payments WHERE tenant_id = $1 AND status = $2::supplier_payment_status ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, SupplierPayment>(
            "SELECT * FROM supplier_payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_supplier_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePaymentRequest>,
) -> Result<Json<SupplierPayment>, AppError> {
    require_permission(&claims, permissions::procurement::payments::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let payment_number = generate_number(&mut tx, &claims.tenant_id, "PAY", "PAY").await?;
    let paid = body.paid_amount.unwrap_or(Decimal::ZERO);
    let balance = body.invoice_amount - paid;
    let status = if balance <= Decimal::ZERO {
        "paid"
    } else if paid > Decimal::ZERO {
        "partially_paid"
    } else {
        "pending"
    };

    let due_date = body.due_date.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let payment_date = if paid > Decimal::ZERO {
        Some(chrono::Utc::now().date_naive())
    } else {
        None
    };

    let payment = sqlx::query_as::<_, SupplierPayment>(
        "INSERT INTO supplier_payments \
         (tenant_id, vendor_id, po_id, grn_id, payment_number, \
          invoice_amount, paid_amount, balance_amount, status, \
          payment_date, due_date, payment_method, reference_number, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::supplier_payment_status,$10,$11,$12,$13,$14,$15) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.vendor_id)
    .bind(body.po_id)
    .bind(body.grn_id)
    .bind(&payment_number)
    .bind(body.invoice_amount)
    .bind(paid)
    .bind(balance)
    .bind(status)
    .bind(payment_date)
    .bind(due_date)
    .bind(&body.payment_method)
    .bind(&body.reference_number)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(payment))
}

pub async fn update_supplier_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePaymentRequest>,
) -> Result<Json<SupplierPayment>, AppError> {
    require_permission(&claims, permissions::procurement::payments::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch existing
    let existing = sqlx::query_as::<_, SupplierPayment>(
        "SELECT * FROM supplier_payments WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let new_paid = existing.paid_amount + body.paid_amount;
    let new_balance = existing.invoice_amount - new_paid;
    let new_status = if new_balance <= Decimal::ZERO {
        "paid"
    } else {
        "partially_paid"
    };

    let payment = sqlx::query_as::<_, SupplierPayment>(
        "UPDATE supplier_payments SET \
         paid_amount = $3, balance_amount = $4, status = $5::supplier_payment_status, \
         payment_date = CURRENT_DATE, \
         payment_method = COALESCE($6, payment_method), \
         reference_number = COALESCE($7, reference_number), \
         notes = COALESCE($8, notes), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_paid)
    .bind(new_balance)
    .bind(new_status)
    .bind(&body.payment_method)
    .bind(&body.reference_number)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(payment))
}
