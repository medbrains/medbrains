use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpecialtyTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub specialty: String,
    pub template_name: String,
    pub template_code: String,
    pub form_schema: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpecialtyRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub specialty: String,
    pub template_id: Option<Uuid>,
    pub form_data: serde_json::Value,
    pub recorded_by: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DialysisSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub machine_number: Option<String>,
    pub access_type: String,
    pub dialyzer_type: Option<String>,
    pub pre_weight_kg: Option<rust_decimal::Decimal>,
    pub post_weight_kg: Option<rust_decimal::Decimal>,
    pub uf_goal_ml: Option<i32>,
    pub uf_achieved_ml: Option<i32>,
    pub duration_minutes: Option<i32>,
    pub pre_vitals: serde_json::Value,
    pub post_vitals: serde_json::Value,
    pub intradialytic_events: serde_json::Value,
    pub kt_v: Option<rust_decimal::Decimal>,
    pub urr_pct: Option<rust_decimal::Decimal>,
    pub heparin_dose: Option<String>,
    pub performed_by: Uuid,
    pub session_date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChemoProtocol {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub protocol_name: String,
    pub cancer_type: String,
    pub staging: Option<String>,
    pub regimen: serde_json::Value,
    pub cycle_number: i32,
    pub total_cycles: Option<i32>,
    pub toxicity_grade: Option<i32>,
    pub recist_response: Option<String>,
    pub tumor_board_discussed: bool,
    pub tumor_board_date: Option<NaiveDate>,
    pub tumor_board_recommendation: Option<String>,
    pub treating_oncologist_id: Option<Uuid>,
    pub cycle_date: NaiveDate,
    pub next_cycle_date: Option<NaiveDate>,
    pub status: String,
    pub notes: Option<String>,
    pub anthracycline_agent: Option<String>,
    pub anthracycline_dose_mg_m2: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Cancer TNM staging (oncology depth).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CancerStaging {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub primary_site: String,
    pub histology: Option<String>,
    pub t_stage: Option<String>,
    pub n_stage: Option<String>,
    pub m_stage: Option<String>,
    pub overall_stage: Option<String>,
    pub staged_by: Option<Uuid>,
    pub staged_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A radiation-therapy session (oncology depth).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RadiationSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub site: String,
    pub technique: Option<String>,
    pub total_dose_gy: Option<rust_decimal::Decimal>,
    pub fractions: Option<i32>,
    pub session_number: Option<i32>,
    pub delivered_by: Option<Uuid>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
