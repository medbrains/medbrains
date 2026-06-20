#![allow(clippy::too_many_lines)]

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ──────────────────────────────────────────────
//  Enums
// ──────────────────────────────────────────────

/// Biological sex — used for clinical purposes (lab ranges, drug dosing).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "gender", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Gender {
    Male,
    Female,
    Other,
    Unknown,
}

/// Patient category — determines billing, priority, and reporting.
/// Configurable per tenant: each hospital defines its own category list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "patient_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PatientCategory {
    General,
    Private,
    Insurance,
    Pmjay,
    Cghs,
    Staff,
    Vip,
    Mlc,
    Esi,
    Corporate,
    Free,
    Charity,
    ResearchSubject,
    StaffDependent,
}

/// Marital status — captures civil/legal partnership state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "marital_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MaritalStatus {
    Single,
    Married,
    Divorced,
    Widowed,
    Separated,
    DomesticPartner,
    Unknown,
}

/// How the patient was registered — determines workflow path.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "registration_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RegistrationType {
    New,
    Revisit,
    TransferIn,
    Referral,
    Emergency,
    Camp,
    Telemedicine,
    PreRegistration,
}

/// Where the registration originated — used for analytics and source tracking.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "registration_source", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RegistrationSource {
    WalkIn,
    Phone,
    OnlinePortal,
    MobileApp,
    Kiosk,
    Referral,
    Ambulance,
    Camp,
    Telemedicine,
}

/// Address classification — each patient may have multiple addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "address_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AddressType {
    Current,
    Permanent,
    Correspondence,
    Workplace,
    Temporary,
}

/// Government-issued or organizational identifier type.
/// Covers India (Aadhaar, PAN, ABHA), US (SSN), UK (NHS), Australia (Medicare),
/// Gulf (Emirates ID, Iqama), and universal (passport, national ID).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "identifier_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IdentifierType {
    Aadhaar,
    Pan,
    VoterId,
    DrivingLicense,
    Passport,
    RationCard,
    Ssn,
    NhsNumber,
    MedicareNumber,
    NationalId,
    BirthCertificate,
    EmployeeId,
    DisabilityCertificate,
    Abha,
    AbhaAddress,
    EmiratesId,
    Iqama,
    UhidExternal,
}

/// ABO/Rh blood group classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "blood_group", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BloodGroup {
    APositive,
    ANegative,
    BPositive,
    BNegative,
    AbPositive,
    AbNegative,
    OPositive,
    ONegative,
    Unknown,
}

/// Allergy category — used for clinical decision support alerts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "allergy_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AllergyType {
    Drug,
    Food,
    Environmental,
    Latex,
    ContrastDye,
    Biological,
    Other,
}

/// Severity grading for allergic reactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "allergy_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AllergySeverity {
    Mild,
    Moderate,
    Severe,
    LifeThreatening,
}

/// Type of patient consent being captured.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consent_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsentType {
    GeneralTreatment,
    DataSharing,
    AbdmLinking,
    ResearchParticipation,
    SmsCommunication,
    EmailCommunication,
    Photography,
    AdvanceDirective,
    OrganDonation,
    HieParticipation,
}

/// Current state of a consent record.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consent_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsentStatus {
    Granted,
    Denied,
    Withdrawn,
    Pending,
}

/// How the consent was captured — affects legal validity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "consent_capture_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConsentCaptureMode {
    PaperSigned,
    DigitalSignature,
    Biometric,
    OtpVerified,
    VerbalRecorded,
}

/// Financial classification — determines billing workflow and payer routing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "financial_class", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum FinancialClass {
    SelfPay,
    Insurance,
    GovernmentScheme,
    Corporate,
    Charity,
    Research,
}

// ──────────────────────────────────────────────
//  Core Patient Struct
// ──────────────────────────────────────────────

/// Patient demographics — UHID is the primary hospital identifier, ABHA is national.
///
/// This struct maps to the `patients` table and includes all columns added by the
/// patient registration migration (`003_patient_registration.sql`). New fields
/// default to `Option` or have DB-level defaults so `SELECT *` remains compatible.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
pub struct Patient {
    pub id: Uuid,
    pub tenant_id: Uuid,

    // ── Identifiers ──
    /// Unique Hospital ID — format configurable per tenant (e.g., `AGI-2026-00001`).
    pub uhid: String,
    /// Ayushman Bharat Health Account — optional, linked via ABDM.
    pub abha_id: Option<String>,

    // ── Name ──
    /// Honorific prefix (Dr., Mr., Mrs., etc.).
    pub prefix: Option<String>,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    /// Academic/professional suffix (Jr., Sr., `PhD`, etc.).
    pub suffix: Option<String>,
    /// Full name in local script (Hindi, Arabic, etc.).
    pub full_name_local: Option<String>,

    // ── Family ──
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub spouse_name: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relation: Option<String>,

    // ── Demographics ──
    pub date_of_birth: Option<NaiveDate>,
    /// True if DOB was calculated from a stated age rather than a known date.
    pub is_dob_estimated: bool,
    pub gender: Gender,
    /// Self-identified gender identity (free text). Separate from biological sex.
    pub gender_identity: Option<String>,
    pub marital_status: Option<MaritalStatus>,
    pub religion: Option<String>,
    pub nationality_id: Option<Uuid>,
    pub preferred_language: Option<String>,
    pub birth_place: Option<String>,

    // ── Clinical quick-reference ──
    pub blood_group: Option<BloodGroup>,
    /// True if blood group was lab-verified (not just patient-reported).
    pub blood_group_verified: bool,
    /// Explicit NKDA (No Known Drug Allergies) flag. `None` means not yet assessed.
    pub no_known_allergies: Option<bool>,

    // ── Socioeconomic ──
    pub occupation: Option<String>,
    pub education_level: Option<String>,

    // ── Contact ──
    pub phone: String,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,
    /// Preferred method: phone, sms, email, whatsapp.
    pub preferred_contact_method: Option<String>,

    // ── Legacy JSON address (kept for backward compatibility) ──
    /// Extensible address blob — new registrations use `patient_addresses` table instead.
    pub address: Option<serde_json::Value>,

    // ── Registration metadata ──
    pub category: PatientCategory,
    pub registration_type: RegistrationType,
    pub registration_source: Option<RegistrationSource>,
    pub registered_by: Option<Uuid>,
    pub registered_at_facility: Option<Uuid>,
    pub financial_class: FinancialClass,

    // ── MLC (Medico-Legal Case) ──
    pub is_medico_legal: bool,
    pub mlc_number: Option<String>,

    // ── Special patient flags ──
    /// Unknown/unidentified patient (unconscious, trauma).
    pub is_unknown_patient: bool,
    /// Auto-generated temporary name for unknown patients (e.g., "Unknown Male #47").
    pub temporary_name: Option<String>,
    /// VIP flag — restricts record access to designated staff only.
    pub is_vip: bool,

    // ── Deceased ──
    pub is_deceased: bool,
    pub deceased_date: Option<DateTime<Utc>>,

    // ── Photo ──
    pub photo_url: Option<String>,
    pub photo_captured_at: Option<DateTime<Utc>>,

    // ── Data quality & visit tracking ──
    /// Completeness score (0-100) computed by the data quality engine.
    pub data_quality_score: Option<i16>,
    pub last_visit_date: Option<NaiveDate>,
    pub total_visits: i32,

    // ── Merge state ──
    /// True if this record has been merged into another patient.
    pub is_merged: bool,
    /// Points to the surviving patient record after a merge.
    pub merged_into_patient_id: Option<Uuid>,

    // ── Migration / external system ──
    /// Name of the source system for imported records.
    pub source_system: Option<String>,
    /// Original ID from a legacy/external system.
    pub legacy_id: Option<String>,

    // ── Extensible attributes ──
    /// Extensible attributes — ID proofs, photo, blood group, etc.
    pub attributes: serde_json::Value,

    // ── Lifecycle ──
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Sub-Resource Structs
// ──────────────────────────────────────────────

/// Government-issued or organizational identifier linked to a patient.
///
/// Maps to `patient_identifiers` table. Supports Aadhaar (hash-only storage),
/// PAN, passport, ABHA, NHS number, SSN, Emirates ID, and more.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientIdentifier {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub id_type: IdentifierType,
    pub id_number: String,
    /// SHA-256 hash for indexed lookup (especially Aadhaar — raw number is never stored).
    pub id_number_hash: Option<String>,
    pub issuing_authority: Option<String>,
    pub issuing_country_id: Option<Uuid>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub is_verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub verification_mode: Option<String>,
    pub document_url: Option<String>,
    /// True if this is the primary identifier for display purposes.
    pub is_primary: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Patient address record — each patient may have multiple addresses (current, permanent, etc.).
///
/// Maps to `patient_addresses` table. Linked to `geo_countries`, `geo_states`,
/// and `geo_districts` for standardized geographic data.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientAddress {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub address_type: AddressType,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub village_town: Option<String>,
    pub city: String,
    pub district_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub country_id: Uuid,
    pub postal_code: String,
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub is_primary: bool,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Emergency contact, next of kin, or legal guardian linked to a patient.
///
/// Maps to `patient_contacts` table. Multiple contacts are ordered by `priority`.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientContact {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub contact_name: String,
    pub relation: String,
    pub phone: String,
    pub phone_alt: Option<String>,
    pub email: Option<String>,
    pub address: Option<serde_json::Value>,
    pub is_emergency_contact: bool,
    pub is_next_of_kin: bool,
    pub is_legal_guardian: bool,
    /// Display/call priority — lower number = higher priority.
    pub priority: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Insurance policy linked to a patient.
///
/// Maps to `patient_insurance` table. Supports primary and secondary policies
/// with TPA (Third Party Administrator) details.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientInsurance {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub company_id: Option<Uuid>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub insurance_provider: String,
    pub policy_number: String,
    pub group_number: Option<String>,
    pub member_id: Option<String>,
    pub plan_name: Option<String>,
    pub policy_holder_name: Option<String>,
    pub policy_holder_relation: Option<String>,
    pub valid_from: NaiveDate,
    pub valid_until: NaiveDate,
    /// Maximum coverage amount under this policy.
    pub sum_insured: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub tpa_id: Option<String>,
    /// Coverage type: cashless, reimbursement, both.
    pub coverage_type: Option<String>,
    /// Policy priority — 1 = primary, 2 = secondary, etc.
    pub priority: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Patient allergy record — used for clinical decision support and drug interaction alerts.
///
/// Maps to `patient_allergies` table. Allergens may reference SNOMED CT or `RxNorm` codes.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientAllergy {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub allergy_type: AllergyType,
    pub allergen_name: String,
    /// SNOMED CT or `RxNorm` code for the allergen.
    pub allergen_code: Option<String>,
    pub reaction: Option<String>,
    pub severity: Option<AllergySeverity>,
    pub onset_date: Option<NaiveDate>,
    pub reported_by: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Patient consent record — tracks consent grants, denials, and withdrawals.
///
/// Maps to `patient_consents` table. General treatment consent is mandatory
/// before any clinical encounter per NABH PRE.1 / JCI PFR.5.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientConsent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub consent_type: ConsentType,
    pub consent_status: ConsentStatus,
    pub consent_date: DateTime<Utc>,
    pub consent_version: Option<String>,
    /// Name of the person who gave consent (patient or representative).
    pub consented_by: String,
    /// Relationship if consent was given by a representative.
    pub consented_by_relation: Option<String>,
    pub witness_name: Option<String>,
    pub capture_mode: ConsentCaptureMode,
    pub document_url: Option<String>,
    pub valid_until: Option<NaiveDate>,
    pub notes: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Audit trail for patient record merges (Master Patient Index operations).
///
/// Maps to `patient_merge_history` table. `merge_data` contains a JSONB snapshot
/// of the merged record for auditability and potential unmerge.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientMergeHistory {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    /// The patient record that survives the merge.
    pub surviving_patient_id: Uuid,
    /// The patient record that was merged (marked `is_merged = true`).
    pub merged_patient_id: Uuid,
    /// User who performed the merge.
    pub merged_by: Uuid,
    pub merge_reason: String,
    /// Full snapshot of the merged patient record before merge.
    pub merge_data: serde_json::Value,
    pub unmerged_at: Option<DateTime<Utc>>,
    pub unmerged_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Document (ID proof, consent form, referral letter, photo) uploaded for a patient.
///
/// Maps to `patient_documents` table. File content is stored externally (S3/MinIO);
/// this record holds the URL reference and metadata.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientDocument {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    /// Category: `id_proof`, `consent_form`, `referral_letter`, `photo`, `report`.
    pub document_type: String,
    pub document_name: String,
    pub file_url: String,
    /// File size in bytes.
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub uploaded_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Family link between two patient records.
///
/// Maps to `patient_family_links` table. Used for household view, shared
/// demographics, and insurance propagation.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientFamilyLink {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub related_patient_id: Uuid,
    pub relationship: String,
    pub is_primary_contact: bool,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// ABDM (Ayushman Bharat Digital Mission) ABHA linking state for a patient.
///
/// Maps to `patient_abha_links` table. Tracks the ABHA 14-digit number,
/// ABHA address, linking token validity, and KYC verification status.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientAbhaLink {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    /// ABHA 14-digit number (format: XX-XXXX-XXXX-XXXX).
    pub abha_number: String,
    /// ABHA address (format: username@abdm).
    pub abha_address: Option<String>,
    /// Linking token issued by ABDM — valid for 30 minutes.
    pub linking_token: Option<String>,
    pub token_expiry: Option<DateTime<Utc>>,
    /// True if identity was verified via Aadhaar e-KYC.
    pub kyc_verified: bool,
    /// Current state: linked, unlinked, pending.
    pub status: String,
    pub linked_at: DateTime<Utc>,
    pub unlinked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Master Tables
// ──────────────────────────────────────────────

/// Religion master — tenant-configurable with optional global defaults.
///
/// Maps to `master_religions` table. `tenant_id = None` indicates a global default
/// available to all tenants.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MasterReligion {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_active: bool,
}

/// Occupation master — tenant-configurable, based on ISCO-08 classification.
///
/// Maps to `master_occupations` table. `tenant_id = None` indicates a global default.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MasterOccupation {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_active: bool,
}

/// Relation master — defines relationship types for contacts and guardians.
///
/// Maps to `master_relations` table. `tenant_id = None` indicates a global default.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MasterRelation {
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub delete_reason: Option<String>,
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_active: bool,
}

/// Insurance provider master — tenant-scoped directory of insurance companies and TPAs.
///
/// Maps to `master_insurance_providers` table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MasterInsuranceProvider {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    /// Provider category: private, government, tpa.
    pub provider_type: String,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub website: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}
