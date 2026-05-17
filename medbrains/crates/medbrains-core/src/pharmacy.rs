use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::pharmacy_phase2::PharmacyDispensingType;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyCatalog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub unit: Option<String>,
    pub base_price: rust_decimal::Decimal,
    pub tax_percent: rust_decimal::Decimal,
    pub current_stock: i32,
    pub reorder_level: i32,
    pub is_active: bool,
    // Regulatory fields
    pub drug_schedule: Option<String>,
    pub is_controlled: bool,
    pub inn_name: Option<String>,
    pub atc_code: Option<String>,
    pub rxnorm_code: Option<String>,
    pub snomed_code: Option<String>,
    pub formulary_status: String,
    pub aware_category: Option<String>,
    pub is_lasa: bool,
    pub lasa_group: Option<String>,
    pub max_dose_per_day: Option<String>,
    pub batch_tracking_required: bool,
    pub storage_conditions: Option<String>,
    pub black_box_warning: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub ordered_by: Uuid,
    pub status: String,
    pub notes: Option<String>,
    // Phase 2 fields
    pub dispensing_type: PharmacyDispensingType,
    pub discharge_summary_id: Option<Uuid>,
    pub billing_package_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub interaction_check_result: Option<serde_json::Value>,
    pub dispensed_by: Option<Uuid>,
    pub dispensed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyOrderItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: String,
    pub quantity: i32,
    pub unit_price: rust_decimal::Decimal,
    pub total_price: rust_decimal::Decimal,
    // Phase 2 fields
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub batch_stock_id: Option<Uuid>,
    pub quantity_prescribed: Option<i32>,
    pub quantity_returned: i32,
    pub removed_at: Option<DateTime<Utc>>,
    pub removed_by: Option<Uuid>,
    pub remove_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmacyStockTransaction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub catalog_item_id: Uuid,
    pub transaction_type: String,
    pub quantity: i32,
    pub reference_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}
