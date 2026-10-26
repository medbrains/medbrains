use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "icu_score_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IcuScoreType {
    ApacheIi,
    ApacheIv,
    Sofa,
    Gcs,
    Prism,
    Snappe,
    Rass,
    CamIcu,
    // The bedside scores the ICU and wards record. The Postgres enum carried
    // these and Rust did not, so reading any NEWS2, qSOFA or other such score
    // back failed to decode and the scores tab answered 500.
    Aldrete,
    News2,
    Meows,
    Pews,
    Qsofa,
    Cpot,
    Curb65,
    ChildPugh,
    Meld,
    CiwaAr,
    WellsPe,
    WellsDvt,
    #[sqlx(rename = "cha2ds2_vasc")]
    #[serde(rename = "cha2ds2_vasc")]
    Cha2ds2Vasc,
    HasBled,
    GlasgowBlatchford,
    MustNutrition,
    Hypoglycaemia,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ventilator_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VentilatorMode {
    Cmv,
    Acv,
    Simv,
    Psv,
    Cpap,
    Bipap,
    Hfov,
    Aprv,
    Niv,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "device_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    CentralLine,
    UrinaryCatheter,
    Ventilator,
    ArterialLine,
    PeripheralIv,
    NasogastricTube,
    ChestTube,
    Tracheostomy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "nutrition_route", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NutritionRoute {
    Enteral,
    Parenteral,
    Oral,
    Npo,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuFlowsheet {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub heart_rate: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub mean_arterial_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<rust_decimal::Decimal>,
    pub temperature: Option<rust_decimal::Decimal>,
    pub cvp: Option<rust_decimal::Decimal>,
    pub intake_ml: Option<i32>,
    pub output_ml: Option<i32>,
    pub urine_ml: Option<i32>,
    pub drain_ml: Option<i32>,
    pub infusions: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuVentilatorRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub mode: VentilatorMode,
    pub fio2: Option<rust_decimal::Decimal>,
    pub peep: Option<rust_decimal::Decimal>,
    pub tidal_volume: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub pip: Option<rust_decimal::Decimal>,
    pub plateau_pressure: Option<rust_decimal::Decimal>,
    pub ph: Option<rust_decimal::Decimal>,
    pub pao2: Option<rust_decimal::Decimal>,
    pub paco2: Option<rust_decimal::Decimal>,
    pub hco3: Option<rust_decimal::Decimal>,
    pub sao2: Option<rust_decimal::Decimal>,
    pub lactate: Option<rust_decimal::Decimal>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuScore {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub score_type: IcuScoreType,
    pub score_value: i32,
    pub score_details: Option<serde_json::Value>,
    pub predicted_mortality: Option<rust_decimal::Decimal>,
    pub scored_at: DateTime<Utc>,
    pub scored_by: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuDevice {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub device_type: DeviceType,
    pub inserted_at: DateTime<Utc>,
    pub inserted_by: Option<Uuid>,
    pub removed_at: Option<DateTime<Utc>>,
    pub removed_by: Option<Uuid>,
    pub site: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuBundleCheck {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub device_id: Uuid,
    pub checked_at: DateTime<Utc>,
    pub checked_by: Uuid,
    pub is_compliant: bool,
    pub still_needed: bool,
    pub checklist: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuNutrition {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub route: NutritionRoute,
    pub formula_name: Option<String>,
    pub rate_ml_hr: Option<rust_decimal::Decimal>,
    pub calories_kcal: Option<rust_decimal::Decimal>,
    pub protein_gm: Option<rust_decimal::Decimal>,
    pub volume_ml: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IcuNeonatalRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub gestational_age_weeks: Option<i32>,
    pub birth_weight_gm: Option<i32>,
    pub current_weight_gm: Option<i32>,
    pub bilirubin_total: Option<rust_decimal::Decimal>,
    pub bilirubin_direct: Option<rust_decimal::Decimal>,
    pub phototherapy_active: bool,
    pub phototherapy_hours: Option<rust_decimal::Decimal>,
    pub breast_milk_type: Option<String>,
    pub breast_milk_volume_ml: Option<rust_decimal::Decimal>,
    pub hearing_screen_result: Option<String>,
    pub sepsis_screen_result: Option<String>,
    pub mother_patient_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}
