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
    /// Printed on the camp form as "Father / Spouse name" — the identifier
    /// rural registers actually use to tell two same-named people apart.
    pub father_spouse_name: Option<String>,
    pub marital_status: Option<String>,
    /// As reported at the desk, not as typed from a sample.
    pub blood_group: Option<String>,
    /// The form's combined "Insurance name / number" box.
    pub insurance_details: Option<String>,
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
    // ── Medical history ──────────────────────────────────────
    // Tick boxes on the paper form, so `None` and `Some(false)` are different
    // facts: not asked versus asked and denied. A screening camp cannot treat
    // an unasked question as a negative finding.
    pub mh_diabetes: Option<bool>,
    pub mh_hypertension: Option<bool>,
    pub mh_asthma: Option<bool>,
    pub mh_heart_disease: Option<bool>,
    pub mh_thyroid_disorder: Option<bool>,
    pub mh_previous_surgeries: Option<bool>,
    pub mh_allergies: Option<bool>,
    pub mh_smoking_history: Option<bool>,
    pub mh_alcohol_use: Option<bool>,
    pub mh_family_history: Option<bool>,
    pub mh_others: Option<bool>,
    pub medical_history_notes: Option<String>,
    // ── Point-of-care tests ──────────────────────────────────
    // Numeric where the form records a number and the value is worth trending.
    pub test_hba1c: Option<Decimal>,
    pub test_haemoglobin: Option<Decimal>,
    pub test_thyroid: Option<Decimal>,
    // Handwritten impressions — coding these would invent precision the paper
    // never had.
    pub test_ecg: Option<String>,
    pub test_xray: Option<String>,
    pub test_bmd: Option<String>,
    pub test_biothesiometry: Option<String>,
    pub findings: Option<String>,
    pub diagnosis: Option<String>,
    pub advice: Option<String>,
    pub referred_to_hospital: bool,
    pub referral_department: Option<String>,
    /// Named on the form, often somebody who is not a user of this system.
    pub referral_doctor_name: Option<String>,
    pub referral_urgency: Option<String>,
    /// ICD-10 assigned at the camp. An array because one screening routinely
    /// yields more than one.
    pub icd_codes: Option<Vec<String>>,
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
    pub tax_percent: Decimal,
    pub tax_amount: Decimal,
    pub total_amount: Decimal,
    pub sponsor_covered_amount: Decimal,
    pub is_free: bool,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
    pub source_module: Option<String>,
    pub source_entity_id: Option<Uuid>,
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
