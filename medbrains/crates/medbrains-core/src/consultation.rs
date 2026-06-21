use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Consultation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub doctor_id: Uuid,
    pub chief_complaint: Option<String>,
    pub history: Option<String>,
    pub examination: Option<String>,
    pub plan: Option<String>,
    pub notes: Option<String>,
    pub hpi: Option<String>,
    pub past_medical_history: Option<serde_json::Value>,
    pub past_surgical_history: Option<serde_json::Value>,
    pub family_history: Option<serde_json::Value>,
    pub social_history: Option<serde_json::Value>,
    pub review_of_systems: Option<serde_json::Value>,
    pub physical_examination: Option<serde_json::Value>,
    pub general_appearance: Option<String>,
    pub snomed_codes: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Diagnosis {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub icd_code: Option<String>,
    pub icd_system: String,
    pub icd_display: Option<String>,
    pub icd_source_url: Option<String>,
    pub icd_source_version: Option<String>,
    pub icd_provider_mode: Option<String>,
    pub description: String,
    pub is_primary: bool,
    pub notes: Option<String>,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<NaiveDate>,
    pub resolved_date: Option<NaiveDate>,
    pub snomed_code: Option<String>,
    pub snomed_display: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SnomedCode {
    pub id: Uuid,
    pub code: String,
    pub display_name: String,
    pub semantic_tag: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Icd10Code {
    pub id: Uuid,
    pub code: String,
    pub short_desc: String,
    pub long_desc: Option<String>,
    pub category: Option<String>,
    pub chapter: Option<String>,
    pub is_billable: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChiefComplaintMaster {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub category: Option<String>,
    pub synonyms: Vec<String>,
    pub suggested_icd: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Prescription {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub doctor_id: Uuid,
    pub notes: Option<String>,
    pub order_mode: String,
    pub transcribed_by: Option<Uuid>,
    pub read_back_confirmed: bool,
    pub countersign_due_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PrescriptionItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Uuid,
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub route: Option<String>,
    pub instructions: Option<String>,
    pub created_at: DateTime<Utc>,
    pub item_status: String,
    pub discontinued_at: Option<DateTime<Utc>>,
    pub discontinued_by: Option<Uuid>,
    pub discontinue_reason: Option<String>,
    pub catalog_item_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Vital {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub recorded_by: Uuid,
    pub temperature: Option<rust_decimal::Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<rust_decimal::Decimal>,
    pub height_cm: Option<rust_decimal::Decimal>,
    pub bmi: Option<rust_decimal::Decimal>,
    pub notes: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PrescriptionTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub created_by: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub department_id: Option<Uuid>,
    pub is_shared: bool,
    pub items: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MedicalCertificate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub doctor_id: Uuid,
    pub certificate_type: String,
    pub certificate_number: Option<String>,
    pub issued_date: NaiveDate,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub diagnosis: Option<String>,
    pub remarks: Option<String>,
    pub body: serde_json::Value,
    pub is_void: bool,
    pub voided_by: Option<Uuid>,
    pub voided_at: Option<DateTime<Utc>>,
    pub void_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Referral {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub from_department_id: Uuid,
    pub to_department_id: Uuid,
    pub from_doctor_id: Option<Uuid>,
    pub to_doctor_id: Option<Uuid>,
    pub urgency: String,
    pub status: String,
    pub reason: String,
    pub clinical_notes: Option<String>,
    pub response_notes: Option<String>,
    pub responded_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProcedureCatalog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub department_id: Option<Uuid>,
    pub category: Option<String>,
    pub base_price: Option<rust_decimal::Decimal>,
    pub duration_minutes: Option<i32>,
    pub requires_consent: bool,
    pub requires_anesthesia: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProcedureOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub procedure_id: Uuid,
    pub ordered_by: Uuid,
    pub performed_by: Option<Uuid>,
    pub priority: String,
    pub status: String,
    pub scheduled_date: Option<NaiveDate>,
    pub scheduled_time: Option<chrono::NaiveTime>,
    pub notes: Option<String>,
    pub findings: Option<String>,
    pub complications: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DoctorDocket {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub docket_date: NaiveDate,
    pub total_patients: i32,
    pub new_patients: i32,
    pub follow_ups: i32,
    pub referrals_made: i32,
    pub procedures_done: i32,
    pub notes: Option<String>,
    pub generated_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientReminder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub doctor_id: Uuid,
    pub reminder_type: String,
    pub reminder_date: NaiveDate,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub status: String,
    pub notification_channels: Vec<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientFeedback {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub rating: Option<i32>,
    pub wait_time_rating: Option<i32>,
    pub staff_rating: Option<i32>,
    pub cleanliness_rating: Option<i32>,
    pub overall_experience: Option<String>,
    pub suggestions: Option<String>,
    pub would_recommend: Option<bool>,
    pub is_anonymous: bool,
    pub submitted_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProcedureConsent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub procedure_order_id: Option<Uuid>,
    pub procedure_name: String,
    pub consent_type: String,
    pub risks_explained: Option<String>,
    pub alternatives_explained: Option<String>,
    pub benefits_explained: Option<String>,
    pub patient_questions: Option<String>,
    pub consented_by_name: Option<String>,
    pub consented_by_relation: Option<String>,
    pub witness_name: Option<String>,
    pub witness_designation: Option<String>,
    pub doctor_id: Uuid,
    pub status: String,
    pub signed_at: Option<DateTime<Utc>>,
    pub refused_at: Option<DateTime<Utc>>,
    pub refusal_reason: Option<String>,
    pub withdrawn_at: Option<DateTime<Utc>>,
    pub withdrawal_reason: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub body: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConsultationTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub created_by: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub specialty: Option<String>,
    pub department_id: Option<Uuid>,
    pub is_shared: bool,
    pub chief_complaints: Vec<String>,
    pub default_history: serde_json::Value,
    pub default_examination: serde_json::Value,
    pub default_ros: serde_json::Value,
    pub default_plan: Option<String>,
    pub common_diagnoses: Vec<String>,
    pub common_medications: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
