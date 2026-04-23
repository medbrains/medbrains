//! OPD Appointment domain types — schedules, slots, and bookings.

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ─────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "appointment_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AppointmentStatus {
    Scheduled,
    Confirmed,
    CheckedIn,
    InConsultation,
    Completed,
    Cancelled,
    NoShow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "appointment_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AppointmentType {
    NewVisit,
    FollowUp,
    Consultation,
    Procedure,
    WalkIn,
}

// ── Doctor Schedule ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DoctorSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub day_of_week: i32,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub slot_duration_mins: i32,
    pub max_patients: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Doctor Schedule Exception ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DoctorScheduleException {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub exception_date: NaiveDate,
    pub is_available: bool,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Appointment ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Appointment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
    pub appointment_type: AppointmentType,
    pub status: AppointmentStatus,
    pub token_number: Option<i32>,
    pub reason: Option<String>,
    pub cancel_reason: Option<String>,
    pub notes: Option<String>,
    pub encounter_id: Option<Uuid>,
    pub checked_in_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub recurrence_pattern: Option<String>,
    pub recurrence_group_id: Option<Uuid>,
    pub recurrence_index: Option<i32>,
    pub appointment_group_id: Option<Uuid>,
    pub booking_source: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Slot (computed, not stored) ───────────────────────────

/// A computed time slot for display — derived from `DoctorSchedule`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableSlot {
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub booked_count: i64,
    pub max_patients: i32,
    pub is_available: bool,
}
