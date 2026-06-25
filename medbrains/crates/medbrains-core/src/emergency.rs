//! Emergency module domain types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Enums ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "triage_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TriageLevel {
    Immediate,
    Emergent,
    Urgent,
    LessUrgent,
    NonUrgent,
    Expectant,
    Unassigned,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "er_visit_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ErVisitStatus {
    Registered,
    Triaged,
    InTreatment,
    Observation,
    Admitted,
    Discharged,
    Transferred,
    Lama,
    Deceased,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "mlc_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MlcStatus {
    Registered,
    UnderInvestigation,
    OpinionGiven,
    CourtPending,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "mass_casualty_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MassCasualtyStatus {
    Activated,
    Ongoing,
    ScalingDown,
    Deactivated,
}

// ── Structs ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErVisit {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub visit_number: String,
    pub status: ErVisitStatus,
    pub arrival_mode: Option<String>,
    pub arrival_time: DateTime<Utc>,
    pub chief_complaint: Option<String>,
    pub is_mlc: bool,
    pub is_brought_dead: bool,
    pub triage_level: Option<TriageLevel>,
    pub attending_doctor_id: Option<Uuid>,
    pub bay_number: Option<String>,
    pub disposition: Option<String>,
    pub disposition_time: Option<DateTime<Utc>>,
    pub disposition_notes: Option<String>,
    pub admitted_to: Option<String>,
    pub admission_id: Option<Uuid>,
    pub door_to_doctor_mins: Option<i32>,
    pub door_to_disposition_mins: Option<i32>,
    pub vitals: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub mass_casualty_event_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErTriageAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Uuid,
    pub triage_level: TriageLevel,
    pub triage_system: String,
    pub score: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub pulse_rate: Option<i32>,
    pub blood_pressure_systolic: Option<i32>,
    pub blood_pressure_diastolic: Option<i32>,
    pub spo2: Option<i32>,
    pub gcs_score: Option<i32>,
    pub gcs_eye: Option<i32>,
    pub gcs_verbal: Option<i32>,
    pub gcs_motor: Option<i32>,
    pub pain_score: Option<i32>,
    pub chief_complaint: Option<String>,
    pub presenting_symptoms: Option<serde_json::Value>,
    pub allergies: Option<serde_json::Value>,
    pub is_pregnant: Option<bool>,
    pub disability_assessment: Option<String>,
    pub notes: Option<String>,
    pub assessed_by: Option<Uuid>,
    pub assessed_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErResuscitationLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Uuid,
    pub log_type: String,
    pub timestamp: DateTime<Utc>,
    pub medication_name: Option<String>,
    pub dose: Option<String>,
    pub route: Option<String>,
    pub fluid_name: Option<String>,
    pub fluid_volume_ml: Option<i32>,
    pub procedure_name: Option<String>,
    pub procedure_notes: Option<String>,
    pub vitals_snapshot: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErCodeActivation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Option<Uuid>,
    pub code_type: String,
    pub activated_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub location: Option<String>,
    pub response_team: Option<serde_json::Value>,
    pub crash_cart_checklist: Option<serde_json::Value>,
    pub outcome: Option<String>,
    pub notes: Option<String>,
    pub activated_by: Option<Uuid>,
    pub deactivated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MlcCase {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub mlc_number: String,
    pub status: MlcStatus,
    pub case_type: Option<String>,
    pub fir_number: Option<String>,
    pub police_station: Option<String>,
    pub brought_by: Option<String>,
    pub informant_name: Option<String>,
    pub informant_relation: Option<String>,
    pub informant_contact: Option<String>,
    pub history_of_incident: Option<String>,
    pub examination_findings: Option<String>,
    pub medical_opinion: Option<String>,
    pub is_pocso: bool,
    pub is_death_case: bool,
    pub cause_of_death: Option<String>,
    pub registered_by: Option<Uuid>,
    pub registered_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MlcDocument {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub mlc_case_id: Uuid,
    pub document_type: String,
    pub title: String,
    pub body_diagram: Option<serde_json::Value>,
    pub content: serde_json::Value,
    pub generated_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MlcPoliceIntimation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub mlc_case_id: Uuid,
    pub intimation_number: String,
    pub police_station: String,
    pub officer_name: Option<String>,
    pub officer_designation: Option<String>,
    pub officer_contact: Option<String>,
    pub sent_at: DateTime<Utc>,
    pub sent_via: Option<String>,
    pub receipt_confirmed: bool,
    pub receipt_confirmed_at: Option<DateTime<Utc>>,
    pub receipt_number: Option<String>,
    pub notes: Option<String>,
    pub sent_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MassCasualtyEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub event_name: String,
    pub event_type: Option<String>,
    pub status: MassCasualtyStatus,
    pub activated_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub location: Option<String>,
    pub estimated_casualties: Option<i32>,
    pub actual_casualties: Option<i32>,
    pub triage_summary: Option<serde_json::Value>,
    pub resources_deployed: Option<serde_json::Value>,
    pub notifications_sent: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub activated_by: Option<Uuid>,
    pub deactivated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Structured ER discharge summary (one per visit, draft → finalized).
/// Mirrors the IPD discharge summary; ER is acute and not encounter/
/// diagnosis-backed, so the clinical fields are free text.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErDischargeSummary {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Uuid,
    pub status: crate::ipd::DischargeSummaryStatus,
    pub final_diagnosis: Option<String>,
    pub condition_at_discharge: Option<String>,
    pub clinical_course: Option<String>,
    pub treatment_given: Option<String>,
    pub medications_on_discharge: Option<String>,
    pub follow_up_instructions: Option<String>,
    pub follow_up_date: Option<chrono::NaiveDate>,
    pub warning_signs: Option<String>,
    pub prepared_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub finalized_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One timestamped ER observation-chart entry — serial vitals + note
/// while a patient is held under observation before disposition.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErObservationNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub er_visit_id: Uuid,
    pub observed_at: DateTime<Utc>,
    pub pulse: Option<i32>,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub resp_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<f64>,
    pub gcs: Option<i32>,
    pub pain_score: Option<i32>,
    pub note: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Configurable ER bay (master). Visits reference a bay by `code`; the
/// occupancy board is computed from active visits.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErBay {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub bay_type: Option<String>,
    pub is_active: bool,
    pub sort_order: i32,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
