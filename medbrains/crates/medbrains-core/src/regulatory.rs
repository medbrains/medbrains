use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

// Re-use AccreditationBody from quality module
pub use crate::quality::AccreditationBody;

// ══════════════════════════════════════════════════════════
//  Enums
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "compliance_checklist_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ComplianceChecklistStatus {
    NotStarted,
    InProgress,
    Compliant,
    NonCompliant,
    NotApplicable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "adverse_event_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdverseEventSeverity {
    Mild,
    Moderate,
    Severe,
    Fatal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "adverse_event_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdverseEventStatus {
    Draft,
    Submitted,
    UnderReview,
    Closed,
    Withdrawn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "pcpndt_form_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PcpndtFormStatus {
    Draft,
    Submitted,
    Registered,
    Expired,
}

// ══════════════════════════════════════════════════════════
//  Structs (FromRow)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceChecklist {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub accreditation_body: AccreditationBody,
    pub standard_code: String,
    pub name: String,
    pub description: Option<String>,
    pub assessment_period_start: NaiveDate,
    pub assessment_period_end: NaiveDate,
    pub overall_status: ComplianceChecklistStatus,
    pub compliance_score: Option<Decimal>,
    pub total_items: i32,
    pub compliant_items: i32,
    pub non_compliant_items: i32,
    pub assessed_by: Option<Uuid>,
    pub assessed_at: Option<DateTime<Utc>>,
    pub next_review_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceChecklistItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub checklist_id: Uuid,
    pub item_number: i32,
    pub criterion: String,
    pub status: ComplianceChecklistStatus,
    pub evidence_summary: Option<String>,
    pub evidence_documents: Value,
    pub gap_description: Option<String>,
    pub corrective_action: Option<String>,
    pub target_date: Option<NaiveDate>,
    pub responsible_user_id: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdrReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub report_number: String,
    pub patient_id: Option<Uuid>,
    pub reporter_id: Uuid,
    pub reporter_type: String,
    pub drug_name: String,
    pub drug_generic_name: Option<String>,
    pub drug_batch_number: Option<String>,
    pub manufacturer: Option<String>,
    pub reaction_description: String,
    pub onset_date: Option<NaiveDate>,
    pub reaction_date: NaiveDate,
    pub severity: AdverseEventSeverity,
    pub outcome: Option<String>,
    pub causality_assessment: Option<String>,
    pub status: AdverseEventStatus,
    pub seriousness_criteria: Value,
    pub dechallenge: Option<String>,
    pub rechallenge: Option<String>,
    pub concomitant_drugs: Value,
    pub relevant_history: Option<String>,
    pub submitted_to_pvpi: bool,
    pub pvpi_reference: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MateriovigilanceReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub report_number: String,
    pub patient_id: Option<Uuid>,
    pub reporter_id: Uuid,
    pub device_name: String,
    pub device_manufacturer: Option<String>,
    pub device_model: Option<String>,
    pub device_batch: Option<String>,
    pub event_description: String,
    pub event_date: NaiveDate,
    pub severity: AdverseEventSeverity,
    pub patient_outcome: Option<String>,
    pub device_action: Option<String>,
    pub status: AdverseEventStatus,
    pub submitted_to_cdsco: bool,
    pub cdsco_reference: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub investigation_findings: Option<String>,
    pub corrective_action: Option<String>,
    pub created_by: Uuid,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PcpndtForm {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub form_number: String,
    pub patient_id: Uuid,
    pub referral_doctor_id: Option<Uuid>,
    /// Unknown while the form is a draft opened from the order.
    pub performing_doctor_id: Option<Uuid>,
    pub procedure_type: String,
    pub indication: Option<String>,
    pub gestational_age_weeks: Option<i32>,
    pub lmp_date: Option<NaiveDate>,
    pub declaration_text: Option<String>,
    pub status: PcpndtFormStatus,
    pub form_signed_at: Option<DateTime<Utc>>,
    pub patient_consent_id: Option<Uuid>,
    pub registered_with: Option<String>,
    pub registration_date: Option<NaiveDate>,
    pub quarterly_report_included: bool,
    pub gender_disclosure_blocked: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[sqlx(default)]
    pub radiology_order_id: Option<Uuid>,
    #[sqlx(default)]
    pub living_sons: Option<i32>,
    #[sqlx(default)]
    pub living_daughters: Option<i32>,
    #[sqlx(default)]
    pub self_referred: bool,
    #[sqlx(default)]
    pub result_summary: Option<String>,
    /// Her declaration that she does not want to know the sex of the fetus.
    #[sqlx(default)]
    pub woman_declared_at: Option<DateTime<Utc>>,
    /// The doctor's declaration that the sex was neither detected nor disclosed.
    #[sqlx(default)]
    pub doctor_declared_at: Option<DateTime<Utc>>,
    #[sqlx(default)]
    pub doctor_declared_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceCalendarEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub regulatory_body_id: Option<Uuid>,
    pub event_type: String,
    pub due_date: NaiveDate,
    pub reminder_days: Vec<i32>,
    pub department_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by: Option<Uuid>,
    pub recurrence: String,
    pub source_table: Option<String>,
    pub source_id: Option<Uuid>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Dashboard aggregation types (not FromRow — computed)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceDashboard {
    pub accreditation_scores: Vec<AccreditationScore>,
    pub department_scores: Vec<DepartmentComplianceScore>,
    pub upcoming_deadlines: Vec<ComplianceCalendarEvent>,
    pub overdue_items: i64,
    pub total_checklists: i64,
    pub compliant_checklists: i64,
    pub license_expiring_soon: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccreditationScore {
    pub body: String,
    pub total_standards: i64,
    pub compliant: i64,
    pub non_compliant: i64,
    pub score_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepartmentComplianceScore {
    /// None for checklists that cover the whole hospital.
    pub department_id: Option<Uuid>,
    pub department_name: String,
    pub avg_score: f64,
    pub checklist_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceGap {
    pub checklist_id: Uuid,
    pub checklist_name: String,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub accreditation_body: String,
    pub non_compliant_items: i64,
    pub gap_descriptions: Vec<String>,
}
