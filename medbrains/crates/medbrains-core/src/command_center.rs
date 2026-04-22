//! Command Center domain types — patient flow, department load, alerts, transport, KPIs.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Patient Flow ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PatientFlowSnapshot {
    pub registered_today: i64,
    pub opd_waiting: i64,
    pub opd_in_consult: i64,
    pub er_active: i64,
    pub ipd_admitted: i64,
    pub pending_discharge: i64,
    pub discharged_today: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct HourlyFlowRow {
    pub hour: i32,
    pub admissions: i64,
    pub discharges: i64,
    pub er_arrivals: i64,
    pub opd_visits: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BottleneckRow {
    pub area: String,
    pub metric: String,
    pub current_value: f64,
    pub threshold: f64,
    pub severity: String,
}

// ── Department Load ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DepartmentLoadRow {
    pub department_id: Uuid,
    pub department_name: String,
    pub bed_total: i64,
    pub bed_occupied: i64,
    pub occupancy_pct: f64,
    pub queue_depth: i64,
    pub avg_wait_mins: f64,
}

// ── Alerts ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DepartmentAlertRow {
    pub id: Uuid,
    pub department_id: Uuid,
    pub department_name: String,
    pub alert_level: String,
    pub metric_code: String,
    pub current_value: Decimal,
    pub threshold_value: Decimal,
    pub message: String,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AlertThresholdRow {
    pub id: Uuid,
    pub department_id: Uuid,
    pub department_name: String,
    pub metric_code: String,
    pub warning_threshold: Option<Decimal>,
    pub critical_threshold: Option<Decimal>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateAlertThresholdRequest {
    pub department_id: Uuid,
    pub metric_code: String,
    pub warning_threshold: Option<f64>,
    pub critical_threshold: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAlertThresholdRequest {
    pub warning_threshold: Option<f64>,
    pub critical_threshold: Option<f64>,
    pub is_active: Option<bool>,
}

// ── Discharge Coordinator ───────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PendingDischargeRow {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub ward_name: String,
    pub bed_code: String,
    pub doctor_name: String,
    pub admitted_at: DateTime<Utc>,
    pub expected_discharge_date: Option<NaiveDate>,
    pub days_admitted: i32,
    pub pending_labs: i64,
    pub pending_billing: bool,
    pub summary_draft: bool,
    pub checklist_pending: i64,
}

// ── Bed Turnaround / Environmental Services ─────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BedTurnaroundRow {
    pub location_id: Uuid,
    pub location_code: String,
    pub ward_name: String,
    pub status: String,
    pub discharge_at: Option<DateTime<Utc>>,
    pub cleaning_started_at: Option<DateTime<Utc>>,
    pub cleaning_completed_at: Option<DateTime<Utc>>,
    pub turnaround_minutes: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TurnaroundStatsRow {
    pub ward_name: String,
    pub avg_turnaround_mins: f64,
    pub max_turnaround_mins: i32,
    pub beds_awaiting_cleaning: i64,
    pub beds_being_cleaned: i64,
}

// ── Transport ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TransportRequestRow {
    pub id: Uuid,
    pub patient_name: Option<String>,
    pub from_location: Option<String>,
    pub to_location: Option<String>,
    pub transport_mode: String,
    pub status: String,
    pub priority: String,
    pub requested_by_name: String,
    pub assigned_to_name: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub assigned_at: Option<DateTime<Utc>>,
    pub picked_up_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransportRequest {
    pub patient_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub from_location_id: Option<Uuid>,
    pub to_location_id: Option<Uuid>,
    pub transport_mode: String,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransportRequest {
    pub transport_mode: Option<String>,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignTransportRequest {
    pub assigned_to: Uuid,
}

// ── KPIs ────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct KpiTile {
    pub code: String,
    pub label: String,
    pub value: f64,
    pub unit: String,
    pub trend: Option<f64>,
    pub period: String,
}
