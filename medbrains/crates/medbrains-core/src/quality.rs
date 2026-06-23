use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "document_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DocumentStatus {
    Draft,
    UnderReview,
    Approved,
    Released,
    Revised,
    Obsolete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "incident_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IncidentSeverity {
    NearMiss,
    Minor,
    Moderate,
    Major,
    Sentinel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "incident_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IncidentStatus {
    Reported,
    Acknowledged,
    Investigating,
    RcaComplete,
    CapaAssigned,
    CapaInProgress,
    Closed,
    Reopened,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "capa_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CapaStatus {
    Open,
    InProgress,
    Completed,
    Verified,
    Overdue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "indicator_frequency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IndicatorFrequency {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Annually,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "accreditation_body", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AccreditationBody {
    Nabh,
    Nmc,
    Nabl,
    Jci,
    Abdm,
    Naac,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "compliance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ComplianceStatus {
    Compliant,
    PartiallyCompliant,
    NonCompliant,
    NotApplicable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "committee_frequency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommitteeFrequency {
    Weekly,
    Biweekly,
    Monthly,
    Quarterly,
    Biannual,
    Annual,
    AsNeeded,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityIndicator {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub sub_category: Option<String>,
    pub numerator_description: Option<String>,
    pub denominator_description: Option<String>,
    pub unit: Option<String>,
    pub frequency: IndicatorFrequency,
    pub target_value: Option<Decimal>,
    pub threshold_warning: Option<Decimal>,
    pub threshold_critical: Option<Decimal>,
    pub benchmark_national: Option<Decimal>,
    pub benchmark_international: Option<Decimal>,
    pub auto_calculated: bool,
    pub calculation_query: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityIndicatorValue {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub indicator_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub numerator_value: Option<Decimal>,
    pub denominator_value: Option<Decimal>,
    pub calculated_value: Option<Decimal>,
    pub department_id: Option<Uuid>,
    pub notes: Option<String>,
    pub recorded_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityDocument {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_number: String,
    pub title: String,
    pub category: String,
    pub department_id: Option<Uuid>,
    pub current_version: i32,
    pub status: DocumentStatus,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub author_id: Uuid,
    pub reviewer_id: Option<Uuid>,
    pub approver_id: Option<Uuid>,
    pub released_at: Option<DateTime<Utc>>,
    pub next_review_date: Option<NaiveDate>,
    pub review_cycle_months: i32,
    pub is_training_required: bool,
    pub attachments: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityDocumentVersion {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_id: Uuid,
    pub version_number: i32,
    pub change_summary: Option<String>,
    pub content: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityDocumentAcknowledgment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_id: Uuid,
    pub user_id: Uuid,
    pub acknowledged_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityIncident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_number: String,
    pub title: String,
    pub description: Option<String>,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub department_id: Option<Uuid>,
    pub location: Option<String>,
    pub incident_date: DateTime<Utc>,
    pub reported_by: Uuid,
    pub is_anonymous: bool,
    pub patient_id: Option<Uuid>,
    pub affected_persons: Value,
    pub immediate_action: Option<String>,
    pub root_cause: Option<String>,
    pub contributing_factors: Value,
    pub assigned_to: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<Uuid>,
    pub is_reportable: bool,
    pub regulatory_body: Option<String>,
    pub regulatory_reported_at: Option<DateTime<Utc>>,
    pub attachments: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List row — omits the heavy free-text + JSONB fields (`description`,
/// `immediate_action`, `root_cause`, `affected_persons`, `contributing_factors`,
/// `attachments`); the detail view fetches the full incident by id (#167).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityIncidentListItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_number: String,
    pub title: String,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub department_id: Option<Uuid>,
    pub location: Option<String>,
    pub incident_date: DateTime<Utc>,
    pub reported_by: Uuid,
    pub is_anonymous: bool,
    pub patient_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<Uuid>,
    pub is_reportable: bool,
    pub regulatory_body: Option<String>,
    pub regulatory_reported_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityCapa {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_id: Uuid,
    pub capa_number: String,
    pub capa_type: String,
    pub description: Option<String>,
    pub action_plan: Option<String>,
    pub status: CapaStatus,
    pub assigned_to: Uuid,
    pub due_date: NaiveDate,
    pub completed_at: Option<DateTime<Utc>>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub effectiveness_check: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityCommittee {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub committee_type: String,
    pub chairperson_id: Option<Uuid>,
    pub secretary_id: Option<Uuid>,
    pub members: Value,
    pub meeting_frequency: CommitteeFrequency,
    pub charter: Option<String>,
    pub is_mandatory: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityCommitteeMeeting {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub committee_id: Uuid,
    pub meeting_number: Option<String>,
    pub scheduled_date: DateTime<Utc>,
    pub actual_date: Option<DateTime<Utc>>,
    pub venue: Option<String>,
    pub agenda: Value,
    pub minutes: Option<String>,
    pub attendees: Value,
    pub absentees: Value,
    pub decisions: Value,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityActionItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub description: Option<String>,
    pub assigned_to: Uuid,
    pub due_date: NaiveDate,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub remarks: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityAccreditationStandard {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub body: AccreditationBody,
    pub standard_code: String,
    pub standard_name: String,
    pub chapter: Option<String>,
    pub description: Option<String>,
    pub measurable_elements: Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityAccreditationCompliance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub standard_id: Uuid,
    pub compliance: ComplianceStatus,
    pub evidence_summary: Option<String>,
    pub evidence_documents: Value,
    pub gap_description: Option<String>,
    pub action_plan: Option<String>,
    pub responsible_person_id: Option<Uuid>,
    pub target_date: Option<NaiveDate>,
    pub assessed_at: Option<DateTime<Utc>>,
    pub assessed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QualityAudit {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub audit_number: String,
    pub audit_type: String,
    pub title: String,
    pub scope: Option<String>,
    pub department_id: Option<Uuid>,
    pub auditor_id: Uuid,
    pub audit_date: NaiveDate,
    pub report_date: Option<NaiveDate>,
    pub findings: Value,
    pub non_conformities: i32,
    pub observations: i32,
    pub opportunities: i32,
    pub overall_score: Option<Decimal>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
