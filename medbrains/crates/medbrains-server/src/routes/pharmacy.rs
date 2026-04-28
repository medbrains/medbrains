#![allow(clippy::too_many_lines, unused_imports)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_core::pharmacy::{
    PharmacyCatalog, PharmacyOrder, PharmacyOrderItem, PharmacyStockTransaction,
};
use medbrains_core::pharmacy_phase2::{
    DeadStockRow, DrugUtilizationRow, NdpsRegisterEntry, NearExpiryRow, PharmacyAbcVedRow,
    PharmacyBatch, PharmacyConsumptionRow, PharmacyReturn, PharmacyStoreAssignment,
    PharmacyTransferRequest,
};
use medbrains_core::pharmacy_phase3::{
    PharmacyAllergyCheckLog, PharmacyPosSale, PharmacyPosSaleItem, PharmacyPrescriptionRx,
    PharmacyPricingTier, PharmacyStockReconciliation, PosDaySummary, RxQueueRow,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub orders: Vec<PharmacyOrder>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct OrderItemInput {
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub quantity: i32,
    pub unit_price: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub prescription_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub notes: Option<String>,
    pub items: Vec<OrderItemInput>,
    pub dispensing_type: Option<String>,
    pub discharge_summary_id: Option<Uuid>,
    pub billing_package_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OrderDetailResponse {
    pub order: PharmacyOrder,
    pub items: Vec<PharmacyOrderItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCatalogRequest {
    pub code: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub unit: Option<String>,
    pub base_price: Decimal,
    pub tax_percent: Option<Decimal>,
    pub current_stock: Option<i32>,
    pub reorder_level: Option<i32>,
    // Regulatory fields
    pub drug_schedule: Option<String>,
    pub is_controlled: Option<bool>,
    pub inn_name: Option<String>,
    pub atc_code: Option<String>,
    pub rxnorm_code: Option<String>,
    pub snomed_code: Option<String>,
    pub formulary_status: Option<String>,
    pub aware_category: Option<String>,
    pub is_lasa: Option<bool>,
    pub lasa_group: Option<String>,
    pub max_dose_per_day: Option<String>,
    pub batch_tracking_required: Option<bool>,
    pub storage_conditions: Option<String>,
    pub black_box_warning: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCatalogRequest {
    pub name: Option<String>,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub unit: Option<String>,
    pub base_price: Option<Decimal>,
    pub tax_percent: Option<Decimal>,
    pub reorder_level: Option<i32>,
    pub is_active: Option<bool>,
    // Regulatory fields
    pub drug_schedule: Option<String>,
    pub is_controlled: Option<bool>,
    pub inn_name: Option<String>,
    pub atc_code: Option<String>,
    pub rxnorm_code: Option<String>,
    pub snomed_code: Option<String>,
    pub formulary_status: Option<String>,
    pub aware_category: Option<String>,
    pub is_lasa: Option<bool>,
    pub lasa_group: Option<String>,
    pub max_dose_per_day: Option<String>,
    pub batch_tracking_required: Option<bool>,
    pub storage_conditions: Option<String>,
    pub black_box_warning: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListStockQuery {
    pub low_stock: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStockTransactionRequest {
    pub catalog_item_id: Uuid,
    pub transaction_type: String,
    pub quantity: i32,
    pub reference_id: Option<Uuid>,
    pub notes: Option<String>,
}

// Phase 2 request/response types

#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub warnings: Vec<String>,
    pub blocks: Vec<String>,
    pub interactions: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct OtcSaleRequest {
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub items: Vec<OrderItemInput>,
    pub notes: Option<String>,
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct DischargeMedsRequest {
    pub patient_id: Uuid,
    pub discharge_summary_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub items: Vec<OrderItemInput>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DispenseOrderRequest {
    pub items: Option<Vec<DispenseItemInput>>,
    pub witnessed_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct DispenseItemInput {
    pub order_item_id: Uuid,
    pub batch_number: Option<String>,
    pub batch_stock_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ListNdpsQuery {
    pub catalog_item_id: Option<Uuid>,
    pub action: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NdpsListResponse {
    pub entries: Vec<NdpsRegisterEntry>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateNdpsEntryRequest {
    pub catalog_item_id: Uuid,
    pub action: String,
    pub quantity: i32,
    pub notes: Option<String>,
    pub witnessed_by: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NdpsBalanceRow {
    pub catalog_item_id: Uuid,
    pub drug_name: String,
    pub balance: i64,
}

#[derive(Debug, Serialize)]
pub struct NdpsReportResponse {
    pub entries: Vec<NdpsBalanceRow>,
}

#[derive(Debug, Deserialize)]
pub struct ListBatchesQuery {
    pub catalog_item_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub expiring_within_days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBatchRequest {
    pub catalog_item_id: Uuid,
    pub batch_number: String,
    pub expiry_date: NaiveDate,
    pub manufacture_date: Option<NaiveDate>,
    pub quantity_received: i32,
    pub store_location_id: Option<Uuid>,
    pub supplier_info: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NearExpiryQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct DeadStockQuery {
    pub idle_days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoreAssignmentRequest {
    pub store_location_id: Uuid,
    pub is_central: Option<bool>,
    pub serves_departments: Option<Vec<Uuid>>,
    pub operating_hours: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferRequest {
    pub from_location_id: Uuid,
    pub to_location_id: Uuid,
    pub items: serde_json::Value,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListTransfersQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReturnRequest {
    pub order_item_id: Uuid,
    pub patient_id: Uuid,
    pub quantity_returned: i32,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessReturnRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct ConsumptionQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub category: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  GET /api/pharmacy/orders
// ══════════════════════════════════════════════════════════

pub async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOrdersQuery>,
) -> Result<Json<OrderListResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(pid),
            string_val: None,
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM pharmacy_orders WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            cq = cq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            cq = cq.bind(s.clone());
        }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM pharmacy_orders WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, PharmacyOrder>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            dq = dq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            dq = dq.bind(s.clone());
        }
    }
    let orders = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(OrderListResponse {
        orders,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/orders (ENHANCED — Phase 2)
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    let dispensing_type = body.dispensing_type.as_deref().unwrap_or("prescription");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "INSERT INTO pharmacy_orders \
         (tenant_id, prescription_id, patient_id, encounter_id, ordered_by, \
          status, notes, dispensing_type, discharge_summary_id, billing_package_id, \
          store_location_id) \
         VALUES ($1, $2, $3, $4, $5, 'ordered', $6, $7::pharmacy_dispensing_type, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.prescription_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(dispensing_type)
    .bind(body.discharge_summary_id)
    .bind(body.billing_package_id)
    .bind(body.store_location_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let total = item.unit_price * Decimal::from(item.quantity);
        let oi = sqlx::query_as::<_, PharmacyOrderItem>(
            "INSERT INTO pharmacy_order_items \
             (tenant_id, order_id, catalog_item_id, drug_name, quantity, \
              unit_price, total_price, quantity_prescribed) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(total)
        .bind(item.quantity)
        .fetch_one(&mut *tx)
        .await?;
        items.push(oi);
    }

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, items }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/pharmacy/orders/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, items }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/pharmacy/orders/{id}/dispense (ENHANCED — Phase 2)
// ══════════════════════════════════════════════════════════

pub async fn dispense_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DispenseOrderRequest>,
) -> Result<Json<PharmacyOrder>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "UPDATE pharmacy_orders SET status = 'dispensed', \
         dispensed_by = $3, dispensed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'ordered' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Deduct stock for each item
    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items WHERE order_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Build a lookup for batch info from the request
    let batch_map: std::collections::HashMap<Uuid, &DispenseItemInput> = body
        .items
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|d| (d.order_item_id, d))
        .collect();

    for item in &items {
        if let Some(catalog_id) = item.catalog_item_id {
            // Update batch info on order item if provided
            if let Some(dispense_input) = batch_map.get(&item.id) {
                if dispense_input.batch_number.is_some() || dispense_input.batch_stock_id.is_some()
                {
                    sqlx::query(
                        "UPDATE pharmacy_order_items SET \
                         batch_number = COALESCE($1, batch_number), \
                         batch_stock_id = COALESCE($2, batch_stock_id) \
                         WHERE id = $3 AND tenant_id = $4",
                    )
                    .bind(&dispense_input.batch_number)
                    .bind(dispense_input.batch_stock_id)
                    .bind(item.id)
                    .bind(claims.tenant_id)
                    .execute(&mut *tx)
                    .await?;
                }
            }

            // Create stock transaction
            sqlx::query(
                "INSERT INTO pharmacy_stock_transactions \
                 (tenant_id, catalog_item_id, transaction_type, quantity, \
                  reference_id, created_by) \
                 VALUES ($1, $2, 'issue', $3, $4, $5)",
            )
            .bind(claims.tenant_id)
            .bind(catalog_id)
            .bind(item.quantity)
            .bind(order.id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;

            // Decrement stock
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock - $1, \
                 updated_at = now() \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(item.quantity)
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            // Deduct from pharmacy_batches if batch tracking
            if let Some(dispense_input) = batch_map.get(&item.id) {
                if let Some(batch_stock_id) = dispense_input.batch_stock_id {
                    sqlx::query(
                        "UPDATE pharmacy_batches SET \
                         quantity_dispensed = quantity_dispensed + $1, \
                         quantity_on_hand = quantity_on_hand - $1, \
                         updated_at = now() \
                         WHERE id = $2 AND tenant_id = $3",
                    )
                    .bind(item.quantity)
                    .bind(batch_stock_id)
                    .bind(claims.tenant_id)
                    .execute(&mut *tx)
                    .await?;
                }
            }

            // Auto-create NDPS register entry for controlled drugs
            let is_controlled = sqlx::query_scalar::<_, bool>(
                "SELECT is_controlled FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
            )
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(false);

            if is_controlled {
                // Get current balance
                let current_balance = sqlx::query_scalar::<_, Option<i64>>(
                    "SELECT SUM(CASE WHEN action IN ('receipt', 'adjustment') THEN quantity \
                     ELSE -quantity END) FROM pharmacy_ndps_register \
                     WHERE catalog_item_id = $1 AND tenant_id = $2",
                )
                .bind(catalog_id)
                .bind(claims.tenant_id)
                .fetch_one(&mut *tx)
                .await?
                .unwrap_or(0);

                let new_balance = current_balance - i64::from(item.quantity);

                sqlx::query(
                    "INSERT INTO pharmacy_ndps_register \
                     (tenant_id, catalog_item_id, action, quantity, balance_after, \
                      patient_id, dispensed_by, witnessed_by) \
                     VALUES ($1, $2, 'dispensed', $3, $4, $5, $6, $7)",
                )
                .bind(claims.tenant_id)
                .bind(catalog_id)
                .bind(item.quantity)
                .bind(i32::try_from(new_balance).unwrap_or(0))
                .bind(order.patient_id)
                .bind(claims.sub)
                .bind(body.witnessed_by)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    // Auto-billing: charge for dispensed items
    if let Some(encounter_id) = order.encounter_id {
        if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "pharmacy").await? {
            for item in &items {
                let code = item.catalog_item_id.map_or_else(
                    || "PHARMA-GENERIC".to_owned(),
                    |cid| format!("PHARMA-{cid}"),
                );
                let _ = super::billing::auto_charge(
                    &mut tx,
                    &claims.tenant_id,
                    super::billing::AutoChargeInput {
                        patient_id: order.patient_id,
                        encounter_id,
                        charge_code: code,
                        source: "pharmacy".to_owned(),
                        source_id: item.id,
                        quantity: item.quantity,
                        description_override: Some(item.drug_name.clone()),
                        unit_price_override: Some(item.unit_price),
                        tax_percent_override: None,
                    },
                )
                .await;
            }
        }
    }

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let dispensed_patient_name = sqlx::query_scalar::<_, String>(
        "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1",
    )
    .bind(order.patient_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let total_amount: Decimal = items.iter().map(|i| i.total_price).sum();

    // Emit integration event
    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "pharmacy.order.dispensed",
        serde_json::json!({
            "order_id": order.id,
            "patient_id": order.patient_id,
            "patient_name": dispensed_patient_name,
            "items_count": items.len(),
            "total_amount": total_amount.to_string(),
        }),
    )
    .await;

    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/pharmacy/orders/{id}/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyOrder>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "UPDATE pharmacy_orders SET status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'ordered' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/orders/{id}/validate
// ══════════════════════════════════════════════════════════

pub async fn validate_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ValidationResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items WHERE order_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut warnings = Vec::new();
    let mut blocks = Vec::new();

    for item in &items {
        if let Some(catalog_id) = item.catalog_item_id {
            let cat = sqlx::query_as::<_, PharmacyCatalog>(
                "SELECT * FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
            )
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(drug) = cat {
                // Formulary check
                if drug.formulary_status == "non_formulary" {
                    blocks.push(format!(
                        "{}: Non-formulary drug — approval required",
                        drug.name
                    ));
                } else if drug.formulary_status == "restricted" {
                    warnings.push(format!("{}: Restricted formulary drug", drug.name));
                }

                // LASA warning
                if drug.is_lasa {
                    warnings.push(format!(
                        "{}: LASA drug{}",
                        drug.name,
                        drug.lasa_group
                            .as_deref()
                            .map_or_else(String::new, |g| format!(" (group: {g})"))
                    ));
                }

                // AWaRe category check
                if drug.aware_category.as_deref() == Some("reserve") {
                    warnings.push(format!(
                        "{}: Reserve-tier antibiotic — stewardship approval needed",
                        drug.name
                    ));
                }

                // Controlled substance
                if drug.is_controlled {
                    warnings.push(format!(
                        "{}: Controlled substance — NDPS register entry required",
                        drug.name
                    ));
                }

                // Stock check
                if drug.current_stock < item.quantity {
                    blocks.push(format!(
                        "{}: Insufficient stock (available: {}, requested: {})",
                        drug.name, drug.current_stock, item.quantity
                    ));
                }
            }
        }
    }

    tx.commit().await?;
    Ok(Json(ValidationResult {
        valid: blocks.is_empty(),
        warnings,
        blocks,
        interactions: Vec::new(),
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/otc-sale
// ══════════════════════════════════════════════════════════

pub async fn create_otc_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OtcSaleRequest>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // OTC sale: patient_id is optional (NULL for walk-in customers)
    let patient_id = body.patient_id;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "INSERT INTO pharmacy_orders \
         (tenant_id, patient_id, ordered_by, status, notes, \
          dispensing_type, store_location_id, dispensed_by, dispensed_at) \
         VALUES ($1, $2, $3, 'dispensed', $4, 'otc'::pharmacy_dispensing_type, $5, $3, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(body.store_location_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let total = item.unit_price * Decimal::from(item.quantity);
        let oi = sqlx::query_as::<_, PharmacyOrderItem>(
            "INSERT INTO pharmacy_order_items \
             (tenant_id, order_id, catalog_item_id, drug_name, quantity, \
              unit_price, total_price, quantity_prescribed) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(total)
        .bind(item.quantity)
        .fetch_one(&mut *tx)
        .await?;

        // Deduct stock
        if let Some(catalog_id) = item.catalog_item_id {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock - $1, \
                 updated_at = now() WHERE id = $2 AND tenant_id = $3",
            )
            .bind(item.quantity)
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
        }

        items.push(oi);
    }

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, items }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/discharge-dispensing
// ══════════════════════════════════════════════════════════

pub async fn create_discharge_dispensing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DischargeMedsRequest>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "INSERT INTO pharmacy_orders \
         (tenant_id, patient_id, encounter_id, ordered_by, status, notes, \
          dispensing_type, discharge_summary_id) \
         VALUES ($1, $2, $3, $4, 'ordered', $5, 'discharge'::pharmacy_dispensing_type, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(body.discharge_summary_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let total = item.unit_price * Decimal::from(item.quantity);
        let oi = sqlx::query_as::<_, PharmacyOrderItem>(
            "INSERT INTO pharmacy_order_items \
             (tenant_id, order_id, catalog_item_id, drug_name, quantity, \
              unit_price, total_price, quantity_prescribed) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(total)
        .bind(item.quantity)
        .fetch_one(&mut *tx)
        .await?;
        items.push(oi);
    }

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, items }))
}

// ══════════════════════════════════════════════════════════
//  Catalog CRUD
// ══════════════════════════════════════════════════════════

#[derive(Debug, serde::Deserialize)]
pub struct CatalogQuery {
    pub search: Option<String>,
    pub category: Option<String>,
    pub formulary_status: Option<String>,
    pub drug_schedule: Option<String>,
}

pub async fn list_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CatalogQuery>,
) -> Result<Json<Vec<PharmacyCatalog>>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let search = q.search.map(|s| format!("%{s}%"));

    let rows = sqlx::query_as::<_, PharmacyCatalog>(
        "SELECT * FROM pharmacy_catalog
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR name ILIKE $2 OR generic_name ILIKE $2 OR code ILIKE $2)
           AND ($3::text IS NULL OR category = $3)
           AND ($4::text IS NULL OR formulary_status::text = $4)
           AND ($5::text IS NULL OR drug_schedule::text = $5)
         ORDER BY name LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(&search)
    .bind(&q.category)
    .bind(&q.formulary_status)
    .bind(&q.drug_schedule)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCatalogRequest>,
) -> Result<Json<PharmacyCatalog>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let tax_pct = body.tax_percent.unwrap_or(Decimal::ZERO);
    let stock = body.current_stock.unwrap_or(0);
    let reorder = body.reorder_level.unwrap_or(10);
    let controlled = body.is_controlled.unwrap_or(false);
    let formulary = body.formulary_status.as_deref().unwrap_or("approved");
    let lasa = body.is_lasa.unwrap_or(false);
    let batch_track = body.batch_tracking_required.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCatalog>(
        "INSERT INTO pharmacy_catalog \
         (tenant_id, code, name, generic_name, category, manufacturer, \
          unit, base_price, tax_percent, current_stock, reorder_level, \
          drug_schedule, is_controlled, inn_name, atc_code, rxnorm_code, \
          snomed_code, formulary_status, aware_category, is_lasa, lasa_group, \
          max_dose_per_day, batch_tracking_required, storage_conditions, \
          black_box_warning) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, \
                 $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, \
                 $22, $23, $24, $25) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.generic_name)
    .bind(&body.category)
    .bind(&body.manufacturer)
    .bind(&body.unit)
    .bind(body.base_price)
    .bind(tax_pct)
    .bind(stock)
    .bind(reorder)
    .bind(&body.drug_schedule)
    .bind(controlled)
    .bind(&body.inn_name)
    .bind(&body.atc_code)
    .bind(&body.rxnorm_code)
    .bind(&body.snomed_code)
    .bind(formulary)
    .bind(&body.aware_category)
    .bind(lasa)
    .bind(&body.lasa_group)
    .bind(&body.max_dose_per_day)
    .bind(batch_track)
    .bind(&body.storage_conditions)
    .bind(&body.black_box_warning)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCatalogRequest>,
) -> Result<Json<PharmacyCatalog>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCatalog>(
        "UPDATE pharmacy_catalog SET \
         name = COALESCE($1, name), \
         generic_name = COALESCE($2, generic_name), \
         category = COALESCE($3, category), \
         manufacturer = COALESCE($4, manufacturer), \
         unit = COALESCE($5, unit), \
         base_price = COALESCE($6, base_price), \
         tax_percent = COALESCE($7, tax_percent), \
         reorder_level = COALESCE($8, reorder_level), \
         is_active = COALESCE($9, is_active), \
         drug_schedule = COALESCE($12, drug_schedule), \
         is_controlled = COALESCE($13, is_controlled), \
         inn_name = COALESCE($14, inn_name), \
         atc_code = COALESCE($15, atc_code), \
         rxnorm_code = COALESCE($16, rxnorm_code), \
         snomed_code = COALESCE($17, snomed_code), \
         formulary_status = COALESCE($18, formulary_status), \
         aware_category = COALESCE($19, aware_category), \
         is_lasa = COALESCE($20, is_lasa), \
         lasa_group = COALESCE($21, lasa_group), \
         max_dose_per_day = COALESCE($22, max_dose_per_day), \
         batch_tracking_required = COALESCE($23, batch_tracking_required), \
         storage_conditions = COALESCE($24, storage_conditions), \
         black_box_warning = COALESCE($25, black_box_warning), \
         updated_at = now() \
         WHERE id = $10 AND tenant_id = $11 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.generic_name)
    .bind(&body.category)
    .bind(&body.manufacturer)
    .bind(&body.unit)
    .bind(body.base_price)
    .bind(body.tax_percent)
    .bind(body.reorder_level)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.drug_schedule)
    .bind(body.is_controlled)
    .bind(&body.inn_name)
    .bind(&body.atc_code)
    .bind(&body.rxnorm_code)
    .bind(&body.snomed_code)
    .bind(&body.formulary_status)
    .bind(&body.aware_category)
    .bind(body.is_lasa)
    .bind(&body.lasa_group)
    .bind(&body.max_dose_per_day)
    .bind(body.batch_tracking_required)
    .bind(&body.storage_conditions)
    .bind(&body.black_box_warning)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Stock
// ══════════════════════════════════════════════════════════

pub async fn list_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListStockQuery>,
) -> Result<Json<Vec<PharmacyCatalog>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sql = if params.low_stock.unwrap_or(false) {
        "SELECT * FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND is_active = true AND current_stock < reorder_level \
         ORDER BY current_stock ASC"
    } else {
        "SELECT * FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name"
    };

    let rows = sqlx::query_as::<_, PharmacyCatalog>(sql)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_stock_transaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStockTransactionRequest>,
) -> Result<Json<PharmacyStockTransaction>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn = sqlx::query_as::<_, PharmacyStockTransaction>(
        "INSERT INTO pharmacy_stock_transactions \
         (tenant_id, catalog_item_id, transaction_type, quantity, \
          reference_id, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.transaction_type)
    .bind(body.quantity)
    .bind(body.reference_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update stock based on transaction type
    let stock_delta = match body.transaction_type.as_str() {
        "receipt" | "return" | "adjustment" => body.quantity,
        "issue" => -body.quantity,
        _ => {
            return Err(AppError::BadRequest(
                "Invalid transaction_type. Must be: receipt, issue, return, adjustment".to_owned(),
            ));
        }
    };

    sqlx::query(
        "UPDATE pharmacy_catalog SET current_stock = current_stock + $1, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(stock_delta)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(txn))
}

// ══════════════════════════════════════════════════════════
//  NDPS Register
// ══════════════════════════════════════════════════════════

pub async fn list_ndps_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListNdpsQuery>,
) -> Result<Json<NdpsListResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::ndps::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    if params.catalog_item_id.is_some() {
        conditions.push(format!("catalog_item_id = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.action.is_some() {
        conditions.push(format!("action = ${bind_idx}::ndps_register_action"));
        bind_idx += 1;
    }
    if params.from_date.is_some() {
        conditions.push(format!("created_at >= ${bind_idx}::date"));
        bind_idx += 1;
    }
    if params.to_date.is_some() {
        conditions.push(format!(
            "created_at < (${bind_idx}::date + interval '1 day')"
        ));
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM pharmacy_ndps_register WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    if let Some(cid) = params.catalog_item_id {
        cq = cq.bind(cid);
    }
    if let Some(ref a) = params.action {
        cq = cq.bind(a.clone());
    }
    if let Some(fd) = params.from_date {
        cq = cq.bind(fd);
    }
    if let Some(td) = params.to_date {
        cq = cq.bind(td);
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM pharmacy_ndps_register WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, NdpsRegisterEntry>(&data_sql).bind(claims.tenant_id);
    if let Some(cid) = params.catalog_item_id {
        dq = dq.bind(cid);
    }
    if let Some(ref a) = params.action {
        dq = dq.bind(a.clone());
    }
    if let Some(fd) = params.from_date {
        dq = dq.bind(fd);
    }
    if let Some(td) = params.to_date {
        dq = dq.bind(td);
    }
    let entries = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(NdpsListResponse {
        entries,
        total,
        page,
        per_page,
    }))
}

pub async fn create_ndps_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNdpsEntryRequest>,
) -> Result<Json<NdpsRegisterEntry>, AppError> {
    require_permission(&claims, permissions::pharmacy::ndps::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Calculate current balance
    let current_balance = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT SUM(CASE WHEN action IN ('receipt', 'adjustment') THEN quantity \
         ELSE -quantity END) FROM pharmacy_ndps_register \
         WHERE catalog_item_id = $1 AND tenant_id = $2",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0);

    let delta = match body.action.as_str() {
        "receipt" | "adjustment" => i64::from(body.quantity),
        "dispensed" | "destroyed" | "transferred" => -i64::from(body.quantity),
        _ => return Err(AppError::BadRequest("Invalid NDPS action".to_owned())),
    };
    let new_balance = current_balance + delta;

    let entry = sqlx::query_as::<_, NdpsRegisterEntry>(
        "INSERT INTO pharmacy_ndps_register \
         (tenant_id, catalog_item_id, action, quantity, balance_after, \
          dispensed_by, witnessed_by, notes) \
         VALUES ($1, $2, $3::ndps_register_action, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.action)
    .bind(body.quantity)
    .bind(i32::try_from(new_balance).unwrap_or(0))
    .bind(claims.sub)
    .bind(body.witnessed_by)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(entry))
}

pub async fn ndps_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NdpsReportResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::ndps::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, NdpsBalanceRow>(
        "SELECT n.catalog_item_id, c.name AS drug_name, \
         COALESCE(SUM(CASE WHEN n.action IN ('receipt', 'adjustment') THEN n.quantity \
         ELSE -n.quantity END), 0) AS balance \
         FROM pharmacy_ndps_register n \
         JOIN pharmacy_catalog c ON c.id = n.catalog_item_id AND c.tenant_id = n.tenant_id \
         WHERE n.tenant_id = $1 \
         GROUP BY n.catalog_item_id, c.name \
         ORDER BY c.name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(NdpsReportResponse { entries: rows }))
}

pub async fn ndps_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NdpsReportResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::ndps::LIST)?;

    // Reuse balance endpoint — same aggregation
    let result = ndps_balance(State(state), Extension(claims)).await?;
    Ok(result)
}

// ══════════════════════════════════════════════════════════
//  Batch & Expiry Management
// ══════════════════════════════════════════════════════════

pub async fn list_batches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBatchesQuery>,
) -> Result<Json<Vec<PharmacyBatch>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    if params.catalog_item_id.is_some() {
        conditions.push(format!("catalog_item_id = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.store_location_id.is_some() {
        conditions.push(format!("store_location_id = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.expiring_within_days.is_some() {
        conditions.push(format!(
            "expiry_date <= (CURRENT_DATE + ${bind_idx} * interval '1 day')"
        ));
        bind_idx += 1;
    }
    let _ = bind_idx;

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM pharmacy_batches WHERE {where_clause} \
         AND quantity_on_hand > 0 ORDER BY expiry_date ASC LIMIT 500"
    );

    let mut q = sqlx::query_as::<_, PharmacyBatch>(&sql).bind(claims.tenant_id);
    if let Some(cid) = params.catalog_item_id {
        q = q.bind(cid);
    }
    if let Some(lid) = params.store_location_id {
        q = q.bind(lid);
    }
    if let Some(days) = params.expiring_within_days {
        q = q.bind(days);
    }

    let rows = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBatchRequest>,
) -> Result<Json<PharmacyBatch>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batch = sqlx::query_as::<_, PharmacyBatch>(
        "INSERT INTO pharmacy_batches \
         (tenant_id, catalog_item_id, batch_number, expiry_date, manufacture_date, \
          quantity_received, quantity_on_hand, store_location_id, supplier_info) \
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.batch_number)
    .bind(body.expiry_date)
    .bind(body.manufacture_date)
    .bind(body.quantity_received)
    .bind(body.store_location_id)
    .bind(&body.supplier_info)
    .fetch_one(&mut *tx)
    .await?;

    // Update catalog stock to stay in sync with batch-level stock
    sqlx::query(
        "UPDATE pharmacy_catalog SET current_stock = current_stock + $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity_received)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Create stock transaction for traceability
    sqlx::query(
        "INSERT INTO pharmacy_stock_transactions \
         (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, notes, created_by) \
         VALUES ($1, $2, 'receipt', $3, $4, $5, $6)",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(body.quantity_received)
    .bind(batch.id)
    .bind(format!("Batch {} received", body.batch_number))
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(batch))
}

pub async fn near_expiry_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<NearExpiryQuery>,
) -> Result<Json<Vec<NearExpiryRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let days = params.days.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, NearExpiryRow>(
        "SELECT c.name AS drug_name, b.batch_number, b.expiry_date, \
         b.quantity_on_hand, (b.expiry_date - CURRENT_DATE)::int AS days_until_expiry \
         FROM pharmacy_batches b \
         JOIN pharmacy_catalog c ON c.id = b.catalog_item_id AND c.tenant_id = b.tenant_id \
         WHERE b.tenant_id = $1 AND b.quantity_on_hand > 0 \
         AND b.expiry_date <= CURRENT_DATE + $2 * interval '1 day' \
         ORDER BY b.expiry_date ASC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn dead_stock_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DeadStockQuery>,
) -> Result<Json<Vec<DeadStockRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let idle_days = params.idle_days.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DeadStockRow>(
        "SELECT c.name AS drug_name, c.current_stock, \
         (c.current_stock::numeric * c.base_price) AS stock_value, \
         MAX(st.created_at) FILTER (WHERE st.transaction_type = 'issue') AS last_dispensed_date, \
         EXTRACT(DAY FROM now() - MAX(st.created_at) FILTER (WHERE st.transaction_type = 'issue'))::int AS days_idle \
         FROM pharmacy_catalog c \
         LEFT JOIN pharmacy_stock_transactions st ON st.catalog_item_id = c.id AND st.tenant_id = c.tenant_id \
         WHERE c.tenant_id = $1 AND c.current_stock > 0 AND c.is_active = true \
         GROUP BY c.id, c.name, c.current_stock, c.base_price \
         HAVING MAX(st.created_at) FILTER (WHERE st.transaction_type = 'issue') IS NULL \
            OR MAX(st.created_at) FILTER (WHERE st.transaction_type = 'issue') < now() - $2 * interval '1 day' \
         ORDER BY (c.current_stock::numeric * c.base_price) DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(idle_days)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Multi-Store & Transfers
// ══════════════════════════════════════════════════════════

pub async fn list_store_assignments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyStoreAssignment>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyStoreAssignment>(
        "SELECT * FROM pharmacy_store_assignments WHERE tenant_id = $1 ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_store_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStoreAssignmentRequest>,
) -> Result<Json<PharmacyStoreAssignment>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyStoreAssignment>(
        "INSERT INTO pharmacy_store_assignments \
         (tenant_id, store_location_id, is_central, serves_departments, operating_hours) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.store_location_id)
    .bind(body.is_central.unwrap_or(false))
    .bind(&body.serves_departments)
    .bind(&body.operating_hours)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTransferRequest>,
) -> Result<Json<PharmacyTransferRequest>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyTransferRequest>(
        "INSERT INTO pharmacy_transfer_requests \
         (tenant_id, from_location_id, to_location_id, items, requested_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.from_location_id)
    .bind(body.to_location_id)
    .bind(&body.items)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyTransferRequest>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyTransferRequest>(
        "UPDATE pharmacy_transfer_requests SET \
         status = 'approved', approved_by = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
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

pub async fn list_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTransfersQuery>,
) -> Result<Json<Vec<PharmacyTransferRequest>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, PharmacyTransferRequest>(
            "SELECT * FROM pharmacy_transfer_requests \
             WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PharmacyTransferRequest>(
            "SELECT * FROM pharmacy_transfer_requests \
             WHERE tenant_id = $1 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Returns
// ══════════════════════════════════════════════════════════

pub async fn list_returns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyReturn>>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyReturn>(
        "SELECT * FROM pharmacy_returns WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReturnRequest>,
) -> Result<Json<PharmacyReturn>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyReturn>(
        "INSERT INTO pharmacy_returns \
         (tenant_id, order_item_id, patient_id, quantity_returned, reason) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_item_id)
    .bind(body.patient_id)
    .bind(body.quantity_returned)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn process_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ProcessReturnRequest>,
) -> Result<Json<PharmacyReturn>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::MANAGE)?;

    let new_status = match body.status.as_str() {
        "approved" | "returned_to_stock" | "destroyed" | "rejected" => &body.status,
        _ => return Err(AppError::BadRequest("Invalid return status".to_owned())),
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let restocked = new_status == "returned_to_stock";

    let row = sqlx::query_as::<_, PharmacyReturn>(
        "UPDATE pharmacy_returns SET \
         status = $3::pharmacy_return_status, approved_by = $4, restocked = $5, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(restocked)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // If returned to stock, increment catalog stock
    if restocked {
        let order_item = sqlx::query_as::<_, PharmacyOrderItem>(
            "SELECT * FROM pharmacy_order_items WHERE id = $1 AND tenant_id = $2",
        )
        .bind(row.order_item_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(oi) = order_item {
            if let Some(catalog_id) = oi.catalog_item_id {
                sqlx::query(
                    "UPDATE pharmacy_catalog SET current_stock = current_stock + $1, \
                     updated_at = now() WHERE id = $2 AND tenant_id = $3",
                )
                .bind(row.quantity_returned)
                .bind(catalog_id)
                .bind(claims.tenant_id)
                .execute(&mut *tx)
                .await?;

                // Update quantity_returned on order item
                sqlx::query(
                    "UPDATE pharmacy_order_items SET quantity_returned = quantity_returned + $1 \
                     WHERE id = $2 AND tenant_id = $3",
                )
                .bind(row.quantity_returned)
                .bind(row.order_item_id)
                .bind(claims.tenant_id)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports
// ══════════════════════════════════════════════════════════

pub async fn consumption_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ConsumptionQuery>,
) -> Result<Json<Vec<PharmacyConsumptionRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec![
        "o.tenant_id = $1".to_owned(),
        "o.status = 'dispensed'".to_owned(),
    ];
    let mut bind_idx: usize = 2;

    if params.from_date.is_some() {
        conditions.push(format!("o.created_at >= ${bind_idx}::date"));
        bind_idx += 1;
    }
    if params.to_date.is_some() {
        conditions.push(format!(
            "o.created_at < (${bind_idx}::date + interval '1 day')"
        ));
        bind_idx += 1;
    }
    if params.category.is_some() {
        conditions.push(format!("c.category = ${bind_idx}"));
        bind_idx += 1;
    }
    let _ = bind_idx;

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT oi.drug_name, c.category, \
         SUM(oi.quantity)::bigint AS total_dispensed, \
         SUM(oi.total_price) AS total_value \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
         LEFT JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
         WHERE {where_clause} \
         GROUP BY oi.drug_name, c.category \
         ORDER BY total_value DESC LIMIT 500"
    );

    let mut q = sqlx::query_as::<_, PharmacyConsumptionRow>(&sql).bind(claims.tenant_id);
    if let Some(fd) = params.from_date {
        q = q.bind(fd);
    }
    if let Some(td) = params.to_date {
        q = q.bind(td);
    }
    if let Some(ref cat) = params.category {
        q = q.bind(cat.clone());
    }

    let rows = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn abc_ved_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyAbcVedRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // ABC analysis: rank drugs by annual consumption value
    // VED from store_catalog ved_class or inferred from formulary_status
    let rows = sqlx::query_as::<_, PharmacyAbcVedRow>(
        "WITH consumption AS ( \
            SELECT oi.catalog_item_id, \
                   SUM(oi.total_price) AS annual_value \
            FROM pharmacy_order_items oi \
            JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
            WHERE o.tenant_id = $1 AND o.status = 'dispensed' \
              AND o.created_at >= now() - interval '1 year' \
              AND oi.catalog_item_id IS NOT NULL \
            GROUP BY oi.catalog_item_id \
         ), ranked AS ( \
            SELECT con.catalog_item_id, con.annual_value, \
                   SUM(con.annual_value) OVER (ORDER BY con.annual_value DESC) / \
                   NULLIF(SUM(con.annual_value) OVER (), 0) AS cumulative_pct \
            FROM consumption con \
         ) \
         SELECT c.name AS drug_name, r.annual_value, \
                CASE WHEN r.cumulative_pct <= 0.70 THEN 'A' \
                     WHEN r.cumulative_pct <= 0.90 THEN 'B' \
                     ELSE 'C' END AS abc_class, \
                CASE WHEN c.formulary_status = 'approved' AND c.is_controlled THEN 'V' \
                     WHEN c.formulary_status = 'approved' THEN 'E' \
                     ELSE 'D' END AS ved_class \
         FROM ranked r \
         JOIN pharmacy_catalog c ON c.id = r.catalog_item_id AND c.tenant_id = $1 \
         ORDER BY r.annual_value DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn drug_utilization_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DrugUtilizationRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DrugUtilizationRow>(
        "SELECT oi.drug_name, c.generic_name, c.aware_category, \
         SUM(oi.quantity)::bigint AS total_dispensed, \
         COUNT(DISTINCT o.patient_id)::bigint AS unique_patients \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
         LEFT JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
         WHERE o.tenant_id = $1 AND o.status = 'dispensed' \
           AND o.created_at >= now() - interval '90 days' \
         GROUP BY oi.drug_name, c.generic_name, c.aware_category \
         ORDER BY total_dispensed DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/interactions/check
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CheckDrugInteractionsRequest {
    pub patient_id: Uuid,
    pub new_drug_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DrugInteractionRow {
    pub existing_drug_id: Option<Uuid>,
    pub existing_drug_name: String,
    pub new_drug_name: Option<String>,
    pub severity: Option<String>,
    pub description: Option<String>,
}

pub async fn check_drug_interactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CheckDrugInteractionsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get active prescriptions for the patient
    let active_drugs = sqlx::query_as::<_, DrugInteractionRow>(
        "SELECT oi.catalog_item_id AS existing_drug_id, \
         oi.drug_name AS existing_drug_name, \
         nc.name AS new_drug_name, \
         di.severity, di.description \
         FROM pharmacy_orders o \
         JOIN pharmacy_order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id \
         LEFT JOIN pharmacy_catalog nc ON nc.id = $3 AND nc.tenant_id = $2 \
         LEFT JOIN drug_interactions di ON di.tenant_id = o.tenant_id AND di.is_active = true AND \
           ((lower(di.drug_a_name) = lower(oi.drug_name) AND lower(di.drug_b_name) = lower(nc.name)) OR \
            (lower(di.drug_b_name) = lower(oi.drug_name) AND lower(di.drug_a_name) = lower(nc.name))) \
         WHERE o.patient_id = $1 AND o.tenant_id = $2 \
           AND o.status IN ('pending', 'dispensed') \
           AND o.created_at >= now() - interval '30 days' \
           AND di.id IS NOT NULL \
         ORDER BY di.severity DESC",
    )
    .bind(body.patient_id)
    .bind(claims.tenant_id)
    .bind(body.new_drug_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "patient_id": body.patient_id,
        "new_drug_id": body.new_drug_id,
        "interactions_found": active_drugs.len(),
        "interactions": active_drugs.iter().map(|d| json!({
            "existing_drug_id": d.existing_drug_id,
            "existing_drug_name": d.existing_drug_name,
            "new_drug_name": d.new_drug_name,
            "severity": d.severity,
            "description": d.description,
        })).collect::<Vec<_>>(),
    })))
}

// ══════════════════════════════════════════════════════════
//  GET /api/pharmacy/prescriptions/{id}/audit
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PrescriptionAuditRow {
    pub id: Uuid,
    pub action: Option<String>,
    pub changed_by: Option<Uuid>,
    pub changed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
}

pub async fn prescription_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
) -> Result<Json<Vec<PrescriptionAuditRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PrescriptionAuditRow>(
        "SELECT a.id, a.action, a.performed_by AS changed_by, \
         a.performed_at AS changed_at, \
         a.old_values, a.new_values \
         FROM audit_log a \
         WHERE a.record_id = $1 AND a.tenant_id = $2 \
           AND a.table_name = 'prescriptions' \
         ORDER BY a.performed_at DESC \
         LIMIT 200",
    )
    .bind(prescription_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/pharmacy/formulary/check
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct FormularyCheckRequest {
    pub drug_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FormularyCheckRow {
    pub id: Uuid,
    pub name: String,
    pub generic_name: Option<String>,
    pub formulary_status: Option<String>,
    pub drug_schedule: Option<String>,
    pub is_controlled: Option<bool>,
    pub aware_category: Option<String>,
}

pub async fn formulary_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<FormularyCheckRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let drug = sqlx::query_as::<_, FormularyCheckRow>(
        "SELECT id, name, generic_name, formulary_status, \
         drug_schedule, is_controlled, aware_category \
         FROM pharmacy_catalog \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.drug_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    match drug {
        Some(d) => {
            let is_formulary = d.formulary_status.as_deref() == Some("approved");
            Ok(Json(json!({
                "drug_id": d.id,
                "name": d.name,
                "generic_name": d.generic_name,
                "is_in_formulary": is_formulary,
                "formulary_status": d.formulary_status,
                "drug_schedule": d.drug_schedule,
                "is_controlled": d.is_controlled,
                "aware_category": d.aware_category,
            })))
        }
        None => Ok(Json(json!({
            "drug_id": body.drug_id,
            "is_in_formulary": false,
            "error": "Drug not found in catalog",
        }))),
    }
}

// ══════════════════════════════════════════════════════════
//  Phase 3: Rx Queue (Pharmacist Prescription Workflow)
// ══════════════════════════════════════════════════════════

/// GET /api/pharmacy/rx-queue
pub async fn list_rx_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<RxQueueQuery>,
) -> Result<Json<Vec<RxQueueRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::rx_queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status_filter = params.status.as_deref().unwrap_or("pending_review");

    let rows = sqlx::query_as::<_, RxQueueRow>(
        "SELECT pr.id, pr.prescription_id, pr.patient_id,
                p.first_name || ' ' || p.last_name AS patient_name,
                u.full_name AS doctor_name,
                pr.source, pr.status, pr.priority, pr.received_at,
                (SELECT COUNT(*) FROM patient_allergies pa
                 WHERE pa.patient_id = pr.patient_id AND pa.is_active = true
                   AND pa.allergy_type = 'drug') AS allergy_count
         FROM pharmacy_prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         JOIN users u ON u.id = pr.doctor_id
         WHERE pr.tenant_id = $1 AND pr.status::text = $2
         ORDER BY
           CASE pr.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
           pr.received_at ASC
         LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(status_filter)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/pharmacy/rx-queue/{id}
pub async fn get_rx_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::rx_queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rx = sqlx::query_as::<_, PharmacyPrescriptionRx>(
        "SELECT * FROM pharmacy_prescriptions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Fetch prescription items
    let items = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r), '[]'::json) FROM (
         SELECT pi.id::text, pi.drug_name, pi.dosage, pi.frequency, pi.duration,
                pi.route, pi.instructions
         FROM prescription_items pi WHERE pi.prescription_id = $1
         ORDER BY pi.created_at
         ) r",
    )
    .bind(rx.prescription_id)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch patient allergies
    let allergies = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r), '[]'::json) FROM (
         SELECT allergen_name, allergy_type::text, severity::text, reaction
         FROM patient_allergies WHERE patient_id = $1 AND is_active = true
         ) r",
    )
    .bind(rx.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({
        "prescription": rx,
        "items": items,
        "allergies": allergies,
    })))
}

/// PUT /api/pharmacy/rx-queue/{id}/review
pub async fn review_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewPrescriptionRequest>,
) -> Result<Json<PharmacyPrescriptionRx>, AppError> {
    require_permission(&claims, permissions::pharmacy::rx_queue::REVIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let new_status = match body.action.as_str() {
        "approved" => "approved",
        "rejected" => "rejected",
        "on_hold" => "on_hold",
        _ => {
            return Err(AppError::BadRequest(
                "Invalid action. Use: approved, rejected, on_hold".to_owned(),
            ));
        }
    };

    let rx = sqlx::query_as::<_, PharmacyPrescriptionRx>(
        "UPDATE pharmacy_prescriptions SET
            status = $2::pharmacy_rx_status,
            reviewed_by = $3,
            reviewed_at = now(),
            review_notes = $4,
            rejection_reason = $5,
            allergy_check_done = true,
            interaction_check_done = true
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(&body.rejection_reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // On approval: auto-create pharmacy order from prescription items
    if new_status == "approved" {
        // Get prescription items
        let items = sqlx::query_as::<_, PrescriptionItemRow>(
            "SELECT drug_name, dosage, frequency, duration, route \
             FROM prescription_items WHERE prescription_id = $1 AND tenant_id = $2",
        )
        .bind(rx.prescription_id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        // Create pharmacy order
        let order_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO pharmacy_orders \
             (tenant_id, patient_id, prescription_id, encounter_id, ordered_by, status, \
              dispensing_type, rx_queue_id, pharmacist_reviewed_by, reviewed_at) \
             VALUES ($1, $2, $3, $4, $5, 'ordered', 'prescription'::pharmacy_dispensing_type, $6, $5, now()) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(rx.patient_id)
        .bind(rx.prescription_id)
        .bind(rx.encounter_id)
        .bind(claims.sub)
        .bind(rx.id)
        .fetch_one(&mut *tx)
        .await?;

        // Create order items from prescription items
        for item in &items {
            // Try to resolve catalog item by drug name
            let catalog = sqlx::query_scalar::<_, Option<Uuid>>(
                "SELECT id FROM pharmacy_catalog \
                 WHERE tenant_id = $1 AND (name ILIKE $2 OR generic_name ILIKE $2) AND is_active = true \
                 LIMIT 1",
            )
            .bind(claims.tenant_id)
            .bind(&item.drug_name)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();

            let price = if let Some(cid) = catalog {
                sqlx::query_scalar::<_, Option<Decimal>>(
                    "SELECT base_price FROM pharmacy_catalog WHERE id = $1",
                )
                .bind(cid)
                .fetch_optional(&mut *tx)
                .await?
                .flatten()
                .unwrap_or_default()
            } else {
                Decimal::ZERO
            };

            sqlx::query(
                "INSERT INTO pharmacy_order_items \
                 (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price) \
                 VALUES ($1, $2, $3, $4, 1, $5, $5)",
            )
            .bind(claims.tenant_id)
            .bind(order_id)
            .bind(catalog)
            .bind(&item.drug_name)
            .bind(price)
            .execute(&mut *tx)
            .await?;
        }

        // Link order back to rx queue
        sqlx::query(
            "UPDATE pharmacy_prescriptions SET pharmacy_order_id = $1, status = 'dispensing'::pharmacy_rx_status WHERE id = $2",
        )
        .bind(order_id)
        .bind(rx.id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(rx))
}

// Helper row for prescription items
#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct PrescriptionItemRow {
    drug_name: String,
    dosage: String,
    frequency: String,
    duration: String,
    route: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Phase 3: Safety Checks
// ══════════════════════════════════════════════════════════

/// POST /api/pharmacy/safety/allergy-check
pub async fn check_patient_allergies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AllergyCheckRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let matches = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r), '[]'::json) FROM (
         SELECT pa.allergen_name, pa.allergy_type::text, pa.severity::text, pa.reaction,
                pc.name AS drug_name, pc.generic_name
         FROM patient_allergies pa
         CROSS JOIN UNNEST($2::uuid[]) AS did(drug_id)
         JOIN pharmacy_catalog pc ON pc.id = did.drug_id AND pc.tenant_id = $3
         WHERE pa.patient_id = $1 AND pa.is_active = true AND pa.allergy_type = 'drug'
           AND (lower(pa.allergen_name) = lower(pc.name)
                OR lower(pa.allergen_name) = lower(pc.generic_name)
                OR lower(pa.allergen_name) = lower(pc.inn_name))
         ) r",
    )
    .bind(body.patient_id)
    .bind(&body.drug_ids)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let safe = matches.as_array().map_or(true, Vec::is_empty);

    // Log allergy check to audit trail
    for drug_id in &body.drug_ids {
        let action = if safe { "no_match" } else { "blocked" };
        let _ = sqlx::query(
            "INSERT INTO pharmacy_allergy_check_log \
             (tenant_id, patient_id, catalog_item_id, drug_name, action_taken, context) \
             VALUES ($1, $2, $3, \
              COALESCE((SELECT name FROM pharmacy_catalog WHERE id = $3 AND tenant_id = $1), 'Unknown'), \
              $4, 'order_creation')",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(drug_id)
        .bind(action)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;
    Ok(Json(json!({ "matches": matches, "safe": safe })))
}

/// POST /api/pharmacy/batches/fefo-select
pub async fn select_fefo_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<FefoSelectRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batches = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.expiry_date), '[]'::json) FROM (
         SELECT id::text AS batch_id, batch_number, expiry_date::text,
                quantity_on_hand
         FROM pharmacy_batches
         WHERE catalog_item_id = $1 AND tenant_id = $2
           AND quantity_on_hand > 0 AND expiry_date > CURRENT_DATE
           AND ($3::uuid IS NULL OR store_location_id = $3)
         ORDER BY expiry_date ASC
         ) r",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .bind(body.store_location_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        json!({ "batches": batches, "quantity_needed": body.quantity_needed }),
    ))
}

// ══════════════════════════════════════════════════════════
//  Phase 3: POS Counter Sales
// ══════════════════════════════════════════════════════════

/// POST /api/pharmacy/pos/sales
pub async fn create_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePosSaleRequest>,
) -> Result<Json<PharmacyPosSale>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Generate sale number
    let sale_num = format!(
        "PH-SALE-{}",
        Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("0000")
    );

    // Calculate totals
    let mut subtotal = Decimal::ZERO;
    let mut gst_total = Decimal::ZERO;
    for item in &body.items {
        let line = Decimal::from(item.quantity) * item.selling_price;
        let gst = line * item.gst_rate / Decimal::from(100);
        subtotal += line;
        gst_total += gst;
    }
    let discount = body.discount_amount.unwrap_or(Decimal::ZERO);
    let total = subtotal - discount + gst_total;

    // Create pharmacy order for stock tracking
    let order = sqlx::query_as::<_, PharmacyOrder>(
        "INSERT INTO pharmacy_orders
         (tenant_id, patient_id, ordered_by, status, notes,
          dispensing_type, store_location_id, dispensed_by, dispensed_at)
         VALUES ($1, $2, $3, 'dispensed', $4, 'otc'::pharmacy_dispensing_type, $5, $3, now())
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(body.store_location_id)
    .fetch_one(&mut *tx)
    .await?;

    // Create POS sale record
    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "INSERT INTO pharmacy_pos_sales
         (tenant_id, sale_number, pharmacy_order_id, patient_id, patient_name, patient_phone,
          subtotal, discount_amount, discount_percent, gst_amount, total_amount,
          payment_mode, payment_reference, amount_received, change_due,
          receipt_number, pricing_tier, sold_by, store_location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12::pharmacy_payment_mode, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&sale_num)
    .bind(order.id)
    .bind(body.patient_id)
    .bind(&body.patient_name)
    .bind(&body.patient_phone)
    .bind(subtotal)
    .bind(discount)
    .bind(body.discount_percent)
    .bind(gst_total)
    .bind(total)
    .bind(body.payment_mode.as_deref().unwrap_or("cash"))
    .bind(&body.payment_reference)
    .bind(body.amount_received.unwrap_or(total))
    .bind(body.amount_received.map_or(Decimal::ZERO, |r| r - total))
    .bind(&sale_num)
    .bind(body.pricing_tier.as_deref().unwrap_or("mrp"))
    .bind(claims.sub)
    .bind(body.store_location_id)
    .fetch_one(&mut *tx)
    .await?;

    // Create sale items + order items + deduct stock
    for item in &body.items {
        let line_gst =
            Decimal::from(item.quantity) * item.selling_price * item.gst_rate / Decimal::from(100);
        let half_gst = line_gst / Decimal::from(2);
        let line_total = Decimal::from(item.quantity) * item.selling_price + line_gst;

        // Order item for stock tracking
        sqlx::query(
            "INSERT INTO pharmacy_order_items
             (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.selling_price)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;

        // POS sale item with GST split
        sqlx::query(
            "INSERT INTO pharmacy_pos_sale_items
             (tenant_id, pos_sale_id, catalog_item_id, drug_name, batch_id, batch_number,
              hsn_code, quantity, mrp, selling_price, gst_rate, cgst_amount, sgst_amount,
              igst_amount, line_total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14)",
        )
        .bind(claims.tenant_id)
        .bind(sale.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.batch_id)
        .bind(&item.batch_number)
        .bind(&item.hsn_code)
        .bind(item.quantity)
        .bind(item.mrp)
        .bind(item.selling_price)
        .bind(item.gst_rate)
        .bind(half_gst)
        .bind(half_gst)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;

        // Deduct stock
        if let Some(cid) = item.catalog_item_id {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock - $1 WHERE id = $2",
            )
            .bind(item.quantity)
            .bind(cid)
            .execute(&mut *tx)
            .await?;
        }
        if let Some(bid) = item.batch_id {
            sqlx::query(
                "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand - $1, quantity_dispensed = quantity_dispensed + $1 WHERE id = $2",
            )
            .bind(item.quantity)
            .bind(bid)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(sale))
}

/// GET /api/pharmacy/pos/sales
pub async fn list_pos_sales(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PosSalesQuery>,
) -> Result<Json<Vec<PharmacyPosSale>>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR payment_mode::text = $2)
           AND created_at >= COALESCE($3::date, CURRENT_DATE)::timestamptz
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(&params.payment_mode)
    .bind(params.date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/pharmacy/pos/day-summary
pub async fn pos_day_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PosDaySummary>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let summary = sqlx::query_as::<_, PosDaySummary>(
        "SELECT
            COUNT(*)::bigint AS total_sales,
            COALESCE(SUM(total_amount), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_total,
            COALESCE(SUM(CASE WHEN payment_mode = 'card' THEN total_amount ELSE 0 END), 0) AS card_total,
            COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN total_amount ELSE 0 END), 0) AS upi_total,
            COALESCE(SUM(gst_amount), 0) AS gst_collected
         FROM pharmacy_pos_sales
         WHERE tenant_id = $1 AND created_at >= CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(summary))
}

/// PUT /api/pharmacy/pos/sales/{id}/cancel — Full cancel POS sale, restore stock
pub async fn cancel_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelPosSaleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get the POS sale
    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Get sale items
    let items = sqlx::query_as::<_, PharmacyPosSaleItem>(
        "SELECT * FROM pharmacy_pos_sale_items WHERE pos_sale_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Restore stock for each item
    for item in &items {
        if let Some(catalog_id) = item.catalog_item_id {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock + $1 \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(item.quantity)
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            // Restore batch stock if tracked
            if let Some(batch_id) = item.batch_id {
                sqlx::query(
                    "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand + $1, \
                     quantity_dispensed = quantity_dispensed - $1 WHERE id = $2",
                )
                .bind(item.quantity)
                .bind(batch_id)
                .execute(&mut *tx)
                .await?;
            }

            // Create reverse stock transaction
            sqlx::query(
                "INSERT INTO pharmacy_stock_transactions \
                 (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, created_by) \
                 VALUES ($1, $2, 'return', $3, $4, $5)",
            )
            .bind(claims.tenant_id)
            .bind(catalog_id)
            .bind(item.quantity)
            .bind(id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Mark all items as cancelled
    sqlx::query(
        "UPDATE pharmacy_pos_sale_items SET is_cancelled = true, cancelled_qty = quantity \
         WHERE pos_sale_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Mark sale as cancelled
    sqlx::query(
        "UPDATE pharmacy_pos_sales SET status = 'cancelled', cancelled_at = now(), \
         cancelled_by = $3, cancel_reason = $4, refund_amount = total_amount \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.reason)
    .execute(&mut *tx)
    .await?;

    // Create refund payment transaction
    sqlx::query(
        "INSERT INTO pharmacy_payment_transactions \
         (tenant_id, pos_sale_id, payment_mode, amount, reference_number, created_by) \
         VALUES ($1, $2, 'cash', -$3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(sale.total_amount)
    .bind(format!("REFUND-{}", sale.receipt_number.as_deref().unwrap_or("N/A")))
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        json!({ "status": "cancelled", "refund_amount": sale.total_amount.to_string() }),
    ))
}

/// PUT /api/pharmacy/pos/sales/{id}/return-items — Partial return: cancel specific items
#[derive(Debug, Deserialize)]
pub struct ReturnPosItemsRequest {
    pub items: Vec<ReturnPosItem>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnPosItem {
    pub item_id: Uuid,
    pub return_qty: i32,
    pub reason: Option<String>,
}

pub async fn return_pos_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnPosItemsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut total_refund = rust_decimal::Decimal::ZERO;

    for ret_item in &body.items {
        // Get the sale item
        let item = sqlx::query_as::<_, PharmacyPosSaleItem>(
            "SELECT * FROM pharmacy_pos_sale_items \
             WHERE id = $1 AND pos_sale_id = $2 AND tenant_id = $3",
        )
        .bind(ret_item.item_id)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

        let return_qty = ret_item.return_qty.min(item.quantity);
        if return_qty <= 0 {
            continue;
        }

        let refund_amount = item.selling_price * rust_decimal::Decimal::from(return_qty);
        total_refund += refund_amount;

        // Mark item as partially/fully cancelled
        let is_full = return_qty >= item.quantity;
        sqlx::query(
            "UPDATE pharmacy_pos_sale_items SET \
             is_cancelled = $3, cancelled_qty = COALESCE(cancelled_qty, 0) + $4, \
             cancel_reason = $5 \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(ret_item.item_id)
        .bind(claims.tenant_id)
        .bind(is_full)
        .bind(return_qty)
        .bind(ret_item.reason.as_deref().or(body.reason.as_deref()))
        .execute(&mut *tx)
        .await?;

        // Restore stock
        if let Some(catalog_id) = item.catalog_item_id {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock + $1 \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(return_qty)
            .bind(catalog_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            if let Some(batch_id) = item.batch_id {
                sqlx::query(
                    "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand + $1, \
                     quantity_dispensed = quantity_dispensed - $1 WHERE id = $2",
                )
                .bind(return_qty)
                .bind(batch_id)
                .execute(&mut *tx)
                .await?;
            }

            // Reverse stock transaction
            sqlx::query(
                "INSERT INTO pharmacy_stock_transactions \
                 (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, created_by) \
                 VALUES ($1, $2, 'return', $3, $4, $5)",
            )
            .bind(claims.tenant_id)
            .bind(catalog_id)
            .bind(return_qty)
            .bind(id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Update sale status + refund amount
    sqlx::query(
        "UPDATE pharmacy_pos_sales SET \
         status = CASE \
           WHEN (SELECT COUNT(*) FROM pharmacy_pos_sale_items WHERE pos_sale_id = $1 AND NOT COALESCE(is_cancelled, false)) = 0 \
           THEN 'cancelled' ELSE 'partially_cancelled' END, \
         refund_amount = COALESCE(refund_amount, 0) + $3 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(total_refund)
    .execute(&mut *tx)
    .await?;

    // Create refund payment
    if total_refund > rust_decimal::Decimal::ZERO {
        sqlx::query(
            "INSERT INTO pharmacy_payment_transactions \
             (tenant_id, pos_sale_id, payment_mode, amount, reference_number, created_by) \
             VALUES ($1, $2, 'cash', -$3, $4, $5)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(total_refund)
        .bind(format!("PARTIAL-REFUND-{id}"))
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(json!({
        "status": "partial_return",
        "items_returned": body.items.len(),
        "refund_amount": total_refund.to_string(),
    })))
}

// ══════════════════════════════════════════════════════════
//  Phase 3: Pricing
// ══════════════════════════════════════════════════════════

/// POST /api/pharmacy/pricing/resolve
pub async fn resolve_drug_price(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ResolvePriceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::prescriptions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tier = body.tier_name.as_deref().unwrap_or("mrp");

    // Try pricing tier first, fall back to catalog
    let price = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT price FROM pharmacy_pricing_tiers
         WHERE catalog_item_id = $1 AND tenant_id = $2 AND tier_name = $3
           AND effective_from <= CURRENT_DATE
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
         ORDER BY effective_from DESC LIMIT 1",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .bind(tier)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    let catalog = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT json_build_object('mrp', mrp, 'base_price', base_price, 'gst_rate', gst_rate, 'name', name)
         FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_else(|| json!({}));

    let selling_price = price
        .or_else(|| {
            catalog
                .get("mrp")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        })
        .or_else(|| {
            catalog
                .get("base_price")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        })
        .unwrap_or(Decimal::ZERO);

    let gst_rate = catalog
        .get("gst_rate")
        .and_then(|v| v.as_f64())
        .map_or(Decimal::ZERO, |f| Decimal::try_from(f).unwrap_or_default());
    let gst_amount = selling_price * gst_rate / Decimal::from(100);

    tx.commit().await?;
    Ok(Json(json!({
        "catalog": catalog,
        "tier": tier,
        "selling_price": selling_price.to_string(),
        "gst_rate": gst_rate.to_string(),
        "gst_amount": gst_amount.to_string(),
        "total": (selling_price + gst_amount).to_string(),
    })))
}

/// PUT /api/pharmacy/pricing/tiers
pub async fn upsert_pricing_tier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertPricingTierRequest>,
) -> Result<Json<PharmacyPricingTier>, AppError> {
    require_permission(&claims, permissions::pharmacy::pricing::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tier = sqlx::query_as::<_, PharmacyPricingTier>(
        "INSERT INTO pharmacy_pricing_tiers
         (tenant_id, catalog_item_id, tier_name, price, effective_from, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, catalog_item_id, tier_name, effective_from) DO UPDATE SET
           price = EXCLUDED.price
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.tier_name)
    .bind(body.price)
    .bind(
        body.effective_from
            .unwrap_or_else(|| chrono::Utc::now().date_naive()),
    )
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(tier))
}

// ══════════════════════════════════════════════════════════
//  Phase 3: Stock Reconciliation & Reorder
// ══════════════════════════════════════════════════════════

/// POST /api/pharmacy/stock/reconcile
pub async fn stock_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReconcileStockRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut reconciled = 0i64;
    for item in &body.items {
        let system_qty = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT current_stock FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
        )
        .bind(item.catalog_item_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten()
        .unwrap_or(0);

        let variance = item.physical_quantity - system_qty;

        sqlx::query(
            "INSERT INTO pharmacy_stock_reconciliation
             (tenant_id, catalog_item_id, batch_id, system_quantity, physical_quantity,
              variance, reason, reconciled_by, store_location_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(claims.tenant_id)
        .bind(item.catalog_item_id)
        .bind(item.batch_id)
        .bind(system_qty)
        .bind(item.physical_quantity)
        .bind(variance)
        .bind(&item.reason)
        .bind(claims.sub)
        .bind(body.store_location_id)
        .execute(&mut *tx)
        .await?;

        // Adjust catalog stock to match physical
        if variance != 0 {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = $1 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(item.physical_quantity)
            .bind(item.catalog_item_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
        }

        reconciled += 1;
    }

    tx.commit().await?;
    Ok(Json(json!({ "reconciled": reconciled })))
}

/// GET /api/pharmacy/stock/reorder-suggestions
pub async fn reorder_suggestions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let suggestions = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.urgency DESC), '[]'::json) FROM (
         SELECT pc.id::text AS catalog_item_id, pc.name, pc.generic_name,
                pc.current_stock, pc.reorder_level, pc.min_stock, pc.max_stock,
                COALESCE(pc.max_stock, pc.reorder_level * 3) - pc.current_stock AS suggested_quantity,
                CASE
                    WHEN pc.current_stock <= 0 THEN 'critical'
                    WHEN pc.current_stock <= COALESCE(pc.min_stock, pc.reorder_level / 2) THEN 'high'
                    ELSE 'normal'
                END AS urgency
         FROM pharmacy_catalog pc
         WHERE pc.tenant_id = $1 AND pc.is_active = true
           AND pc.current_stock <= COALESCE(pc.reorder_level, 10)
         ORDER BY pc.current_stock ASC
         ) r",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "suggestions": suggestions })))
}

// ══════════════════════════════════════════════════════════
//  Phase 3: Enhanced Analytics
// ══════════════════════════════════════════════════════════

/// GET /api/pharmacy/analytics/daily-sales
pub async fn daily_sales_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let days = params.days.unwrap_or(30);

    let rows = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.sale_date), '[]'::json) FROM (
         SELECT DATE(created_at)::text AS sale_date,
                COUNT(*)::bigint AS sale_count,
                SUM(total_amount)::float8 AS revenue,
                SUM(gst_amount)::float8 AS gst,
                SUM(CASE WHEN payment_mode = 'cash' THEN total_amount ELSE 0 END)::float8 AS cash,
                SUM(CASE WHEN payment_mode = 'card' THEN total_amount ELSE 0 END)::float8 AS card,
                SUM(CASE WHEN payment_mode = 'upi' THEN total_amount ELSE 0 END)::float8 AS upi
         FROM pharmacy_pos_sales
         WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
         GROUP BY DATE(created_at)
         ) r",
    )
    .bind(claims.tenant_id)
    .bind(days.to_string())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "sales": rows })))
}

/// GET /api/pharmacy/analytics/fill-rate
pub async fn prescription_fill_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let stats = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT json_build_object(
            'total', COUNT(*)::bigint,
            'dispensed', COUNT(*) FILTER (WHERE status IN ('dispensed', 'partially_dispensed'))::bigint,
            'rejected', COUNT(*) FILTER (WHERE status = 'rejected')::bigint,
            'pending', COUNT(*) FILTER (WHERE status = 'pending_review')::bigint,
            'on_hold', COUNT(*) FILTER (WHERE status = 'on_hold')::bigint,
            'avg_review_minutes', EXTRACT(EPOCH FROM AVG(reviewed_at - received_at) FILTER (WHERE reviewed_at IS NOT NULL)) / 60.0
         )
         FROM pharmacy_prescriptions
         WHERE tenant_id = $1 AND received_at >= CURRENT_DATE - INTERVAL '30 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(stats))
}

/// GET /api/pharmacy/analytics/margins
pub async fn margin_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.margin_percent DESC), '[]'::json) FROM (
         SELECT pc.category, pc.name, pc.generic_name,
                pc.cost_price::float8 AS cost,
                pc.base_price::float8 AS selling,
                CASE WHEN pc.cost_price > 0
                    THEN ((pc.base_price - pc.cost_price) / pc.cost_price * 100)::float8
                    ELSE 0
                END AS margin_percent,
                pc.current_stock
         FROM pharmacy_catalog pc
         WHERE pc.tenant_id = $1 AND pc.is_active = true AND pc.cost_price IS NOT NULL
         LIMIT 100
         ) r",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "margins": rows })))
}

// ── Phase 3 Request Types ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RxQueueQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewPrescriptionRequest {
    pub action: String,
    pub notes: Option<String>,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AllergyCheckRequest {
    pub patient_id: Uuid,
    pub drug_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct FefoSelectRequest {
    pub catalog_item_id: Uuid,
    pub quantity_needed: i32,
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePosSaleRequest {
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub items: Vec<PosSaleItemInput>,
    pub discount_amount: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
    pub amount_received: Option<Decimal>,
    pub pricing_tier: Option<String>,
    pub notes: Option<String>,
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct PosSaleItemInput {
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub batch_id: Option<Uuid>,
    pub batch_number: Option<String>,
    pub hsn_code: Option<String>,
    pub quantity: i32,
    pub mrp: Decimal,
    pub selling_price: Decimal,
    pub gst_rate: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct PosSalesQuery {
    pub payment_mode: Option<String>,
    pub date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CancelPosSaleRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResolvePriceRequest {
    pub catalog_item_id: Uuid,
    pub tier_name: Option<String>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertPricingTierRequest {
    pub catalog_item_id: Uuid,
    pub tier_name: String,
    pub price: Decimal,
    pub effective_from: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct ReconcileStockRequest {
    pub items: Vec<ReconcileItemInput>,
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ReconcileItemInput {
    pub catalog_item_id: Uuid,
    pub batch_id: Option<Uuid>,
    pub physical_quantity: i32,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsDateQuery {
    pub days: Option<i32>,
}
