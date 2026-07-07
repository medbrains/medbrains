use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A dental exam (the visit) — carries the tooth-wise chart via `dental_chart_entries`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DentalExam {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub examined_by: Option<Uuid>,
    pub examined_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One tooth's finding on a dental exam (FDI numbering).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DentalChartEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub exam_id: Uuid,
    pub tooth_number: String,
    pub condition: String,
    pub surface: Option<String>,
    pub treatment_planned: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
