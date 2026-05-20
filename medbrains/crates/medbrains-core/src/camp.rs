use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camp_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CampType {
    GeneralHealth,
    BloodDonation,
    Vaccination,
    EyeScreening,
    Dental,
    Awareness,
    Specialized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camp_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CampStatus {
    Planned,
    Approved,
    Setup,
    Active,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camp_registration_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CampRegistrationStatus {
    Registered,
    Screened,
    Referred,
    Converted,
    NoShow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camp_followup_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CampFollowupStatus {
    Scheduled,
    Completed,
    Missed,
    Cancelled,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Camp {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_code: String,
    pub name: String,
    pub camp_type: CampType,
    pub status: CampStatus,
    pub organizing_department_id: Option<Uuid>,
    pub coordinator_id: Option<Uuid>,
    pub scheduled_date: NaiveDate,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub venue_pincode: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub expected_participants: Option<i32>,
    pub actual_participants: Option<i32>,
    pub budget_allocated: Option<Decimal>,
    pub budget_spent: Option<Decimal>,
    pub logistics_notes: Option<String>,
    pub equipment_list: Option<serde_json::Value>,
    pub is_free: bool,
    pub discount_percentage: Option<Decimal>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancellation_reason: Option<String>,
    pub summary_notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampTeamMember {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub employee_id: Uuid,
    pub role_in_camp: String,
    pub is_confirmed: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampRegistration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub registration_number: String,
    pub person_name: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub patient_id: Option<Uuid>,
    pub clinical_department_id: Option<Uuid>,
    pub attending_doctor_id: Option<Uuid>,
    pub service_line: Option<String>,
    pub status: CampRegistrationStatus,
    pub chief_complaint: Option<String>,
    pub is_walk_in: bool,
    pub registered_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampScreening {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<Decimal>,
    pub blood_sugar_random: Option<Decimal>,
    pub bmi: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub weight_kg: Option<Decimal>,
    pub visual_acuity_left: Option<String>,
    pub visual_acuity_right: Option<String>,
    pub findings: Option<String>,
    pub diagnosis: Option<String>,
    pub advice: Option<String>,
    pub referred_to_hospital: bool,
    pub referral_department: Option<String>,
    pub referral_urgency: Option<String>,
    pub screened_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampLabSample {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub sample_type: String,
    pub test_requested: Option<String>,
    pub barcode: Option<String>,
    pub collected_at: Option<DateTime<Utc>>,
    pub collected_by: Option<Uuid>,
    pub sent_to_lab: bool,
    pub lab_order_id: Option<Uuid>,
    pub result_summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampBillingRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub service_description: String,
    pub standard_amount: Decimal,
    pub discount_percentage: Option<Decimal>,
    pub charged_amount: Decimal,
    pub is_free: bool,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
    pub billed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CampFollowup {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub followup_date: NaiveDate,
    pub followup_type: String,
    pub status: CampFollowupStatus,
    pub notes: Option<String>,
    pub outcome: Option<String>,
    pub converted_to_patient: bool,
    pub converted_patient_id: Option<Uuid>,
    pub converted_department_id: Option<Uuid>,
    pub followed_up_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
