use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A comprehensive eye exam. Per-eye columns: OD = right eye, OS = left eye.
///
/// Refraction (sphere/cylinder/axis, near add) doubles as the spectacle
/// prescription once the exam is signed; `visual_acuity_*` is unaided.
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
    pub bcva_od: Option<String>,
    pub bcva_os: Option<String>,
    pub near_va_od: Option<String>,
    pub near_va_os: Option<String>,
    pub add_od: Option<rust_decimal::Decimal>,
    pub add_os: Option<rust_decimal::Decimal>,
    pub pd_mm: Option<rust_decimal::Decimal>,
    pub lens_type: Option<String>,
    pub lens_advice: Option<String>,
    pub review_after_months: Option<i16>,
    pub signed_by: Option<Uuid>,
    pub signed_at: Option<DateTime<Utc>>,
    /// Who signed, for display; filled by reads that join it.
    #[sqlx(default)]
    pub signed_by_name: Option<String>,
    pub examined_by: Option<Uuid>,
    pub examined_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
