use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consent_template_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsentTemplateCategory {
    General,
    Surgical,
    Anesthesia,
    BloodTransfusion,
    Investigation,
    DataSharing,
    Research,
    Photography,
    Teaching,
    Refusal,
    AdvanceDirective,
    OrganDonation,
    Communication,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consent_audit_action", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsentAuditAction {
    Created,
    Granted,
    Denied,
    Signed,
    Refused,
    Withdrawn,
    Revoked,
    Expired,
    Renewed,
    Amended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "signature_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SignatureType {
    PenOnPaper,
    DigitalPen,
    AadhaarEsign,
    BiometricThumb,
    Otp,
    VideoConsent,
    VerbalWitness,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
pub struct ConsentTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: ConsentTemplateCategory,
    pub version: i32,
    pub body_text: serde_json::Value,
    pub risks_section: Option<serde_json::Value>,
    pub alternatives_section: Option<serde_json::Value>,
    pub benefits_section: Option<serde_json::Value>,
    pub required_fields: Vec<String>,
    pub requires_witness: bool,
    pub requires_doctor: bool,
    pub validity_days: Option<i32>,
    pub applicable_departments: Option<Vec<Uuid>>,
    pub is_read_aloud_required: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List row — omits `body_text` + the risks/alternatives/benefits sections
/// (heavy per-language JSONB). The editor fetches the full template by id
/// (#167 field projection).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
pub struct ConsentTemplateListItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: ConsentTemplateCategory,
    pub version: i32,
    pub required_fields: Vec<String>,
    pub requires_witness: bool,
    pub requires_doctor: bool,
    pub validity_days: Option<i32>,
    pub applicable_departments: Option<Vec<Uuid>>,
    pub is_read_aloud_required: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConsentAuditEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub consent_source: String,
    pub consent_id: Uuid,
    pub action: ConsentAuditAction,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub changed_by: Option<Uuid>,
    pub change_reason: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConsentSignatureMetadata {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub consent_source: String,
    pub consent_id: Uuid,
    pub signature_type: SignatureType,
    pub signature_image_url: Option<String>,
    pub video_consent_url: Option<String>,
    pub aadhaar_esign_ref: Option<String>,
    pub aadhaar_esign_timestamp: Option<DateTime<Utc>>,
    pub biometric_hash: Option<String>,
    pub biometric_device_id: Option<String>,
    pub witness_name: Option<String>,
    pub witness_designation: Option<String>,
    pub witness_signature_url: Option<String>,
    pub doctor_signature_url: Option<String>,
    pub captured_at: DateTime<Utc>,
    pub captured_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
