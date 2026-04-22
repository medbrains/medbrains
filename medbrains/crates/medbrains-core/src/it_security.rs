//! IT Security domain types — Break-Glass, Clinical Access Monitor, Stock Disposal,
//! TAT Tracking, Data Migration, EOD Digest, Data Quality, CERT-In Compliance.

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ══════════════════════════════════════════════════════════════
// BREAK-GLASS EMERGENCY ACCESS
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BreakGlassEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub reason: String,
    pub justification: Option<String>,
    pub modules_accessed: Vec<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub supervisor_id: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BreakGlassEventSummary {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub reason: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBreakGlassRequest {
    pub patient_id: Option<Uuid>,
    pub reason: String,
    pub justification: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EndBreakGlassRequest {
    pub modules_accessed: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewBreakGlassRequest {
    pub review_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BreakGlassQuery {
    pub user_id: Option<String>,
    pub patient_id: Option<String>,
    pub is_active: Option<bool>,
    pub reviewed: Option<bool>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ══════════════════════════════════════════════════════════════
// CLINICAL ACCESS MONITOR
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "snake_case")]
pub enum SensitivityType {
    Vip,
    Celebrity,
    Employee,
    StaffFamily,
    Legal,
    Research,
    #[default]
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SensitivePatient {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub sensitivity_type: String,
    pub reason: Option<String>,
    pub access_restricted_to: Option<Vec<Uuid>>,
    pub alert_on_access: bool,
    pub notify_users: Option<Vec<Uuid>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SensitivePatientSummary {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub sensitivity_type: String,
    pub reason: Option<String>,
    pub alert_on_access: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSensitivePatientRequest {
    pub patient_id: Uuid,
    pub sensitivity_type: String,
    pub reason: Option<String>,
    pub access_restricted_to: Option<Vec<Uuid>>,
    pub alert_on_access: Option<bool>,
    pub notify_users: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AccessAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub access_type: String,
    pub module: Option<String>,
    pub ip_address: Option<String>,
    pub is_authorized: Option<bool>,
    pub alert_sent: bool,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AcknowledgeAlertRequest {
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════════
// STOCK DISPOSAL
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "disposal_method", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DisposalMethod {
    Incineration,
    Autoclave,
    Shredding,
    Chemical,
    ReturnVendor,
    Donation,
    Landfill,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "disposal_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DisposalStatus {
    #[default]
    Pending,
    Approved,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockDisposalRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub request_number: String,
    pub store_id: Option<Uuid>,
    pub disposal_type: String,
    pub disposal_method: Option<DisposalMethod>,
    pub status: DisposalStatus,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub executed_by: Option<Uuid>,
    pub executed_at: Option<DateTime<Utc>>,
    pub total_value: Option<rust_decimal::Decimal>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub certificate_number: Option<String>,
    pub witness_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockDisposalSummary {
    pub id: Uuid,
    pub request_number: String,
    pub store_name: Option<String>,
    pub disposal_type: String,
    pub status: DisposalStatus,
    pub requested_by_name: Option<String>,
    pub total_value: Option<rust_decimal::Decimal>,
    pub item_count: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockDisposalItem {
    pub id: Uuid,
    pub disposal_id: Uuid,
    pub item_id: Option<Uuid>,
    pub item_name: String,
    pub item_code: Option<String>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: rust_decimal::Decimal,
    pub unit: String,
    pub unit_cost: Option<rust_decimal::Decimal>,
    pub total_cost: Option<rust_decimal::Decimal>,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDisposalRequest {
    pub store_id: Option<Uuid>,
    pub disposal_type: String,
    pub disposal_method: Option<DisposalMethod>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<CreateDisposalItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDisposalItemRequest {
    pub item_id: Option<Uuid>,
    pub item_name: String,
    pub item_code: Option<String>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: rust_decimal::Decimal,
    pub unit: String,
    pub unit_cost: Option<rust_decimal::Decimal>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveDisposalRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteDisposalRequest {
    pub certificate_number: Option<String>,
    pub witness_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DisposalQuery {
    pub store_id: Option<String>,
    pub disposal_type: Option<String>,
    pub status: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ══════════════════════════════════════════════════════════════
// TAT TRACKING
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "tat_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TatCategory {
    Lab,
    Radiology,
    Pharmacy,
    Discharge,
    Emergency,
    OpdWait,
    IpdAdmission,
    Surgery,
    BloodBank,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TatBenchmark {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: TatCategory,
    pub sub_category: Option<String>,
    pub benchmark_minutes: i32,
    pub warning_minutes: Option<i32>,
    pub critical_minutes: Option<i32>,
    pub department_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTatBenchmarkRequest {
    pub category: TatCategory,
    pub sub_category: Option<String>,
    pub benchmark_minutes: i32,
    pub warning_minutes: Option<i32>,
    pub critical_minutes: Option<i32>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TatRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: TatCategory,
    pub sub_category: Option<String>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub elapsed_minutes: Option<i32>,
    pub benchmark_minutes: Option<i32>,
    pub status: Option<String>,
    pub breach_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TatRecordSummary {
    pub id: Uuid,
    pub category: TatCategory,
    pub sub_category: Option<String>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub patient_name: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub elapsed_minutes: Option<i32>,
    pub benchmark_minutes: Option<i32>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTatRecordRequest {
    pub category: TatCategory,
    pub sub_category: Option<String>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteTatRecordRequest {
    pub breach_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TatAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub tat_record_id: Uuid,
    pub alert_type: String,
    pub notified_users: Option<Vec<Uuid>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub resolution_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TatQuery {
    pub category: Option<String>,
    pub status: Option<String>,
    pub department_id: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TatDashboard {
    pub total_records: i64,
    pub on_track: i64,
    pub warning: i64,
    pub breached: i64,
    pub avg_tat_minutes: Option<f64>,
    pub breach_rate: f64,
    pub by_category: Vec<TatCategoryStats>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TatCategoryStats {
    pub category: String,
    pub total: i64,
    pub on_track: i64,
    pub breached: i64,
    pub avg_minutes: Option<f64>,
}

// ══════════════════════════════════════════════════════════════
// DATA MIGRATION
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "migration_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MigrationStatus {
    #[default]
    Pending,
    Validating,
    Validated,
    Importing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "migration_direction", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MigrationDirection {
    Import,
    Export,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataMigration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub direction: MigrationDirection,
    pub entity_type: String,
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub status: MigrationStatus,
    pub total_records: Option<i32>,
    pub processed_records: Option<i32>,
    pub success_count: Option<i32>,
    pub error_count: Option<i32>,
    pub warning_count: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub initiated_by: Uuid,
    pub error_log: Option<serde_json::Value>,
    pub mapping_config: Option<serde_json::Value>,
    pub options: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMigrationRequest {
    pub direction: MigrationDirection,
    pub entity_type: String,
    pub file_name: Option<String>,
    pub mapping_config: Option<serde_json::Value>,
    pub options: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct MigrationQuery {
    pub direction: Option<String>,
    pub entity_type: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ══════════════════════════════════════════════════════════════
// EOD DIGEST
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "digest_frequency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DigestFrequency {
    #[default]
    Daily,
    Weekly,
    Monthly,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EodDigestSubscription {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub frequency: DigestFrequency,
    pub delivery_time: Option<NaiveTime>,
    pub delivery_days: Option<Vec<i32>>,
    pub modules: Option<Vec<String>>,
    pub include_summary: bool,
    pub include_alerts: bool,
    pub include_pending_tasks: bool,
    pub email_enabled: bool,
    pub push_enabled: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDigestSubscriptionRequest {
    pub frequency: Option<DigestFrequency>,
    pub delivery_time: Option<String>,
    pub delivery_days: Option<Vec<i32>>,
    pub modules: Option<Vec<String>>,
    pub include_summary: Option<bool>,
    pub include_alerts: Option<bool>,
    pub include_pending_tasks: Option<bool>,
    pub email_enabled: Option<bool>,
    pub push_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EodDigestHistory {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub digest_date: NaiveDate,
    pub content: serde_json::Value,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivery_status: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════════
// DATA QUALITY
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "data_quality_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DataQualityCategory {
    Completeness,
    Accuracy,
    Timeliness,
    Consistency,
    Duplicates,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataQualityRule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: DataQualityCategory,
    pub entity_type: String,
    pub field_name: Option<String>,
    pub rule_name: String,
    pub rule_expression: String,
    pub severity: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDataQualityRuleRequest {
    pub category: DataQualityCategory,
    pub entity_type: String,
    pub field_name: Option<String>,
    pub rule_name: String,
    pub rule_expression: String,
    pub severity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataQualityIssue {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub rule_id: Option<Uuid>,
    pub category: DataQualityCategory,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub field_name: Option<String>,
    pub issue_description: String,
    pub severity: Option<String>,
    pub current_value: Option<String>,
    pub suggested_value: Option<String>,
    pub is_resolved: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub resolution_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveIssueRequest {
    pub resolution_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DataQualityQuery {
    pub category: Option<String>,
    pub entity_type: Option<String>,
    pub severity: Option<String>,
    pub is_resolved: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataQualityScore {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: String,
    pub score_date: NaiveDate,
    pub completeness_score: Option<rust_decimal::Decimal>,
    pub accuracy_score: Option<rust_decimal::Decimal>,
    pub timeliness_score: Option<rust_decimal::Decimal>,
    pub consistency_score: Option<rust_decimal::Decimal>,
    pub overall_score: Option<rust_decimal::Decimal>,
    pub total_records: Option<i32>,
    pub issues_found: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DataQualityDashboard {
    pub overall_score: f64,
    pub completeness_score: f64,
    pub accuracy_score: f64,
    pub timeliness_score: f64,
    pub consistency_score: f64,
    pub total_issues: i64,
    pub unresolved_issues: i64,
    pub critical_issues: i64,
    pub by_entity_type: Vec<EntityQualityStats>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EntityQualityStats {
    pub entity_type: String,
    pub overall_score: Option<f64>,
    pub total_issues: i64,
    pub unresolved_issues: i64,
}

// ══════════════════════════════════════════════════════════════
// CERT-IN COMPLIANCE
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "incident_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IncidentSeverity {
    Low,
    #[default]
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "incident_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IncidentStatus {
    #[default]
    Detected,
    Investigating,
    Contained,
    Eradicated,
    Recovered,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityIncident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_number: String,
    pub title: String,
    pub description: Option<String>,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub detected_at: DateTime<Utc>,
    pub detected_by: Option<Uuid>,
    pub affected_systems: Option<Vec<String>>,
    pub affected_data_types: Option<Vec<String>>,
    pub estimated_impact: Option<String>,
    pub containment_steps: Option<String>,
    pub eradication_steps: Option<String>,
    pub recovery_steps: Option<String>,
    pub lessons_learned: Option<String>,
    pub cert_in_reported: bool,
    pub cert_in_report_date: Option<DateTime<Utc>>,
    pub cert_in_reference: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityIncidentSummary {
    pub id: Uuid,
    pub incident_number: String,
    pub title: String,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub detected_at: DateTime<Utc>,
    pub cert_in_reported: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSecurityIncidentRequest {
    pub title: String,
    pub description: Option<String>,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub detected_at: DateTime<Utc>,
    pub affected_systems: Option<Vec<String>>,
    pub affected_data_types: Option<Vec<String>>,
    pub estimated_impact: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSecurityIncidentRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub severity: Option<IncidentSeverity>,
    pub status: Option<IncidentStatus>,
    pub containment_steps: Option<String>,
    pub eradication_steps: Option<String>,
    pub recovery_steps: Option<String>,
    pub lessons_learned: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportToCertInRequest {
    pub cert_in_reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityIncidentUpdate {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub update_type: String,
    pub description: String,
    pub old_status: Option<IncidentStatus>,
    pub new_status: Option<IncidentStatus>,
    pub updated_by: Uuid,
    pub updated_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddIncidentUpdateRequest {
    pub update_type: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct IncidentQuery {
    pub incident_type: Option<String>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub cert_in_reported: Option<bool>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Vulnerability {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub cve_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub severity: IncidentSeverity,
    pub affected_component: String,
    pub discovered_at: DateTime<Utc>,
    pub discovered_by: Option<String>,
    pub remediation_status: Option<String>,
    pub remediation_notes: Option<String>,
    pub remediation_deadline: Option<NaiveDate>,
    pub remediated_at: Option<DateTime<Utc>>,
    pub remediated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVulnerabilityRequest {
    pub cve_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub severity: IncidentSeverity,
    pub affected_component: String,
    pub discovered_at: DateTime<Utc>,
    pub discovered_by: Option<String>,
    pub remediation_deadline: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVulnerabilityRequest {
    pub remediation_status: Option<String>,
    pub remediation_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceRequirement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub framework: String,
    pub requirement_code: String,
    pub requirement_title: String,
    pub requirement_description: Option<String>,
    pub category: Option<String>,
    pub is_mandatory: bool,
    pub compliance_status: Option<String>,
    pub evidence_links: Option<Vec<String>>,
    pub last_assessed_at: Option<DateTime<Utc>>,
    pub assessed_by: Option<Uuid>,
    pub next_review_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateComplianceRequest {
    pub compliance_status: Option<String>,
    pub evidence_links: Option<Vec<String>>,
    pub notes: Option<String>,
    pub next_review_date: Option<NaiveDate>,
}

// ══════════════════════════════════════════════════════════════
// SYSTEM HEALTH & MONITORING
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SystemHealthMetric {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub metric_name: String,
    pub metric_value: rust_decimal::Decimal,
    pub metric_unit: Option<String>,
    pub component: String,
    pub status: Option<String>,
    pub threshold_warning: Option<rust_decimal::Decimal>,
    pub threshold_critical: Option<rust_decimal::Decimal>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SystemHealthDashboard {
    pub overall_status: String,
    pub database_status: String,
    pub api_status: String,
    pub storage_status: String,
    pub metrics: Vec<SystemHealthMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BackupHistory {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub backup_type: String,
    pub backup_name: String,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub status: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub verification_at: Option<DateTime<Utc>>,
    pub retention_days: Option<i32>,
    pub expires_at: Option<NaiveDate>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OnboardingProgress {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub wizard_type: String,
    pub current_step: String,
    pub completed_steps: Vec<String>,
    pub step_data: serde_json::Value,
    pub is_completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub started_by: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOnboardingRequest {
    pub current_step: String,
    pub step_data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteOnboardingStepRequest {
    pub step: String,
    pub step_data: Option<serde_json::Value>,
}

// ══════════════════════════════════════════════════════════════
// INCENTIVE CONFIGURATION
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncentivePlan {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub plan_name: String,
    pub plan_code: String,
    pub description: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub is_active: bool,
    pub calculation_basis: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncentivePlanRequest {
    pub plan_name: String,
    pub plan_code: String,
    pub description: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub calculation_basis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncentivePlanRule {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub rule_name: String,
    pub service_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub min_threshold: Option<rust_decimal::Decimal>,
    pub max_threshold: Option<rust_decimal::Decimal>,
    pub percentage: Option<rust_decimal::Decimal>,
    pub fixed_amount: Option<rust_decimal::Decimal>,
    pub multiplier: Option<rust_decimal::Decimal>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncentiveRuleRequest {
    pub rule_name: String,
    pub service_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub min_threshold: Option<rust_decimal::Decimal>,
    pub max_threshold: Option<rust_decimal::Decimal>,
    pub percentage: Option<rust_decimal::Decimal>,
    pub fixed_amount: Option<rust_decimal::Decimal>,
    pub multiplier: Option<rust_decimal::Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DoctorIncentiveAssignment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub doctor_name: Option<String>,
    pub plan_id: Uuid,
    pub plan_name: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub custom_percentage: Option<rust_decimal::Decimal>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AssignIncentivePlanRequest {
    pub doctor_id: Uuid,
    pub plan_id: Uuid,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub custom_percentage: Option<rust_decimal::Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncentiveCalculation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub doctor_name: Option<String>,
    pub plan_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub gross_revenue: Option<rust_decimal::Decimal>,
    pub eligible_revenue: Option<rust_decimal::Decimal>,
    pub incentive_amount: Option<rust_decimal::Decimal>,
    pub deductions: Option<rust_decimal::Decimal>,
    pub net_payable: Option<rust_decimal::Decimal>,
    pub status: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub payment_reference: Option<String>,
    pub calculation_details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CalculateIncentiveRequest {
    pub doctor_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct ApproveIncentiveRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MarkIncentivePaidRequest {
    pub payment_reference: String,
}
