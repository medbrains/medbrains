use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "po_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PoStatus {
    Draft,
    Submitted,
    Approved,
    SentToVendor,
    PartiallyReceived,
    FullyReceived,
    Closed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "grn_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum GrnStatus {
    Draft,
    Inspecting,
    Accepted,
    PartiallyAccepted,
    Rejected,
    Completed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "vendor_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VendorStatus {
    Active,
    Inactive,
    Blacklisted,
    PendingApproval,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "rate_contract_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RateContractStatus {
    Draft,
    Active,
    Expired,
    Terminated,
}

// ── Vendor ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Vendor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub display_name: Option<String>,
    pub vendor_type: String,
    pub status: VendorStatus,
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
    pub credit_limit: rust_decimal::Decimal,
    pub credit_days: i32,
    pub rating: rust_decimal::Decimal,
    pub categories: serde_json::Value,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Store Location ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StoreLocation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub location_type: String,
    pub department_id: Option<Uuid>,
    pub facility_id: Option<Uuid>,
    pub address: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Purchase Order ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PurchaseOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub po_number: String,
    pub vendor_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub status: PoStatus,
    pub indent_requisition_id: Option<Uuid>,
    pub rate_contract_id: Option<Uuid>,
    pub subtotal: rust_decimal::Decimal,
    pub tax_amount: rust_decimal::Decimal,
    pub discount_amount: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub order_date: NaiveDate,
    pub expected_delivery: Option<NaiveDate>,
    pub payment_terms: Option<String>,
    pub delivery_terms: Option<String>,
    pub created_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub is_emergency: bool,
    pub emergency_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Purchase Order Item ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PurchaseOrderItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub po_id: Uuid,
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub item_code: Option<String>,
    pub unit: String,
    pub quantity_ordered: i32,
    pub quantity_received: i32,
    pub unit_price: rust_decimal::Decimal,
    pub tax_percent: rust_decimal::Decimal,
    pub tax_amount: rust_decimal::Decimal,
    pub discount_percent: rust_decimal::Decimal,
    pub discount_amount: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub indent_item_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Goods Receipt Note ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GoodsReceiptNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub grn_number: String,
    pub po_id: Uuid,
    pub vendor_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub status: GrnStatus,
    pub total_amount: rust_decimal::Decimal,
    pub receipt_date: NaiveDate,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub invoice_amount: Option<rust_decimal::Decimal>,
    pub received_by: Uuid,
    pub inspected_by: Option<Uuid>,
    pub inspected_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    /// GST e-invoice reference (64 hex chars) when the bill carried one.
    pub irn: Option<String>,
    /// When stock moved. A draft has none; posting sets it exactly once.
    pub posted_at: Option<DateTime<Utc>>,
    pub posted_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── GRN Item ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GrnItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub grn_id: Uuid,
    pub po_item_id: Option<Uuid>,
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub quantity_received: i32,
    pub quantity_accepted: i32,
    pub quantity_rejected: i32,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub manufacture_date: Option<NaiveDate>,
    pub unit_price: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub rejection_reason: Option<String>,
    pub notes: Option<String>,
    pub mrp: Option<rust_decimal::Decimal>,
    pub ptr: Option<rust_decimal::Decimal>,
    /// Scheme units ("10+1"): stocked, never billed.
    pub free_quantity: i32,
    pub discount_amount: rust_decimal::Decimal,
    pub gst_rate: Option<rust_decimal::Decimal>,
    pub hsn_code: Option<String>,
    pub pharmacy_batch_id: Option<Uuid>,
    pub batch_stock_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ── Batch Stock ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BatchStock {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub batch_number: String,
    pub expiry_date: Option<NaiveDate>,
    pub manufacture_date: Option<NaiveDate>,
    pub quantity: i32,
    pub unit_cost: rust_decimal::Decimal,
    pub grn_id: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub is_consignment: bool,
    pub serial_number: Option<String>,
    pub barcode: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Rate Contract ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RateContract {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub contract_number: String,
    pub vendor_id: Uuid,
    pub status: RateContractStatus,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Rate Contract Item ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RateContractItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub contract_id: Uuid,
    pub catalog_item_id: Uuid,
    pub contracted_price: rust_decimal::Decimal,
    pub max_quantity: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}
