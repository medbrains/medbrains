//! CSSD (Central Sterile Supply Department) domain types.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Enums ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "instrument_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum InstrumentStatus {
    Available,
    InUse,
    Decontaminating,
    Sterilizing,
    Sterile,
    Damaged,
    Condemned,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sterilization_method", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SterilizationMethod {
    Steam,
    Eto,
    Plasma,
    DryHeat,
    Flash,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "indicator_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IndicatorType {
    Chemical,
    Biological,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "load_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LoadStatus {
    Loading,
    Running,
    Completed,
    Failed,
}

// ── Structs ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdSterilizer {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub method: SterilizationMethod,
    pub chamber_size_liters: Option<Decimal>,
    pub location: Option<String>,
    pub is_active: bool,
    pub last_maintenance_at: Option<DateTime<Utc>>,
    pub next_maintenance_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdInstrument {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub barcode: String,
    pub name: String,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub status: InstrumentStatus,
    pub purchase_date: Option<NaiveDate>,
    pub lifecycle_uses: i32,
    pub max_uses: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdInstrumentSet {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub set_code: String,
    pub set_name: String,
    pub department: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdSetItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub set_id: Uuid,
    pub instrument_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdSterilizationLoad {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub load_number: String,
    pub sterilizer_id: Uuid,
    pub method: SterilizationMethod,
    pub status: LoadStatus,
    pub operator_id: Option<Uuid>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cycle_time_minutes: Option<i32>,
    pub temperature_c: Option<Decimal>,
    pub pressure_psi: Option<Decimal>,
    pub is_flash: bool,
    pub flash_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    /// Set when the whole load is recalled; no pack from it may be issued.
    pub recalled_at: Option<DateTime<Utc>>,
    pub recalled_by: Option<Uuid>,
    pub recall_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdLoadItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub load_id: Uuid,
    pub set_id: Option<Uuid>,
    pub instrument_id: Option<Uuid>,
    pub quantity: i32,
    pub pack_expiry_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdIndicatorResult {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub load_id: Uuid,
    pub indicator_type: IndicatorType,
    pub indicator_brand: Option<String>,
    pub indicator_lot: Option<String>,
    pub result_pass: bool,
    pub read_at: DateTime<Utc>,
    pub read_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdIssuance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub load_item_id: Option<Uuid>,
    pub set_id: Option<Uuid>,
    pub issued_to_department: String,
    pub issued_to_patient_id: Option<Uuid>,
    pub issued_by: Option<Uuid>,
    pub issued_at: DateTime<Utc>,
    pub returned_at: Option<DateTime<Utc>>,
    pub returned_by: Option<Uuid>,
    pub is_recalled: bool,
    pub recall_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CssdMaintenanceLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub sterilizer_id: Uuid,
    pub maintenance_type: String,
    pub performed_by: Option<String>,
    pub performed_at: DateTime<Utc>,
    pub next_due_at: Option<DateTime<Utc>>,
    pub findings: Option<String>,
    pub actions_taken: Option<String>,
    pub cost: Option<Decimal>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}
