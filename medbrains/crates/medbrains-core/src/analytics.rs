//! Clinical & operational analytics domain types.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Query Parameters ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub report: String,
    pub format: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
}

// ── Revenue ───────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct DeptRevenueRow {
    pub department_name: String,
    pub revenue: f64,
    pub invoice_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DoctorRevenueRow {
    pub doctor_name: String,
    pub department_name: String,
    pub revenue: f64,
    pub patient_count: i64,
}

// ── IPD ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct IpdCensusRow {
    pub date: NaiveDate,
    pub admissions: i64,
    pub discharges: i64,
    pub deaths: i64,
    pub active: i64,
}

// ── Lab ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct LabTatRow {
    pub test_name: String,
    pub order_count: i64,
    pub avg_tat_mins: f64,
    pub p90_tat_mins: f64,
    pub min_tat_mins: f64,
    pub max_tat_mins: f64,
}

// ── Pharmacy ──────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct PharmacySalesRow {
    pub drug_name: String,
    pub category: Option<String>,
    pub quantity_sold: i64,
    pub total_revenue: f64,
}

// ── Operation Theatre ─────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct OtUtilizationRow {
    pub room_name: String,
    pub total_bookings: i64,
    pub completed: i64,
    pub cancelled: i64,
    pub avg_duration_mins: f64,
    pub utilization_pct: f64,
}

// ── Emergency ─────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ErVolumeRow {
    pub date: NaiveDate,
    pub total_visits: i64,
    pub immediate: i64,
    pub emergent: i64,
    pub urgent: i64,
    pub less_urgent: i64,
    pub non_urgent: i64,
    pub avg_door_to_doctor_mins: f64,
}

// ── Clinical Indicators ───────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ClinicalIndicatorRow {
    pub period: String,
    pub mortality_rate: f64,
    pub infection_rate: f64,
    pub readmission_rate: f64,
    pub avg_los_days: f64,
}

// ── OPD ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct OpdFootfallRow {
    pub date: NaiveDate,
    pub department_name: String,
    pub visit_count: i64,
    pub new_patients: i64,
    pub follow_ups: i64,
}

// ── Bed Occupancy ─────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct BedOccupancyRow {
    pub ward_name: String,
    pub total_beds: i64,
    pub occupied: i64,
    pub vacant: i64,
    pub occupancy_pct: f64,
}
