use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "cleaning_area_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CleaningAreaType {
    Icu,
    Ward,
    Ot,
    Er,
    Lab,
    Pharmacy,
    Corridor,
    Lobby,
    Washroom,
    Kitchen,
    General,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "cleaning_task_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CleaningTaskStatus {
    Pending,
    Assigned,
    InProgress,
    Completed,
    Verified,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "linen_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LinenStatus {
    Clean,
    InUse,
    Soiled,
    Washing,
    Condemned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "linen_contamination_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LinenContaminationType {
    Regular,
    Contaminated,
    Isolation,
}

// ── Structs ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CleaningSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub area_type: CleaningAreaType,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub frequency_hours: i32,
    pub checklist_items: serde_json::Value,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CleaningTask {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub schedule_id: Option<Uuid>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub area_type: CleaningAreaType,
    pub task_date: NaiveDate,
    pub assigned_to: Option<String>,
    /// Who `assigned_to` names, when it is an employee or user id. Only the
    /// list query resolves it.
    #[sqlx(default)]
    pub assigned_to_name: Option<String>,
    /// Whether `assigned_to` is the caller. Only the list query computes it;
    /// the server re-checks on every status change.
    #[sqlx(default)]
    #[serde(default)]
    pub assigned_to_me: bool,
    pub status: CleaningTaskStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub checklist_results: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RoomTurnaround {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub discharge_at: Option<DateTime<Utc>>,
    pub dirty_at: Option<DateTime<Utc>>,
    pub cleaning_started_at: Option<DateTime<Utc>>,
    pub cleaning_completed_at: Option<DateTime<Utc>>,
    pub ready_at: Option<DateTime<Utc>>,
    pub turnaround_minutes: Option<i32>,
    pub cleaned_by: Option<String>,
    pub verified_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PestControlSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub pest_type: String,
    pub frequency_months: i32,
    pub last_done: Option<NaiveDate>,
    pub next_due: Option<NaiveDate>,
    pub vendor_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PestControlLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub schedule_id: Option<Uuid>,
    pub treatment_date: NaiveDate,
    pub treatment_type: String,
    pub chemicals_used: Option<String>,
    pub areas_treated: serde_json::Value,
    pub vendor_name: Option<String>,
    pub certificate_no: Option<String>,
    pub next_due: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LinenItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub barcode: Option<String>,
    pub item_type: String,
    pub current_status: LinenStatus,
    pub ward_id: Option<Uuid>,
    pub wash_count: i32,
    pub max_washes: i32,
    pub commissioned_date: Option<NaiveDate>,
    pub condemned_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LinenMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub linen_item_id: Option<Uuid>,
    pub movement_type: String,
    pub from_ward: Option<Uuid>,
    pub to_ward: Option<Uuid>,
    pub quantity: i32,
    pub weight_kg: Option<rust_decimal::Decimal>,
    pub contamination_type: LinenContaminationType,
    pub batch_id: Option<Uuid>,
    pub recorded_by: Option<String>,
    pub movement_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LaundryBatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub batch_number: String,
    pub items_count: i32,
    pub total_weight: Option<rust_decimal::Decimal>,
    pub contamination_type: LinenContaminationType,
    pub wash_formula: Option<String>,
    pub wash_temperature: Option<i32>,
    pub cycle_minutes: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: String,
    pub operator_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LinenParLevel {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub ward_id: Option<Uuid>,
    pub item_type: String,
    pub par_level: i32,
    pub current_stock: i32,
    pub reorder_level: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LinenCondemnation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub linen_item_id: Option<Uuid>,
    pub reason: String,
    pub wash_count_at_condemn: Option<i32>,
    pub condemned_by: Option<Uuid>,
    pub condemned_date: NaiveDate,
    pub replacement_requested: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
