//! Multi-Hospital Management types.
//!
//! This module provides types for:
//! - Hospital groups (chains)
//! - Regions
//! - Cross-hospital user assignments
//! - Inter-hospital transfers (patients, stock)
//! - Consolidated KPIs and dashboards
//! - Doctor rotation schedules

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Hospital Groups ────────────────────────────────────────────────────────

/// A hospital group/chain (e.g., Apollo, Fortis)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HospitalGroup {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub display_name: Option<String>,
    pub headquarters_address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub config: serde_json::Value,
    pub default_currency: String,
    pub timezone: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new hospital group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHospitalGroup {
    pub code: String,
    pub name: String,
    pub display_name: Option<String>,
    pub headquarters_address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub default_currency: Option<String>,
    pub timezone: Option<String>,
}

/// Update hospital group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateHospitalGroup {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub headquarters_address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub default_currency: Option<String>,
    pub timezone: Option<String>,
    pub is_active: Option<bool>,
}

// ── Regions ────────────────────────────────────────────────────────────────

/// A geographic region within a hospital group
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HospitalRegion {
    pub id: Uuid,
    pub group_id: Uuid,
    pub code: String,
    pub name: String,
    pub country: String,
    pub states: Option<Vec<String>>,
    pub regional_head_name: Option<String>,
    pub regional_head_email: Option<String>,
    pub regional_head_phone: Option<String>,
    pub config: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new region
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHospitalRegion {
    pub group_id: Uuid,
    pub code: String,
    pub name: String,
    pub country: Option<String>,
    pub states: Option<Vec<String>>,
    pub regional_head_name: Option<String>,
    pub regional_head_email: Option<String>,
    pub regional_head_phone: Option<String>,
}

// ── Hospital in Group ──────────────────────────────────────────────────────

/// Hospital membership in a group
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HospitalInGroup {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub group_id: Option<Uuid>,
    pub region_id: Option<Uuid>,
    pub branch_code: Option<String>,
    pub is_headquarters: bool,
    pub city: Option<String>,
    pub state: Option<String>,
}

/// Assign hospital to group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignHospitalToGroup {
    pub tenant_id: Uuid,
    pub group_id: Uuid,
    pub region_id: Option<Uuid>,
    pub branch_code: Option<String>,
    pub is_headquarters: Option<bool>,
}

// ── Cross-Hospital Users ───────────────────────────────────────────────────

/// User assignment to a hospital
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserHospitalAssignment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
    pub permissions: serde_json::Value,
    pub is_primary: bool,
    pub is_active: bool,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// User with all hospital assignments
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithAssignments {
    pub user_id: Uuid,
    pub username: String,
    pub full_name: String,
    pub email: String,
    pub assignments: Vec<UserHospitalAssignment>,
}

/// Assign user to hospital
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserHospitalAssignment {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
    pub permissions: Option<Vec<String>>,
    pub is_primary: Option<bool>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
}

// ── Patient Transfers ──────────────────────────────────────────────────────

/// Patient transfer status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    #[default]
    Requested,
    Approved,
    InTransit,
    Received,
    Cancelled,
    Rejected,
}

/// Inter-hospital patient transfer
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PatientTransfer {
    pub id: Uuid,
    pub source_tenant_id: Uuid,
    pub dest_tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub transfer_type: String,
    pub reason: String,
    pub clinical_summary: Option<String>,
    pub priority: String,
    pub status: TransferStatus,
    pub requested_at: DateTime<Utc>,
    pub approved_at: Option<DateTime<Utc>>,
    pub departed_at: Option<DateTime<Utc>>,
    pub arrived_at: Option<DateTime<Utc>>,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub received_by: Option<Uuid>,
    pub transport_mode: Option<String>,
    pub transport_details: serde_json::Value,
    pub documents: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Patient transfer with hospital names
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientTransferDisplay {
    pub id: Uuid,
    pub source_hospital_name: String,
    pub dest_hospital_name: String,
    pub patient_name: String,
    pub uhid: String,
    pub transfer_type: String,
    pub reason: String,
    pub priority: String,
    pub status: TransferStatus,
    pub requested_at: DateTime<Utc>,
    pub requested_by_name: String,
}

/// Request a patient transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePatientTransfer {
    pub dest_tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub transfer_type: Option<String>,
    pub reason: String,
    pub clinical_summary: Option<String>,
    pub priority: Option<String>,
    pub transport_mode: Option<String>,
}

/// Update transfer status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTransferStatus {
    pub status: TransferStatus,
    pub notes: Option<String>,
}

// ── Stock Transfers ────────────────────────────────────────────────────────

/// Stock transfer status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "stock_transfer_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum StockTransferStatus {
    #[default]
    Requested,
    Approved,
    Dispatched,
    InTransit,
    Received,
    Cancelled,
}

/// Inter-hospital stock transfer
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockTransfer {
    pub id: Uuid,
    pub source_tenant_id: Uuid,
    pub dest_tenant_id: Uuid,
    pub transfer_number: String,
    pub status: StockTransferStatus,
    pub priority: String,
    pub requested_at: DateTime<Utc>,
    pub approved_at: Option<DateTime<Utc>>,
    pub dispatched_at: Option<DateTime<Utc>>,
    pub received_at: Option<DateTime<Utc>>,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub dispatched_by: Option<Uuid>,
    pub received_by: Option<Uuid>,
    pub request_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Stock transfer item
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockTransferItem {
    pub id: Uuid,
    pub transfer_id: Uuid,
    pub item_id: Uuid,
    pub item_type: String,
    pub item_code: String,
    pub item_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub requested_qty: f64,
    pub approved_qty: Option<f64>,
    pub dispatched_qty: Option<f64>,
    pub received_qty: Option<f64>,
    pub unit: String,
    pub unit_price: Option<f64>,
    pub created_at: DateTime<Utc>,
}

/// Request a stock transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStockTransfer {
    pub dest_tenant_id: Uuid,
    pub priority: Option<String>,
    pub request_reason: Option<String>,
    pub items: Vec<CreateStockTransferItem>,
}

/// Stock transfer item request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStockTransferItem {
    pub item_id: Uuid,
    pub item_type: Option<String>,
    pub item_code: String,
    pub item_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub requested_qty: f64,
    pub unit: String,
    pub unit_price: Option<f64>,
}

// ── Group KPIs ─────────────────────────────────────────────────────────────

/// KPI snapshot for a hospital or group
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupKpiSnapshot {
    pub id: Uuid,
    pub group_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub snapshot_date: NaiveDate,
    pub snapshot_type: String,
    pub total_beds: Option<i32>,
    pub occupied_beds: Option<i32>,
    pub occupancy_pct: Option<f64>,
    pub opd_visits: Option<i32>,
    pub new_patients: Option<i32>,
    pub admissions: Option<i32>,
    pub discharges: Option<i32>,
    pub gross_revenue: Option<f64>,
    pub net_revenue: Option<f64>,
    pub collections: Option<f64>,
    pub avg_los: Option<f64>,
    pub mortality_rate: Option<f64>,
    pub readmission_rate: Option<f64>,
    pub infection_rate: Option<f64>,
    pub metrics: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Consolidated dashboard for hospital group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupDashboard {
    pub group_id: Uuid,
    pub group_name: String,
    pub hospitals: Vec<HospitalKpiSummary>,
    pub total_beds: i32,
    pub total_occupied: i32,
    pub overall_occupancy_pct: f64,
    pub total_opd_visits: i32,
    pub total_admissions: i32,
    pub total_revenue: f64,
    pub snapshot_date: NaiveDate,
}

/// KPI summary for a single hospital
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HospitalKpiSummary {
    pub tenant_id: Uuid,
    pub hospital_name: String,
    pub branch_code: Option<String>,
    pub region_name: Option<String>,
    pub total_beds: i32,
    pub occupied_beds: i32,
    pub occupancy_pct: f64,
    pub opd_visits: i32,
    pub admissions: i32,
    pub revenue: f64,
    pub avg_los: f64,
}

// ── Doctor Rotation ────────────────────────────────────────────────────────

/// Doctor rotation schedule entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DoctorRotationSchedule {
    pub id: Uuid,
    pub group_id: Uuid,
    pub doctor_id: Uuid,
    pub schedule_date: NaiveDate,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub shift: String,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub is_locum: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Doctor rotation with hospital name
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorRotationDisplay {
    pub id: Uuid,
    pub doctor_name: String,
    pub doctor_specialty: Option<String>,
    pub hospital_name: String,
    pub department_name: Option<String>,
    pub schedule_date: NaiveDate,
    pub shift: String,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub is_locum: bool,
}

/// Create rotation schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDoctorRotation {
    pub doctor_id: Uuid,
    pub schedule_date: NaiveDate,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub shift: Option<String>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub is_locum: Option<bool>,
    pub notes: Option<String>,
}

// ── Group Masters ──────────────────────────────────────────────────────────

/// Group-level drug master entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupDrugMaster {
    pub id: Uuid,
    pub group_id: Uuid,
    pub code: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub manufacturer: Option<String>,
    pub drug_schedule: Option<String>,
    pub atc_code: Option<String>,
    pub formulation: Option<String>,
    pub strength: Option<String>,
    pub unit: Option<String>,
    pub hsn_code: Option<String>,
    pub gst_rate: Option<f64>,
    pub is_controlled: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Group-level test master entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupTestMaster {
    pub id: Uuid,
    pub group_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: Option<String>,
    pub department: Option<String>,
    pub loinc_code: Option<String>,
    pub sample_type: Option<String>,
    pub container_type: Option<String>,
    pub volume_required: Option<String>,
    pub tat_hours: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Group-level tariff master entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupTariffMaster {
    pub id: Uuid,
    pub group_id: Uuid,
    pub service_code: String,
    pub service_name: String,
    pub category: Option<String>,
    pub base_price: f64,
    pub gst_applicable: bool,
    pub gst_rate: Option<f64>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Hospital-level price override
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HospitalPriceOverride {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub group_tariff_id: Uuid,
    pub override_price: f64,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub reason: Option<String>,
    pub approved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ── Group Templates ────────────────────────────────────────────────────────

/// Group-level template (consent forms, SOPs, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupTemplate {
    pub id: Uuid,
    pub group_id: Uuid,
    pub template_type: String,
    pub code: String,
    pub name: String,
    pub content: serde_json::Value,
    pub version: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create group template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupTemplate {
    pub template_type: String,
    pub code: String,
    pub name: String,
    pub content: serde_json::Value,
}
