use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ved_class", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VedClass {
    Vital,
    Essential,
    Desirable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "condemnation_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CondemnationStatus {
    Initiated,
    CommitteeReview,
    Approved,
    Condemned,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "supplier_payment_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SupplierPaymentStatus {
    Pending,
    PartiallyPaid,
    Paid,
    Overdue,
    Disputed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consumable_issue_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsumableIssueStatus {
    Issued,
    Returned,
    Billed,
}

// ── FromRow entities ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientConsumableIssue {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub catalog_item_id: Uuid,
    pub batch_stock_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub quantity: i32,
    pub returned_qty: i32,
    pub unit_price: Decimal,
    pub status: ConsumableIssueStatus,
    pub is_chargeable: bool,
    pub invoice_item_id: Option<Uuid>,
    pub issued_by: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ImplantRegistryEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    /// `store_catalog.name` / `.code`, joined by the list query only;
    /// `RETURNING *` writes leave them `None`.
    #[sqlx(default)]
    pub catalog_item_name: Option<String>,
    #[sqlx(default)]
    pub catalog_item_code: Option<String>,
    pub batch_stock_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub serial_number: Option<String>,
    pub implant_date: NaiveDate,
    pub implant_site: Option<String>,
    pub surgeon_id: Option<Uuid>,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub warranty_expiry: Option<NaiveDate>,
    pub removal_date: Option<NaiveDate>,
    pub removal_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EquipmentCondemnation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    /// `store_catalog.name` / `.code`, joined by the list query only;
    /// `RETURNING *` writes leave them `None`.
    #[sqlx(default)]
    pub catalog_item_name: Option<String>,
    #[sqlx(default)]
    pub catalog_item_code: Option<String>,
    pub condemnation_number: String,
    pub status: CondemnationStatus,
    pub reason: String,
    pub current_value: Decimal,
    pub purchase_value: Decimal,
    pub committee_remarks: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub disposal_method: Option<String>,
    pub disposed_at: Option<DateTime<Utc>>,
    pub initiated_by: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SupplierPayment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub vendor_id: Uuid,
    pub po_id: Option<Uuid>,
    pub grn_id: Option<Uuid>,
    pub payment_number: String,
    pub invoice_amount: Decimal,
    pub paid_amount: Decimal,
    pub balance_amount: Decimal,
    pub status: SupplierPaymentStatus,
    pub payment_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub payment_method: Option<String>,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReorderAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub alert_type: String,
    pub current_stock: i32,
    pub threshold_level: i32,
    pub is_acknowledged: bool,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Analytics response types (Serialize only) ──────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ConsumptionAnalysisRow {
    pub item_name: String,
    pub department_name: Option<String>,
    pub total_issued: i64,
    pub total_value: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct AbcAnalysisRow {
    pub item_name: String,
    pub annual_value: Decimal,
    pub cumulative_pct: f64,
    pub abc_class: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VedAnalysisRow {
    pub item_name: String,
    pub ved_class: Option<String>,
    pub current_stock: i32,
    pub reorder_level: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FsnAnalysisRow {
    pub item_name: String,
    pub last_issue_date: Option<DateTime<Utc>>,
    pub days_since_last_issue: Option<i64>,
    pub fsn_class: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DeadStockRow {
    pub item_name: String,
    pub current_stock: i32,
    pub stock_value: Decimal,
    pub last_movement_date: Option<DateTime<Utc>>,
    pub days_idle: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct InventoryValuationRow {
    pub item_name: String,
    pub category: Option<String>,
    pub current_stock: i32,
    pub avg_unit_cost: Decimal,
    pub total_value: Decimal,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PurchaseConsumptionTrendRow {
    pub period: String,
    pub total_purchased: i64,
    pub total_consumed: i64,
    pub net_change: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VendorPerformanceRow {
    pub vendor_name: String,
    pub total_orders: i64,
    pub on_time_pct: f64,
    pub rejection_rate: f64,
    pub avg_delivery_days: f64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VendorComparisonRow {
    pub vendor_name: String,
    pub item_name: String,
    pub unit_price: Decimal,
    pub delivery_days: Option<f64>,
    pub rejection_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComplianceCheckRow {
    pub check_name: String,
    pub status: String,
    pub detail: String,
}
