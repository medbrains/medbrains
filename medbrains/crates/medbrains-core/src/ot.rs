use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ot_booking_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OtBookingStatus {
    Requested,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
    Postponed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ot_case_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OtCasePriority {
    Elective,
    Urgent,
    Emergency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "anesthesia_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AnesthesiaType {
    General,
    Spinal,
    Epidural,
    RegionalBlock,
    Local,
    Sedation,
    Combined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "asa_classification", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AsaClassification {
    Asa1,
    Asa2,
    Asa3,
    Asa4,
    Asa5,
    Asa6,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "checklist_phase", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ChecklistPhase {
    SignIn,
    TimeOut,
    SignOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ot_room_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OtRoomStatus {
    Available,
    InUse,
    Cleaning,
    Maintenance,
    Reserved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "preop_clearance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PreopClearanceStatus {
    Pending,
    Cleared,
    NotCleared,
    Conditional,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "postop_recovery_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PostopRecoveryStatus {
    InRecovery,
    Stable,
    ShiftedToWard,
    ShiftedToIcu,
    Discharged,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtRoom {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Option<Uuid>,
    pub name: String,
    pub code: String,
    pub status: OtRoomStatus,
    pub specialties: serde_json::Value,
    pub equipment: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtBooking {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub ot_room_id: Uuid,
    pub primary_surgeon_id: Uuid,
    pub anesthetist_id: Option<Uuid>,
    pub scheduled_date: NaiveDate,
    pub scheduled_start: DateTime<Utc>,
    pub scheduled_end: DateTime<Utc>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub procedure_name: String,
    pub procedure_code: Option<String>,
    pub laterality: Option<String>,
    pub priority: OtCasePriority,
    pub status: OtBookingStatus,
    pub consent_obtained: bool,
    pub site_marked: bool,
    pub blood_arranged: bool,
    pub assistant_surgeons: serde_json::Value,
    pub scrub_nurses: serde_json::Value,
    pub circulating_nurses: serde_json::Value,
    pub estimated_duration_min: Option<i32>,
    pub cancellation_reason: Option<String>,
    pub postpone_reason: Option<String>,
    pub actual_start_time: Option<DateTime<Utc>>,
    pub actual_end_time: Option<DateTime<Utc>>,
    pub turnaround_minutes: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// OT → PACU / ward post-op handoff (nursing transfer of care after surgery).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtPostopHandoff {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub items: serde_json::Value,
    pub handed_off_by: Option<Uuid>,
    pub received_by: Option<Uuid>,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Ward → OT pre-op send-off handoff (nursing transfer of care before surgery).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtPreopHandoff {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub items: serde_json::Value,
    pub handed_off_by: Option<Uuid>,
    pub received_by: Option<Uuid>,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtPreopAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub clearance_status: PreopClearanceStatus,
    pub asa_class: Option<AsaClassification>,
    pub airway_assessment: serde_json::Value,
    pub cardiac_assessment: serde_json::Value,
    pub pulmonary_assessment: serde_json::Value,
    pub lab_results_reviewed: bool,
    pub imaging_reviewed: bool,
    pub blood_group_confirmed: bool,
    pub fasting_status: bool,
    pub npo_since: Option<DateTime<Utc>>,
    pub allergies_noted: Option<String>,
    pub current_medications: Option<String>,
    pub conditions: Option<String>,
    pub assessed_by: Uuid,
    pub assessed_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtSurgicalSafetyChecklist {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub phase: ChecklistPhase,
    pub items: serde_json::Value,
    pub completed: bool,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub verified_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtCaseRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub surgeon_id: Uuid,
    pub patient_in_time: Option<DateTime<Utc>>,
    pub patient_out_time: Option<DateTime<Utc>>,
    pub incision_time: Option<DateTime<Utc>>,
    pub closure_time: Option<DateTime<Utc>>,
    pub procedure_performed: String,
    pub findings: Option<String>,
    pub technique: Option<String>,
    pub complications: Option<String>,
    pub blood_loss_ml: Option<i32>,
    pub specimens: serde_json::Value,
    pub implants: serde_json::Value,
    pub drains: serde_json::Value,
    pub instrument_count_correct_before: Option<bool>,
    pub instrument_count_correct_after: Option<bool>,
    pub sponge_count_correct: Option<bool>,
    pub cssd_issuance_ids: serde_json::Value,
    pub surgical_site_infection: bool,
    pub ssi_detected_at: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtAnesthesiaRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub anesthetist_id: Uuid,
    pub anesthesia_type: AnesthesiaType,
    pub asa_class: Option<AsaClassification>,
    pub induction_time: Option<DateTime<Utc>>,
    pub intubation_time: Option<DateTime<Utc>>,
    pub extubation_time: Option<DateTime<Utc>>,
    pub airway_details: serde_json::Value,
    pub drugs_administered: serde_json::Value,
    pub monitoring_events: serde_json::Value,
    pub fluids_given: serde_json::Value,
    pub blood_products: serde_json::Value,
    pub adverse_events: serde_json::Value,
    pub complications: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtPostopRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub booking_id: Uuid,
    pub destination_bed_id: Option<Uuid>,
    pub recovery_status: PostopRecoveryStatus,
    pub arrival_time: Option<DateTime<Utc>>,
    pub discharge_time: Option<DateTime<Utc>>,
    pub aldrete_score_arrival: Option<i32>,
    pub aldrete_score_discharge: Option<i32>,
    pub vitals_on_arrival: serde_json::Value,
    pub monitoring_entries: serde_json::Value,
    pub pain_assessment: Option<String>,
    pub fluid_orders: Option<String>,
    pub diet_orders: Option<String>,
    pub activity_orders: Option<String>,
    pub disposition: Option<String>,
    pub postop_orders: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OtSurgeonPreference {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub surgeon_id: Uuid,
    pub procedure_name: String,
    pub position: Option<String>,
    pub skin_prep: Option<String>,
    pub draping: Option<String>,
    pub instruments: serde_json::Value,
    pub sutures: serde_json::Value,
    pub implants: serde_json::Value,
    pub equipment: serde_json::Value,
    pub medications: serde_json::Value,
    pub special_instructions: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
