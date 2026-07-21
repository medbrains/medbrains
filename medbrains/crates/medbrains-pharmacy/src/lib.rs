#![allow(clippy::too_many_lines, unused_imports)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::clinical_events::{
    ClinicalEventEnvelope, ClinicalEventName, ClinicalEventSourceModule,
};
use medbrains_core::permissions;
use medbrains_core::pharmacy::{
    PharmacyCatalog, PharmacyOrder, PharmacyOrderItem, PharmacyStockTransaction,
};
use medbrains_core::pharmacy_phase2::{
    DeadStockRow, DrugUtilizationRow, NdpsRegisterEntry, NearExpiryRow, PharmacyAbcVedRow,
    PharmacyBatch, PharmacyConsumptionRow, PharmacyReturn, PharmacyReturnStatus,
    PharmacyStoreAssignment, PharmacyTransferRequest,
};
use medbrains_core::pharmacy_phase3::{
    PharmacyAllergyCheckLog, PharmacyPaymentMode, PharmacyPosSale, PharmacyPosSaleItem,
    PharmacyPrescriptionRx, PharmacyPricingTier, PharmacyRxStatus, PharmacyStockReconciliation,
    PosDaySummary, RxQueueRow,
};
use medbrains_core::privacy::{mask_name, mask_phone};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use axum::routing::{get,post,put,delete};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_any_permission, require_permission};
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::notifications::{NewNotification, create_notification};
use medbrains_server_core::state::AppState;
use medbrains_core::form::FieldAccessLevel;

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    /// Column key to sort by (allowlisted server-side). Defaults to created_at.
    pub sort: Option<String>,
    /// Sort direction: "asc" or "desc" (default desc).
    pub order: Option<String>,
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
    /// General CPOE/CDS override reason for medication safety blocks
    /// (duplicate active order, high-risk medication acknowledgement,
    /// controlled-drug acknowledgement). Requires
    /// `pharmacy.safety.override`.
    pub safety_override_reason: Option<String>,
    /// When the prescriber has reviewed the patient's drug-allergy
    /// list and chooses to proceed despite a partial-match warning,
    /// the override reason is stored on the order for audit (e.g.
    /// "test dose under monitoring", "sensitivity confirmed false on
    /// re-challenge"). Empty / absent → strict allergy check.
    pub allergy_override_reason: Option<String>,
    /// Internal training / simulator flag. See OPD CreateEncounterRequest.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderItemRequest {
    pub quantity: i32,
}

#[derive(Debug, Clone)]
pub struct MedicationSafetyItem {
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub quantity: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct MedicationSafetyWarning {
    pub code: String,
    pub severity: MedicationSafetySeverity,
    pub message: String,
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub detail: serde_json::Value,
}

#[derive(Debug, sqlx::FromRow)]
struct PharmacyStockGate {
    current_stock: i32,
    batch_tracking_required: bool,
    is_controlled: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct BatchDispenseTrace {
    id: Uuid,
    batch_number: String,
    expiry_date: NaiveDate,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MedicationSafetySeverity {
    Warn,
    Block,
}

#[derive(Debug, Serialize)]
pub struct OrderDetailResponse {
    pub order: PharmacyOrder,
    pub items: Vec<PharmacyOrderItem>,
    pub admission_id: Option<Uuid>,
    pub billing_invoice_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct CatalogPriceRow {
    id: Uuid,
    base_price: Decimal,
}

fn pharmacy_rx_status_code(status: &PharmacyRxStatus) -> &'static str {
    match status {
        PharmacyRxStatus::PendingReview => "pending_review",
        PharmacyRxStatus::Approved => "approved",
        PharmacyRxStatus::Rejected => "rejected",
        PharmacyRxStatus::OnHold => "on_hold",
        PharmacyRxStatus::Dispensing => "dispensing",
        PharmacyRxStatus::Dispensed => "dispensed",
        PharmacyRxStatus::PartiallyDispensed => "partially_dispensed",
        PharmacyRxStatus::Cancelled => "cancelled",
    }
}

#[derive(Debug, sqlx::FromRow)]
struct RxDetailItemPriceRow {
    id: Uuid,
    drug_name: String,
    dosage: String,
    frequency: String,
    duration: String,
    route: Option<String>,
    instructions: Option<String>,
    catalog_item_id: Option<Uuid>,
    unit_price: Decimal,
    tax_percent: Decimal,
    price_source: String,
}

#[derive(Debug, sqlx::FromRow)]
struct LinkedPharmacyInvoiceItem {
    invoice_item_id: Uuid,
    invoice_id: Uuid,
    invoice_status: String,
}

#[derive(Debug, Default, Clone, Copy)]
struct PharmacyBillingIndentResult {
    invoice_id: Option<Uuid>,
    created_invoice_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct BillingInvoiceEventRow {
    invoice_number: String,
    total_amount: Decimal,
    status: String,
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
    /// When set, `current_stock` is overridden with the on-hand at THIS pharmacy
    /// location (summed live from its batches), for a per-location stock view.
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStockTransactionRequest {
    pub catalog_item_id: Uuid,
    pub transaction_type: String,
    pub quantity: i32,
    pub reference_id: Option<Uuid>,
    pub notes: Option<String>,
}

fn medication_safety_override_reason(body: &CreateOrderRequest) -> Option<&str> {
    body.safety_override_reason
        .as_deref()
        .or(body.allergy_override_reason.as_deref())
        .map(str::trim)
        .filter(|reason| !reason.is_empty())
}

fn can_override_medication_safety(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::pharmacy::safety::OVERRIDE)
}

fn can_view_patient_identity(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW)
}

fn medication_safety_severity_str(severity: MedicationSafetySeverity) -> &'static str {
    match severity {
        MedicationSafetySeverity::Warn => "warn",
        MedicationSafetySeverity::Block => "block",
    }
}

fn decimal_as_f64(value: Decimal) -> f64 {
    value.to_f64().unwrap_or(0.0)
}

const PHARMACY_CATALOG_BASE_PRICE_FIELD: &str = "pharmacy.catalog.base_price";
const PHARMACY_PRICING_UNIT_PRICE_FIELD: &str = "pharmacy.pricing.unit_price";
const PHARMACY_BATCH_NUMBER_FIELD: &str = "pharmacy.batches.batch_number";
const PHARMACY_BATCH_PURCHASE_RATE_FIELD: &str = "pharmacy.batches.purchase_rate";
const PHARMACY_BATCH_SELLING_RATE_FIELD: &str = "pharmacy.batches.selling_rate";
const PHARMACY_BATCH_SOURCE_FIELD: &str = "pharmacy.batches.source";
const PHARMACY_NDPS_BALANCE_FIELD: &str = "pharmacy.ndps.balance_after";
const PHARMACY_NDPS_USER_IDS_FIELD: &str = "pharmacy.ndps.user_ids";
const PHARMACY_NDPS_WITNESS_FIELD: &str = "pharmacy.ndps.witnessed_by";
const PHARMACY_ANALYTICS_VALUE_FIELD: &str = "pharmacy.analytics.value";
const PHARMACY_POS_PATIENT_NAME_FIELD: &str = "pharmacy.pos.patient_name";
const PHARMACY_POS_PATIENT_PHONE_FIELD: &str = "pharmacy.pos.patient_phone";

async fn resolve_pharmacy_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn pharmacy_field_access(
    restricted: &HashMap<String, FieldAccessLevel>,
    field: &str,
) -> FieldAccessLevel {
    restricted
        .get(field)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn should_hide_pharmacy_field(restricted: &HashMap<String, FieldAccessLevel>, field: &str) -> bool {
    pharmacy_field_access(restricted, field) == FieldAccessLevel::Hidden
}

fn should_mask_pharmacy_field(restricted: &HashMap<String, FieldAccessLevel>, field: &str) -> bool {
    pharmacy_field_access(restricted, field) == FieldAccessLevel::Mask
}

fn should_scrub_pharmacy_field(
    restricted: &HashMap<String, FieldAccessLevel>,
    field: &str,
) -> bool {
    matches!(
        pharmacy_field_access(restricted, field),
        FieldAccessLevel::Mask | FieldAccessLevel::Hidden
    )
}

fn should_scrub_pharmacy_pos_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    should_scrub_pharmacy_field(restricted, PHARMACY_PRICING_UNIT_PRICE_FIELD)
        || should_scrub_pharmacy_field(restricted, PHARMACY_ANALYTICS_VALUE_FIELD)
}

fn can_write_pharmacy_field(restricted: &HashMap<String, FieldAccessLevel>, field: &str) -> bool {
    pharmacy_field_access(restricted, field) == FieldAccessLevel::Edit
}

fn has_pharmacy_text(value: &Option<String>) -> bool {
    value.as_deref().is_some_and(|text| !text.trim().is_empty())
}

fn validate_pos_sale_field_access(
    body: &CreatePosSaleRequest,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    let mut violations = Vec::new();
    if has_pharmacy_text(&body.patient_name)
        && !can_write_pharmacy_field(restricted, PHARMACY_POS_PATIENT_NAME_FIELD)
    {
        violations.push("patient_name");
    }
    if has_pharmacy_text(&body.patient_phone)
        && !can_write_pharmacy_field(restricted, PHARMACY_POS_PATIENT_PHONE_FIELD)
    {
        violations.push("patient_phone");
    }

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write restricted pharmacy POS fields: {}",
        violations.join(", ")
    )))
}

fn validate_catalog_price_write(
    base_price: Option<Decimal>,
    restricted: &HashMap<String, FieldAccessLevel>,
    allow_zero_default: bool,
) -> Result<(), AppError> {
    let writes_restricted_price = base_price.is_some_and(|price| {
        if allow_zero_default {
            price != Decimal::ZERO
        } else {
            true
        }
    });

    if writes_restricted_price
        && !can_write_pharmacy_field(restricted, PHARMACY_CATALOG_BASE_PRICE_FIELD)
    {
        return Err(AppError::BadRequest(
            "Cannot write restricted pharmacy catalog price".to_owned(),
        ));
    }

    Ok(())
}

fn validate_batch_write_access(
    body: &CreateBatchRequest,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    let mut violations = Vec::new();

    if !can_write_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        violations.push("batch number");
    }
    if has_pharmacy_text(&body.supplier_batch_number)
        && !can_write_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD)
    {
        violations.push("supplier batch number");
    }
    if body.purchase_rate.is_some()
        && !can_write_pharmacy_field(restricted, PHARMACY_BATCH_PURCHASE_RATE_FIELD)
    {
        violations.push("purchase rate");
    }
    if body.selling_rate.is_some()
        && !can_write_pharmacy_field(restricted, PHARMACY_BATCH_SELLING_RATE_FIELD)
    {
        violations.push("selling rate");
    }
    if (has_pharmacy_text(&body.supplier_info) || has_pharmacy_text(&body.invoice_number))
        && !can_write_pharmacy_field(restricted, PHARMACY_BATCH_SOURCE_FIELD)
    {
        violations.push("batch source");
    }

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write restricted pharmacy batch fields: {}",
        violations.join(", ")
    )))
}

fn filter_pharmacy_catalog_response(
    mut row: PharmacyCatalog,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyCatalog {
    if should_scrub_pharmacy_field(restricted, PHARMACY_CATALOG_BASE_PRICE_FIELD) {
        row.base_price = Decimal::ZERO;
    }
    row
}

fn filter_pharmacy_pos_sale_response(
    mut row: PharmacyPosSale,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyPosSale {
    if should_hide_pharmacy_field(restricted, PHARMACY_POS_PATIENT_NAME_FIELD) {
        row.patient_name = None;
    } else if should_mask_pharmacy_field(restricted, PHARMACY_POS_PATIENT_NAME_FIELD) {
        row.patient_name = row.patient_name.map(|value| mask_name(&value));
    }
    if should_hide_pharmacy_field(restricted, PHARMACY_POS_PATIENT_PHONE_FIELD) {
        row.patient_phone = None;
    } else if should_mask_pharmacy_field(restricted, PHARMACY_POS_PATIENT_PHONE_FIELD) {
        row.patient_phone = row.patient_phone.map(|value| mask_phone(&value));
    }
    if should_scrub_pharmacy_pos_amount(restricted) {
        row.subtotal = Decimal::ZERO;
        row.discount_amount = Decimal::ZERO;
        row.discount_percent = None;
        row.gst_amount = Decimal::ZERO;
        row.total_amount = Decimal::ZERO;
        row.amount_received = Decimal::ZERO;
        row.change_due = Decimal::ZERO;
        if row.refund_amount.is_some() {
            row.refund_amount = Some(Decimal::ZERO);
        }
    }
    row
}

fn filter_pharmacy_pos_sale_item_response(
    mut row: PharmacyPosSaleItem,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyPosSaleItem {
    if should_scrub_pharmacy_field(restricted, PHARMACY_PRICING_UNIT_PRICE_FIELD) {
        row.mrp = Decimal::ZERO;
        row.selling_price = Decimal::ZERO;
        row.cgst_amount = Decimal::ZERO;
        row.sgst_amount = Decimal::ZERO;
        row.igst_amount = Decimal::ZERO;
        row.line_total = Decimal::ZERO;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        row.batch_id = None;
        row.batch_number = None;
    }
    row
}

fn filter_pharmacy_order_item_response(
    mut row: PharmacyOrderItem,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyOrderItem {
    if should_scrub_pharmacy_field(restricted, PHARMACY_PRICING_UNIT_PRICE_FIELD) {
        row.unit_price = Decimal::ZERO;
        row.total_price = Decimal::ZERO;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        row.batch_number = None;
        row.batch_stock_id = None;
    }
    row
}

fn filter_pharmacy_order_detail_response(
    mut detail: OrderDetailResponse,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> OrderDetailResponse {
    detail.items = detail
        .items
        .into_iter()
        .map(|row| filter_pharmacy_order_item_response(row, restricted))
        .collect();
    detail
}

async fn admission_id_for_encounter_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    encounter_id: Option<Uuid>,
) -> Result<Option<Uuid>, AppError> {
    let Some(encounter_id) = encounter_id else {
        return Ok(None);
    };

    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM admissions WHERE tenant_id = $1 AND encounter_id = $2 LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

/// Dispensed-batch trace for a catalog item: (stock id, batch number, expiry).
type BatchTrace = (Option<Uuid>, Option<String>, Option<NaiveDate>);

#[derive(sqlx::FromRow)]
struct PrescriptionItemForMar {
    id: Uuid,
    drug_name: String,
    dosage: String,
    frequency: String,
    duration: String,
    route: Option<String>,
    catalog_item_id: Option<Uuid>,
}

/// Explode a just-dispensed IPD prescription into scheduled eMAR doses.
///
/// For each active prescription item we generate `ipd_medication_administration`
/// rows from the item's frequency + duration (see [`mar_schedule`]), attaching
/// the dispensed batch (matched by catalog item) for recall/expiry traceability
/// and flagging high-alert drugs (controlled / Schedule H1·X·NDPS / LASA) so the
/// bedside requires a witness. Idempotent: an item that already has MAR rows is
/// skipped, so re-dispensing the remainder of a partial order won't double-book.
async fn generate_mar_from_dispensed_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    admission_id: Uuid,
    prescription_id: Uuid,
    dispensed_items: &[PharmacyOrderItem],
) -> Result<(), AppError> {
    // Batch by catalog item: the dose carries the actual dispensed lot.
    let batch_by_catalog: HashMap<Uuid, BatchTrace> =
        dispensed_items
            .iter()
            .filter_map(|i| {
                i.catalog_item_id.map(|cid| {
                    (
                        cid,
                        (i.batch_stock_id, i.batch_number.clone(), i.expiry_date),
                    )
                })
            })
            .collect();

    let items = sqlx::query_as::<_, PrescriptionItemForMar>(
        "SELECT id, drug_name, dosage, frequency, duration, route, catalog_item_id \
         FROM prescription_items \
         WHERE prescription_id = $1 AND tenant_id = $2 AND item_status = 'active'",
    )
    .bind(prescription_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let now = chrono::Utc::now();
    for item in &items {
        // Idempotency: don't regenerate if this item already has scheduled doses.
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM ipd_medication_administration \
             WHERE tenant_id = $1 AND prescription_item_id = $2)",
        )
        .bind(tenant_id)
        .bind(item.id)
        .fetch_one(&mut **tx)
        .await?;
        if exists {
            continue;
        }

        let slots = medbrains_core::mar_schedule::schedule_doses(&item.frequency, &item.duration, now);
        if slots.is_empty() {
            // PRN / SOS — created on demand at the bedside, not pre-scheduled.
            continue;
        }

        let is_high_alert = match item.catalog_item_id {
            Some(cid) => sqlx::query_scalar::<_, bool>(
                "SELECT (is_controlled OR is_lasa OR drug_schedule IN ('H1','X','NDPS')) \
                 FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
            )
            .bind(cid)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .unwrap_or(false),
            None => false,
        };

        let (batch_stock_id, batch_number, batch_expiry) = item
            .catalog_item_id
            .and_then(|cid| batch_by_catalog.get(&cid).cloned())
            .unwrap_or((None, None, None));
        let route = item.route.clone().unwrap_or_else(|| "oral".to_owned());

        for slot in slots {
            sqlx::query(
                "INSERT INTO ipd_medication_administration \
                   (tenant_id, admission_id, prescription_item_id, drug_name, dose, route, \
                    frequency, scheduled_at, status, is_high_alert, \
                    batch_stock_id, batch_number, batch_expiry) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled'::mar_status, $9, $10, $11, $12)",
            )
            .bind(tenant_id)
            .bind(admission_id)
            .bind(item.id)
            .bind(&item.drug_name)
            .bind(&item.dosage)
            .bind(&route)
            .bind(&item.frequency)
            .bind(slot.scheduled_at)
            .bind(is_high_alert)
            .bind(batch_stock_id)
            .bind(&batch_number)
            .bind(batch_expiry)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

async fn order_detail_response_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    order: PharmacyOrder,
    items: Vec<PharmacyOrderItem>,
) -> Result<OrderDetailResponse, AppError> {
    let admission_id = admission_id_for_encounter_in_tx(tx, tenant_id, order.encounter_id).await?;
    let billing_invoice_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT ii.invoice_id \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
           AND ii.pharmacy_order_id = $2 \
           AND ii.reversal_of_id IS NULL \
           AND ii.is_reversal = false \
         ORDER BY \
           CASE i.status::text \
             WHEN 'draft' THEN 0 \
             WHEN 'issued' THEN 1 \
             WHEN 'partially_paid' THEN 2 \
             WHEN 'paid' THEN 3 \
             ELSE 4 \
           END, \
           ii.created_at DESC \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(order.id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(OrderDetailResponse {
        order,
        items,
        admission_id,
        billing_invoice_id,
    })
}

fn filter_pharmacy_batch_response(
    mut row: PharmacyBatch,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyBatch {
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        row.batch_number = "Restricted".to_owned();
        row.supplier_batch_number = None;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_PURCHASE_RATE_FIELD) {
        row.purchase_rate = None;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_SELLING_RATE_FIELD) {
        row.selling_rate = None;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_SOURCE_FIELD) {
        row.supplier_info = None;
        row.grn_item_id = None;
        row.grn_id = None;
        row.invoice_number = None;
        row.vendor_id = None;
    }
    row
}

fn filter_ndps_entry_response(
    mut row: NdpsRegisterEntry,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> NdpsRegisterEntry {
    if should_scrub_pharmacy_field(restricted, PHARMACY_NDPS_BALANCE_FIELD) {
        row.balance_after = 0;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_NDPS_USER_IDS_FIELD) {
        row.dispensed_by = None;
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_NDPS_WITNESS_FIELD) {
        row.witnessed_by = None;
    }
    row
}

fn filter_ndps_balance_response(
    mut row: NdpsBalanceRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> NdpsBalanceRow {
    if should_scrub_pharmacy_field(restricted, PHARMACY_NDPS_BALANCE_FIELD) {
        row.balance = 0;
    }
    row
}

async fn queue_ndps_movement_created_event_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    actor_id: Uuid,
    entry: &NdpsRegisterEntry,
    movement_source: &'static str,
) -> Result<(), AppError> {
    let mut event = ClinicalEventEnvelope::new(
        tenant_id,
        ClinicalEventName::PharmacyNdpsMovementCreated,
        entry.id,
        actor_id,
        json!({
            "entry_id": entry.id,
            "catalog_item_id": entry.catalog_item_id,
            "action": &entry.action,
            "movement_source": movement_source,
            "has_patient_context": entry.patient_id.is_some(),
            "has_prescription_context": entry.prescription_id.is_some(),
            "witness_recorded": entry.witnessed_by.is_some(),
            "created_at": entry.created_at,
        }),
    );
    if let Some(patient_id) = entry.patient_id {
        event = event.with_patient(patient_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(tx, &event).await?;
    Ok(())
}

fn filter_near_expiry_response(
    mut row: NearExpiryRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> NearExpiryRow {
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        row.batch_number = "Restricted".to_owned();
    }
    row
}

fn filter_dead_stock_response(
    mut row: DeadStockRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> DeadStockRow {
    if should_scrub_pharmacy_field(restricted, PHARMACY_ANALYTICS_VALUE_FIELD) {
        row.stock_value = Decimal::ZERO;
    }
    row
}

fn filter_consumption_response(
    mut row: PharmacyConsumptionRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyConsumptionRow {
    if should_scrub_pharmacy_field(restricted, PHARMACY_ANALYTICS_VALUE_FIELD) {
        row.total_value = Decimal::ZERO;
    }
    row
}

fn filter_abc_ved_response(
    mut row: PharmacyAbcVedRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyAbcVedRow {
    if should_scrub_pharmacy_field(restricted, PHARMACY_ANALYTICS_VALUE_FIELD) {
        row.annual_value = Decimal::ZERO;
    }
    row
}

fn scrub_json_numeric_fields(value: &mut serde_json::Value, fields: &[&str]) {
    match value {
        serde_json::Value::Array(rows) => {
            for row in rows {
                scrub_json_numeric_fields(row, fields);
            }
        }
        serde_json::Value::Object(map) => {
            for field in fields {
                if map.contains_key(*field) {
                    map.insert((*field).to_owned(), json!(0));
                }
            }
            for nested in map.values_mut() {
                scrub_json_numeric_fields(nested, fields);
            }
        }
        _ => {}
    }
}

fn scrub_json_fields_with_value(
    value: &mut serde_json::Value,
    fields: &[&str],
    replacement: &serde_json::Value,
) {
    match value {
        serde_json::Value::Array(rows) => {
            for row in rows {
                scrub_json_fields_with_value(row, fields, replacement);
            }
        }
        serde_json::Value::Object(map) => {
            for field in fields {
                if map.contains_key(*field) {
                    map.insert((*field).to_owned(), replacement.clone());
                }
            }
            for nested in map.values_mut() {
                scrub_json_fields_with_value(nested, fields, replacement);
            }
        }
        _ => {}
    }
}

fn filter_pharmacy_transfer_response(
    mut row: PharmacyTransferRequest,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyTransferRequest {
    if should_scrub_pharmacy_field(restricted, PHARMACY_PRICING_UNIT_PRICE_FIELD) {
        scrub_json_numeric_fields(
            &mut row.items,
            &[
                "base_price",
                "unit_price",
                "total_price",
                "price",
                "mrp",
                "amount",
            ],
        );
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_NUMBER_FIELD) {
        scrub_json_fields_with_value(
            &mut row.items,
            &[
                "batch_number",
                "supplier_batch_number",
                "batch_stock_id",
                "batch_id",
            ],
            &serde_json::Value::Null,
        );
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_PURCHASE_RATE_FIELD) {
        scrub_json_numeric_fields(&mut row.items, &["purchase_rate"]);
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_SELLING_RATE_FIELD) {
        scrub_json_numeric_fields(&mut row.items, &["selling_rate"]);
    }
    if should_scrub_pharmacy_field(restricted, PHARMACY_BATCH_SOURCE_FIELD) {
        scrub_json_fields_with_value(
            &mut row.items,
            &[
                "supplier_info",
                "grn_item_id",
                "grn_id",
                "invoice_number",
                "vendor_id",
            ],
            &serde_json::Value::Null,
        );
    }
    row
}

fn filter_pharmacy_analytics_json_response(
    mut value: serde_json::Value,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> serde_json::Value {
    if should_scrub_pharmacy_field(restricted, PHARMACY_ANALYTICS_VALUE_FIELD) {
        scrub_json_numeric_fields(
            &mut value,
            &[
                "revenue",
                "gst",
                "cash",
                "card",
                "upi",
                "cost",
                "selling",
                "margin_percent",
            ],
        );
    }
    value
}

fn filter_pos_day_summary_response(
    mut row: PosDaySummary,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PosDaySummary {
    if should_scrub_pharmacy_pos_amount(restricted) {
        row.total_revenue = Decimal::ZERO;
        row.cash_total = Decimal::ZERO;
        row.card_total = Decimal::ZERO;
        row.upi_total = Decimal::ZERO;
        row.gst_collected = Decimal::ZERO;
    }
    row
}

fn first_number(text: &str) -> Option<f64> {
    let mut buf = String::new();
    let mut seen_digit = false;

    for ch in text.chars() {
        if ch.is_ascii_digit() || (ch == '.' && seen_digit && !buf.contains('.')) {
            if ch.is_ascii_digit() {
                seen_digit = true;
            }
            buf.push(ch);
        } else if seen_digit {
            break;
        }
    }

    if seen_digit {
        buf.parse::<f64>().ok()
    } else {
        None
    }
}

fn dash_frequency_units_per_day(text: &str) -> Option<f64> {
    let parts: Vec<&str> = text.split('-').collect();
    if parts.len() < 2 {
        return None;
    }

    let mut sum = 0.0;
    for part in parts {
        let trimmed = part.trim();
        if trimmed.is_empty() || !trimmed.chars().all(|ch| ch.is_ascii_digit()) {
            return None;
        }
        sum += trimmed.parse::<f64>().ok()?;
    }

    (sum > 0.0).then_some(sum)
}

fn frequency_units_per_day(frequency: &str) -> f64 {
    let f = frequency.trim().to_ascii_lowercase();
    if f.is_empty() {
        return 1.0;
    }

    if let Some(sum) = dash_frequency_units_per_day(&f) {
        return sum;
    }

    if f.contains("q4h") || f.contains("4 hourly") || f.contains("every 4") {
        return 6.0;
    }
    if f.contains("q6h") || f.contains("6 hourly") || f.contains("every 6") {
        return 4.0;
    }
    if f.contains("q8h") || f.contains("8 hourly") || f.contains("every 8") {
        return 3.0;
    }
    if f.contains("q12h") || f.contains("12 hourly") || f.contains("every 12") {
        return 2.0;
    }

    if f.contains("qid") || f.contains("qds") || f.contains("four times") {
        4.0
    } else if f.contains("tid") || f.contains("tds") || f.contains("three times") {
        3.0
    } else if f.contains("bid") || f.contains("bd") || f.contains("twice") {
        2.0
    } else if f.contains("qod") || f.contains("alternate") {
        0.5
    } else {
        1.0
    }
}

fn duration_days(duration: &str) -> f64 {
    let d = duration.trim().to_ascii_lowercase();
    let Some(value) = first_number(&d) else {
        return 1.0;
    };

    if d.contains("week") || d.contains(" wk") || d.ends_with("wk") {
        value * 7.0
    } else if d.contains("month") || d.contains(" mon") || d.ends_with("mo") {
        value * 30.0
    } else if d.contains("hour") || d.ends_with('h') {
        (value / 24.0).max(1.0)
    } else {
        value
    }
}

fn dose_units_per_administration(dosage: &str) -> f64 {
    let d = dosage.trim().to_ascii_lowercase();
    let Some(value) = first_number(&d) else {
        return 1.0;
    };

    let countable_units = [
        "tab",
        "tablet",
        "cap",
        "capsule",
        "vial",
        "amp",
        "ampoule",
        "puff",
        "drop",
        "sachet",
        "suppository",
        "patch",
        "ml",
    ];

    if countable_units.iter().any(|unit| d.contains(unit)) {
        value.max(1.0)
    } else {
        1.0
    }
}

fn estimate_rx_dispense_quantity(dosage: &str, frequency: &str, duration: &str) -> i32 {
    let estimated = dose_units_per_administration(dosage)
        * frequency_units_per_day(frequency)
        * duration_days(duration);
    estimated.ceil().clamp(1.0, 9_999.0) as i32
}

pub fn medication_safety_warning_is_overrideable(code: &str) -> bool {
    !matches!(code, "INSUFFICIENT_STOCK")
}

fn normalize_allergy_tokens(value: &serde_json::Value) -> Vec<String> {
    match value {
        serde_json::Value::Array(items) => items
            .iter()
            .flat_map(normalize_allergy_tokens)
            .collect::<Vec<_>>(),
        serde_json::Value::String(s) => split_allergy_text(s),
        serde_json::Value::Null => Vec::new(),
        other => split_allergy_text(&other.to_string()),
    }
}

fn split_allergy_text(text: &str) -> Vec<String> {
    text.split([',', ';', '/', '\n', '[', ']', '"'])
        .map(str::trim)
        .filter(|token| {
            !token.is_empty()
                && !token.eq_ignore_ascii_case("nkda")
                && !token.eq_ignore_ascii_case("no known drug allergies")
                && !token.eq_ignore_ascii_case("none")
        })
        .map(str::to_lowercase)
        .collect()
}

fn drug_search_text(parts: &[Option<&str>]) -> String {
    parts
        .iter()
        .filter_map(|part| part.map(str::trim).filter(|s| !s.is_empty()))
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn warning_detail(mut pairs: Vec<(&str, serde_json::Value)>) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (key, value) in pairs.drain(..) {
        map.insert(key.to_owned(), value);
    }
    serde_json::Value::Object(map)
}

/// Shared medication CDS phase-1 evaluator used by both direct pharmacy order
/// creation and the CPOE order basket. The evaluator does not decide whether
/// a block is overrideable; callers enforce permission and audit decisions.
pub async fn evaluate_medication_safety_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: &Uuid,
    items: &[MedicationSafetyItem],
) -> Result<Vec<MedicationSafetyWarning>, AppError> {
    let mut warnings = Vec::new();

    let structured_allergies = sqlx::query!(
        r#"
        SELECT allergen_name, allergy_type::text AS "allergy_type!", severity::text AS severity,
               reaction
        FROM patient_allergies
        WHERE tenant_id = $1
          AND patient_id = $2
          AND is_active = true
          AND allergy_type = 'drug'
        "#,
        *tenant_id,
        *patient_id
    )
    .fetch_all(&mut **tx)
    .await?;

    let patient_attributes = sqlx::query!(
        r#"
        SELECT attributes->'drug_allergies' AS "drug_allergies: serde_json::Value"
        FROM patients
        WHERE id = $1 AND tenant_id = $2
        "#,
        *patient_id,
        *tenant_id
    )
    .fetch_optional(&mut **tx)
    .await?;

    let mut attribute_allergies = patient_attributes
        .and_then(|row| row.drug_allergies)
        .as_ref()
        .map(normalize_allergy_tokens)
        .unwrap_or_default();
    attribute_allergies.sort();
    attribute_allergies.dedup();

    for item in items {
        let catalog = if let Some(catalog_id) = item.catalog_item_id {
            sqlx::query!(
                r#"
                SELECT name, generic_name, inn_name, atc_code, drug_class, drug_schedule,
                       is_controlled, is_lasa, lasa_group, formulary_status,
                       black_box_warning, max_dose_per_day, current_stock
                FROM pharmacy_catalog
                WHERE id = $1 AND tenant_id = $2
                "#,
                catalog_id,
                *tenant_id
            )
            .fetch_optional(&mut **tx)
            .await?
        } else {
            None
        };

        let catalog_name = catalog
            .as_ref()
            .map(|row| row.name.as_str())
            .unwrap_or(item.drug_name.as_str());
        let drug_text = drug_search_text(&[
            Some(item.drug_name.as_str()),
            Some(catalog_name),
            catalog.as_ref().and_then(|row| row.generic_name.as_deref()),
            catalog.as_ref().and_then(|row| row.inn_name.as_deref()),
            catalog.as_ref().and_then(|row| row.drug_class.as_deref()),
            catalog.as_ref().and_then(|row| row.atc_code.as_deref()),
        ]);

        for allergy in &structured_allergies {
            let allergen = allergy.allergen_name.trim().to_lowercase();
            if !allergen.is_empty()
                && (drug_text.contains(&allergen) || allergen.contains(&drug_text))
            {
                warnings.push(MedicationSafetyWarning {
                    code: "DRUG_ALLERGY_CONFLICT".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!(
                        "{} conflicts with documented drug allergy '{}'",
                        item.drug_name, allergy.allergen_name
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![
                        ("allergen", json!(allergy.allergen_name)),
                        ("allergy_type", json!(allergy.allergy_type)),
                        ("severity", json!(allergy.severity)),
                        ("reaction", json!(allergy.reaction)),
                    ]),
                });
            }
        }

        for allergen in &attribute_allergies {
            if drug_text.contains(allergen) || allergen.contains(&drug_text) {
                warnings.push(MedicationSafetyWarning {
                    code: "DRUG_ALLERGY_CONFLICT".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!(
                        "{} conflicts with registered drug allergy '{}'",
                        item.drug_name, allergen
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![("allergen", json!(allergen))]),
                });
            }
        }

        let duplicate_count = sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)::bigint
            FROM pharmacy_orders po
            JOIN pharmacy_order_items poi
              ON poi.order_id = po.id AND poi.tenant_id = po.tenant_id
             AND poi.removed_at IS NULL
            WHERE po.tenant_id = $1
              AND po.patient_id = $2
              AND po.status = 'ordered'
              AND (
                    ($3::uuid IS NOT NULL AND poi.catalog_item_id = $3)
                    OR ($3::uuid IS NULL AND lower(poi.drug_name) = lower($4))
                  )
            ",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .fetch_one(&mut **tx)
        .await?;

        if duplicate_count > 0 {
            warnings.push(MedicationSafetyWarning {
                code: "DUPLICATE_ACTIVE_MEDICATION_ORDER".to_owned(),
                severity: MedicationSafetySeverity::Block,
                message: format!(
                    "{} already has {duplicate_count} active medication order(s)",
                    item.drug_name
                ),
                catalog_item_id: item.catalog_item_id,
                drug_name: item.drug_name.clone(),
                detail: warning_detail(vec![("existing_count", json!(duplicate_count))]),
            });
        }

        if let Some(row) = &catalog {
            if row.current_stock < item.quantity {
                warnings.push(MedicationSafetyWarning {
                    code: "INSUFFICIENT_STOCK".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!(
                        "Insufficient stock for {name}: requested {req}, on-hand {on}",
                        name = row.name,
                        req = item.quantity,
                        on = row.current_stock
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![
                        ("requested", json!(item.quantity)),
                        ("on_hand", json!(row.current_stock)),
                    ]),
                });
            }

            let schedule = row.drug_schedule.as_deref().unwrap_or("");
            if row.is_controlled
                || schedule.eq_ignore_ascii_case("NDPS")
                || schedule.eq_ignore_ascii_case("X")
                || schedule.eq_ignore_ascii_case("H1")
            {
                warnings.push(MedicationSafetyWarning {
                    code: "CONTROLLED_DRUG_ACK_REQUIRED".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!(
                        "{} is a controlled/restricted scheduled medicine; dual review is required",
                        item.drug_name
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![
                        ("drug_schedule", json!(row.drug_schedule)),
                        ("is_controlled", json!(row.is_controlled)),
                    ]),
                });
            }

            if row.is_lasa || row.black_box_warning.is_some() {
                warnings.push(MedicationSafetyWarning {
                    code: "HIGH_RISK_MEDICATION_ACK_REQUIRED".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!(
                        "{} is flagged for high-risk medication safety review",
                        item.drug_name
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![
                        ("is_lasa", json!(row.is_lasa)),
                        ("lasa_group", json!(row.lasa_group)),
                        ("black_box_warning", json!(row.black_box_warning)),
                    ]),
                });
            }

            if row.formulary_status == "restricted" {
                warnings.push(MedicationSafetyWarning {
                    code: "RESTRICTED_FORMULARY_ACK_REQUIRED".to_owned(),
                    severity: MedicationSafetySeverity::Block,
                    message: format!("{} is restricted by formulary policy", item.drug_name),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![("formulary_status", json!(row.formulary_status))]),
                });
            }

            if let Some(max_dose) = row
                .max_dose_per_day
                .as_deref()
                .filter(|s| !s.trim().is_empty())
            {
                warnings.push(MedicationSafetyWarning {
                    code: "MAX_DAILY_DOSE_REVIEW_REQUIRED".to_owned(),
                    severity: MedicationSafetySeverity::Warn,
                    message: format!(
                        "{} has a configured max daily dose: {max_dose}",
                        item.drug_name
                    ),
                    catalog_item_id: item.catalog_item_id,
                    drug_name: item.drug_name.clone(),
                    detail: warning_detail(vec![("max_dose_per_day", json!(max_dose))]),
                });
            }
        }
    }

    Ok(warnings)
}

#[allow(clippy::too_many_arguments)]
async fn record_cpoe_safety_audit_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    source_module: &str,
    source_record_id: Option<Uuid>,
    warnings: &[MedicationSafetyWarning],
    override_reason: Option<&str>,
) -> Result<(), AppError> {
    for warning in warnings {
        let action_taken = match warning.severity {
            MedicationSafetySeverity::Block if override_reason.is_some() => "overridden",
            MedicationSafetySeverity::Block => "blocked",
            MedicationSafetySeverity::Warn => "warned",
        };
        let item_ref = json!({
            "catalog_item_id": warning.catalog_item_id,
            "drug_name": warning.drug_name,
        });
        sqlx::query!(
            r#"
            INSERT INTO cpoe_safety_audit
              (tenant_id, patient_id, encounter_id, source_module, source_record_id,
               order_type, warning_code, severity, action_taken, item_ref, message,
               override_reason, overridden_by, checked_by)
            VALUES
              ($1, $2, $3, $4, $5, 'drug', $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            claims.tenant_id,
            patient_id,
            encounter_id,
            source_module,
            source_record_id,
            warning.code.as_str(),
            medication_safety_severity_str(warning.severity),
            action_taken,
            item_ref,
            warning.message.as_str(),
            override_reason,
            override_reason.map(|_| claims.sub),
            claims.sub
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
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
    /// Pharmacist's reason for selling despite a documented drug allergy.
    pub allergy_override_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DischargeMedsRequest {
    pub patient_id: Uuid,
    pub discharge_summary_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub items: Vec<OrderItemInput>,
    pub notes: Option<String>,
    /// Pharmacist's reason for dispensing despite a documented drug allergy.
    pub allergy_override_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DispenseOrderRequest {
    pub items: Option<Vec<DispenseItemInput>>,
    pub witnessed_by: Option<Uuid>,
    /// Pharmacist's reason for dispensing despite a documented drug allergy.
    /// Required (non-blank) when a line conflicts with the patient's allergies;
    /// logged to `pharmacy_allergy_check_log` (context `dispensing`).
    pub allergy_override_reason: Option<String>,
    /// Pharmacist's reason for dispensing a controlled (NDPS) drug WITHOUT a witness
    /// (dual-lock). Required (non-blank) when no `witnessed_by` is supplied and any line
    /// is a controlled substance; logged for audit.
    pub ndps_override_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DispenseItemInput {
    pub order_item_id: Uuid,
    pub batch_number: Option<String>,
    // Historical API field name; stores the selected pharmacy_batches.id.
    pub batch_stock_id: Option<Uuid>,
    /// Quantity to dispense now (partial). Defaults to the ordered quantity;
    /// clamped to the ordered quantity. Under-dispensing → `partially_dispensed`.
    pub quantity: Option<i32>,
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
    pub invoice_number: Option<String>,
    pub supplier_batch_number: Option<String>,
    pub purchase_rate: Option<Decimal>,
    pub selling_rate: Option<Decimal>,
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
pub struct CreateReturnBatchRequest {
    pub patient_id: Uuid,
    pub items: Vec<CreateReturnBatchItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReturnBatchItemRequest {
    pub order_item_id: Uuid,
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

    // ── ReBAC scope — only pharmacy orders caller has `view` on ─
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    let visible_ids: Option<Vec<Uuid>> = if authz_ctx.is_bypass {
        None
    } else {
        Some(
            state
                .authz
                .list_accessible(
                    &authz_ctx,
                    "pharmacy_order",
                    medbrains_authz::Relation::Viewer,
                )
                .await
                .unwrap_or_default(),
        )
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;
    if let Some(ref ids) = visible_ids {
        if ids.is_empty() {
            return Ok(Json(OrderListResponse {
                orders: Vec::new(),
                total: 0,
                page,
                per_page,
            }));
        }
        conditions.push(format!("id = ANY(${bind_idx}::uuid[])"));
        bind_idx += 1;
    }

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
    if let Some(ref ids) = visible_ids {
        cq = cq.bind(ids.clone());
    }
    let total = cq.fetch_one(&mut *tx).await?;

    // ORDER BY built from an allowlist (never raw user input).
    let sort_dir = if params.order.as_deref() == Some("asc") { "ASC" } else { "DESC" };
    let order_by = match params.sort.as_deref() {
        Some("status") => format!("status {sort_dir}"),
        Some("total_price") => format!("total_price {sort_dir}"),
        _ => format!("created_at {sort_dir}"),
    };
    let data_sql = format!(
        "SELECT * FROM pharmacy_orders WHERE {where_clause} \
         ORDER BY {order_by} LIMIT ${bind_idx} OFFSET ${}",
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
    if let Some(ref ids) = visible_ids {
        dq = dq.bind(ids.clone());
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let result = create_order_in_tx(&mut tx, &claims, &body).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        result,
        &restricted_fields,
    )))
}

/// Transaction-scoped sibling of `create_order`. Used by order basket so
/// multiple orders across modules commit atomically. Caller owns the tx
/// + tenant context. Does NOT check permissions — caller must.
pub async fn create_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateOrderRequest,
) -> Result<OrderDetailResponse, AppError> {
    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    if let Some(encounter_id) = body.encounter_id {
        let encounter_patient_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        )
        .bind(encounter_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;

        if encounter_patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "encounter does not belong to patient".to_owned(),
            ));
        }
    }

    let safety_items = body
        .items
        .iter()
        .map(|item| MedicationSafetyItem {
            catalog_item_id: item.catalog_item_id,
            drug_name: item.drug_name.clone(),
            quantity: item.quantity,
        })
        .collect::<Vec<_>>();
    let safety_warnings =
        evaluate_medication_safety_in_tx(tx, &claims.tenant_id, &body.patient_id, &safety_items)
            .await?;
    let safety_override_reason = medication_safety_override_reason(body);
    let blocking_warnings = safety_warnings
        .iter()
        .filter(|warning| warning.severity == MedicationSafetySeverity::Block)
        .collect::<Vec<_>>();
    if !blocking_warnings.is_empty() {
        if let Some(hard_block) = blocking_warnings
            .iter()
            .find(|warning| !medication_safety_warning_is_overrideable(&warning.code))
        {
            return Err(AppError::BadRequest(hard_block.message.clone()));
        }
        let reason = safety_override_reason.ok_or_else(|| {
            let codes = blocking_warnings
                .iter()
                .map(|warning| warning.code.as_str())
                .collect::<Vec<_>>()
                .join(", ");
            AppError::BadRequest(format!(
                "Medication safety block(s) require authorized override reason before ordering: {codes}"
            ))
        })?;
        if reason.len() < 5 {
            return Err(AppError::BadRequest(
                "Medication safety override reason must be at least 5 characters".to_owned(),
            ));
        }
        if !can_override_medication_safety(claims) {
            return Err(AppError::Forbidden);
        }
    }

    let dispensing_type = body.dispensing_type.as_deref().unwrap_or("prescription");

    let order = sqlx::query_as!(
        PharmacyOrder,
        r#"
        INSERT INTO pharmacy_orders
          (tenant_id, prescription_id, patient_id, encounter_id, ordered_by,
           status, notes, dispensing_type, discharge_summary_id, billing_package_id,
           store_location_id)
        VALUES ($1, $2, $3, $4, $5, 'ordered', $6, $7::text::pharmacy_dispensing_type, $8, $9, $10)
        RETURNING id, tenant_id, prescription_id, patient_id AS "patient_id!",
                  encounter_id, ordered_by, status, notes,
                  dispensing_type AS "dispensing_type: _",
                  discharge_summary_id, billing_package_id, store_location_id,
                  interaction_check_result, dispensed_by, dispensed_at,
                  created_at, updated_at
        "#,
        claims.tenant_id,
        body.prescription_id,
        body.patient_id,
        body.encounter_id,
        claims.sub,
        body.notes.as_deref(),
        dispensing_type,
        body.discharge_summary_id,
        body.billing_package_id,
        body.store_location_id
    )
    .fetch_one(&mut **tx)
    .await?;

    // is_dummy is patched via a separate UPDATE so we don't have to
    // re-run `cargo sqlx prepare` for the macro above.
    if body.is_dummy.unwrap_or(false) && is_bypass_role(claims) {
        sqlx::query("UPDATE pharmacy_orders SET is_dummy = true WHERE id = $1")
            .bind(order.id)
            .execute(&mut **tx)
            .await?;
    }

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let total = item.unit_price * Decimal::from(item.quantity);
        let oi = sqlx::query_as::<_, PharmacyOrderItem>(
            "
            INSERT INTO pharmacy_order_items
              (tenant_id, order_id, catalog_item_id, drug_name, quantity,
               unit_price, total_price, quantity_prescribed)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            ",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(total)
        .bind(item.quantity)
        .fetch_one(&mut **tx)
        .await?;
        items.push(oi);
    }

    record_cpoe_safety_audit_in_tx(
        tx,
        claims,
        body.patient_id,
        body.encounter_id,
        "pharmacy",
        Some(order.id),
        &safety_warnings,
        safety_override_reason,
    )
    .await?;

    let admission_id =
        admission_id_for_encounter_in_tx(tx, &claims.tenant_id, body.encounter_id).await?;
    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::OrderCreated,
        order.id,
        claims.sub,
        json!({
            "order_id": order.id,
            "order_type": "drug",
            "patient_id": body.patient_id,
            "encounter_id": body.encounter_id,
            "admission_id": admission_id,
            "items": items.iter().map(|item| {
                json!({
                    "catalog_item_id": item.catalog_item_id,
                    "drug_name": item.drug_name,
                    "quantity": item.quantity,
                })
            }).collect::<Vec<_>>(),
        }),
    )
    .with_source_module(ClinicalEventSourceModule::Pharmacy)
    .with_patient(body.patient_id);
    let event = if let Some(encounter_id) = body.encounter_id {
        event.with_encounter(encounter_id)
    } else {
        event
    };
    let event = if let Some(admission_id) = admission_id {
        event.with_admission(admission_id)
    } else {
        event
    };
    medbrains_workflow::events::queue_clinical_event_in_tx(tx, &event).await?;

    ensure_order_items_stock_available_for_billing_in_tx(tx, &claims.tenant_id, &items).await?;
    ensure_pharmacy_billing_indent_for_order_in_tx(tx, &claims.tenant_id, &order, &items).await?;

    // Auto-issue a pharmacy token (per store counter when known).
    medbrains_tokens::issue_token_in_tx(
        tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            module: "pharmacy",
            scope: if order.store_location_id.is_some() { "counter" } else { "global" },
            scope_id: order.store_location_id,
            scope_label: None,
            priority: "normal",
            patient_id: Some(order.patient_id),
            patient_name: None,
            entity_type: Some("pharmacy_order"),
            entity_id: Some(order.id),
            issued_by: Some(claims.sub),
        },
    )
    .await?;

    order_detail_response_in_tx(tx, &claims.tenant_id, order, items).await
}

async fn fetch_pharmacy_stock_gate_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    catalog_id: Uuid,
    drug_name: &str,
) -> Result<PharmacyStockGate, AppError> {
    sqlx::query_as::<_, PharmacyStockGate>(
        "SELECT current_stock, batch_tracking_required, is_controlled \
         FROM pharmacy_catalog \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true",
    )
    .bind(catalog_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Conflict(format!("Map \"{drug_name}\" to an active formulary item")))
}

async fn ensure_order_items_stock_available_for_billing_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    items: &[PharmacyOrderItem],
) -> Result<(), AppError> {
    for item in items {
        if item.quantity <= 0 {
            return Err(AppError::BadRequest(
                "Pharmacy quantity must be greater than zero".to_owned(),
            ));
        }

        if let Some(catalog_id) = item.catalog_item_id {
            let stock =
                fetch_pharmacy_stock_gate_in_tx(tx, tenant_id, catalog_id, &item.drug_name).await?;
            if stock.current_stock < item.quantity {
                return Err(AppError::Conflict(format!(
                    "Insufficient stock for {}: requested {}, available {}. Billing is blocked until stock is received or quantity is reduced.",
                    item.drug_name, item.quantity, stock.current_stock
                )));
            }
        }
    }

    Ok(())
}

async fn decrement_catalog_stock_for_dispense_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    catalog_id: Uuid,
    quantity: i32,
    drug_name: &str,
) -> Result<(), AppError> {
    let updated = sqlx::query_as::<_, (i32, i32)>(
        "UPDATE pharmacy_catalog SET \
         current_stock = current_stock - $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND current_stock >= $1 \
         RETURNING current_stock, reorder_level",
    )
    .bind(quantity)
    .bind(catalog_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((new_stock, reorder_level)) = updated else {
        return Err(AppError::Conflict(format!(
            "Insufficient stock for {drug_name}. Dispense was not posted."
        )));
    };

    // Low-stock alert to pharmacists — only on the crossing (this dispense
    // pushed it to/below the reorder level for the first time), so we don't
    // re-notify on every subsequent dispense while it stays low.
    let prev_stock = new_stock + quantity;
    if reorder_level > 0 && new_stock <= reorder_level && prev_stock > reorder_level {
        notify_pharmacists_low_stock_in_tx(
            tx,
            tenant_id,
            catalog_id,
            drug_name,
            new_stock,
            reorder_level,
        )
        .await?;
    }

    Ok(())
}

/// Notify every active pharmacist that a catalog drug crossed its reorder level.
async fn notify_pharmacists_low_stock_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    catalog_id: Uuid,
    drug_name: &str,
    current_stock: i32,
    reorder_level: i32,
) -> Result<(), AppError> {
    let pharmacists = sqlx::query_scalar::<_, Uuid>(
        "SELECT u.id FROM users u \
         JOIN roles r ON r.id = u.role_id AND r.tenant_id = u.tenant_id \
         WHERE u.tenant_id = $1 AND r.code = 'pharmacist' AND u.is_active = true",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let title = format!("Low stock: {drug_name}");
    let body = format!("{current_stock} left (reorder at {reorder_level})");
    for user_id in pharmacists {
        create_notification(
            tx,
            *tenant_id,
            NewNotification {
                user_id,
                kind: "warning",
                title: &title,
                body: Some(&body),
                category: Some("Pharmacy"),
                entity_type: Some("pharmacy_catalog"),
                entity_id: Some(catalog_id),
                action_url: Some("/pharmacy"),
            },
        )
        .await?;
    }
    Ok(())
}

async fn decrement_batch_stock_for_dispense_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    catalog_id: Uuid,
    batch_id: Uuid,
    quantity: i32,
    drug_name: &str,
) -> Result<BatchDispenseTrace, AppError> {
    sqlx::query_as::<_, BatchDispenseTrace>(
        "UPDATE pharmacy_batches SET \
         quantity_dispensed = quantity_dispensed + $1, \
         quantity_on_hand = quantity_on_hand - $1, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND catalog_item_id = $4 \
           AND quantity_on_hand >= $1 \
           AND expiry_date > CURRENT_DATE \
           AND quarantine_status = 'cleared' \
         RETURNING id, batch_number, expiry_date",
    )
    .bind(quantity)
    .bind(batch_id)
    .bind(tenant_id)
    .bind(catalog_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(format!(
            "Insufficient usable batch stock for {drug_name}. Select another non-expired cleared batch."
        ))
    })
}

async fn try_decrement_fefo_batch_stock_for_dispense_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    catalog_id: Uuid,
    store_location_id: Option<Uuid>,
    quantity: i32,
) -> Result<Option<BatchDispenseTrace>, AppError> {
    sqlx::query_as::<_, BatchDispenseTrace>(
        "UPDATE pharmacy_batches SET \
         quantity_dispensed = quantity_dispensed + $1, \
         quantity_on_hand = quantity_on_hand - $1, \
         updated_at = now() \
         WHERE id = ( \
           SELECT id FROM pharmacy_batches \
           WHERE tenant_id = $2 AND catalog_item_id = $3 \
             AND quantity_on_hand >= $1 \
             AND expiry_date > CURRENT_DATE \
             AND quarantine_status = 'cleared' \
             AND ($4::uuid IS NULL OR store_location_id = $4) \
           ORDER BY expiry_date ASC, created_at ASC, id ASC \
           LIMIT 1 \
           FOR UPDATE SKIP LOCKED \
         ) \
         RETURNING id, batch_number, expiry_date",
    )
    .bind(quantity)
    .bind(tenant_id)
    .bind(catalog_id)
    .bind(store_location_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

async fn ensure_pharmacy_billing_indent_for_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    order: &PharmacyOrder,
    items: &[PharmacyOrderItem],
) -> Result<PharmacyBillingIndentResult, AppError> {
    if !medbrains_server_services::billing::is_auto_billing_enabled(tx, tenant_id, "pharmacy").await? {
        return Ok(PharmacyBillingIndentResult::default());
    }

    let mut result = PharmacyBillingIndentResult::default();

    for item in items {
        let tax_percent = match item.catalog_item_id {
            Some(catalog_id) => sqlx::query_scalar::<_, Decimal>(
                "SELECT tax_percent FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
            )
            .bind(catalog_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .unwrap_or(Decimal::ZERO),
            None => Decimal::ZERO,
        };

        let code = item.catalog_item_id.map_or_else(
            || "PHARMA-GENERIC".to_owned(),
            |cid| format!("PHARMA-{cid}"),
        );

        let charge = medbrains_server_services::billing::auto_charge_with_batch(
            tx,
            tenant_id,
            medbrains_server_services::billing::AutoChargeInput {
                patient_id: order.patient_id,
                encounter_id: order.encounter_id,
                charge_code: code,
                source: "pharmacy".to_owned(),
                source_id: item.id,
                quantity: item.quantity,
                description_override: Some(item.drug_name.clone()),
                unit_price_override: Some(item.unit_price),
                tax_percent_override: Some(tax_percent),
            },
            medbrains_server_services::billing::BatchTrace {
                batch_number: item.batch_number.clone(),
                expiry_date: item.expiry_date,
            },
        )
        .await?;
        result.invoice_id.get_or_insert(charge.invoice_id);
        if charge.was_new_invoice {
            result.created_invoice_id.get_or_insert(charge.invoice_id);
        }

        sqlx::query(
            "UPDATE invoice_items SET \
             pharmacy_order_id = $1, \
             batch_number = COALESCE($2, batch_number), \
             expiry_date = COALESCE($3, expiry_date), \
             source_module = 'pharmacy' \
             WHERE id = $4 AND tenant_id = $5",
        )
        .bind(order.id)
        .bind(&item.batch_number)
        .bind(item.expiry_date)
        .bind(charge.item_id)
        .bind(tenant_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(result)
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    // ── ReBAC pre-check — must hold `view` on the pharmacy_order ─
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    let allowed = state
        .authz
        .check(
            &authz_ctx,
            medbrains_authz::Relation::Viewer,
            "pharmacy_order",
            id,
        )
        .await
        .unwrap_or(false);
    if !allowed {
        return Err(AppError::NotFound);
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let detail = order_detail_response_in_tx(&mut tx, &claims.tenant_id, order, items).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        detail,
        &restricted_fields,
    )))
}

async fn fetch_order_detail_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    order_id: Uuid,
) -> Result<OrderDetailResponse, AppError> {
    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    order_detail_response_in_tx(tx, tenant_id, order, items).await
}

async fn linked_pharmacy_invoice_item_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    item_id: Uuid,
) -> Result<Option<LinkedPharmacyInvoiceItem>, AppError> {
    let row = sqlx::query_as::<_, LinkedPharmacyInvoiceItem>(
        "SELECT ii.id AS invoice_item_id, ii.invoice_id, i.status::text AS invoice_status \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
           AND ii.source = 'pharmacy'::charge_source \
           AND ii.source_id = $2 \
           AND ii.reversal_of_id IS NULL \
           AND ii.is_reversal = false \
         ORDER BY ii.created_at \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(item_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row)
}

fn ensure_invoice_can_follow_order_edit(
    linked: &LinkedPharmacyInvoiceItem,
) -> Result<(), AppError> {
    if linked.invoice_status == "draft" {
        return Ok(());
    }

    Err(AppError::Conflict(
        "Pharmacy item can be edited only before the linked invoice is issued or paid".to_owned(),
    ))
}

async fn sync_invoice_item_quantity_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    item: &PharmacyOrderItem,
) -> Result<(), AppError> {
    let Some(linked) = linked_pharmacy_invoice_item_in_tx(tx, tenant_id, item.id).await? else {
        return Ok(());
    };
    ensure_invoice_can_follow_order_edit(&linked)?;

    sqlx::query(
        "UPDATE invoice_items \
         SET quantity = $3, \
             unit_price = $4, \
             total_price = $4 * $3 * (1 + tax_percent / 100), \
             description = $5, \
             source_module = 'pharmacy' \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(linked.invoice_item_id)
    .bind(tenant_id)
    .bind(item.quantity)
    .bind(item.unit_price)
    .bind(&item.drug_name)
    .execute(&mut **tx)
    .await?;

    medbrains_server_services::billing::recalculate_invoice_totals(tx, linked.invoice_id, *tenant_id).await?;
    Ok(())
}

async fn reverse_invoice_item_for_removed_order_item_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    item_id: Uuid,
    removed_by: Uuid,
) -> Result<(), AppError> {
    let Some(linked) = linked_pharmacy_invoice_item_in_tx(tx, tenant_id, item_id).await? else {
        return Ok(());
    };
    ensure_invoice_can_follow_order_edit(&linked)?;

    medbrains_server_services::billing::reverse_auto_charge_for_source(
        tx,
        tenant_id,
        "pharmacy",
        item_id,
        removed_by,
        "Pharmacy order item removed before dispense",
    )
    .await?;
    Ok(())
}

// ══════════════════════════════════════════════════════════
//  PUT /api/pharmacy/orders/{id}/items/{item_id}
// ══════════════════════════════════════════════════════════

pub async fn update_order_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((order_id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateOrderItemRequest>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::PARTIAL)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest(
            "Quantity must be greater than zero".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if order.status != "ordered" {
        return Err(AppError::Conflict(
            "Pharmacy order items can be edited only before dispense".to_owned(),
        ));
    }

    let existing = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE id = $1 AND order_id = $2 AND tenant_id = $3 AND removed_at IS NULL",
    )
    .bind(item_id)
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.quantity_returned > 0 {
        return Err(AppError::Conflict(
            "Returned pharmacy items cannot be edited".to_owned(),
        ));
    }

    let total = existing.unit_price * Decimal::from(body.quantity);
    let item = sqlx::query_as::<_, PharmacyOrderItem>(
        "UPDATE pharmacy_order_items \
         SET quantity = $1, total_price = $2 \
         WHERE id = $3 AND order_id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(body.quantity)
    .bind(total)
    .bind(item_id)
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    sync_invoice_item_quantity_in_tx(&mut tx, &claims.tenant_id, &item).await?;

    sqlx::query("UPDATE pharmacy_orders SET updated_at = now() WHERE id = $1 AND tenant_id = $2")
        .bind(order_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    let detail = fetch_order_detail_in_tx(&mut tx, &claims.tenant_id, order_id).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        detail,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  DELETE /api/pharmacy/orders/{id}/items/{item_id}
// ══════════════════════════════════════════════════════════

pub async fn remove_order_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((order_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::PARTIAL)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if order.status != "ordered" {
        return Err(AppError::Conflict(
            "Pharmacy order items can be removed only before dispense".to_owned(),
        ));
    }

    let item = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE id = $1 AND order_id = $2 AND tenant_id = $3 AND removed_at IS NULL",
    )
    .bind(item_id)
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if item.quantity_returned > 0 {
        return Err(AppError::Conflict(
            "Returned pharmacy items cannot be removed".to_owned(),
        ));
    }

    let item_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if item_count <= 1 {
        return Err(AppError::BadRequest(
            "At least one pharmacy item must remain on the order".to_owned(),
        ));
    }

    reverse_invoice_item_for_removed_order_item_in_tx(
        &mut tx,
        &claims.tenant_id,
        item.id,
        claims.sub,
    )
    .await?;

    sqlx::query(
        "UPDATE pharmacy_order_items \
         SET removed_at = now(), removed_by = $3, \
             remove_reason = 'Removed before dispense by pharmacy' \
         WHERE id = $1 AND tenant_id = $2 AND removed_at IS NULL",
    )
    .bind(item.id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE pharmacy_orders SET updated_at = now() WHERE id = $1 AND tenant_id = $2")
        .bind(order_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    let detail = fetch_order_detail_in_tx(&mut tx, &claims.tenant_id, order_id).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        detail,
        &restricted_fields,
    )))
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Schedule H/H1/X compliance gate. Drugs and Cosmetics Act 1940
    // (rules 65, 65A) — must be on a registered medical practitioner's
    // prescription; Schedule X (NDPS Act) further requires a witnessed
    // dispense and duplicate retained Rx.
    enforce_schedule_compliance(&mut tx, &claims.tenant_id, id, body.witnessed_by).await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "SELECT * FROM pharmacy_orders \
         WHERE id = $1 AND tenant_id = $2 AND status = 'ordered' \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Allergy backstop — the last barrier before a drug reaches the patient.
    // Warn & require an acknowledged reason (logged); never a silent pass,
    // never a hard block (prior tolerance / desensitisation / no alternative).
    let dispense_drug_names: Vec<String> = items.iter().map(|i| i.drug_name.clone()).collect();
    let allergy_conflicts =
        drug_allergy_conflicts(&mut tx, claims.tenant_id, order.patient_id, &dispense_drug_names)
            .await?;
    if !allergy_conflicts.is_empty() {
        let reason = body
            .allergy_override_reason
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty());
        match reason {
            None => {
                return Err(AppError::BadRequest(format!(
                    "Patient has a documented drug allergy conflicting with: {}. Provide an override reason to dispense.",
                    allergy_conflict_summary(&allergy_conflicts)
                )));
            }
            Some(reason) => {
                log_allergy_overrides(
                    &mut tx,
                    &allergy_conflicts,
                    &AllergyOverrideLog {
                        tenant_id: claims.tenant_id,
                        patient_id: order.patient_id,
                        overridden_by: claims.sub,
                        reason,
                        context: "dispensing",
                        order_id: Some(order.id),
                    },
                )
                .await?;
            }
        }
    }

    // NDPS soft-gate — a controlled substance requires a witness (dual-lock) to
    // dispense. If none is supplied, a non-blank override reason is required and logged.
    // Closes the gap where controlled dispensing recorded the register entry but never
    // enforced the dual-lock. (Schedule X keeps its stricter witness≠prescriber rule.)
    let has_controlled: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
           SELECT 1 FROM pharmacy_order_items i \
           JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
           WHERE i.order_id = $1 AND i.tenant_id = $2 AND i.removed_at IS NULL \
             AND c.is_controlled = true)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if has_controlled && body.witnessed_by.is_none() {
        let reason = body
            .ndps_override_reason
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty());
        match reason {
            None => {
                return Err(AppError::BadRequest(
                    "Controlled substance (NDPS): a witness (dual-lock) is required to dispense, \
                     or provide an override reason."
                        .to_owned(),
                ));
            }
            Some(reason) => {
                tracing::warn!(
                    tenant_id = %claims.tenant_id,
                    order_id = %order.id,
                    patient_id = %order.patient_id,
                    dispensed_by = %claims.sub,
                    reason,
                    "NDPS controlled dispense without a witness — override reason logged"
                );
            }
        }
    }

    // Build a lookup for batch info from the request
    let batch_map: HashMap<Uuid, &DispenseItemInput> = body
        .items
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|d| (d.order_item_id, d))
        .collect();

    // Did we leave any item short of its ordered quantity? → partially_dispensed.
    let mut all_fully_dispensed = true;
    for item in &items {
        if item.quantity <= 0 {
            return Err(AppError::BadRequest(
                "Pharmacy quantity must be greater than zero".to_owned(),
            ));
        }

        // Remaining = ordered − already dispensed; per-item requested qty is
        // clamped to the remaining (supports partial + dispensing the rest later).
        let remaining = item.quantity - item.quantity_dispensed;
        let mut dispense_qty = batch_map
            .get(&item.id)
            .and_then(|d| d.quantity)
            .map_or(remaining, |q| q.clamp(0, remaining));
        if dispense_qty < remaining {
            all_fully_dispensed = false;
        }
        if dispense_qty <= 0 {
            continue;
        }

        if let Some(catalog_id) = item.catalog_item_id {
            let stock = fetch_pharmacy_stock_gate_in_tx(
                &mut tx,
                &claims.tenant_id,
                catalog_id,
                &item.drug_name,
            )
            .await?;
            if stock.current_stock < dispense_qty {
                // Per-line partial dispense: fill what's on hand and leave the rest
                // backordered (the order stays partially_dispensed and dispensable
                // later — that remainder IS the backorder) instead of failing the whole
                // order for one short line. Visible via the reduced dispensed quantity.
                dispense_qty = stock.current_stock.max(0);
                all_fully_dispensed = false;
                if dispense_qty <= 0 {
                    continue;
                }
            }

            let selected_batch_id = batch_map
                .get(&item.id)
                .and_then(|dispense_input| dispense_input.batch_stock_id)
                .or(item.batch_stock_id);

            let batch_trace = if let Some(batch_stock_id) = selected_batch_id {
                Some(
                    decrement_batch_stock_for_dispense_in_tx(
                        &mut tx,
                        &claims.tenant_id,
                        catalog_id,
                        batch_stock_id,
                        dispense_qty,
                        &item.drug_name,
                    )
                    .await?,
                )
            } else {
                let trace = try_decrement_fefo_batch_stock_for_dispense_in_tx(
                    &mut tx,
                    &claims.tenant_id,
                    catalog_id,
                    order.store_location_id,
                    dispense_qty,
                )
                .await?;
                if trace.is_none() && stock.batch_tracking_required {
                    return Err(AppError::Conflict(format!(
                        "No usable FEFO batch is available for {}. Receive stock or select another cleared non-expired batch.",
                        item.drug_name
                    )));
                }
                trace
            };

            if let Some(trace) = batch_trace {
                sqlx::query(
                    "UPDATE pharmacy_order_items SET \
                     batch_number = $1, batch_stock_id = $2, expiry_date = $3 \
                     WHERE id = $4 AND tenant_id = $5",
                )
                .bind(&trace.batch_number)
                .bind(trace.id)
                .bind(trace.expiry_date)
                .bind(item.id)
                .bind(claims.tenant_id)
                .execute(&mut *tx)
                .await?;
            } else if let Some(dispense_input) = batch_map.get(&item.id) {
                if dispense_input.batch_number.is_some() {
                    sqlx::query(
                        "UPDATE pharmacy_order_items SET \
                         batch_number = COALESCE($1, batch_number) \
                         WHERE id = $2 AND tenant_id = $3",
                    )
                    .bind(&dispense_input.batch_number)
                    .bind(item.id)
                    .bind(claims.tenant_id)
                    .execute(&mut *tx)
                    .await?;
                }
            }

            decrement_catalog_stock_for_dispense_in_tx(
                &mut tx,
                &claims.tenant_id,
                catalog_id,
                dispense_qty,
                &item.drug_name,
            )
            .await?;

            // Create stock transaction
            sqlx::query(
                "INSERT INTO pharmacy_stock_transactions \
                 (tenant_id, catalog_item_id, transaction_type, quantity, \
                  reference_id, created_by) \
                 VALUES ($1, $2, 'issue', $3, $4, $5)",
            )
            .bind(claims.tenant_id)
            .bind(catalog_id)
            .bind(dispense_qty)
            .bind(order.id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;

            if stock.is_controlled {
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

                let new_balance = current_balance - i64::from(dispense_qty);

                let ndps_entry = sqlx::query_as::<_, NdpsRegisterEntry>(
                    "INSERT INTO pharmacy_ndps_register \
                     (tenant_id, catalog_item_id, action, quantity, balance_after, \
                      patient_id, prescription_id, dispensed_by, witnessed_by) \
                     VALUES ($1, $2, 'dispensed', $3, $4, $5, $6, $7, $8) \
                     RETURNING *",
                )
                .bind(claims.tenant_id)
                .bind(catalog_id)
                .bind(dispense_qty)
                .bind(i32::try_from(new_balance).unwrap_or(0))
                .bind(order.patient_id)
                .bind(order.prescription_id)
                .bind(claims.sub)
                .bind(body.witnessed_by)
                .fetch_one(&mut *tx)
                .await?;
                queue_ndps_movement_created_event_in_tx(
                    &mut tx,
                    claims.tenant_id,
                    claims.sub,
                    &ndps_entry,
                    "pharmacy_order_dispense",
                )
                .await?;
            }
        }

        // Track dispensed-so-far on the line (supports dispensing the rest later).
        sqlx::query(
            "UPDATE pharmacy_order_items SET quantity_dispensed = quantity_dispensed + $1 \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(dispense_qty)
        .bind(item.id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    // Fully dispensed → 'dispensed'; some line still has a balance → 'partially_dispensed'
    // (re-dispensing the remainder is allowed from either 'ordered' or 'partially_dispensed').
    let new_status = if all_fully_dispensed {
        "dispensed"
    } else {
        "partially_dispensed"
    };
    let order = sqlx::query_as::<_, PharmacyOrder>(
        "UPDATE pharmacy_orders SET status = $4, \
         dispensed_by = $3, dispensed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('ordered', 'partially_dispensed') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(new_status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let billed_items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    ensure_pharmacy_billing_indent_for_order_in_tx(
        &mut tx,
        &claims.tenant_id,
        &order,
        &billed_items,
    )
    .await?;

    let admission_id =
        admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, order.encounter_id).await?;

    // Close the medication loop: an IPD dispense generates the bedside eMAR
    // schedule (doses appear on the nurse's round, traceable to this batch).
    if let (Some(admission_id), Some(prescription_id)) = (admission_id, order.prescription_id) {
        generate_mar_from_dispensed_order_in_tx(
            &mut tx,
            &claims.tenant_id,
            admission_id,
            prescription_id,
            &billed_items,
        )
        .await?;
    }

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::PharmacyOrderDispensed,
        order.id,
        claims.sub,
        serde_json::json!({
            "order_id": order.id,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
            "admission_id": admission_id,
            "items": billed_items.iter().map(|item| {
                serde_json::json!({
                    "catalog_item_id": item.catalog_item_id,
                    "drug_name": item.drug_name,
                    "quantity": item.quantity,
                    "batch_number": item.batch_number,
                })
            }).collect::<Vec<_>>(),
        }),
    )
    .with_patient(order.patient_id);
    if let Some(encounter_id) = order.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    if let Some(admission_id) = admission_id {
        event = event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    let total_amount: Decimal = items.iter().map(|i| i.total_price).sum();

    // Emit integration event
    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "pharmacy.order.dispensed",
        serde_json::json!({
            "order_id": order.id,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
            "admission_id": admission_id,
            "items_count": items.len(),
            "total_amount": total_amount.to_string(),
        }),
    )
    .await;

    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  Schedule H/H1/X compliance enforcement
// ══════════════════════════════════════════════════════════
//
// Drugs and Cosmetics Act 1940 + NDPS Act 1985:
//   Schedule H   — Rx-only. Must be on a doctor's prescription.
//   Schedule H1  — H plus mandatory register entry; pharmacist keeps
//                  duplicate of the Rx for 3 years.
//   Schedule X   — H1 plus dual signature (witness) and duplicate Rx
//                  retained for 2 years; only doctors with
//                  `can_prescribe_schedule_x` may issue.
//
// Returns AppError::BadRequest with the offending list when any item
// fails the gate. Caller already holds an open transaction so the
// rollback is automatic on error.

async fn enforce_schedule_compliance(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    order_id: Uuid,
    witnessed_by: Option<Uuid>,
) -> Result<(), AppError> {
    let order: Option<(Option<Uuid>, Option<Uuid>, Uuid)> = sqlx::query_as(
        "SELECT prescription_id, encounter_id, ordered_by \
         FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((prescription_id, encounter_id, ordered_by)) = order else {
        return Err(AppError::NotFound);
    };

    let has_prescription = prescription_id.is_some() || encounter_id.is_some();

    let scheduled_items: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT c.name, c.drug_schedule::text \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id \
         WHERE oi.order_id = $1 AND oi.tenant_id = $2 \
           AND oi.removed_at IS NULL \
           AND c.drug_schedule IS NOT NULL \
           AND c.drug_schedule::text IN ('H', 'H1', 'X')",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    if scheduled_items.is_empty() {
        return Ok(());
    }

    let mut blocks: Vec<String> = Vec::new();

    // Anything Schedule H/H1/X requires a prescription source on the order.
    if !has_prescription {
        for (name, sched) in &scheduled_items {
            blocks.push(format!(
                "{name}: Schedule {} drug — no prescription / encounter linked to order",
                sched.as_deref().unwrap_or("?")
            ));
        }
    }

    // Schedule X: dual signature + prescriber must be authorised.
    let has_x = scheduled_items
        .iter()
        .any(|(_, s)| s.as_deref() == Some("X"));

    if has_x {
        if witnessed_by.is_none() {
            blocks
                .push("Schedule X dispense requires a witness signature (witnessed_by)".to_owned());
        } else if witnessed_by == Some(ordered_by) {
            blocks.push("Schedule X witness must differ from prescriber".to_owned());
        }

        let prescriber_authorised: Option<bool> = sqlx::query_scalar(
            "SELECT can_prescribe_schedule_x FROM doctors \
             WHERE user_id = $1 AND tenant_id = $2",
        )
        .bind(ordered_by)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;

        match prescriber_authorised {
            Some(true) => {}
            Some(false) => blocks.push(
                "Schedule X prescriber lacks `can_prescribe_schedule_x` authorisation".to_owned(),
            ),
            None => blocks.push(
                "Schedule X prescriber not registered as a doctor in this hospital".to_owned(),
            ),
        }
    }

    if !blocks.is_empty() {
        return Err(AppError::BadRequest(format!(
            "Schedule H/H1/X gate failed: {}",
            blocks.join("; ")
        )));
    }

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  PUT /api/pharmacy/orders/{id}/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyOrder>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CANCEL)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, PharmacyOrder>(
        "UPDATE pharmacy_orders SET status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'ordered' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(ref o) = order {
        let order_item_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM pharmacy_order_items \
             WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL",
        )
        .bind(o.id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        for order_item_id in order_item_ids {
            medbrains_server_services::billing::reverse_auto_charge_for_source(
                &mut tx,
                &claims.tenant_id,
                "pharmacy",
                order_item_id,
                claims.sub,
                "Pharmacy order cancelled",
            )
            .await?;
        }

        let admission_id =
            admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, o.encounter_id).await?;
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::OrderCancelled,
            o.id,
            claims.sub,
            serde_json::json!({
                "order_id": o.id,
                "order_type": "pharmacy",
                "reason": "Cancelled from pharmacy order queue",
                "patient_id": o.patient_id,
                "encounter_id": o.encounter_id,
                "admission_id": admission_id,
            }),
        )
        .with_source_module(ClinicalEventSourceModule::Pharmacy)
        .with_patient(o.patient_id);
        if let Some(encounter_id) = o.encounter_id {
            event = event.with_encounter(encounter_id);
        }
        if let Some(admission_id) = admission_id {
            event = event.with_admission(admission_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "SELECT * FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL",
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
                // Schedule H/H1/X surface — block at validation if no prescription source
                if let Some(sched) = drug.drug_schedule.as_deref() {
                    if matches!(sched, "H" | "H1" | "X") {
                        let order_meta: Option<(Option<Uuid>, Option<Uuid>)> = sqlx::query_as(
                            "SELECT prescription_id, encounter_id FROM pharmacy_orders \
                             WHERE id = $1 AND tenant_id = $2",
                        )
                        .bind(id)
                        .bind(claims.tenant_id)
                        .fetch_optional(&mut *tx)
                        .await?;
                        let has_rx = order_meta
                            .as_ref()
                            .map(|(p, e)| p.is_some() || e.is_some())
                            .unwrap_or(false);
                        if !has_rx {
                            blocks.push(format!(
                                "{}: Schedule {sched} drug — Rx / encounter required before dispense",
                                drug.name
                            ));
                        } else if sched == "X" {
                            warnings.push(format!(
                                "{}: Schedule X — dual signature + duplicate Rx required at dispense",
                                drug.name
                            ));
                        } else {
                            warnings.push(format!(
                                "{}: Schedule {sched} — pharmacist must retain Rx",
                                drug.name
                            ));
                        }
                    }
                }

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

/// Active drug-allergy conflicts for a patient against the given drug names,
/// including cross-reactivity classes (via `medbrains_core::allergy`). Shared by
/// the dispense / OTC-sale / POS-sale allergy guards.
async fn drug_allergy_conflicts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    drug_names: &[String],
) -> Result<Vec<medbrains_core::allergy::DrugAllergyConflict>, AppError> {
    let allergens = sqlx::query_scalar::<_, String>(
        "SELECT allergen_name FROM patient_allergies \
         WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
           AND allergy_type = 'drug'",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    if allergens.is_empty() {
        return Ok(Vec::new());
    }
    Ok(medbrains_core::allergy::find_conflicts(drug_names, &allergens))
}

/// Human-readable "drug (allergy: allergen[, cross-reactive]); …" 400 summary.
fn allergy_conflict_summary(conflicts: &[medbrains_core::allergy::DrugAllergyConflict]) -> String {
    conflicts
        .iter()
        .map(|c| {
            let cross = if c.kind == medbrains_core::allergy::AllergyMatchKind::CrossReactive {
                format!(", cross-reactive {}", c.class.as_deref().unwrap_or("class"))
            } else {
                String::new()
            };
            format!("{} (allergy: {}{cross})", c.drug_name, c.allergen)
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// Context for recording acknowledged allergy overrides.
struct AllergyOverrideLog<'a> {
    tenant_id: Uuid,
    patient_id: Uuid,
    overridden_by: Uuid,
    reason: &'a str,
    context: &'a str,
    order_id: Option<Uuid>,
}

/// Record acknowledged allergy overrides to `pharmacy_allergy_check_log`.
async fn log_allergy_overrides(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    conflicts: &[medbrains_core::allergy::DrugAllergyConflict],
    log: &AllergyOverrideLog<'_>,
) -> Result<(), AppError> {
    for c in conflicts {
        sqlx::query(
            "INSERT INTO pharmacy_allergy_check_log \
             (tenant_id, patient_id, drug_name, allergen_matched, action_taken, \
              overridden_by, override_reason, context, order_id) \
             VALUES ($1, $2, $3, $4, 'overridden', $5, $6, $7, $8)",
        )
        .bind(log.tenant_id)
        .bind(log.patient_id)
        .bind(&c.drug_name)
        .bind(&c.allergen)
        .bind(log.overridden_by)
        .bind(log.reason)
        .bind(log.context)
        .bind(log.order_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

pub async fn create_otc_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OtcSaleRequest>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // OTC sale: patient_id is optional (NULL for walk-in customers)
    let patient_id = body.patient_id;

    // OTC = over-the-counter: no prescription, no witness, no encounter. Scheduled
    // and controlled drugs (Schedule H/H1/X/NDPS or is_controlled) may NOT be sold
    // here — they require the prescription-backed dispense_order path, which enforces
    // schedule compliance (witness, authorised prescriber) and the NDPS register write.
    let catalog_ids: Vec<Uuid> = body.items.iter().filter_map(|i| i.catalog_item_id).collect();
    if !catalog_ids.is_empty() {
        let blocked: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM pharmacy_catalog \
             WHERE tenant_id = $1 AND id = ANY($2) \
               AND (is_controlled OR drug_schedule::text IN ('H', 'H1', 'X', 'NDPS'))",
        )
        .bind(claims.tenant_id)
        .bind(&catalog_ids)
        .fetch_all(&mut *tx)
        .await?;
        if !blocked.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Cannot sell scheduled/controlled drug(s) over the counter: {}. \
                 Use the prescription dispensing flow.",
                blocked.join(", ")
            )));
        }
    }

    // Allergy guard — only when the sale is linked to a patient.
    let allergy_reason = body
        .allergy_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    let allergy_conflicts = if let Some(pid) = patient_id {
        let names: Vec<String> = body.items.iter().map(|i| i.drug_name.clone()).collect();
        drug_allergy_conflicts(&mut tx, claims.tenant_id, pid, &names).await?
    } else {
        Vec::new()
    };
    if !allergy_conflicts.is_empty() && allergy_reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "Patient has a documented drug allergy conflicting with: {}. Provide an override reason to sell.",
            allergy_conflict_summary(&allergy_conflicts)
        )));
    }

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

    if let (Some(pid), Some(reason)) = (patient_id, allergy_reason) {
        if !allergy_conflicts.is_empty() {
            log_allergy_overrides(
                &mut tx,
                &allergy_conflicts,
                &AllergyOverrideLog {
                    tenant_id: claims.tenant_id,
                    patient_id: pid,
                    overridden_by: claims.sub,
                    reason,
                    context: "pos_sale",
                    order_id: Some(order.id),
                },
            )
            .await?;
        }
    }

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

        // Deduct stock atomically with a floor guard (mirrors dispense_order):
        // prevents overselling below zero and double-spend on concurrent sales.
        if let Some(catalog_id) = item.catalog_item_id {
            decrement_catalog_stock_for_dispense_in_tx(
                &mut tx,
                &claims.tenant_id,
                catalog_id,
                item.quantity,
                &item.drug_name,
            )
            .await?;
        }

        items.push(oi);
    }

    let detail = order_detail_response_in_tx(&mut tx, &claims.tenant_id, order, items).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        detail,
        &restricted_fields,
    )))
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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

    // Discharge (to-take-out) meds are a real dispensing event and must not bypass the allergy
    // check that dispense_order enforces — dispensing a discharge drug the patient is allergic to is
    // the same hazard. Warn & require an acknowledged reason; a block early-returns (rolling back the
    // order just inserted). Mirrors dispense_order. IPSG.3.
    let dispense_drug_names: Vec<String> = body.items.iter().map(|i| i.drug_name.clone()).collect();
    let allergy_conflicts =
        drug_allergy_conflicts(&mut tx, claims.tenant_id, body.patient_id, &dispense_drug_names)
            .await?;
    if !allergy_conflicts.is_empty() {
        let reason = body
            .allergy_override_reason
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty());
        match reason {
            None => {
                return Err(AppError::BadRequest(format!(
                    "Patient has a documented drug allergy conflicting with: {}. Provide an override reason to dispense.",
                    allergy_conflict_summary(&allergy_conflicts)
                )));
            }
            Some(reason) => {
                log_allergy_overrides(
                    &mut tx,
                    &allergy_conflicts,
                    &AllergyOverrideLog {
                        tenant_id: claims.tenant_id,
                        patient_id: body.patient_id,
                        overridden_by: claims.sub,
                        reason,
                        context: "discharge_dispensing",
                        order_id: Some(order.id),
                    },
                )
                .await?;
            }
        }
    }

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

    let detail = order_detail_response_in_tx(&mut tx, &claims.tenant_id, order, items).await?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_order_detail_response(
        detail,
        &restricted_fields,
    )))
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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::prescriptions::VIEW,
            permissions::pharmacy::dispensing::CREATE,
            permissions::pharmacy::dispensing::PARTIAL,
            permissions::pharmacy::stock::MANAGE,
            permissions::pharmacy::ndps::MANAGE,
            permissions::pharmacy::stores::MANAGE,
            permissions::pharmacy::returns::REQUEST,
            permissions::pharmacy::rx_queue::LIST,
            permissions::pharmacy::rx_queue::REVIEW,
            permissions::pharmacy::pos::CREATE,
            permissions::pharmacy::safety::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::patients::CREATE,
            permissions::patients::UPDATE,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_catalog_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCatalogRequest>,
) -> Result<Json<PharmacyCatalog>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    validate_catalog_price_write(Some(body.base_price), &restricted_fields, true)?;

    let tax_pct = body.tax_percent.unwrap_or(Decimal::ZERO);
    let stock = body.current_stock.unwrap_or(0);
    let reorder = body.reorder_level.unwrap_or(10);
    let controlled = body.is_controlled.unwrap_or(false);
    let formulary = body.formulary_status.as_deref().unwrap_or("approved");
    let lasa = body.is_lasa.unwrap_or(false);
    let batch_track = body.batch_tracking_required.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pharmacy_catalog_response(
        row,
        &restricted_fields,
    )))
}

pub async fn update_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCatalogRequest>,
) -> Result<Json<PharmacyCatalog>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    validate_catalog_price_write(body.base_price, &restricted_fields, false)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| {
            Ok(Json(filter_pharmacy_catalog_response(
                r,
                &restricted_fields,
            )))
        },
    )
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // With a location filter, select all active — the aggregate low-stock SQL
    // predicate would hide items low AT THE LOCATION but not tenant-wide; low_stock
    // is re-applied against the per-location on-hand below.
    let sql = if params.low_stock.unwrap_or(false) && params.store_location_id.is_none() {
        "SELECT * FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND is_active = true AND current_stock < reorder_level \
         ORDER BY current_stock ASC LIMIT 5000"
    } else {
        "SELECT * FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name LIMIT 5000"
    };

    let mut rows = sqlx::query_as::<_, PharmacyCatalog>(sql)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

    // Per-location view: override current_stock with the on-hand at that pharmacy,
    // summed live from its batches. Read-only — the dispense/decrement path is
    // unchanged; the aggregate stays the tenant-wide total.
    if let Some(location_id) = params.store_location_id {
        let sums = sqlx::query_as::<_, (Uuid, Option<i64>)>(
            "SELECT catalog_item_id, SUM(quantity_on_hand) FROM pharmacy_batches \
             WHERE tenant_id = $1 AND store_location_id = $2 GROUP BY catalog_item_id",
        )
        .bind(claims.tenant_id)
        .bind(location_id)
        .fetch_all(&mut *tx)
        .await?;
        let on_hand: HashMap<Uuid, i32> = sums
            .into_iter()
            .map(|(id, qty)| (id, i32::try_from(qty.unwrap_or(0)).unwrap_or(i32::MAX)))
            .collect();
        for row in &mut rows {
            row.current_stock = on_hand.get(&row.id).copied().unwrap_or(0);
        }
        if params.low_stock.unwrap_or(false) {
            rows.retain(|r| r.current_stock < r.reorder_level);
        }
    }

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_catalog_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_stock_transaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStockTransactionRequest>,
) -> Result<Json<PharmacyStockTransaction>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::ndps::LIST,
            permissions::pharmacy::ndps::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
        entries: entries
            .into_iter()
            .map(|row| filter_ndps_entry_response(row, &restricted_fields))
            .collect(),
        total,
        page,
        per_page,
    }))
}

pub async fn create_ndps_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: axum_extra::extract::CookieJar,
    Json(body): Json<CreateNdpsEntryRequest>,
) -> Result<Json<NdpsRegisterEntry>, AppError> {
    require_permission(&claims, permissions::pharmacy::ndps::MANAGE)?;
    // Controlled-substance (NDPS) register entry — require fresh re-auth.
    medbrains_server_core::step_up::require_step_up(&state, &jar, &claims)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    #[derive(sqlx::FromRow)]
    struct NdpsCatalogCheck {
        drug_schedule: Option<String>,
        is_controlled: bool,
    }

    let catalog = sqlx::query_as::<_, NdpsCatalogCheck>(
        "SELECT drug_schedule, is_controlled FROM pharmacy_catalog \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if !catalog.is_controlled && !matches!(catalog.drug_schedule.as_deref(), Some("NDPS" | "X")) {
        return Err(AppError::BadRequest(
            "NDPS register entries require a controlled, NDPS, or Schedule X catalog item"
                .to_owned(),
        ));
    }

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
    if new_balance < 0 {
        return Err(AppError::Conflict(
            "Insufficient NDPS balance for this register action".to_owned(),
        ));
    }

    // NDPS dual-control: a controlled-substance dispense/destruction/transfer must be witnessed by a
    // second, different person (NDPS Act 1985 — witnessed dual-lock).
    if matches!(body.action.as_str(), "dispensed" | "destroyed" | "transferred") {
        match body.witnessed_by {
            None => {
                return Err(AppError::BadRequest(
                    "A witness is required to dispense, destroy, or transfer a controlled substance \
                     (NDPS dual-control)."
                        .to_owned(),
                ));
            }
            Some(w) if w == claims.sub => {
                return Err(AppError::BadRequest(
                    "The witness must be a different person from the one recording the entry."
                        .to_owned(),
                ));
            }
            Some(_) => {}
        }
    }

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

    queue_ndps_movement_created_event_in_tx(
        &mut tx,
        claims.tenant_id,
        claims.sub,
        &entry,
        "manual_register",
    )
    .await?;

    tx.commit().await?;
    Ok(Json(filter_ndps_entry_response(entry, &restricted_fields)))
}

pub async fn ndps_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NdpsReportResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::ndps::LIST,
            permissions::pharmacy::ndps::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, NdpsBalanceRow>(
        "SELECT n.catalog_item_id, c.name AS drug_name, \
         COALESCE(SUM(CASE WHEN n.action IN ('receipt', 'adjustment') THEN n.quantity \
         ELSE -n.quantity END), 0) AS balance \
         FROM pharmacy_ndps_register n \
         JOIN pharmacy_catalog c ON c.id = n.catalog_item_id AND c.tenant_id = n.tenant_id \
         WHERE n.tenant_id = $1 \
         GROUP BY n.catalog_item_id, c.name \
         ORDER BY c.name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(NdpsReportResponse {
        entries: rows
            .into_iter()
            .map(|row| filter_ndps_balance_response(row, &restricted_fields))
            .collect(),
    }))
}

pub async fn ndps_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NdpsReportResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::ndps::LIST,
            permissions::pharmacy::ndps::MANAGE,
        ],
    )?;

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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_batch_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBatchRequest>,
) -> Result<Json<PharmacyBatch>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    if body.quantity_received <= 0 {
        return Err(AppError::BadRequest(
            "quantity_received must be greater than zero".to_owned(),
        ));
    }
    validate_batch_write_access(&body, &restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let batch = sqlx::query_as::<_, PharmacyBatch>(
        "INSERT INTO pharmacy_batches \
         (tenant_id, catalog_item_id, batch_number, expiry_date, manufacture_date, \
          quantity_received, quantity_on_hand, store_location_id, supplier_info, \
          invoice_number, supplier_batch_number, purchase_rate, selling_rate) \
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.batch_number)
    .bind(body.expiry_date)
    .bind(body.manufacture_date)
    .bind(body.quantity_received)
    .bind(body.store_location_id)
    .bind(&body.supplier_info)
    .bind(&body.invoice_number)
    .bind(&body.supplier_batch_number)
    .bind(body.purchase_rate)
    .bind(body.selling_rate)
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
    Ok(Json(filter_pharmacy_batch_response(
        batch,
        &restricted_fields,
    )))
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct LocationStockSummary {
    pub location_id: Uuid,
    pub location_name: String,
    pub stock_value: Decimal,
    pub item_count: i64,
    pub near_expiry_batches: i64,
    pub expired_batches: i64,
}

/// `GET /api/pharmacy/stock/by-location` — per-location stock health: value, distinct items,
/// near-expiry (≤90d) and already-expired batch counts. The multi-pharmacy dashboard.
pub async fn location_stock_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LocationStockSummary>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LocationStockSummary>(
        "SELECT sl.id AS location_id, sl.name AS location_name, \
                COALESCE(SUM(bs.quantity * bs.unit_cost), 0) AS stock_value, \
                COUNT(DISTINCT bs.catalog_item_id) AS item_count, \
                COUNT(*) FILTER ( \
                    WHERE bs.expiry_date IS NOT NULL AND bs.quantity > 0 \
                      AND bs.expiry_date >= CURRENT_DATE \
                      AND bs.expiry_date < CURRENT_DATE + 90 \
                ) AS near_expiry_batches, \
                COUNT(*) FILTER ( \
                    WHERE bs.expiry_date IS NOT NULL AND bs.quantity > 0 \
                      AND bs.expiry_date < CURRENT_DATE \
                ) AS expired_batches \
         FROM store_locations sl \
         LEFT JOIN batch_stock bs ON bs.store_location_id = sl.id AND bs.tenant_id = sl.tenant_id \
         WHERE sl.tenant_id = $1 \
         GROUP BY sl.id, sl.name ORDER BY stock_value DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, serde::Deserialize)]
pub struct WriteOffExpiredRequest {
    /// Destruction method: incineration | chemical | landfill | return_to_manufacturer | other.
    pub method: Option<String>,
    pub witness_name: String,
    pub notes: Option<String>,
}

/// `POST /api/pharmacy/stock/write-off-expired` — zero all expired pharmacy batches, decrement
/// the catalogue aggregate, and file ONE destruction-log certificate (reason=expired).
pub async fn write_off_expired(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<WriteOffExpiredRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    if body.witness_name.trim().is_empty() {
        return Err(AppError::BadRequest("A witness name is required".to_owned()));
    }
    let method = body.method.as_deref().unwrap_or("incineration");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batches: Vec<(Uuid, Uuid, String, NaiveDate, i32)> = sqlx::query_as(
        "SELECT id, catalog_item_id, batch_number, expiry_date, quantity_on_hand \
         FROM pharmacy_batches \
         WHERE tenant_id = $1 AND quantity_on_hand > 0 AND expiry_date < CURRENT_DATE FOR UPDATE",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    if batches.is_empty() {
        return Err(AppError::BadRequest("No expired stock to write off".to_owned()));
    }

    let mut items = Vec::new();
    let mut total_qty: i32 = 0;
    for (id, catalog_item_id, batch_number, expiry_date, qty) in &batches {
        items.push(serde_json::json!({
            "batch_id": id, "catalog_item_id": catalog_item_id,
            "batch_number": batch_number, "expiry_date": expiry_date, "quantity": qty,
        }));
        total_qty += *qty;
        sqlx::query(
            "UPDATE pharmacy_batches SET quantity_on_hand = 0, updated_at = now() WHERE id = $1",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE pharmacy_catalog SET current_stock = GREATEST(current_stock - $1, 0), \
             updated_at = now() WHERE id = $2 AND tenant_id = $3",
        )
        .bind(qty)
        .bind(catalog_item_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    let certificate_number = format!("DEST-{}", &Uuid::new_v4().to_string()[..8]);
    sqlx::query(
        "INSERT INTO pharmacy_destruction_log \
         (tenant_id, certificate_number, destruction_date, method, items, total_quantity, \
          total_value, reason, witness_name, created_by, notes) \
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 0, 'expired', $6, $7, $8)",
    )
    .bind(claims.tenant_id)
    .bind(&certificate_number)
    .bind(method)
    .bind(serde_json::Value::Array(items))
    .bind(total_qty)
    .bind(&body.witness_name)
    .bind(claims.sub)
    .bind(&body.notes)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "certificate_number": certificate_number,
        "batches_written_off": batches.len(),
        "total_quantity": total_qty,
    })))
}

pub async fn near_expiry_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<NearExpiryQuery>,
) -> Result<Json<Vec<NearExpiryRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let days = params.days.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_near_expiry_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn dead_stock_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DeadStockQuery>,
) -> Result<Json<Vec<DeadStockRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let idle_days = params.idle_days.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_dead_stock_response(row, &restricted_fields))
            .collect(),
    ))
}

// ══════════════════════════════════════════════════════════
//  Multi-Store & Transfers
// ══════════════════════════════════════════════════════════

pub async fn list_store_assignments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyStoreAssignment>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PharmacyStoreAssignment>(
        "SELECT * FROM pharmacy_store_assignments WHERE tenant_id = $1 ORDER BY created_at LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Multi-pharmacy staff scoping (MP3) ──────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserPharmacyAssignment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub store_location_id: Uuid,
    pub is_default: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MyPharmacy {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub location_type: String,
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct AssignPharmacyStaffRequest {
    pub user_id: Uuid,
    pub store_location_id: Uuid,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PharmacyStaffQuery {
    pub store_location_id: Option<Uuid>,
}

/// POST /api/pharmacy/staff — assign a user to a pharmacy location.
pub async fn assign_pharmacy_staff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AssignPharmacyStaffRequest>,
) -> Result<Json<UserPharmacyAssignment>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let row = sqlx::query_as::<_, UserPharmacyAssignment>(
        "INSERT INTO user_pharmacy_assignments (tenant_id, user_id, store_location_id, is_default) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (user_id, store_location_id) DO UPDATE SET is_default = EXCLUDED.is_default \
         RETURNING id, user_id, store_location_id, is_default, created_at",
    )
    .bind(claims.tenant_id)
    .bind(body.user_id)
    .bind(body.store_location_id)
    .bind(body.is_default.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// GET /api/pharmacy/staff?store_location_id= — staff assigned to a pharmacy (or all).
pub async fn list_pharmacy_staff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PharmacyStaffQuery>,
) -> Result<Json<Vec<UserPharmacyAssignment>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let rows = match params.store_location_id {
        Some(loc) => {
            sqlx::query_as::<_, UserPharmacyAssignment>(
                "SELECT id, user_id, store_location_id, is_default, created_at \
                 FROM user_pharmacy_assignments \
                 WHERE tenant_id = $1 AND store_location_id = $2 ORDER BY created_at LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .bind(loc)
            .fetch_all(&mut *tx)
            .await?
        }
        None => {
            sqlx::query_as::<_, UserPharmacyAssignment>(
                "SELECT id, user_id, store_location_id, is_default, created_at \
                 FROM user_pharmacy_assignments WHERE tenant_id = $1 ORDER BY created_at LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };
    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/pharmacy/my-locations — the pharmacies the current user is assigned to.
pub async fn my_pharmacies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MyPharmacy>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let rows = sqlx::query_as::<_, MyPharmacy>(
        "SELECT sl.id, sl.code, sl.name, sl.location_type, upa.is_default \
         FROM store_locations sl \
         JOIN user_pharmacy_assignments upa \
           ON upa.store_location_id = sl.id AND upa.tenant_id = sl.tenant_id \
         WHERE upa.tenant_id = $1 AND upa.user_id = $2 \
         ORDER BY upa.is_default DESC, sl.name LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// DELETE /api/pharmacy/staff/{id} — unassign a user from a pharmacy.
pub async fn remove_pharmacy_staff(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    sqlx::query("DELETE FROM user_pharmacy_assignments WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "removed" })))
}

pub async fn create_store_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStoreAssignmentRequest>,
) -> Result<Json<PharmacyStoreAssignment>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pharmacy_transfer_response(
        row,
        &restricted_fields,
    )))
}

pub async fn approve_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyTransferRequest>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pharmacy_transfer_response(
        row,
        &restricted_fields,
    )))
}

pub async fn list_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTransfersQuery>,
) -> Result<Json<Vec<PharmacyTransferRequest>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, PharmacyTransferRequest>(
            "SELECT * FROM pharmacy_transfer_requests \
             WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PharmacyTransferRequest>(
            "SELECT * FROM pharmacy_transfer_requests \
             WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_transfer_response(row, &restricted_fields))
            .collect(),
    ))
}

#[derive(Debug, serde::Deserialize)]
struct TransferItem {
    catalog_item_id: Uuid,
    quantity: i32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct DispatchedLine {
    catalog_item_id: Uuid,
    batch_number: String,
    expiry_date: Option<NaiveDate>,
    unit_cost: Decimal,
    quantity: i32,
}

/// `POST /api/pharmacy/transfers/{id}/dispatch` — FEFO-decrement the source location's
/// batch stock for each requested item and record the exact batches taken.
pub async fn dispatch_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyTransferRequest>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (from_location, items): (Uuid, serde_json::Value) = sqlx::query_as(
        "SELECT from_location_id, items FROM pharmacy_transfer_requests \
         WHERE id = $1 AND tenant_id = $2 AND status = 'approved' FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Transfer not found or not in approved state".to_owned()))?;

    let requested: Vec<TransferItem> = serde_json::from_value(items)
        .map_err(|_| AppError::BadRequest("Transfer items are malformed".to_owned()))?;

    let mut dispatched: Vec<DispatchedLine> = Vec::new();
    for item in &requested {
        if item.quantity <= 0 {
            continue;
        }
        let batches: Vec<(Uuid, String, Option<NaiveDate>, Decimal, i32)> = sqlx::query_as(
            "SELECT id, batch_number, expiry_date, unit_cost, quantity FROM batch_stock \
             WHERE tenant_id = $1 AND store_location_id = $2 AND catalog_item_id = $3 \
               AND quantity > 0 ORDER BY expiry_date ASC NULLS LAST FOR UPDATE",
        )
        .bind(claims.tenant_id)
        .bind(from_location)
        .bind(item.catalog_item_id)
        .fetch_all(&mut *tx)
        .await?;

        let mut remaining = item.quantity;
        for (batch_id, batch_number, expiry_date, unit_cost, avail) in batches {
            if remaining <= 0 {
                break;
            }
            let take = remaining.min(avail);
            sqlx::query(
                "UPDATE batch_stock SET quantity = quantity - $1, updated_at = now() WHERE id = $2",
            )
            .bind(take)
            .bind(batch_id)
            .execute(&mut *tx)
            .await?;
            dispatched.push(DispatchedLine {
                catalog_item_id: item.catalog_item_id,
                batch_number,
                expiry_date,
                unit_cost,
                quantity: take,
            });
            remaining -= take;
        }
        if remaining > 0 {
            return Err(AppError::BadRequest(format!(
                "Insufficient stock at the source pharmacy for item {} — short by {remaining}",
                item.catalog_item_id
            )));
        }
    }

    let dispatched_json = serde_json::to_value(&dispatched)
        .map_err(|e| AppError::Internal(format!("serialize dispatched lines: {e}")))?;
    let row = sqlx::query_as::<_, PharmacyTransferRequest>(
        "UPDATE pharmacy_transfer_requests SET status = 'dispatched', dispatched_lines = $3, \
         dispatched_by = $4, dispatched_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(dispatched_json)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_pharmacy_transfer_response(row, &restricted_fields)))
}

/// `POST /api/pharmacy/transfers/{id}/receive` — recreate the dispatched batches at the
/// destination location (preserving batch_number + expiry for recall traceability).
pub async fn receive_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyTransferRequest>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (to_location, dispatched): (Uuid, serde_json::Value) = sqlx::query_as(
        "SELECT to_location_id, dispatched_lines FROM pharmacy_transfer_requests \
         WHERE id = $1 AND tenant_id = $2 AND status = 'dispatched' FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Transfer not found or not dispatched".to_owned()))?;

    let lines: Vec<DispatchedLine> = serde_json::from_value(dispatched)
        .map_err(|_| AppError::BadRequest("Dispatched lines are malformed".to_owned()))?;

    for line in &lines {
        let updated = sqlx::query(
            "UPDATE batch_stock SET quantity = quantity + $1, updated_at = now() \
             WHERE tenant_id = $2 AND store_location_id = $3 AND catalog_item_id = $4 \
               AND batch_number = $5",
        )
        .bind(line.quantity)
        .bind(claims.tenant_id)
        .bind(to_location)
        .bind(line.catalog_item_id)
        .bind(&line.batch_number)
        .execute(&mut *tx)
        .await?;
        if updated.rows_affected() == 0 {
            sqlx::query(
                "INSERT INTO batch_stock \
                 (tenant_id, catalog_item_id, store_location_id, batch_number, expiry_date, \
                  quantity, unit_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            )
            .bind(claims.tenant_id)
            .bind(line.catalog_item_id)
            .bind(to_location)
            .bind(&line.batch_number)
            .bind(line.expiry_date)
            .bind(line.quantity)
            .bind(line.unit_cost)
            .execute(&mut *tx)
            .await?;
        }
    }

    let row = sqlx::query_as::<_, PharmacyTransferRequest>(
        "UPDATE pharmacy_transfer_requests SET status = 'received', received_by = $3, \
         received_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_pharmacy_transfer_response(row, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  Returns
// ══════════════════════════════════════════════════════════

pub async fn list_returns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyReturn>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::returns::LIST,
            permissions::pharmacy::returns::APPROVE,
            permissions::pharmacy::returns::RESTOCK,
            permissions::pharmacy::returns::DESTROY,
            permissions::pharmacy::returns::REJECT,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    require_permission(&claims, permissions::pharmacy::returns::REQUEST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = create_return_in_tx(&mut tx, claims.tenant_id, &body).await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_return_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReturnBatchRequest>,
) -> Result<Json<Vec<PharmacyReturn>>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::REQUEST)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "Select at least one dispensed medicine for return".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut rows = Vec::with_capacity(body.items.len());
    for item in body.items {
        let request = CreateReturnRequest {
            order_item_id: item.order_item_id,
            patient_id: body.patient_id,
            quantity_returned: item.quantity_returned,
            reason: item.reason,
        };
        rows.push(create_return_in_tx(&mut tx, claims.tenant_id, &request).await?);
    }

    tx.commit().await?;
    Ok(Json(rows))
}

async fn create_return_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &CreateReturnRequest,
) -> Result<PharmacyReturn, AppError> {
    if body.quantity_returned <= 0 {
        return Err(AppError::BadRequest(
            "Return quantity must be greater than zero".to_owned(),
        ));
    }

    let Some((order_patient_id, order_status, ordered_quantity, already_requested)) =
        sqlx::query_as::<_, (Uuid, String, i32, i32)>(
            "SELECT o.patient_id, o.status, oi.quantity, \
                    COALESCE(SUM(pr.quantity_returned) \
                      FILTER (WHERE pr.status <> 'rejected'), 0)::integer \
             FROM pharmacy_order_items oi \
             JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
             LEFT JOIN pharmacy_returns pr ON pr.order_item_id = oi.id \
               AND pr.tenant_id = oi.tenant_id \
             WHERE oi.id = $1 AND oi.tenant_id = $2 AND oi.removed_at IS NULL \
             GROUP BY o.patient_id, o.status, oi.quantity",
        )
        .bind(body.order_item_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
    else {
        return Err(AppError::NotFound);
    };

    if order_patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "return patient does not match the pharmacy order".to_owned(),
        ));
    }

    if order_status != "dispensed" {
        return Err(AppError::Conflict(
            "Only dispensed pharmacy items can be returned".to_owned(),
        ));
    }

    let remaining_quantity = ordered_quantity - already_requested;
    if body.quantity_returned > remaining_quantity {
        return Err(AppError::Conflict(format!(
            "Return quantity exceeds remaining dispensed quantity. Remaining: {remaining_quantity}"
        )));
    }

    let row = sqlx::query_as::<_, PharmacyReturn>(
        "INSERT INTO pharmacy_returns \
         (tenant_id, order_item_id, patient_id, quantity_returned, reason) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(tenant_id)
    .bind(body.order_item_id)
    .bind(body.patient_id)
    .bind(body.quantity_returned)
    .bind(&body.reason)
    .fetch_one(&mut **tx)
    .await?;

    Ok(row)
}

fn required_pharmacy_return_permission(status: &str) -> Result<&'static str, AppError> {
    match status {
        "approved" => Ok(permissions::pharmacy::returns::APPROVE),
        "returned_to_stock" => Ok(permissions::pharmacy::returns::RESTOCK),
        "destroyed" => Ok(permissions::pharmacy::returns::DESTROY),
        "rejected" => Ok(permissions::pharmacy::returns::REJECT),
        _ => Err(AppError::BadRequest("Invalid return status".to_owned())),
    }
}

fn required_pharmacy_return_extra_permission(status: &str) -> Option<&'static str> {
    match status {
        "approved" => Some(permissions::pharmacy::dispensing::VOID),
        _ => None,
    }
}

fn ensure_pharmacy_return_transition(
    current: &PharmacyReturnStatus,
    next_status: &str,
) -> Result<(), AppError> {
    let allowed = match current {
        PharmacyReturnStatus::Requested => matches!(next_status, "approved" | "rejected"),
        PharmacyReturnStatus::Approved => matches!(next_status, "returned_to_stock" | "destroyed"),
        PharmacyReturnStatus::ReturnedToStock
        | PharmacyReturnStatus::Destroyed
        | PharmacyReturnStatus::Rejected => false,
    };

    if allowed {
        return Ok(());
    }

    Err(AppError::Conflict(
        "Invalid pharmacy return status transition".to_owned(),
    ))
}

pub async fn process_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ProcessReturnRequest>,
) -> Result<Json<PharmacyReturn>, AppError> {
    let new_status = body.status.as_str();
    let required_permission = required_pharmacy_return_permission(new_status)?;
    require_permission(&claims, required_permission)?;
    if let Some(extra_permission) = required_pharmacy_return_extra_permission(new_status) {
        require_permission(&claims, extra_permission)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let existing = sqlx::query_as::<_, PharmacyReturn>(
        "SELECT * FROM pharmacy_returns WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    ensure_pharmacy_return_transition(&existing.status, new_status)?;

    let restocked = new_status == "returned_to_stock";

    let row = sqlx::query_as::<_, PharmacyReturn>(
        "UPDATE pharmacy_returns SET \
         status = $3::pharmacy_return_status, \
         approved_by = CASE WHEN $3 = 'approved' THEN $4 ELSE approved_by END, \
         restocked = CASE WHEN $5 THEN true ELSE restocked END, \
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

    let order_item = if new_status == "rejected" {
        None
    } else {
        Some(
            sqlx::query_as::<_, PharmacyOrderItem>(
                "SELECT * FROM pharmacy_order_items \
                 WHERE id = $1 AND tenant_id = $2 AND removed_at IS NULL",
            )
            .bind(row.order_item_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?,
        )
    };

    if let Some(oi) = order_item {
        if new_status == "approved" {
            medbrains_server_services::billing::reverse_auto_charge_quantity_for_source(
                &mut tx,
                &claims.tenant_id,
                "pharmacy",
                row.order_item_id,
                Some(row.quantity_returned),
                claims.sub,
                row.reason.as_deref().unwrap_or("Pharmacy return"),
                "pharmacy_return",
                row.id,
            )
            .await?;

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

        // If returned to stock, increment catalog stock.
        if restocked {
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

                if let Some(batch_id) = oi.batch_stock_id {
                    sqlx::query(
                        "UPDATE pharmacy_batches SET \
                         quantity_on_hand = quantity_on_hand + $1, \
                         quantity_dispensed = GREATEST(quantity_dispensed - $1, 0), \
                         updated_at = now() \
                         WHERE id = $2 AND tenant_id = $3",
                    )
                    .bind(row.quantity_returned)
                    .bind(batch_id)
                    .bind(claims.tenant_id)
                    .execute(&mut *tx)
                    .await?;
                }
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec![
        "o.tenant_id = $1".to_owned(),
        "o.status = 'dispensed'".to_owned(),
        "o.dispensed_at IS NOT NULL".to_owned(),
        "oi.removed_at IS NULL".to_owned(),
    ];
    let mut bind_idx: usize = 2;

    // Filter by dispense date, not order-creation date — consumption
    // tracks what physically left the pharmacy, not what was prescribed.
    // An Rx ordered on Monday and dispensed on Wednesday counts toward
    // Wednesday's consumption.
    if params.from_date.is_some() {
        conditions.push(format!("o.dispensed_at >= ${bind_idx}::date"));
        bind_idx += 1;
    }
    if params.to_date.is_some() {
        conditions.push(format!(
            "o.dispensed_at < (${bind_idx}::date + interval '1 day')"
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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_consumption_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn abc_ved_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyAbcVedRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
              AND oi.removed_at IS NULL \
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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_abc_ved_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn drug_utilization_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DrugUtilizationRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, DrugUtilizationRow>(
        "SELECT oi.drug_name, c.generic_name, c.aware_category, \
         SUM(oi.quantity)::bigint AS total_dispensed, \
         COUNT(DISTINCT o.patient_id)::bigint AS unique_patients \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
         LEFT JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
         WHERE o.tenant_id = $1 AND o.status = 'dispensed' \
           AND oi.removed_at IS NULL \
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
    #[serde(alias = "drug_id")]
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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::prescriptions::VIEW,
            permissions::pharmacy::safety::VIEW,
            permissions::pharmacy::rx_queue::REVIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Get active prescriptions for the patient
    let active_drugs = sqlx::query_as::<_, DrugInteractionRow>(
        "SELECT oi.catalog_item_id AS existing_drug_id, \
         oi.drug_name AS existing_drug_name, \
         nc.name AS new_drug_name, \
         di.severity, di.description \
         FROM pharmacy_orders o \
         JOIN pharmacy_order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id \
          AND oi.removed_at IS NULL \
         LEFT JOIN pharmacy_catalog nc ON nc.id = $3 AND nc.tenant_id = $2 \
         LEFT JOIN drug_interactions di ON di.tenant_id = o.tenant_id AND di.is_active = true AND \
           ((lower(di.drug_a_name) = lower(oi.drug_name) AND lower(di.drug_b_name) = lower(nc.name)) OR \
            (lower(di.drug_b_name) = lower(oi.drug_name) AND lower(di.drug_a_name) = lower(nc.name))) \
         WHERE o.patient_id = $1 AND o.tenant_id = $2 \
           AND o.status IN ('ordered', 'dispensed') \
           AND o.created_at >= now() - interval '30 days' \
           AND di.id IS NOT NULL \
         ORDER BY di.severity DESC LIMIT 5000",
    )
    .bind(body.patient_id)
    .bind(claims.tenant_id)
    .bind(body.new_drug_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!(
        active_drugs
            .iter()
            .map(|drug| json!({
                "interacting_drug": drug.existing_drug_name,
                "interaction_type": "drug_drug",
                "severity": drug.severity.as_deref().unwrap_or("moderate"),
                "description": drug
                    .description
                    .as_deref()
                    .unwrap_or("Potential interaction with active medication"),
            }))
            .collect::<Vec<_>>()
    )))
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::prescriptions::VIEW,
            permissions::pharmacy::safety::VIEW,
            permissions::pharmacy::rx_queue::REVIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
            let requires_approval = d.formulary_status.as_deref() == Some("restricted")
                || d.is_controlled.unwrap_or(false);
            Ok(Json(json!({
                "drug_id": d.id,
                "drug_name": d.name,
                "generic_name": d.generic_name,
                "is_formulary": is_formulary,
                "requires_approval": requires_approval,
                "alternative_drugs": [],
                "formulary_status": d.formulary_status,
                "drug_schedule": d.drug_schedule,
                "is_controlled": d.is_controlled,
                "aware_category": d.aware_category,
            })))
        }
        None => Ok(Json(json!({
            "drug_id": body.drug_id,
            "drug_name": "Unknown medicine",
            "is_formulary": false,
            "requires_approval": true,
            "alternative_drugs": [],
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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::rx_queue::LIST,
            permissions::pharmacy::rx_queue::REVIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut bind_idx = 2;
    let mut conditions = vec!["pr.tenant_id = $1".to_owned()];
    let mut data_sql = "SELECT pr.id, pr.prescription_id, pr.patient_id,
                p.first_name || ' ' || p.last_name AS patient_name,
                u.full_name AS doctor_name,
                pr.source, pr.status, pr.priority, pr.received_at,
                (SELECT COUNT(*) FROM patient_allergies pa
                 WHERE pa.patient_id = pr.patient_id AND pa.is_active = true
                   AND pa.allergy_type = 'drug') AS allergy_count
         FROM pharmacy_prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         JOIN users u ON u.id = pr.doctor_id"
        .to_owned();

    if params.rx_queue_id.is_none() || params.status.is_some() {
        conditions.push(format!("pr.status::text = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.patient_id.is_some() {
        conditions.push(format!("pr.patient_id = ${bind_idx}"));
        if params.rx_queue_id.is_some() {
            bind_idx += 1;
        }
    }
    if params.rx_queue_id.is_some() {
        conditions.push(format!("pr.id = ${bind_idx}"));
    }

    data_sql.push_str(" WHERE ");
    data_sql.push_str(&conditions.join(" AND "));
    data_sql.push_str(
        " ORDER BY
           CASE pr.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
           pr.received_at ASC
         LIMIT 50",
    );

    let mut query = sqlx::query_as::<_, RxQueueRow>(&data_sql).bind(claims.tenant_id);
    if params.rx_queue_id.is_none() {
        query = query.bind(params.status.as_deref().unwrap_or("pending_review"));
    } else if let Some(status) = &params.status {
        query = query.bind(status);
    }
    if let Some(patient_id) = params.patient_id {
        query = query.bind(patient_id);
    }
    if let Some(rx_queue_id) = params.rx_queue_id {
        query = query.bind(rx_queue_id);
    }

    let mut rows = query.fetch_all(&mut *tx).await?;

    if !can_view_patient_identity(&claims) {
        for row in &mut rows {
            row.patient_name = "Restricted".to_owned();
        }
    }

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/pharmacy/rx-queue/{id}
pub async fn get_rx_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::rx_queue::LIST,
            permissions::pharmacy::rx_queue::REVIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rx = sqlx::query_as::<_, PharmacyPrescriptionRx>(
        "SELECT * FROM pharmacy_prescriptions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Camp pharmacy is always free for the patient — sponsor / hospital
    // absorbs the cost. Zero out unit_price and tax so the approval modal
    // shows ₹0 instead of catalog MRP.
    let is_camp_rx = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
             SELECT 1 FROM encounters e
             WHERE e.id = $1
               AND e.tenant_id = $2
               AND (e.visit_type = 'camp' OR (e.attributes ->> 'camp_id') IS NOT NULL)
         )",
    )
    .bind(rx.encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch prescription items with a pharmacist-facing quantity + price
    // estimate. Final quantity remains editable before approval, but defaulting
    // to the inferred course quantity prevents accidental one-tablet billing.
    let item_rows = sqlx::query_as::<_, RxDetailItemPriceRow>(
        "SELECT pi.id, pi.drug_name, pi.dosage, pi.frequency, pi.duration,
                pi.route, pi.instructions,
                pc.id AS catalog_item_id,
                COALESCE(pc.base_price, 0) AS unit_price,
                COALESCE(pc.tax_percent, 0) AS tax_percent,
                CASE WHEN pc.id IS NULL THEN 'unmatched' ELSE 'catalog' END AS price_source
         FROM prescription_items pi
         LEFT JOIN LATERAL (
             SELECT c.id, c.base_price, c.tax_percent
             FROM pharmacy_catalog c
             WHERE c.tenant_id = pi.tenant_id
               AND c.is_active = true
               AND (
                   c.id = pi.catalog_item_id
                   OR lower(c.name) = lower(pi.drug_name)
                   OR (c.generic_name IS NOT NULL AND lower(c.generic_name) = lower(pi.drug_name))
               )
             ORDER BY
               CASE
                 WHEN c.id = pi.catalog_item_id THEN 0
                 WHEN lower(c.name) = lower(pi.drug_name) THEN 1
                 ELSE 2
               END,
               c.name
             LIMIT 1
         ) pc ON true
         WHERE pi.prescription_id = $1 AND pi.tenant_id = $2
           AND pi.item_status = 'active'
         ORDER BY pi.created_at",
    )
    .bind(rx.prescription_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let items = item_rows
        .into_iter()
        .map(|item| {
            let quantity =
                estimate_rx_dispense_quantity(&item.dosage, &item.frequency, &item.duration);
            let (unit_price, tax_percent) = if is_camp_rx {
                (Decimal::ZERO, Decimal::ZERO)
            } else {
                (item.unit_price, item.tax_percent)
            };
            let taxable_amount = unit_price * Decimal::from(quantity);
            let tax_amount = taxable_amount * tax_percent / Decimal::from(100);
            let line_total = taxable_amount + tax_amount;

            json!({
                "id": item.id,
                "drug_name": item.drug_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
                "duration": item.duration,
                "route": item.route,
                "instructions": item.instructions,
                "quantity": quantity,
                "catalog_item_id": item.catalog_item_id,
                "unit_price": decimal_as_f64(unit_price),
                "tax_percent": decimal_as_f64(tax_percent),
                "taxable_amount": decimal_as_f64(taxable_amount),
                "tax_amount": decimal_as_f64(tax_amount),
                "line_total": decimal_as_f64(line_total),
                "price_source": item.price_source,
            })
        })
        .collect::<Vec<_>>();

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
         WHERE id = $1 AND tenant_id = $6 RETURNING *",
    )
    .bind(id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(&body.rejection_reason)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let mut billing_invoice_id = None;
    let mut created_billing_invoice_id = None;
    let mut created_order_id = None;
    let mut created_order_items: Vec<PharmacyOrderItem> = Vec::new();

    // On approval: auto-create pharmacy order from prescription items
    if new_status == "approved" {
        // Get prescription items
        let items = sqlx::query_as::<_, PrescriptionItemRow>(
            "SELECT id, drug_name, dosage, frequency, duration, route, catalog_item_id \
             FROM prescription_items \
             WHERE prescription_id = $1 AND tenant_id = $2 AND item_status = 'active'",
        )
        .bind(rx.prescription_id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        let reviewed_items = body.items.as_deref().unwrap_or_default();

        // Create pharmacy order and billing indent; dispense remains a
        // separate stock-control step after billing is visible.
        let order = sqlx::query_as::<_, PharmacyOrder>(
            "INSERT INTO pharmacy_orders \
             (tenant_id, patient_id, prescription_id, encounter_id, ordered_by, status, \
              dispensing_type, rx_queue_id, pharmacist_reviewed_by, reviewed_at, notes) \
             VALUES ($1, $2, $3, $4, $5, 'ordered', 'prescription'::pharmacy_dispensing_type, $6, $5, now(), $7) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(rx.patient_id)
        .bind(rx.prescription_id)
        .bind(rx.encounter_id)
        .bind(claims.sub)
        .bind(rx.id)
        .bind(&body.notes)
        .fetch_one(&mut *tx)
        .await?;

        // Create order items from prescription items
        let mut order_items = Vec::with_capacity(items.len());
        for item in &items {
            let reviewed = reviewed_items
                .iter()
                .find(|review_item| review_item.prescription_item_id == item.id);
            let quantity = reviewed.map_or_else(
                || estimate_rx_dispense_quantity(&item.dosage, &item.frequency, &item.duration),
                |review_item| review_item.quantity,
            );
            if quantity <= 0 {
                return Err(AppError::BadRequest(
                    "Reviewed pharmacy quantity must be greater than zero".to_owned(),
                ));
            }
            let reviewed_catalog_id = reviewed
                .and_then(|review_item| review_item.catalog_item_id)
                .or(item.catalog_item_id);

            // Try to resolve catalog item by drug name
            let catalog = sqlx::query_as::<_, CatalogPriceRow>(
                "SELECT id, base_price \
                 FROM pharmacy_catalog \
                 WHERE tenant_id = $1 \
                   AND is_active = true \
                   AND ( \
                     id = $2 \
                     OR lower(name) = lower($3) \
                     OR (generic_name IS NOT NULL AND lower(generic_name) = lower($3)) \
                   ) \
                 ORDER BY \
                   CASE \
                     WHEN id = $2 THEN 0 \
                     WHEN lower(name) = lower($3) THEN 1 \
                     ELSE 2 \
                   END, \
                   name \
                 LIMIT 1",
            )
            .bind(claims.tenant_id)
            .bind(reviewed_catalog_id)
            .bind(&item.drug_name)
            .fetch_optional(&mut *tx)
            .await?;

            let Some(catalog) = catalog else {
                return Err(AppError::Conflict(format!(
                    "Map \"{}\" to the pharmacy formulary before approving billing",
                    item.drug_name
                )));
            };
            let price = reviewed
                .map(|review_item| review_item.unit_price)
                .unwrap_or(catalog.base_price);
            if price < Decimal::ZERO {
                return Err(AppError::BadRequest(
                    "Reviewed pharmacy price cannot be negative".to_owned(),
                ));
            }
            if price != catalog.base_price
                && body
                    .notes
                    .as_deref()
                    .map(str::trim)
                    .is_none_or(str::is_empty)
            {
                return Err(AppError::BadRequest(
                    "Price override reason is required in review notes".to_owned(),
                ));
            }
            let total = price * Decimal::from(quantity);

            let order_item = sqlx::query_as::<_, PharmacyOrderItem>(
                "INSERT INTO pharmacy_order_items \
                 (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, \
                  total_price, quantity_prescribed) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $5) \
                 RETURNING *",
            )
            .bind(claims.tenant_id)
            .bind(order.id)
            .bind(catalog.id)
            .bind(&item.drug_name)
            .bind(quantity)
            .bind(price)
            .bind(total)
            .fetch_one(&mut *tx)
            .await?;
            order_items.push(order_item);
        }

        ensure_order_items_stock_available_for_billing_in_tx(
            &mut tx,
            &claims.tenant_id,
            &order_items,
        )
        .await?;
        let billing_indent = ensure_pharmacy_billing_indent_for_order_in_tx(
            &mut tx,
            &claims.tenant_id,
            &order,
            &order_items,
        )
        .await?;
        billing_invoice_id = billing_indent.invoice_id;
        created_billing_invoice_id = billing_indent.created_invoice_id;
        created_order_id = Some(order.id);
        created_order_items = order_items;

        // Link order back to rx queue
        sqlx::query(
            "UPDATE pharmacy_prescriptions SET pharmacy_order_id = $1, status = 'dispensing'::pharmacy_rx_status WHERE id = $2",
        )
        .bind(order.id)
        .bind(rx.id)
        .execute(&mut *tx)
        .await?;
    }

    let final_rx = sqlx::query_as::<_, PharmacyPrescriptionRx>(
        "SELECT * FROM pharmacy_prescriptions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let admission_id =
        admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, Some(final_rx.encounter_id))
            .await?;
    let mut billing_invoice_lifecycle_payload = None;
    let mut created_order_lifecycle_payload = None;

    if let Some(invoice_id) = created_billing_invoice_id {
        let invoice = sqlx::query_as::<_, BillingInvoiceEventRow>(
            "SELECT invoice_number, total_amount, status::text AS status \
             FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        let billing_payload = json!({
            "invoice_id": invoice_id,
            "patient_id": final_rx.patient_id,
            "encounter_id": final_rx.encounter_id,
            "admission_id": admission_id,
            "invoice_number": invoice.invoice_number,
            "total_amount": invoice.total_amount,
            "status": invoice.status,
            "source_module": "pharmacy",
            "pharmacy_order_id": created_order_id,
            "rx_queue_id": final_rx.id,
            "prescription_id": final_rx.prescription_id,
        });
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::BillingInvoiceCreated,
            invoice_id,
            claims.sub,
            billing_payload.clone(),
        )
        .with_patient(final_rx.patient_id)
        .with_encounter(final_rx.encounter_id);
        if let Some(admission_id) = admission_id {
            event = event.with_admission(admission_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
        billing_invoice_lifecycle_payload = Some(billing_payload);
    }

    if let Some(order_id) = created_order_id {
        let total_amount: Decimal = created_order_items
            .iter()
            .map(|item| item.total_price)
            .sum();
        let order_payload = json!({
            "order_id": order_id,
            "order_type": "pharmacy",
            "patient_id": final_rx.patient_id,
            "encounter_id": final_rx.encounter_id,
            "admission_id": admission_id,
            "prescription_id": final_rx.prescription_id,
            "rx_queue_id": final_rx.id,
            "billing_invoice_id": billing_invoice_id,
            "items_count": created_order_items.len(),
            "total_amount": total_amount.to_string(),
            "items": created_order_items.iter().map(|item| {
                json!({
                    "catalog_item_id": item.catalog_item_id,
                    "drug_name": item.drug_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price,
                })
            }).collect::<Vec<_>>(),
        });
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::OrderCreated,
            order_id,
            claims.sub,
            order_payload.clone(),
        )
        .with_source_module(ClinicalEventSourceModule::Pharmacy)
        .with_patient(final_rx.patient_id)
        .with_encounter(final_rx.encounter_id);
        if let Some(admission_id) = admission_id {
            event = event.with_admission(admission_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
        created_order_lifecycle_payload = Some(order_payload);
    }

    let review_payload = json!({
        "rx_queue_id": final_rx.id,
        "prescription_id": final_rx.prescription_id,
        "patient_id": final_rx.patient_id,
        "encounter_id": final_rx.encounter_id,
        "admission_id": admission_id,
        "review_status": pharmacy_rx_status_code(&final_rx.status),
        "review_action": body.action.as_str(),
        "pharmacy_order_id": final_rx.pharmacy_order_id.or(created_order_id),
        "billing_invoice_id": billing_invoice_id,
        "items_count": created_order_items.len(),
        "reviewed_by": claims.sub,
        "allergy_check_done": final_rx.allergy_check_done,
        "interaction_check_done": final_rx.interaction_check_done,
    });
    let mut review_event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::PharmacyPrescriptionReviewed,
        final_rx.id,
        claims.sub,
        review_payload.clone(),
    )
    .with_patient(final_rx.patient_id)
    .with_encounter(final_rx.encounter_id);
    if let Some(admission_id) = admission_id {
        review_event = review_event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &review_event).await?;

    tx.commit().await?;

    if let Some(billing_payload) = billing_invoice_lifecycle_payload {
        let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            ClinicalEventName::BillingInvoiceCreated.as_str(),
            billing_payload,
        )
        .await;
    }
    if let Some(order_payload) = created_order_lifecycle_payload {
        let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            ClinicalEventName::OrderCreated.as_str(),
            order_payload,
        )
        .await;
    }
    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        ClinicalEventName::PharmacyPrescriptionReviewed.as_str(),
        review_payload,
    )
    .await;

    Ok(Json(final_rx))
}

// Helper row for prescription items
#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct PrescriptionItemRow {
    id: Uuid,
    drug_name: String,
    dosage: String,
    frequency: String,
    duration: String,
    route: Option<String>,
    catalog_item_id: Option<Uuid>,
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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

    let safe = matches.as_array().is_none_or(Vec::is_empty);

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let batches = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.expiry_date), '[]'::json) FROM (
         SELECT id::text AS batch_id, batch_number, expiry_date::text,
                quantity_on_hand
         FROM pharmacy_batches
         WHERE catalog_item_id = $1 AND tenant_id = $2
           AND quantity_on_hand > 0 AND expiry_date > CURRENT_DATE
           AND quarantine_status = 'cleared'
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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    validate_pos_sale_field_access(&body, &restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Allergy guard — only when the sale is linked to a patient.
    let allergy_reason = body
        .allergy_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    let allergy_conflicts = if let Some(pid) = body.patient_id {
        let names: Vec<String> = body.items.iter().map(|i| i.drug_name.clone()).collect();
        drug_allergy_conflicts(&mut tx, claims.tenant_id, pid, &names).await?
    } else {
        Vec::new()
    };
    if !allergy_conflicts.is_empty() && allergy_reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "Patient has a documented drug allergy conflicting with: {}. Provide an override reason to sell.",
            allergy_conflict_summary(&allergy_conflicts)
        )));
    }

    // A POS / OTC walk-in sale carries no prescription, NDPS register entry, or witnessed
    // dual-lock, so a scheduled or controlled drug (Schedule H/H1/X or NDPS/controlled) must
    // not be sold here — those are dispensed only through the prescription path (dispense_order),
    // which enforces schedule compliance and records the register + dual-lock. This matches the
    // sibling OTC endpoint create_otc_sale (D&C Act 1940 / NDPS Act 1985).
    let catalog_ids: Vec<Uuid> = body.items.iter().filter_map(|i| i.catalog_item_id).collect();
    if !catalog_ids.is_empty() {
        let blocked_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM pharmacy_catalog \
             WHERE tenant_id = $1 AND id = ANY($2) \
               AND (is_controlled = true OR drug_schedule IN ('H', 'H1', 'X', 'NDPS')) \
             LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(&catalog_ids)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(bid) = blocked_id {
            let drug = body
                .items
                .iter()
                .find(|i| i.catalog_item_id == Some(bid))
                .map_or("This item", |i| i.drug_name.as_str());
            return Err(AppError::BadRequest(format!(
                "'{drug}' is a scheduled / controlled drug and cannot be sold over the counter — \
                 dispense it against a prescription so schedule compliance and the NDPS register \
                 and dual-lock are recorded."
            )));
        }
    }

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
    if body.amount_received.unwrap_or(total) < total {
        return Err(AppError::BadRequest(
            "Amount received cannot be less than pharmacy sale total".to_owned(),
        ));
    }
    let payment_mode = body.payment_mode.as_deref().unwrap_or("cash");
    if payment_mode == "mixed" {
        return Err(AppError::BadRequest(
            "Mixed pharmacy tender requires split payment lines before posting to common billing"
                .to_owned(),
        ));
    }

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

    if let (Some(pid), Some(reason)) = (body.patient_id, allergy_reason) {
        if !allergy_conflicts.is_empty() {
            log_allergy_overrides(
                &mut tx,
                &allergy_conflicts,
                &AllergyOverrideLog {
                    tenant_id: claims.tenant_id,
                    patient_id: pid,
                    overridden_by: claims.sub,
                    reason,
                    context: "pos_sale",
                    order_id: Some(order.id),
                },
            )
            .await?;
        }
    }

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
    .bind(payment_mode)
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
    let mut billing_lines = Vec::with_capacity(body.items.len());
    for item in &body.items {
        if item.quantity <= 0 {
            return Err(AppError::BadRequest(
                "POS quantity must be greater than zero".to_owned(),
            ));
        }

        let line_gst =
            Decimal::from(item.quantity) * item.selling_price * item.gst_rate / Decimal::from(100);
        let half_gst = line_gst / Decimal::from(2);
        let line_total = Decimal::from(item.quantity) * item.selling_price + line_gst;

        let batch_trace = if let Some(catalog_id) = item.catalog_item_id {
            let stock = fetch_pharmacy_stock_gate_in_tx(
                &mut tx,
                &claims.tenant_id,
                catalog_id,
                &item.drug_name,
            )
            .await?;
            if stock.current_stock < item.quantity {
                return Err(AppError::Conflict(format!(
                    "Insufficient stock for {}: requested {}, available {}. POS sale was not posted.",
                    item.drug_name, item.quantity, stock.current_stock
                )));
            }

            let trace = if let Some(batch_id) = item.batch_id {
                Some(
                    decrement_batch_stock_for_dispense_in_tx(
                        &mut tx,
                        &claims.tenant_id,
                        catalog_id,
                        batch_id,
                        item.quantity,
                        &item.drug_name,
                    )
                    .await?,
                )
            } else {
                let trace = try_decrement_fefo_batch_stock_for_dispense_in_tx(
                    &mut tx,
                    &claims.tenant_id,
                    catalog_id,
                    body.store_location_id,
                    item.quantity,
                )
                .await?;
                if trace.is_none() && stock.batch_tracking_required {
                    return Err(AppError::Conflict(format!(
                        "No usable FEFO batch is available for {}. Receive stock or select another cleared non-expired batch.",
                        item.drug_name
                    )));
                }
                trace
            };

            decrement_catalog_stock_for_dispense_in_tx(
                &mut tx,
                &claims.tenant_id,
                catalog_id,
                item.quantity,
                &item.drug_name,
            )
            .await?;

            sqlx::query(
                "INSERT INTO pharmacy_stock_transactions \
                 (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, notes, created_by) \
                 VALUES ($1, $2, 'issue', $3, $4, $5, $6)",
            )
            .bind(claims.tenant_id)
            .bind(catalog_id)
            .bind(item.quantity)
            .bind(order.id)
            .bind("POS sale")
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;

            trace
        } else {
            None
        };

        let batch_id = batch_trace.as_ref().map(|trace| trace.id).or(item.batch_id);
        let batch_number = batch_trace
            .as_ref()
            .map(|trace| trace.batch_number.clone())
            .or_else(|| item.batch_number.clone());

        // Order item for stock tracking
        sqlx::query(
            "INSERT INTO pharmacy_order_items
             (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price,
              batch_stock_id, batch_number, expiry_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(item.quantity)
        .bind(item.selling_price)
        .bind(line_total)
        .bind(batch_id)
        .bind(&batch_number)
        .bind(batch_trace.as_ref().map(|trace| trace.expiry_date))
        .execute(&mut *tx)
        .await?;

        // POS sale item with GST split
        let pos_sale_item_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO pharmacy_pos_sale_items
             (tenant_id, pos_sale_id, catalog_item_id, drug_name, batch_id, batch_number,
              hsn_code, quantity, mrp, selling_price, gst_rate, cgst_amount, sgst_amount,
              igst_amount, line_total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14)
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(sale.id)
        .bind(item.catalog_item_id)
        .bind(&item.drug_name)
        .bind(batch_id)
        .bind(&batch_number)
        .bind(&item.hsn_code)
        .bind(item.quantity)
        .bind(item.mrp)
        .bind(item.selling_price)
        .bind(item.gst_rate)
        .bind(half_gst)
        .bind(half_gst)
        .bind(line_total)
        .fetch_one(&mut *tx)
        .await?;

        billing_lines.push(PosSaleBillingLine {
            source_id: pos_sale_item_id,
            catalog_item_id: item.catalog_item_id,
            drug_name: item.drug_name.clone(),
            batch_id,
            batch_number,
            expiry_date: batch_trace.as_ref().map(|trace| trace.expiry_date),
            hsn_code: item.hsn_code.clone(),
            quantity: item.quantity,
            selling_price: item.selling_price,
            gst_rate: item.gst_rate,
        });
    }

    let billing_invoice_id = mirror_patient_pos_sale_to_billing_in_tx(
        &mut tx,
        claims.tenant_id,
        claims.sub,
        &sale,
        &order,
        &billing_lines,
    )
    .await?;

    let sale = if billing_invoice_id.is_some() {
        sqlx::query_as::<_, PharmacyPosSale>(
            "SELECT * FROM pharmacy_pos_sales WHERE id = $1 AND tenant_id = $2",
        )
        .bind(sale.id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sale
    };

    tx.commit().await?;
    Ok(Json(filter_pharmacy_pos_sale_response(
        sale,
        &restricted_fields,
    )))
}

/// GET /api/pharmacy/pos/sales
pub async fn list_pos_sales(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PosSalesQuery>,
) -> Result<Json<Vec<PharmacyPosSale>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::VIEW,
            permissions::pharmacy::pos::CANCEL,
            permissions::pharmacy::pos::RETURN,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_pos_sale_response(row, &restricted_fields))
            .collect(),
    ))
}

/// GET /api/pharmacy/pos/sales/{id}/items
pub async fn list_pos_sale_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PharmacyPosSaleItem>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::VIEW,
            permissions::pharmacy::pos::RETURN,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PharmacyPosSaleItem>(
        "SELECT * FROM pharmacy_pos_sale_items WHERE pos_sale_id = $1 AND tenant_id = $2 \
         ORDER BY created_at, drug_name LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_pharmacy_pos_sale_item_response(row, &restricted_fields))
            .collect(),
    ))
}

/// GET /api/pharmacy/pos/day-summary
pub async fn pos_day_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PosDaySummary>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::VIEW)?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pos_day_summary_response(
        summary,
        &restricted_fields,
    )))
}

/// PUT /api/pharmacy/pos/sales/{id}/cancel — Full cancel POS sale, restore stock
pub async fn cancel_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelPosSaleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CANCEL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Get the POS sale
    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let sale_status = sale.status.as_deref().unwrap_or("completed");
    if matches!(sale_status, "cancelled" | "refunded") {
        return Err(AppError::Conflict(
            "POS sale is already cancelled or refunded".to_owned(),
        ));
    }
    let already_refunded = sale.refund_amount.unwrap_or(Decimal::ZERO);
    let remaining_refund = if sale.total_amount > already_refunded {
        sale.total_amount - already_refunded
    } else {
        Decimal::ZERO
    };

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
        let remaining_qty = item.quantity - item.cancelled_qty.unwrap_or(0);
        if remaining_qty <= 0 {
            continue;
        }
        if let Some(catalog_id) = item.catalog_item_id {
            sqlx::query(
                "UPDATE pharmacy_catalog SET current_stock = current_stock + $1 \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(remaining_qty)
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
                .bind(remaining_qty)
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
            .bind(remaining_qty)
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

    // Create refund payment transaction for the not-yet-refunded amount.
    if remaining_refund > Decimal::ZERO {
        sqlx::query(
            "INSERT INTO pharmacy_payment_transactions \
             (tenant_id, pos_sale_id, payment_mode, amount, reference_number, created_by) \
             VALUES ($1, $2, 'cash', -$3, $4, $5)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(remaining_refund)
        .bind(format!(
            "REFUND-{}",
            sale.receipt_number.as_deref().unwrap_or("N/A")
        ))
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(
        json!({ "status": "cancelled", "refund_amount": remaining_refund.to_string() }),
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
    require_permission(&claims, permissions::pharmacy::pos::RETURN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let sale_status = sale.status.as_deref().unwrap_or("completed");
    if matches!(sale_status, "cancelled" | "refunded") {
        return Err(AppError::Conflict(
            "POS sale is already cancelled or refunded".to_owned(),
        ));
    }

    let mut total_refund = Decimal::ZERO;

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

        let remaining_qty = item.quantity - item.cancelled_qty.unwrap_or(0);
        let return_qty = ret_item.return_qty.min(remaining_qty);
        if return_qty <= 0 {
            continue;
        }

        let refund_amount = item.selling_price * Decimal::from(return_qty);
        total_refund += refund_amount;

        // Mark item as partially/fully cancelled
        let is_full = return_qty >= remaining_qty;
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
    if total_refund > Decimal::ZERO {
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pharmacy_analytics_json_response(
        json!({ "sales": rows }),
        &restricted_fields,
    )))
}

/// GET /api/pharmacy/analytics/fill-rate
pub async fn prescription_fill_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    Ok(Json(filter_pharmacy_analytics_json_response(
        json!({ "margins": rows }),
        &restricted_fields,
    )))
}

// ── Phase 3 Request Types ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RxQueueQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub rx_queue_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewPrescriptionRequest {
    pub action: String,
    pub notes: Option<String>,
    pub rejection_reason: Option<String>,
    pub items: Option<Vec<ReviewPrescriptionItemInput>>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewPrescriptionItemInput {
    pub prescription_item_id: Uuid,
    pub catalog_item_id: Option<Uuid>,
    pub quantity: i32,
    pub unit_price: Decimal,
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
    /// Pharmacist's reason for selling despite a documented drug allergy.
    pub allergy_override_reason: Option<String>,
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

struct PosSaleBillingLine {
    source_id: Uuid,
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    batch_id: Option<Uuid>,
    batch_number: Option<String>,
    expiry_date: Option<NaiveDate>,
    hsn_code: Option<String>,
    quantity: i32,
    selling_price: Decimal,
    gst_rate: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct PosSalesQuery {
    pub payment_mode: Option<String>,
    pub date: Option<NaiveDate>,
}

fn billing_payment_mode_for_pharmacy(
    payment_mode: &PharmacyPaymentMode,
) -> Result<&'static str, AppError> {
    match payment_mode {
        PharmacyPaymentMode::Cash => Ok("cash"),
        PharmacyPaymentMode::Card => Ok("card"),
        PharmacyPaymentMode::Upi => Ok("upi"),
        PharmacyPaymentMode::Insurance => Ok("insurance"),
        PharmacyPaymentMode::Credit => Ok("credit"),
        PharmacyPaymentMode::Mixed => Err(AppError::BadRequest(
            "Mixed pharmacy tender requires split payment lines before posting to common billing"
                .to_owned(),
        )),
    }
}

async fn mirror_patient_pos_sale_to_billing_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    sold_by: Uuid,
    sale: &PharmacyPosSale,
    order: &PharmacyOrder,
    items: &[PosSaleBillingLine],
) -> Result<Option<Uuid>, AppError> {
    let Some(patient_id) = sale.patient_id else {
        return Ok(None);
    };

    #[derive(sqlx::FromRow)]
    struct InvoiceId {
        id: Uuid,
    }

    let payment_mode = billing_payment_mode_for_pharmacy(&sale.payment_mode)?;
    let invoice_number = medbrains_server_services::billing::generate_invoice_number(tx, &tenant_id).await?;
    let admission_id =
        medbrains_server_services::billing::admission_id_for_encounter_in_tx(tx, &tenant_id, order.encounter_id)
            .await?;
    let invoice = sqlx::query_as::<_, InvoiceId>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes, issued_at, \
          created_by) \
         VALUES ($1, $2, $3, $4, $5, 'paid'::invoice_status, $6, $7, $8, $9, $9, $10, now(), $11) \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(invoice_number)
    .bind(patient_id)
    .bind(order.encounter_id)
    .bind(admission_id)
    .bind(sale.subtotal)
    .bind(sale.gst_amount)
    .bind(sale.discount_amount)
    .bind(sale.total_amount)
    .bind(format!("Pharmacy POS sale {}", sale.sale_number))
    .bind(sold_by)
    .fetch_one(&mut **tx)
    .await?;

    for line in items {
        let line_gst =
            Decimal::from(line.quantity) * line.selling_price * line.gst_rate / Decimal::from(100);
        let half_gst = line_gst / Decimal::from(2);
        let line_total = Decimal::from(line.quantity) * line.selling_price + line_gst;

        sqlx::query(
            "INSERT INTO invoice_items \
             (tenant_id, invoice_id, charge_code, description, source, source_id, quantity, \
              unit_price, tax_percent, total_price, gst_rate, gst_type, cgst_amount, \
              sgst_amount, igst_amount, hsn_sac_code, pharmacy_order_id, source_module, \
              pharmacy_batch_id, batch_number, expiry_date) \
             VALUES ($1, $2, $3, $4, 'pharmacy'::charge_source, $5, $6, $7, $8, $9, $8, \
              CASE WHEN $8 > 0 THEN 'cgst_sgst'::gst_type ELSE 'exempt'::gst_type END, \
              $10, $10, 0, $11, $12, 'pharmacy_pos', $13, $14, $15)",
        )
        .bind(tenant_id)
        .bind(invoice.id)
        .bind(
            line.catalog_item_id
                .map_or_else(|| "PH-POS".to_owned(), |id| format!("PH-{id}")),
        )
        .bind(&line.drug_name)
        .bind(line.source_id)
        .bind(line.quantity)
        .bind(line.selling_price)
        .bind(line.gst_rate)
        .bind(line_total)
        .bind(half_gst)
        .bind(&line.hsn_code)
        .bind(order.id)
        .bind(line.batch_id)
        .bind(&line.batch_number)
        .bind(line.expiry_date)
        .execute(&mut **tx)
        .await?;
    }

    sqlx::query(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, paid_at) \
         VALUES ($1, $2, $3, $4::payment_mode, $5, $6, $7, now())",
    )
    .bind(tenant_id)
    .bind(invoice.id)
    .bind(sale.total_amount)
    .bind(payment_mode)
    .bind(&sale.payment_reference)
    .bind(sold_by)
    .bind(format!(
        "Posted from pharmacy POS sale {}; pharmacy cash drawer remains the operational source",
        sale.sale_number
    ))
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE pharmacy_pos_sales \
         SET billing_invoice_id = $1, billing_posted_at = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(invoice.id)
    .bind(sale.id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;

    Ok(Some(invoice.id))
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

/// Pharmacy (orders, dispensing, catalog, stock, transfers, analytics, finance) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/pharmacy/orders",
            get(list_orders).post(create_order),
        )
        .route(
            "/api/pharmacy/orders/{id}",
            get(get_order),
        )
        .route(
            "/api/pharmacy/orders/{id}/items/{item_id}",
            put(update_order_item).delete(remove_order_item),
        )
        .route(
            "/api/pharmacy/orders/{id}/dispense",
            put(dispense_order),
        )
        .route(
            "/api/pharmacy/orders/{id}/cancel",
            put(cancel_order),
        )
        .route(
            "/api/pharmacy/catalog",
            get(list_catalog).post(create_catalog_entry),
        )
        .route(
            "/api/pharmacy/catalog/{id}",
            put(update_catalog_entry),
        )
        .route("/api/pharmacy/stock", get(list_stock))
        .route(
            "/api/pharmacy/stock/transactions",
            post(create_stock_transaction),
        )
        .route(
            "/api/pharmacy/orders/{id}/validate",
            post(validate_order),
        )
        .route("/api/pharmacy/otc-sale", post(create_otc_sale))
        .route(
            "/api/pharmacy/discharge-dispensing",
            post(create_discharge_dispensing),
        )
        .route(
            "/api/pharmacy/ndps-register",
            get(list_ndps_entries).post(create_ndps_entry),
        )
        .route(
            "/api/pharmacy/ndps-register/balance",
            get(ndps_balance),
        )
        .route(
            "/api/pharmacy/ndps-register/report",
            get(ndps_report),
        )
        .route(
            "/api/pharmacy/batches",
            get(list_batches).post(create_batch),
        )
        .route(
            "/api/pharmacy/batches/near-expiry",
            get(near_expiry_report),
        )
        .route(
            "/api/pharmacy/batches/write-off-expired",
            post(write_off_expired),
        )
        .route(
            "/api/pharmacy/stock/by-location",
            get(location_stock_dashboard),
        )
        .route(
            "/api/pharmacy/batches/dead-stock",
            get(dead_stock_report),
        )
        .route(
            "/api/pharmacy/store-assignments",
            get(list_store_assignments).post(create_store_assignment),
        )
        .route(
            "/api/pharmacy/staff",
            get(list_pharmacy_staff).post(assign_pharmacy_staff),
        )
        .route(
            "/api/pharmacy/staff/{id}",
            delete(remove_pharmacy_staff),
        )
        .route("/api/pharmacy/my-locations", get(my_pharmacies))
        .route(
            "/api/pharmacy/transfers",
            get(list_transfers).post(create_transfer),
        )
        .route(
            "/api/pharmacy/transfers/{id}/approve",
            put(approve_transfer),
        )
        .route(
            "/api/pharmacy/transfers/{id}/dispatch",
            post(dispatch_transfer),
        )
        .route(
            "/api/pharmacy/transfers/{id}/receive",
            post(receive_transfer),
        )
        .route(
            "/api/pharmacy/returns",
            get(list_returns).post(create_return),
        )
        .route(
            "/api/pharmacy/returns/batch",
            post(create_return_batch),
        )
        .route(
            "/api/pharmacy/returns/{id}/process",
            put(process_return),
        )
        .route(
            "/api/pharmacy/analytics/consumption",
            get(consumption_analysis),
        )
        .route(
            "/api/pharmacy/analytics/abc-ved",
            get(abc_ved_analysis),
        )
        .route(
            "/api/pharmacy/analytics/utilization",
            get(drug_utilization_review),
        )
        .route(
            "/api/pharmacy/interactions/check",
            post(check_drug_interactions),
        )
        .route(
            "/api/pharmacy/prescriptions/{id}/audit",
            get(prescription_audit),
        )
        .route(
            "/api/pharmacy/formulary/check",
            post(formulary_check),
        )
        .route("/api/pharmacy/rx-queue", get(list_rx_queue))
        .route("/api/pharmacy/rx-queue/{id}", get(get_rx_detail))
        .route("/api/pharmacy/rx-queue/{id}/review", put(review_prescription))
        .route("/api/pharmacy/safety/allergy-check", post(check_patient_allergies))
        .route("/api/pharmacy/batches/fefo-select", post(select_fefo_batch))
        .route("/api/pharmacy/pos/sales", get(list_pos_sales).post(create_pos_sale))
        .route("/api/pharmacy/pos/sales/{id}/items", get(list_pos_sale_items))
        .route("/api/pharmacy/pos/sales/{id}/cancel", put(cancel_pos_sale))
        .route("/api/pharmacy/pos/sales/{id}/return-items", put(return_pos_items))
        .route("/api/pharmacy/pos/day-summary", get(pos_day_summary))
        .route("/api/pharmacy/pricing/resolve", post(resolve_drug_price))
        .route("/api/pharmacy/pricing/tiers", put(upsert_pricing_tier))
        .route("/api/pharmacy/stock/reconcile", post(stock_reconciliation))
        .route("/api/pharmacy/stock/reorder-suggestions", get(reorder_suggestions))
        .route("/api/pharmacy/analytics/daily-sales", get(daily_sales_summary))
        .route("/api/pharmacy/analytics/fill-rate", get(prescription_fill_rate))
        .route("/api/pharmacy/analytics/margins", get(margin_analysis))
}
