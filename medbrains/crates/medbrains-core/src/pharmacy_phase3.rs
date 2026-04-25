use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ══════════════════════════════════════════════════════════
//  Enums
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "pharmacy_rx_status", rename_all = "snake_case")]
pub enum PharmacyRxStatus {
    PendingReview,
    Approved,
    Rejected,
    OnHold,
    Dispensing,
    Dispensed,
    PartiallyDispensed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "pharmacy_payment_mode", rename_all = "snake_case")]
pub enum PharmacyPaymentMode {
    Cash,
    Card,
    Upi,
    Insurance,
    Credit,
    Mixed,
}

// ══════════════════════════════════════════════════════════
//  FromRow structs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyPrescriptionRx {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub doctor_id: Uuid,
    pub source: String,
    pub status: PharmacyRxStatus,
    pub priority: String,
    pub pharmacy_order_id: Option<Uuid>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub rejection_reason: Option<String>,
    pub allergy_check_done: bool,
    pub interaction_check_done: bool,
    pub interaction_check_result: serde_json::Value,
    pub store_location_id: Option<Uuid>,
    pub received_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyPosSale {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub sale_number: String,
    pub pharmacy_order_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub subtotal: rust_decimal::Decimal,
    pub discount_amount: rust_decimal::Decimal,
    pub discount_percent: Option<rust_decimal::Decimal>,
    pub gst_amount: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub payment_mode: PharmacyPaymentMode,
    pub payment_reference: Option<String>,
    pub amount_received: rust_decimal::Decimal,
    pub change_due: rust_decimal::Decimal,
    pub receipt_number: Option<String>,
    pub receipt_printed: bool,
    pub pricing_tier: String,
    pub sold_by: Uuid,
    pub store_location_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyPosSaleItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pos_sale_id: Uuid,
    pub order_item_id: Option<Uuid>,
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub batch_id: Option<Uuid>,
    pub batch_number: Option<String>,
    pub hsn_code: Option<String>,
    pub quantity: i32,
    pub mrp: rust_decimal::Decimal,
    pub selling_price: rust_decimal::Decimal,
    pub gst_rate: rust_decimal::Decimal,
    pub cgst_amount: rust_decimal::Decimal,
    pub sgst_amount: rust_decimal::Decimal,
    pub igst_amount: rust_decimal::Decimal,
    pub line_total: rust_decimal::Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyPricingTier {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub tier_name: String,
    pub price: rust_decimal::Decimal,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyAllergyCheckLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub allergen_matched: Option<String>,
    pub allergy_type: Option<String>,
    pub severity: Option<String>,
    pub action_taken: String,
    pub overridden_by: Option<Uuid>,
    pub override_reason: Option<String>,
    pub checked_at: DateTime<Utc>,
    pub context: Option<String>,
    pub rx_queue_id: Option<Uuid>,
    pub order_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyStockReconciliation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub batch_id: Option<Uuid>,
    pub system_quantity: i32,
    pub physical_quantity: i32,
    pub variance: i32,
    pub reason: Option<String>,
    pub reconciled_by: Uuid,
    pub store_location_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Composite response structs (Serialize only — not FromRow)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RxQueueRow {
    pub id: Uuid,
    pub prescription_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub doctor_name: String,
    pub source: String,
    pub status: PharmacyRxStatus,
    pub priority: String,
    pub received_at: DateTime<Utc>,
    pub allergy_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PosDaySummary {
    pub total_sales: i64,
    pub total_revenue: rust_decimal::Decimal,
    pub cash_total: rust_decimal::Decimal,
    pub card_total: rust_decimal::Decimal,
    pub upi_total: rust_decimal::Decimal,
    pub gst_collected: rust_decimal::Decimal,
}
