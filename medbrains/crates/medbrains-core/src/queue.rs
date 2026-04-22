//! Queue management types for TV displays, OPD, Lab, Pharmacy, and other queues.
//!
//! This module provides types for:
//! - Token generation and tracking
//! - Queue status displays
//! - TV announcements
//! - Priority handling

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Token Priority ─────────────────────────────────────────────────────────

/// Queue token priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "queue_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum QueuePriority {
    #[default]
    Normal,
    Elderly,
    Pregnant,
    Disabled,
    Pediatric,
    Emergency,
    Vip,
}

// ── Token Status ───────────────────────────────────────────────────────────

/// Queue token status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TokenStatus {
    #[default]
    Waiting,
    Called,
    InProgress,
    Completed,
    NoShow,
    Cancelled,
}

// ── Queue Token ────────────────────────────────────────────────────────────

/// A single queue token
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QueueToken {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub token_date: NaiveDate,
    pub token_seq: i32,
    pub token_number: String,
    pub patient_id: Option<Uuid>,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub status: String,
    pub priority: QueuePriority,
    pub called_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Queue token with patient/doctor names for display
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QueueTokenDisplay {
    pub id: Uuid,
    pub token_number: String,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub department_id: Uuid,
    pub department_name: String,
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub room_number: Option<String>,
    pub status: String,
    pub priority: QueuePriority,
    pub called_at: Option<DateTime<Utc>>,
    pub wait_time_minutes: Option<i32>,
}

/// Create a new queue token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateQueueToken {
    pub patient_id: Option<Uuid>,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub priority: Option<QueuePriority>,
    pub encounter_id: Option<Uuid>,
}

/// Update token status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTokenStatus {
    pub status: TokenStatus,
}

// ── Queue Display Data ─────────────────────────────────────────────────────

/// Queue display data for TV screens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueDisplayData {
    pub department_id: Uuid,
    pub department_name: String,
    pub current_token: Option<QueueTokenDisplay>,
    pub next_tokens: Vec<QueueTokenDisplay>,
    pub waiting_count: i32,
    pub completed_count: i32,
    pub avg_wait_minutes: i32,
    pub updated_at: DateTime<Utc>,
}

/// OPD queue display for a single doctor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorQueueDisplay {
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub room_number: Option<String>,
    pub current_token: Option<QueueTokenDisplay>,
    pub next_tokens: Vec<QueueTokenDisplay>,
    pub waiting_count: i32,
    pub is_on_break: bool,
    pub break_message: Option<String>,
}

/// Multi-doctor display for OPD area
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiDoctorQueueDisplay {
    pub department_id: Uuid,
    pub department_name: String,
    pub doctors: Vec<DoctorQueueDisplay>,
    pub total_waiting: i32,
    pub updated_at: DateTime<Utc>,
}

// ── Pharmacy Queue ─────────────────────────────────────────────────────────

/// Pharmacy token with prescription details
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PharmacyQueueToken {
    pub id: Uuid,
    pub token_number: String,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub prescription_count: i32,
    pub status: String,
    pub counter_number: Option<i32>,
    pub estimated_wait_minutes: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Pharmacy queue display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacyQueueDisplay {
    pub current_token: Option<PharmacyQueueToken>,
    pub preparing: Vec<PharmacyQueueToken>,
    pub ready_for_pickup: Vec<PharmacyQueueToken>,
    pub waiting: Vec<PharmacyQueueToken>,
    pub stats: PharmacyQueueStats,
    pub updated_at: DateTime<Utc>,
}

/// Pharmacy queue statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacyQueueStats {
    pub waiting_count: i32,
    pub preparing_count: i32,
    pub ready_count: i32,
    pub dispensed_today: i32,
    pub avg_wait_minutes: i32,
}

// ── Lab Queue ──────────────────────────────────────────────────────────────

/// Lab sample collection queue token
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LabQueueToken {
    pub id: Uuid,
    pub token_number: String,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub test_count: i32,
    pub is_fasting: bool,
    pub is_pediatric: bool,
    pub status: String,
    pub counter_number: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Lab queue display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabQueueDisplay {
    pub current_tokens: Vec<LabQueueToken>,
    pub waiting: Vec<LabQueueToken>,
    pub collection_in_progress: Vec<LabQueueToken>,
    pub stats: LabQueueStats,
    pub updated_at: DateTime<Utc>,
}

/// Lab queue statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabQueueStats {
    pub waiting_count: i32,
    pub collected_today: i32,
    pub avg_wait_minutes: i32,
    pub counters_active: i32,
}

// ── Radiology Queue ────────────────────────────────────────────────────────

/// Radiology queue token
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RadiologyQueueToken {
    pub id: Uuid,
    pub token_number: String,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub modality: String,
    pub room_number: String,
    pub status: String,
    pub preparation_instructions: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Radiology queue display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiologyQueueDisplay {
    pub modality: String,
    pub room_number: String,
    pub current_token: Option<RadiologyQueueToken>,
    pub waiting: Vec<RadiologyQueueToken>,
    pub stats: RadiologyQueueStats,
    pub updated_at: DateTime<Utc>,
}

/// Radiology queue statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiologyQueueStats {
    pub waiting_count: i32,
    pub completed_today: i32,
    pub avg_scan_minutes: i32,
}

// ── ER Triage Queue ────────────────────────────────────────────────────────

/// ER triage levels per Manchester/ATS
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriageLevel {
    Red,      // Immediate (0 min)
    Orange,   // Very urgent (10 min)
    Yellow,   // Urgent (60 min)
    Green,    // Standard (120 min)
    Blue,     // Non-urgent (240 min)
}

/// ER triage queue token (privacy-safe - no names on display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErTriageToken {
    pub token_number: String,
    pub triage_level: TriageLevel,
    pub waiting_minutes: i32,
    pub target_wait_minutes: i32,
    pub is_overdue: bool,
}

/// ER queue display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErQueueDisplay {
    pub tokens_by_level: ErTokensByLevel,
    pub resuscitation_bays_available: i32,
    pub total_waiting: i32,
    pub updated_at: DateTime<Utc>,
}

/// ER tokens grouped by triage level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErTokensByLevel {
    pub red: Vec<ErTriageToken>,
    pub orange: Vec<ErTriageToken>,
    pub yellow: Vec<ErTriageToken>,
    pub green: Vec<ErTriageToken>,
    pub blue: Vec<ErTriageToken>,
}

// ── Billing Queue ──────────────────────────────────────────────────────────

/// Billing queue token
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BillingQueueToken {
    pub id: Uuid,
    pub token_number: String,
    pub patient_name: String,
    pub queue_type: String,
    pub counter_number: Option<i32>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Billing queue display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingQueueDisplay {
    pub opd_billing: Vec<BillingQueueToken>,
    pub ipd_discharge: Vec<BillingQueueToken>,
    pub advance_deposit: Vec<BillingQueueToken>,
    pub insurance_desk: Vec<BillingQueueToken>,
    pub updated_at: DateTime<Utc>,
}

// ── Bed Waiting List ───────────────────────────────────────────────────────

/// IPD bed waiting entry
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BedWaitingEntry {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub ward_type: String,
    pub priority: String,
    pub wait_time_minutes: i32,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Bed availability display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BedAvailabilityDisplay {
    pub ward_type: String,
    pub total_beds: i32,
    pub occupied: i32,
    pub available: i32,
    pub waiting_list: Vec<BedWaitingEntry>,
    pub updated_at: DateTime<Utc>,
}

// ── TV Announcements ───────────────────────────────────────────────────────

/// Announcement priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AnnouncementPriority {
    #[default]
    Info,
    Warning,
    Emergency,
}

/// TV announcement
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TvAnnouncement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub message: String,
    pub priority: AnnouncementPriority,
    pub display_ids: Option<Vec<Uuid>>,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Create announcement request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAnnouncement {
    pub message: String,
    pub priority: Option<AnnouncementPriority>,
    pub display_ids: Option<Vec<Uuid>>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
}

// ── TV Display Configuration ───────────────────────────────────────────────

/// TV display types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisplayType {
    OpdQueue,
    LabQueue,
    PharmacyQueue,
    RadiologyQueue,
    ErTriage,
    BillingQueue,
    BedStatus,
    DoctorSchedule,
    Signage,
    Emergency,
}

/// TV display configuration
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TvDisplayConfig {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub display_type: String,
    pub location: String,
    pub department_id: Option<Uuid>,
    pub doctor_ids: Option<Vec<Uuid>>,
    pub settings: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

// ── Queue Analytics ────────────────────────────────────────────────────────

/// Queue analytics summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueAnalytics {
    pub department_id: Uuid,
    pub department_name: String,
    pub date: NaiveDate,
    pub total_tokens: i32,
    pub completed: i32,
    pub no_shows: i32,
    pub avg_wait_minutes: i32,
    pub peak_hour: i32,
    pub peak_hour_count: i32,
}

/// Real-time queue metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMetrics {
    pub department_id: Uuid,
    pub current_waiting: i32,
    pub avg_wait_minutes: i32,
    pub throughput_per_hour: f32,
    pub estimated_wait_new_token: i32,
}

// ── Doctor Controls ────────────────────────────────────────────────────────

/// Doctor queue control actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum DoctorQueueAction {
    CallNext,
    Recall { token_id: Uuid },
    Skip { token_id: Uuid, reason: Option<String> },
    Hold { token_id: Uuid },
    Transfer { token_id: Uuid, to_doctor_id: Uuid },
    CallSpecific { token_id: Uuid },
    SetBreak { message: String, resume_at: Option<DateTime<Utc>> },
    EndBreak,
}

/// Doctor queue action result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorQueueActionResult {
    pub success: bool,
    pub token: Option<QueueTokenDisplay>,
    pub message: Option<String>,
}
