use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A comprehensive eye exam. Per-eye columns: OD = right eye, OS = left eye.
/// Refraction (sphere/cylinder/axis) doubles as the spectacle prescription.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OphthoExam {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub visual_acuity_od: Option<String>,
    pub visual_acuity_os: Option<String>,
    pub sphere_od: Option<rust_decimal::Decimal>,
    pub sphere_os: Option<rust_decimal::Decimal>,
    pub cylinder_od: Option<rust_decimal::Decimal>,
    pub cylinder_os: Option<rust_decimal::Decimal>,
    pub axis_od: Option<i16>,
    pub axis_os: Option<i16>,
    pub iop_od: Option<rust_decimal::Decimal>,
    pub iop_os: Option<rust_decimal::Decimal>,
    pub slit_lamp: Option<String>,
    pub fundus: Option<String>,
    pub diagnosis: Option<String>,
    pub plan: Option<String>,
    pub examined_by: Option<Uuid>,
    pub examined_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
