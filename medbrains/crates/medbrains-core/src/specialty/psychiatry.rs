use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "psych_admission_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PsychAdmissionCategory {
    Independent,
    Supported,
    MinorSupported,
    Emergency,
    /// MHCA s.90 — supported admission beyond 30 days, on Board permission.
    SupportedExtended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ect_laterality", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EctLaterality {
    Bilateral,
    RightUnilateral,
    LeftUnilateral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "restraint_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RestraintType {
    Physical,
    Chemical,
    Seclusion,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychPatient {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_category: PsychAdmissionCategory,
    pub substance_abuse_flag: bool,
    pub is_restricted: bool,
    pub treating_psychiatrist_id: Option<Uuid>,
    pub notes: Option<String>,
    /// When the patient consented to share mental-health records via ABDM.
    pub abdm_mh_share_consented_at: Option<DateTime<Utc>>,
    pub abdm_mh_share_consented_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub assessment_type: String,
    pub mental_status_exam: serde_json::Value,
    pub ham_d_score: Option<i32>,
    pub bprs_score: Option<i32>,
    pub gaf_score: Option<i32>,
    pub risk_assessment: serde_json::Value,
    pub assessed_by: Uuid,
    pub assessed_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychEctRegister {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub session_number: i32,
    pub consent_obtained: bool,
    pub laterality: EctLaterality,
    pub stimulus_dose: Option<rust_decimal::Decimal>,
    pub seizure_duration_sec: Option<i32>,
    pub anesthetic: Option<String>,
    pub muscle_relaxant: Option<String>,
    pub performed_by: Uuid,
    pub anesthetist_id: Option<Uuid>,
    pub session_date: DateTime<Utc>,
    pub complications: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// MHCA s.95(2): the Board's prior permission for ECT on a minor.
    pub board_permission_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychSeclusionRestraint {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub restraint_type: RestraintType,
    pub reason: String,
    pub start_time: DateTime<Utc>,
    pub review_due_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub ordered_by: Uuid,
    pub released_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// MHCA s.97(1)(b): the psychiatrist in charge who authorised it.
    pub authorised_by: Option<Uuid>,
    /// s.97(3): method and nature of the restraint.
    pub method: Option<String>,
    /// s.97(1)(a)/(4): only means to prevent imminent harm; not punishment,
    /// not for want of staff.
    pub last_resort_confirmed: bool,
    /// s.97(5): the nominated representative is told within 24 hours.
    pub nominated_rep_informed_at: Option<DateTime<Utc>>,
    pub nominated_rep_informed_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychMhrbNotification {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub notification_type: String,
    pub reference_number: Option<String>,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychCounselingSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub session_type: String,
    pub therapist_id: Uuid,
    pub modality: Option<String>,
    pub duration_minutes: Option<i32>,
    pub outcome_rating: Option<i32>,
    pub session_date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One Mental Healthcare Act admission episode.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychAdmission {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub category: PsychAdmissionCategory,
    pub admitted_at: DateTime<Utc>,
    pub applicant: String,
    pub criteria: Vec<String>,
    pub least_restrictive_certified: bool,
    pub needs_high_support: bool,
    pub capacity_note: Option<String>,
    pub examiner1_id: Option<Uuid>,
    pub examiner1_role: Option<String>,
    pub examiner1_examined_at: Option<DateTime<Utc>>,
    pub examiner2_id: Option<Uuid>,
    pub examiner2_role: Option<String>,
    pub examiner2_examined_at: Option<DateTime<Utc>>,
    pub extension_number: i32,
    pub period_ends_at: Option<DateTime<Utc>>,
    pub minor_safeguards_confirmed: bool,
    pub board_report_due_at: Option<DateTime<Utc>>,
    pub board_reported_at: Option<DateTime<Utc>>,
    pub board_reference: Option<String>,
    pub board_decision_due_at: Option<DateTime<Utc>>,
    pub board_decision: Option<String>,
    pub board_decided_at: Option<DateTime<Utc>>,
    pub discharged_at: Option<DateTime<Utc>>,
    pub discharge_note: Option<String>,
    pub admitted_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// MHCA s.14 nominated representative.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychNominatedRepresentative {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub full_name: String,
    pub relationship: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub basis: String,
    pub written_consent_received: bool,
    pub appointment_document_ref: Option<String>,
    pub appointed_on: Option<chrono::NaiveDate>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// MHCA s.5 advance directive.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychAdvanceDirective {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub made_on: Option<chrono::NaiveDate>,
    pub made_by: String,
    pub treatment_wishes: Option<String>,
    pub treatment_refusals: Option<String>,
    pub representative_preferences: Option<String>,
    pub document_ref: Option<String>,
    pub status: String,
    pub revoked_at: Option<DateTime<Utc>>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// MHCA s.11 application to the Board against an advance directive.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychDirectiveChallenge {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub advance_directive_id: Uuid,
    pub applicant_role: String,
    pub grounds: Vec<String>,
    pub details: String,
    pub status: String,
    pub board_reference: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub decision_note: Option<String>,
    pub filed_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A scored PHQ-9 or GAD-7, item by item.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PsychScreening {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub psych_patient_id: Uuid,
    pub instrument: String,
    pub answers: Vec<i16>,
    pub total: i32,
    pub severity: String,
    pub item9_positive: bool,
    pub administered_by: Uuid,
    pub administered_at: DateTime<Utc>,
    pub safety_review_status: String,
    pub safety_reviewed_by: Option<Uuid>,
    pub safety_reviewed_at: Option<DateTime<Utc>>,
    pub safety_review_outcome: Option<String>,
    pub safety_review_note: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
