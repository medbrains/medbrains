use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "anc_risk_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AncRiskCategory {
    Low,
    Moderate,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "delivery_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryType {
    NormalVaginal,
    AssistedVaginal,
    LscsElective,
    LscsEmergency,
    Breech,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "labor_stage", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LaborStage {
    FirstLatent,
    FirstActive,
    Second,
    Third,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MaternityRegistration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub registration_number: String,
    pub lmp_date: NaiveDate,
    pub edd_date: NaiveDate,
    pub gravida: i32,
    pub para: i32,
    pub abortion: i32,
    pub living: i32,
    pub risk_category: AncRiskCategory,
    pub blood_group: Option<String>,
    pub rh_factor: Option<String>,
    pub is_high_risk: bool,
    pub high_risk_reasons: serde_json::Value,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AncVisit {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub visit_number: i32,
    pub gestational_weeks: rust_decimal::Decimal,
    pub weight_kg: Option<rust_decimal::Decimal>,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub fundal_height_cm: Option<rust_decimal::Decimal>,
    pub fetal_heart_rate: Option<i32>,
    pub hemoglobin: Option<rust_decimal::Decimal>,
    pub urine_protein: Option<String>,
    pub urine_sugar: Option<String>,
    pub pcpndt_form_f_filed: bool,
    pub pcpndt_form_f_number: Option<String>,
    pub ultrasound_done: bool,
    pub examined_by: Uuid,
    pub visit_date: NaiveDate,
    pub next_visit_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LaborRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub labor_onset_time: Option<DateTime<Utc>>,
    pub current_stage: LaborStage,
    pub partograph_data: serde_json::Value,
    pub cervical_dilation_log: serde_json::Value,
    pub delivery_type: Option<DeliveryType>,
    pub delivery_time: Option<DateTime<Utc>>,
    pub placenta_delivery_time: Option<DateTime<Utc>>,
    pub blood_loss_ml: Option<i32>,
    pub episiotomy: bool,
    pub perineal_tear_grade: Option<i32>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub baby_weight_gm: Option<i32>,
    pub attending_doctor_id: Option<Uuid>,
    pub midwife_id: Option<Uuid>,
    pub complications: Option<String>,
    pub notes: Option<String>,
    /// Server-derived postpartum-haemorrhage severity: none | pph | severe (NULL if blood loss unset).
    pub pph_severity: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NewbornRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub labor_id: Uuid,
    pub birth_date: DateTime<Utc>,
    pub gender: String,
    pub weight_gm: i32,
    pub length_cm: Option<rust_decimal::Decimal>,
    pub head_circumference_cm: Option<rust_decimal::Decimal>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub apgar_10min: Option<i32>,
    pub resuscitation_needed: bool,
    pub bcg_given: bool,
    pub opv_given: bool,
    pub hep_b_given: bool,
    pub vitamin_k_given: bool,
    pub nicu_admission_needed: bool,
    pub nicu_admission_reason: Option<String>,
    pub birth_certificate_number: Option<String>,
    pub congenital_anomalies: Option<String>,
    pub notes: Option<String>,
    pub mother_id: Option<Uuid>,
    pub id_band_number: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PostnatalRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub registration_id: Uuid,
    pub day_postpartum: i32,
    pub mother_vitals: serde_json::Value,
    pub uterus_involution: Option<String>,
    pub lochia: Option<String>,
    pub breast_feeding_status: Option<String>,
    pub baby_vitals: serde_json::Value,
    pub baby_weight_gm: Option<i32>,
    pub baby_feeding: Option<String>,
    pub examined_by: Uuid,
    pub visit_date: NaiveDate,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
