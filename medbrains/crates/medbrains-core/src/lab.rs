use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_order_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabOrderStatus {
    Ordered,
    SampleCollected,
    Processing,
    Completed,
    Verified,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabPriority {
    Routine,
    Urgent,
    Stat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_result_flag", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabResultFlag {
    Normal,
    Low,
    High,
    CriticalLow,
    CriticalHigh,
    Abnormal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_report_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabReportStatus {
    Preliminary,
    Final,
    Amended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_qc_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabQcStatus {
    Accepted,
    Rejected,
    Warning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_outsource_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabOutsourceStatus {
    PendingSend,
    Sent,
    ResultReceived,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_phlebotomy_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabPhlebotomyStatus {
    Waiting,
    InProgress,
    Completed,
    Skipped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_westgard_rule", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabWestgardRule {
    #[sqlx(rename = "1_2s")]
    #[serde(rename = "1_2s")]
    OneTwo,
    #[sqlx(rename = "1_3s")]
    #[serde(rename = "1_3s")]
    OneThree,
    #[sqlx(rename = "2_2s")]
    #[serde(rename = "2_2s")]
    TwoTwo,
    #[sqlx(rename = "r_4s")]
    #[serde(rename = "r_4s")]
    RFour,
    #[sqlx(rename = "4_1s")]
    #[serde(rename = "4_1s")]
    FourOne,
    #[sqlx(rename = "10x")]
    #[serde(rename = "10x")]
    TenX,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabTestCatalog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub sample_type: Option<String>,
    pub normal_range: Option<String>,
    pub unit: Option<String>,
    pub price: Decimal,
    pub tat_hours: Option<i32>,
    pub is_active: bool,
    // Phase 2 fields
    pub loinc_code: Option<String>,
    pub method: Option<String>,
    pub specimen_volume: Option<String>,
    pub critical_low: Option<Decimal>,
    pub critical_high: Option<Decimal>,
    pub delta_check_percent: Option<Decimal>,
    pub auto_validation_rules: Option<serde_json::Value>,
    pub allows_add_on: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub test_id: Uuid,
    pub ordered_by: Uuid,
    pub status: LabOrderStatus,
    pub priority: LabPriority,
    pub collected_at: Option<DateTime<Utc>>,
    pub collected_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub rejection_reason: Option<String>,
    // Phase 2 fields
    pub sample_barcode: Option<String>,
    pub is_outsourced: bool,
    pub report_status: Option<LabReportStatus>,
    pub is_report_locked: bool,
    pub expected_tat_minutes: Option<i32>,
    pub completed_at: Option<DateTime<Utc>>,
    pub parent_order_id: Option<Uuid>,
    // Phase 3 fields
    pub is_stat: bool,
    pub collection_center_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabResult {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub parameter_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub normal_range: Option<String>,
    pub flag: Option<LabResultFlag>,
    pub notes: Option<String>,
    // Phase 2 fields
    pub previous_value: Option<String>,
    pub delta_percent: Option<Decimal>,
    pub is_delta_flagged: bool,
    pub is_auto_validated: bool,
    pub entered_by: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabTestPanel {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabPanelTest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub panel_id: Uuid,
    pub test_id: Uuid,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabSampleRejection {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub rejected_by: Uuid,
    pub rejection_reason: String,
    pub rejected_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Phase 2 structs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabResultAmendment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub result_id: Uuid,
    pub order_id: Uuid,
    pub original_value: Option<String>,
    pub amended_value: Option<String>,
    pub original_flag: Option<LabResultFlag>,
    pub amended_flag: Option<LabResultFlag>,
    pub reason: String,
    pub amended_by: Uuid,
    pub amended_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabCriticalAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub result_id: Uuid,
    pub patient_id: Uuid,
    pub parameter_name: String,
    pub value: String,
    pub flag: LabResultFlag,
    pub notified_to: Option<Uuid>,
    pub notified_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub readback_value: Option<String>,
    pub readback_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabReagentLot {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub reagent_name: String,
    pub lot_number: String,
    pub manufacturer: Option<String>,
    pub test_id: Option<Uuid>,
    pub received_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: Option<Decimal>,
    pub quantity_unit: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    // Phase 3 fields
    pub reorder_level: Option<Decimal>,
    pub consumption_per_test: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabQcResult {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub test_id: Uuid,
    pub lot_id: Uuid,
    pub level: String,
    pub target_mean: Option<Decimal>,
    pub target_sd: Option<Decimal>,
    pub observed_value: Option<Decimal>,
    pub sd_index: Option<Decimal>,
    pub status: LabQcStatus,
    pub westgard_violations: Option<Vec<LabWestgardRule>>,
    pub run_date: Option<NaiveDate>,
    pub run_time: DateTime<Utc>,
    pub performed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    pub reviewed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabCalibration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub test_id: Uuid,
    pub instrument_name: Option<String>,
    pub calibrator_lot: Option<String>,
    pub calibration_date: Option<NaiveDate>,
    pub next_calibration_date: Option<NaiveDate>,
    pub result_summary: Option<serde_json::Value>,
    pub is_passed: bool,
    pub performed_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabOutsourcedOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub external_lab_name: String,
    pub external_lab_code: Option<String>,
    pub sent_date: Option<NaiveDate>,
    pub expected_return_date: Option<NaiveDate>,
    pub actual_return_date: Option<NaiveDate>,
    pub external_ref_number: Option<String>,
    pub status: LabOutsourceStatus,
    pub cost: Option<Decimal>,
    pub notes: Option<String>,
    pub sent_by: Option<Uuid>,
    pub received_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Phase 3 enums
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_home_collection_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabHomeCollectionStatus {
    Scheduled,
    Assigned,
    InTransit,
    Arrived,
    Collected,
    ReturnedToLab,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_collection_center_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabCollectionCenterType {
    Hospital,
    Satellite,
    Partner,
    Camp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_sample_archive_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabSampleArchiveStatus {
    Stored,
    Retrieved,
    Discarded,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_dispatch_method", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabDispatchMethod {
    Counter,
    Email,
    Sms,
    Whatsapp,
    Portal,
    Courier,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lab_eqas_evaluation", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LabEqasEvaluation {
    Acceptable,
    Marginal,
    Unacceptable,
    Pending,
}

// ══════════════════════════════════════════════════════════
//  Phase 3 structs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabHomeCollection {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub scheduled_date: NaiveDate,
    pub scheduled_time_slot: Option<String>,
    pub address_line: String,
    pub city: Option<String>,
    pub pincode: Option<String>,
    pub contact_phone: Option<String>,
    pub assigned_phlebotomist: Option<Uuid>,
    pub status: LabHomeCollectionStatus,
    pub special_instructions: Option<String>,
    pub collected_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabCollectionCenter {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub center_type: LabCollectionCenterType,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub contact_person: Option<String>,
    pub is_active: bool,
    pub operating_hours: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabSampleArchive {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub sample_barcode: Option<String>,
    pub storage_location: Option<String>,
    pub stored_at: DateTime<Utc>,
    pub archived_by: Uuid,
    pub status: LabSampleArchiveStatus,
    pub retrieved_at: Option<DateTime<Utc>>,
    pub retrieved_by: Option<Uuid>,
    pub disposal_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabReportDispatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub dispatch_method: LabDispatchMethod,
    pub dispatched_to: Option<String>,
    pub dispatched_by: Uuid,
    pub dispatched_at: DateTime<Utc>,
    pub received_confirmation: bool,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabReportTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub template_name: String,
    pub header_html: Option<String>,
    pub footer_html: Option<String>,
    pub logo_url: Option<String>,
    pub report_format: Option<serde_json::Value>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List row — omits `header_html`/`footer_html`/`report_format` (the heavy
/// template body + layout JSON), fetched by id when editing (#167 projection).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabReportTemplateListItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub template_name: String,
    pub logo_url: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabEqasResult {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub program_name: String,
    pub provider: Option<String>,
    pub test_id: Uuid,
    pub cycle: Option<String>,
    pub sample_number: Option<String>,
    pub expected_value: Option<Decimal>,
    pub reported_value: Option<Decimal>,
    pub evaluation: LabEqasEvaluation,
    pub bias_percent: Option<Decimal>,
    pub z_score: Option<Decimal>,
    pub report_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabProficiencyTest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub program: String,
    pub test_id: Uuid,
    pub survey_round: Option<String>,
    pub sample_id: Option<String>,
    pub assigned_value: Option<Decimal>,
    pub reported_value: Option<Decimal>,
    pub acceptable_range_low: Option<Decimal>,
    pub acceptable_range_high: Option<Decimal>,
    pub is_acceptable: Option<bool>,
    pub evaluation_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabNablDocument {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_type: String,
    pub document_number: String,
    pub title: String,
    pub version: Option<String>,
    pub effective_date: Option<NaiveDate>,
    pub review_date: Option<NaiveDate>,
    pub approved_by: Option<Uuid>,
    pub file_path: Option<String>,
    pub is_current: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabHistopathReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub specimen_type: Option<String>,
    pub clinical_history: Option<String>,
    pub gross_description: Option<String>,
    pub microscopy_findings: Option<String>,
    pub special_stains: Option<serde_json::Value>,
    pub immunohistochemistry: Option<serde_json::Value>,
    pub synoptic_data: Option<serde_json::Value>,
    pub diagnosis: Option<String>,
    pub icd_code: Option<String>,
    pub pathologist_id: Option<Uuid>,
    pub reported_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub turnaround_days: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabCytologyReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub specimen_type: Option<String>,
    pub clinical_indication: Option<String>,
    pub adequacy: Option<String>,
    pub screening_findings: Option<String>,
    pub diagnosis: Option<String>,
    pub bethesda_category: Option<String>,
    pub cytopathologist_id: Option<Uuid>,
    pub reported_at: Option<DateTime<Utc>>,
    pub icd_code: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabMolecularReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub test_method: Option<String>,
    pub target_gene: Option<String>,
    pub primer_details: Option<String>,
    pub amplification_data: Option<serde_json::Value>,
    pub ct_value: Option<Decimal>,
    pub result_interpretation: Option<String>,
    pub quantitative_value: Option<Decimal>,
    pub quantitative_unit: Option<String>,
    pub kit_name: Option<String>,
    pub kit_lot: Option<String>,
    pub performed_by: Option<Uuid>,
    pub reported_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabB2bClient {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub client_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub contact_person: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub payment_terms_days: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabB2bRate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub client_id: Uuid,
    pub test_id: Uuid,
    pub agreed_price: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub effective_from: Option<NaiveDate>,
    pub effective_to: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabPhlebotomyQueue {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub priority: LabPriority,
    pub queue_number: Option<i32>,
    pub status: LabPhlebotomyStatus,
    pub assigned_to: Option<Uuid>,
    pub location_id: Option<Uuid>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
