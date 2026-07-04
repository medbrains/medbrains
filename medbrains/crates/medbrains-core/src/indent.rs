use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::inventory::VedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "snake_case")]
pub enum IndentType {
    #[sqlx(rename = "general")]
    General,
    #[sqlx(rename = "pharmacy")]
    Pharmacy,
    #[sqlx(rename = "lab")]
    Lab,
    #[sqlx(rename = "surgical")]
    Surgical,
    #[sqlx(rename = "housekeeping")]
    Housekeeping,
    #[sqlx(rename = "emergency")]
    Emergency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "snake_case")]
pub enum IndentPriority {
    #[sqlx(rename = "normal")]
    Normal,
    #[sqlx(rename = "urgent")]
    Urgent,
    #[sqlx(rename = "emergency")]
    Emergency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "snake_case")]
pub enum IndentStatus {
    #[sqlx(rename = "draft")]
    Draft,
    #[sqlx(rename = "submitted")]
    Submitted,
    #[sqlx(rename = "approved")]
    Approved,
    #[sqlx(rename = "partially_approved")]
    PartiallyApproved,
    #[sqlx(rename = "rejected")]
    Rejected,
    #[sqlx(rename = "issued")]
    Issued,
    #[sqlx(rename = "partially_issued")]
    PartiallyIssued,
    #[sqlx(rename = "closed")]
    Closed,
    #[sqlx(rename = "cancelled")]
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "snake_case")]
pub enum StockMovementType {
    #[sqlx(rename = "receipt")]
    Receipt,
    #[sqlx(rename = "issue")]
    Issue,
    #[sqlx(rename = "return")]
    Return,
    #[sqlx(rename = "adjustment")]
    Adjustment,
    #[sqlx(rename = "transfer")]
    Transfer,
}

// ── Store Catalog ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StoreCatalog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: Option<String>,
    pub sub_category: Option<String>,
    pub unit: String,
    pub base_price: rust_decimal::Decimal,
    pub current_stock: i32,
    pub reorder_level: i32,
    pub is_active: bool,
    /// 'consumable' (clinical) | 'stationery' (office supplies).
    pub domain: String,
    pub is_implant: bool,
    pub is_high_value: bool,
    pub ved_class: Option<VedClass>,
    pub hsn_code: Option<String>,
    pub bin_location: Option<String>,
    pub last_issue_date: Option<DateTime<Utc>>,
    pub last_receipt_date: Option<DateTime<Utc>>,
    pub min_stock: i32,
    pub max_stock: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Indent Requisition ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IndentRequisition {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub indent_number: String,
    pub department_id: Uuid,
    pub requested_by: Uuid,
    pub indent_type: IndentType,
    pub priority: IndentPriority,
    pub status: IndentStatus,
    pub total_amount: rust_decimal::Decimal,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub context: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Indent Item ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IndentItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub requisition_id: Uuid,
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub quantity_requested: i32,
    pub quantity_approved: i32,
    pub quantity_issued: i32,
    pub unit_price: rust_decimal::Decimal,
    pub total_price: rust_decimal::Decimal,
    pub item_context: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Stock Movement ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StoreStockMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub movement_type: StockMovementType,
    pub quantity: i32,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub batch_stock_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}
