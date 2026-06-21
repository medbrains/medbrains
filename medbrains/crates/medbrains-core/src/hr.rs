use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "employment_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmploymentType {
    Permanent,
    Contract,
    Visiting,
    Intern,
    Resident,
    Fellow,
    Volunteer,
    Outsourced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "employee_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmployeeStatus {
    Active,
    OnLeave,
    Suspended,
    Resigned,
    Terminated,
    Retired,
    Absconding,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "credential_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CredentialType {
    MedicalCouncil,
    NursingCouncil,
    PharmacyCouncil,
    DentalCouncil,
    OtherCouncil,
    Bls,
    Acls,
    Pals,
    Nals,
    FireSafety,
    RadiationSafety,
    NabhOrientation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "credential_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CredentialStatus {
    Active,
    Expired,
    Suspended,
    Revoked,
    PendingRenewal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "leave_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LeaveType {
    Casual,
    Earned,
    Medical,
    Maternity,
    Paternity,
    Compensatory,
    Study,
    Special,
    LossOfPay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "leave_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LeaveStatus {
    Draft,
    PendingHod,
    PendingAdmin,
    Approved,
    Rejected,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "shift_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ShiftType {
    Morning,
    Afternoon,
    Evening,
    Night,
    General,
    Split,
    OnCall,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "training_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TrainingStatus {
    Scheduled,
    InProgress,
    Completed,
    Cancelled,
    Failed,
}

// ── Structs ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Designation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub level: i32,
    pub category: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Employee {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub employee_code: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub employment_type: EmploymentType,
    pub status: EmployeeStatus,
    pub department_id: Option<Uuid>,
    pub designation_id: Option<Uuid>,
    pub reporting_to: Option<Uuid>,
    pub date_of_joining: NaiveDate,
    pub date_of_leaving: Option<NaiveDate>,
    pub qualifications: serde_json::Value,
    pub blood_group: Option<String>,
    pub address: serde_json::Value,
    pub emergency_contact: serde_json::Value,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub pf_number: Option<String>,
    pub esi_number: Option<String>,
    pub uan_number: Option<String>,
    pub pan_number: Option<String>,
    pub aadhaar_number: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EmployeeCredential {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub credential_type: CredentialType,
    pub issuing_body: String,
    pub registration_no: String,
    pub state_code: Option<String>,
    pub issued_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub status: CredentialStatus,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ShiftDefinition {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub shift_type: ShiftType,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub break_minutes: i32,
    pub is_night: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DutyRoster {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub department_id: Option<Uuid>,
    pub shift_id: Uuid,
    pub roster_date: NaiveDate,
    pub is_on_call: bool,
    pub swap_with: Option<Uuid>,
    pub swap_approved: bool,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AttendanceRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub attendance_date: NaiveDate,
    pub shift_id: Option<Uuid>,
    pub check_in: Option<DateTime<Utc>>,
    pub check_out: Option<DateTime<Utc>>,
    pub is_late: bool,
    pub late_minutes: i32,
    pub is_early_out: bool,
    pub early_minutes: i32,
    pub overtime_minutes: i32,
    pub status: String,
    pub source: String,
    pub notes: Option<String>,
    pub recorded_by: Uuid,
    pub planned_end: Option<DateTime<Utc>>,
    pub extended_until: Option<DateTime<Utc>>,
    pub extension_reason: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_minutes: i32,
    pub session_status: String,
    pub fatigue_ack_at: Option<DateTime<Utc>>,
    pub fatigue_ack_reason: Option<String>,
    pub fatigue_flags: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeaveBalance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub leave_type: LeaveType,
    pub year: i32,
    pub opening: rust_decimal::Decimal,
    pub earned: rust_decimal::Decimal,
    pub used: rust_decimal::Decimal,
    pub balance: rust_decimal::Decimal,
    pub carry_forward: rust_decimal::Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeaveRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub leave_type: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub days: rust_decimal::Decimal,
    pub is_half_day: bool,
    pub reason: Option<String>,
    pub status: LeaveStatus,
    pub hod_id: Option<Uuid>,
    pub hod_action_at: Option<DateTime<Utc>>,
    pub hod_remarks: Option<String>,
    pub admin_id: Option<Uuid>,
    pub admin_action_at: Option<DateTime<Utc>>,
    pub admin_remarks: Option<String>,
    pub cancelled_by: Option<Uuid>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OnCallSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub department_id: Option<Uuid>,
    pub schedule_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub is_primary: bool,
    pub contact_number: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrainingProgram {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_mandatory: bool,
    pub frequency_months: Option<i32>,
    pub duration_hours: Option<rust_decimal::Decimal>,
    pub target_roles: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrainingRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub program_id: Uuid,
    pub training_date: NaiveDate,
    pub status: TrainingStatus,
    pub score: Option<rust_decimal::Decimal>,
    pub certificate_no: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub trainer_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Appraisal {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub appraisal_year: i32,
    pub appraiser_id: Option<Uuid>,
    pub rating: Option<rust_decimal::Decimal>,
    pub strengths: Option<String>,
    pub improvements: Option<String>,
    pub goals: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StatutoryRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub record_type: String,
    pub title: String,
    pub compliance_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub details: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
