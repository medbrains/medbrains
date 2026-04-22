use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceType {
    Bls,
    Als,
    PatientTransport,
    Mortuary,
    Neonatal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceStatus {
    Available,
    OnTrip,
    Maintenance,
    OffDuty,
    Decommissioned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_trip_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceTripType {
    Emergency,
    Scheduled,
    InterFacility,
    Discharge,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_trip_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceTripStatus {
    Requested,
    Dispatched,
    EnRoutePickup,
    AtPickup,
    EnRouteDrop,
    AtDrop,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_trip_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceTripPriority {
    Critical,
    Urgent,
    Routine,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ambulance_maintenance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AmbulanceMaintenanceStatus {
    Scheduled,
    InProgress,
    Completed,
    Overdue,
    Cancelled,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Ambulance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub vehicle_number: String,
    pub ambulance_code: String,
    pub ambulance_type: AmbulanceType,
    pub status: AmbulanceStatus,
    pub make: Option<String>,
    pub model: Option<String>,
    pub year_of_manufacture: Option<i32>,
    pub chassis_number: Option<String>,
    pub engine_number: Option<String>,
    pub fitness_certificate_expiry: Option<NaiveDate>,
    pub insurance_expiry: Option<NaiveDate>,
    pub pollution_certificate_expiry: Option<NaiveDate>,
    pub permit_expiry: Option<NaiveDate>,
    pub equipment_checklist: Option<serde_json::Value>,
    pub has_ventilator: bool,
    pub has_defibrillator: bool,
    pub has_oxygen: bool,
    pub seating_capacity: Option<i32>,
    pub gps_device_id: Option<String>,
    pub last_latitude: Option<f64>,
    pub last_longitude: Option<f64>,
    pub last_location_at: Option<DateTime<Utc>>,
    pub default_driver_id: Option<Uuid>,
    pub current_driver_id: Option<Uuid>,
    pub odometer_km: Option<i32>,
    pub fuel_type: Option<String>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AmbulanceDriver {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub license_number: String,
    pub license_type: String,
    pub license_expiry: NaiveDate,
    pub is_active: bool,
    pub bls_certified: bool,
    pub bls_expiry: Option<NaiveDate>,
    pub defensive_driving: bool,
    pub shift_pattern: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AmbulanceTrip {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub trip_code: String,
    pub ambulance_id: Option<Uuid>,
    pub driver_id: Option<Uuid>,
    pub trip_type: AmbulanceTripType,
    pub status: AmbulanceTripStatus,
    pub priority: AmbulanceTripPriority,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub pickup_address: String,
    pub pickup_latitude: Option<f64>,
    pub pickup_longitude: Option<f64>,
    pub pickup_landmark: Option<String>,
    pub drop_address: Option<String>,
    pub drop_latitude: Option<f64>,
    pub drop_longitude: Option<f64>,
    pub drop_landmark: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub dispatched_at: Option<DateTime<Utc>>,
    pub pickup_arrived_at: Option<DateTime<Utc>>,
    pub patient_loaded_at: Option<DateTime<Utc>>,
    pub drop_arrived_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub vitals_at_pickup: Option<serde_json::Value>,
    pub vitals_at_drop: Option<serde_json::Value>,
    pub clinical_notes: Option<String>,
    pub oxygen_administered: Option<bool>,
    pub iv_started: Option<bool>,
    pub odometer_start: Option<i32>,
    pub odometer_end: Option<i32>,
    pub distance_km: Option<Decimal>,
    pub cancellation_reason: Option<String>,
    pub is_billable: bool,
    pub base_charge: Option<Decimal>,
    pub per_km_charge: Option<Decimal>,
    pub total_amount: Option<Decimal>,
    pub billing_invoice_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
    pub transport_request_id: Option<Uuid>,
    pub requested_by: Option<Uuid>,
    pub dispatched_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AmbulanceTripLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub trip_id: Uuid,
    pub event_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub speed_kmh: Option<Decimal>,
    pub heading: Option<Decimal>,
    pub event_data: Option<serde_json::Value>,
    pub recorded_by: Option<Uuid>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AmbulanceMaintenance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub ambulance_id: Uuid,
    pub maintenance_type: String,
    pub status: AmbulanceMaintenanceStatus,
    pub scheduled_date: NaiveDate,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub description: Option<String>,
    pub vendor_name: Option<String>,
    pub cost: Option<Decimal>,
    pub odometer_at_service: Option<i32>,
    pub next_service_km: Option<i32>,
    pub next_service_date: Option<NaiveDate>,
    pub findings: Option<String>,
    pub parts_replaced: Option<serde_json::Value>,
    pub performed_by: Option<String>,
    pub approved_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
