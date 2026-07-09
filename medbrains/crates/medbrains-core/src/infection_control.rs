use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

// -- Enums -------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "hai_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HaiType {
    Clabsi,
    Cauti,
    Vap,
    Ssi,
    Cdiff,
    Mrsa,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "infection_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum InfectionStatus {
    Suspected,
    Confirmed,
    RuledOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "antibiotic_request_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AntibioticRequestStatus {
    Pending,
    Approved,
    Denied,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "antibiotic_action", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AntibioticAction {
    Initiate,
    Escalate,
    DeEscalate,
    Stop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "waste_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum WasteCategory {
    Yellow,
    Red,
    WhiteTranslucent,
    Blue,
    Cytotoxic,
    Chemical,
    Radioactive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "outbreak_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OutbreakStatus {
    Suspected,
    Confirmed,
    Contained,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "hygiene_moment", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HygieneMoment {
    BeforePatient,
    BeforeAseptic,
    AfterBodyFluid,
    AfterPatient,
    AfterSurroundings,
}

// -- Structs -----------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InfectionSurveillanceEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub hai_type: HaiType,
    pub infection_status: InfectionStatus,
    pub organism: Option<String>,
    pub susceptibility_pattern: Option<Value>,
    pub device_type: Option<String>,
    pub insertion_date: Option<DateTime<Utc>>,
    pub infection_date: DateTime<Utc>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub nhsn_criteria: Option<String>,
    pub contributing_factors: Option<Value>,
    pub notes: Option<String>,
    pub reported_by: Uuid,
    pub confirmed_by: Option<Uuid>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InfectionDeviceDay {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Uuid,
    pub department_id: Option<Uuid>,
    pub record_date: NaiveDate,
    pub patient_days: i32,
    pub central_line_days: i32,
    pub urinary_catheter_days: i32,
    pub ventilator_days: i32,
    pub recorded_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AntibioticStewardshipRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub antibiotic_name: String,
    pub dose: Option<String>,
    pub route: Option<String>,
    pub frequency: Option<String>,
    pub duration_days: Option<i32>,
    pub indication: String,
    pub culture_sent: bool,
    pub culture_result: Option<String>,
    pub request_status: AntibioticRequestStatus,
    pub requested_by: Uuid,
    pub requested_at: DateTime<Utc>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub escalation_reason: Option<String>,
    pub auto_stop_date: Option<NaiveDate>,
    pub timeout_decision: Option<String>,
    pub timeout_decision_at: Option<DateTime<Utc>>,
    pub timeout_reviewed_by: Option<Uuid>,
    pub timeout_notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AntibioticConsumptionRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub antibiotic_name: String,
    pub atc_code: Option<String>,
    pub record_month: NaiveDate,
    pub quantity_used: Decimal,
    pub ddd: Option<Decimal>,
    pub patient_days: i32,
    pub ddd_per_1000_patient_days: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BiowasteRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Uuid,
    pub waste_category: WasteCategory,
    pub weight_kg: Decimal,
    pub record_date: NaiveDate,
    pub container_count: i32,
    pub disposal_vendor: Option<String>,
    pub manifest_number: Option<String>,
    pub notes: Option<String>,
    pub recorded_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NeedleStickIncident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_number: String,
    pub staff_id: Uuid,
    pub incident_date: DateTime<Utc>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub device_type: String,
    pub procedure_during: Option<String>,
    pub body_part: Option<String>,
    pub depth: Option<String>,
    pub source_patient_id: Option<Uuid>,
    pub hiv_status: Option<String>,
    pub hbv_status: Option<String>,
    pub hcv_status: Option<String>,
    pub pep_initiated: bool,
    pub pep_details: Option<String>,
    pub follow_up_schedule: Option<Value>,
    pub outcome: Option<String>,
    pub reported_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct HandHygieneAudit {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub audit_date: DateTime<Utc>,
    pub location_id: Option<Uuid>,
    pub department_id: Uuid,
    pub auditor_id: Uuid,
    pub observations: i32,
    pub compliant: i32,
    pub non_compliant: i32,
    pub compliance_rate: Option<Decimal>,
    pub moment_breakdown: Option<Value>,
    pub staff_category: Option<String>,
    pub findings: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CultureSurveillance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub culture_type: String,
    pub sample_site: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub collection_date: DateTime<Utc>,
    pub result: Option<String>,
    pub organism: Option<String>,
    pub colony_count: Option<i32>,
    pub acceptable: Option<bool>,
    pub action_taken: Option<String>,
    pub collected_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OutbreakEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub outbreak_number: String,
    pub organism: String,
    pub outbreak_status: OutbreakStatus,
    pub detected_date: DateTime<Utc>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub initial_cases: i32,
    pub total_cases: i32,
    pub description: Option<String>,
    pub control_measures: Option<Value>,
    pub hicc_notified: bool,
    pub hicc_notified_at: Option<DateTime<Utc>>,
    pub containment_date: Option<DateTime<Utc>>,
    pub closure_date: Option<DateTime<Utc>>,
    pub root_cause: Option<String>,
    pub lessons_learned: Option<String>,
    pub reported_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OutbreakContact {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub outbreak_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
    pub contact_type: String,
    pub exposure_date: Option<DateTime<Utc>>,
    pub screening_date: Option<DateTime<Utc>>,
    pub screening_result: Option<String>,
    pub quarantine_required: bool,
    pub quarantine_start: Option<NaiveDate>,
    pub quarantine_end: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
