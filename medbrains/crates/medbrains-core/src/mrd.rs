//! Medical Records Department (MRD) domain types.

use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "mrd_record_status", rename_all = "snake_case")]
pub enum MrdRecordStatus {
    Active,
    Archived,
    Destroyed,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "mrd_movement_status", rename_all = "snake_case")]
pub enum MrdMovementStatus {
    Issued,
    Returned,
    Overdue,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "mrd_register_type", rename_all = "snake_case")]
pub enum MrdRegisterType {
    Birth,
    Death,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdMedicalRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub record_number: String,
    pub record_type: String,
    pub volume_number: i32,
    pub total_pages: Option<i32>,
    pub shelf_location: Option<String>,
    pub status: MrdRecordStatus,
    pub last_accessed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub retention_years: i32,
    pub destruction_due_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdRecordMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub medical_record_id: Uuid,
    pub issued_to_user_id: Option<Uuid>,
    pub issued_to_department_id: Option<Uuid>,
    pub issued_at: chrono::DateTime<chrono::Utc>,
    pub due_date: Option<NaiveDate>,
    pub returned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub status: MrdMovementStatus,
    pub purpose: Option<String>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdBirthRegister {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub register_number: String,
    pub birth_date: NaiveDate,
    pub birth_time: Option<NaiveTime>,
    pub baby_gender: String,
    pub baby_weight_grams: Option<i32>,
    pub birth_type: String,
    pub apgar_1min: Option<i16>,
    pub apgar_5min: Option<i16>,
    pub complications: Option<String>,
    pub attending_doctor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_issued: bool,
    pub father_name: Option<String>,
    pub mother_age: Option<i32>,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdDeathRegister {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
    pub mlc_case_id: Option<Uuid>,
    pub register_number: String,
    pub death_date: NaiveDate,
    pub death_time: Option<NaiveTime>,
    pub cause_of_death: Option<String>,
    pub immediate_cause: Option<String>,
    pub antecedent_cause: Option<String>,
    pub underlying_cause: Option<String>,
    pub manner_of_death: String,
    pub is_medico_legal: bool,
    pub is_brought_dead: bool,
    pub certifying_doctor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_issued: bool,
    pub reported_to_municipality: bool,
    pub municipality_report_date: Option<NaiveDate>,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdRetentionPolicy {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub record_type: String,
    pub category: String,
    pub retention_years: i32,
    pub legal_reference: Option<String>,
    pub destruction_method: Option<String>,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdStorageLocation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub building: Option<String>,
    pub floor: Option<String>,
    pub room: Option<String>,
    pub rack: Option<String>,
    pub shelf: Option<String>,
    pub bin: Option<String>,
    pub barcode: Option<String>,
    pub capacity: Option<i32>,
    pub current_count: i32,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdCaseSheetPacket {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub medical_record_id: Option<Uuid>,
    pub packet_number: String,
    pub packet_type: String,
    pub status: String,
    pub version: i32,
    pub page_count: i32,
    pub document_output_id: Option<Uuid>,
    pub print_job_id: Option<Uuid>,
    pub storage_location_id: Option<Uuid>,
    pub shelf_location: Option<String>,
    pub source_snapshot: Value,
    pub reprint_reason: Option<String>,
    pub notes: Option<String>,
    pub generated_by: Option<Uuid>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
    pub printed_by: Option<Uuid>,
    pub printed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub filed_by: Option<Uuid>,
    pub filed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub voided_by: Option<Uuid>,
    pub voided_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdCaseSheetPage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub packet_id: Uuid,
    pub page_code: String,
    pub page_title: String,
    pub page_order: i32,
    pub source_module: Option<String>,
    pub source_table: Option<String>,
    pub source_id: Option<Uuid>,
    pub document_output_id: Option<Uuid>,
    pub is_required: bool,
    pub status: String,
    pub deficiency_reason: Option<String>,
    pub marked_deficient_by: Option<Uuid>,
    pub marked_deficient_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub printed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MrdFormRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub form_type: String,
    pub template_id: Option<Uuid>,
    pub form_date: NaiveDate,
    pub form_time: Option<NaiveTime>,
    pub shift: Option<String>,
    pub form_data: Value,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub pdf_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub created_by: Uuid,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    // joined
    pub completed_by_name: Option<String>,
    pub verified_by_name: Option<String>,
}
