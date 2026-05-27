use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ══════════════════════════════════════════════════════════
//  Enums
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "pharmacy_dispensing_type", rename_all = "snake_case")]
pub enum PharmacyDispensingType {
    Prescription,
    Otc,
    Discharge,
    Package,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "ndps_register_action", rename_all = "snake_case")]
pub enum NdpsRegisterAction {
    Receipt,
    Dispensed,
    Destroyed,
    Transferred,
    Adjustment,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "pharmacy_return_status", rename_all = "snake_case")]
pub enum PharmacyReturnStatus {
    Requested,
    Approved,
    ReturnedToStock,
    Destroyed,
    Rejected,
}

// ══════════════════════════════════════════════════════════
//  FromRow structs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyBatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub batch_number: String,
    pub expiry_date: NaiveDate,
    pub manufacture_date: Option<NaiveDate>,
    pub quantity_received: i32,
    pub quantity_dispensed: i32,
    pub quantity_on_hand: i32,
    pub store_location_id: Option<Uuid>,
    pub supplier_info: Option<String>,
    pub grn_item_id: Option<Uuid>,
    pub grn_id: Option<Uuid>,
    pub invoice_number: Option<String>,
    pub supplier_batch_number: Option<String>,
    pub purchase_rate: Option<rust_decimal::Decimal>,
    pub selling_rate: Option<rust_decimal::Decimal>,
    pub vendor_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NdpsRegisterEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub action: NdpsRegisterAction,
    pub quantity: i32,
    pub balance_after: i32,
    pub patient_id: Option<Uuid>,
    pub prescription_id: Option<Uuid>,
    pub dispensed_by: Option<Uuid>,
    pub witnessed_by: Option<Uuid>,
    pub register_number: Option<String>,
    pub page_number: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyReturn {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_item_id: Uuid,
    pub patient_id: Uuid,
    pub quantity_returned: i32,
    pub reason: Option<String>,
    pub status: PharmacyReturnStatus,
    pub approved_by: Option<Uuid>,
    pub return_batch_id: Option<Uuid>,
    pub restocked: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyStoreAssignment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub store_location_id: Uuid,
    pub is_central: bool,
    pub serves_departments: Option<Vec<Uuid>>,
    pub operating_hours: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyTransferRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub from_location_id: Uuid,
    pub to_location_id: Uuid,
    pub status: String,
    pub items: serde_json::Value,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Analytics response structs (Serialize only — not FromRow)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyConsumptionRow {
    pub drug_name: String,
    pub category: Option<String>,
    pub total_dispensed: i64,
    pub total_value: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyAbcVedRow {
    pub drug_name: String,
    pub annual_value: rust_decimal::Decimal,
    pub abc_class: String,
    pub ved_class: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NearExpiryRow {
    pub drug_name: String,
    pub batch_number: String,
    pub expiry_date: NaiveDate,
    pub quantity_on_hand: i32,
    pub days_until_expiry: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeadStockRow {
    pub drug_name: String,
    pub current_stock: i32,
    pub stock_value: rust_decimal::Decimal,
    pub last_dispensed_date: Option<DateTime<Utc>>,
    pub days_idle: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DrugUtilizationRow {
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub aware_category: Option<String>,
    pub total_dispensed: i64,
    pub unique_patients: i64,
}
