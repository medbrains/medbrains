use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "document_template_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DocumentTemplateCategory {
    Prescription,
    ConsultationSummary,
    DischargeSummary,
    DeathCertificate,
    ConsentForm,
    LabReport,
    RadiologyReport,
    OpdBill,
    IpdBill,
    Receipt,
    CaseSheetCover,
    ProgressNote,
    NursingAssessment,
    MarChart,
    VitalsChart,
    SurgicalChecklist,
    AnesthesiaRecord,
    OperationNote,
    EmployeeIdCard,
    PurchaseOrder,
    PatientCard,
    Wristband,
    QueueToken,
    BmwManifest,
    PcpndtFormF,
    MlcCertificate,
    ReferralLetter,
    MedicalCertificate,
    FitnessCertificate,
    BloodRequisition,
    DietChart,
    InvestigationReport,
    TransferSummary,
    AdmissionForm,
    AgainstMedicalAdvice,
    MedicoLegalReport,
    BirthCertificate,
    DutyRoster,
    IndentForm,
    GrnForm,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "document_output_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DocumentOutputStatus {
    Draft,
    Generated,
    Printed,
    Downloaded,
    Voided,
    Superseded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "print_format", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PrintFormat {
    A4Portrait,
    A4Landscape,
    A5Portrait,
    A5Landscape,
    Thermal80mm,
    Thermal58mm,
    Label50x25mm,
    Wristband,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "watermark_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum WatermarkType {
    None,
    Draft,
    Confidential,
    Copy,
    Duplicate,
    Uncontrolled,
    Sample,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "print_job_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PrintJobStatus {
    Queued,
    Printing,
    Completed,
    Failed,
    Cancelled,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
pub struct DocumentTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: DocumentTemplateCategory,
    pub module_code: Option<String>,
    pub description: Option<String>,
    pub version: i32,
    pub is_active: bool,
    pub is_default: bool,
    pub print_format: PrintFormat,
    pub header_layout: Option<serde_json::Value>,
    pub body_layout: Option<serde_json::Value>,
    pub footer_layout: Option<serde_json::Value>,
    pub show_logo: bool,
    pub logo_position: Option<String>,
    pub show_hospital_name: bool,
    pub show_hospital_address: bool,
    pub show_hospital_phone: bool,
    pub show_registration_no: bool,
    pub show_accreditation: bool,
    pub font_family: Option<String>,
    pub font_size_pt: Option<i32>,
    pub margin_top_mm: Option<i32>,
    pub margin_bottom_mm: Option<i32>,
    pub margin_left_mm: Option<i32>,
    pub margin_right_mm: Option<i32>,
    pub show_page_numbers: bool,
    pub show_print_metadata: bool,
    pub show_qr_code: bool,
    pub default_watermark: WatermarkType,
    pub signature_blocks: Option<serde_json::Value>,
    pub required_context: Option<Vec<String>>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub brand_entity_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentTemplateVersion {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub template_id: Uuid,
    pub version_number: i32,
    pub snapshot: serde_json::Value,
    pub change_summary: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentOutput {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub template_id: Option<Uuid>,
    pub template_version: Option<i32>,
    pub module_code: Option<String>,
    pub source_table: Option<String>,
    pub source_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub visit_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub document_number: String,
    pub title: String,
    pub category: DocumentTemplateCategory,
    pub status: DocumentOutputStatus,
    pub file_url: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub page_count: Option<i32>,
    pub print_count: i32,
    pub first_printed_at: Option<DateTime<Utc>>,
    pub last_printed_at: Option<DateTime<Utc>>,
    pub watermark: WatermarkType,
    pub language_code: Option<String>,
    pub context_snapshot: Option<serde_json::Value>,
    pub qr_code_data: Option<String>,
    pub document_hash: Option<String>,
    pub generated_by: Option<Uuid>,
    pub voided_by: Option<Uuid>,
    pub voided_at: Option<DateTime<Utc>>,
    pub voided_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentOutputSignature {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_output_id: Uuid,
    pub signer_role: String,
    pub signer_name: Option<String>,
    pub designation: Option<String>,
    pub registration_number: Option<String>,
    pub signature_type: crate::consent::SignatureType,
    pub signature_image_url: Option<String>,
    pub biometric_hash: Option<String>,
    pub aadhaar_ref: Option<String>,
    pub thumb_impression: bool,
    pub signed_at: DateTime<Utc>,
    pub captured_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentFormReviewSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub template_id: Uuid,
    pub review_cycle_months: i32,
    pub last_reviewed_at: Option<DateTime<Utc>>,
    pub last_reviewed_by: Option<Uuid>,
    pub next_review_due: Option<NaiveDate>,
    pub review_status: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PrinterConfig {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub printer_type: String,
    pub connection_type: Option<String>,
    pub connection_string: Option<String>,
    pub department_id: Option<Uuid>,
    pub default_format: PrintFormat,
    pub capabilities: Option<serde_json::Value>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PrintJob {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_output_id: Uuid,
    pub printer_id: Option<Uuid>,
    pub status: PrintJobStatus,
    pub copies: i32,
    pub priority: i32,
    pub department_id: Option<Uuid>,
    pub submitted_by: Option<Uuid>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
