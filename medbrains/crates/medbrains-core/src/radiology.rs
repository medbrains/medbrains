use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "radiology_order_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RadiologyOrderStatus {
    Ordered,
    Scheduled,
    InProgress,
    Completed,
    Reported,
    Verified,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "radiology_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RadiologyPriority {
    Routine,
    Urgent,
    Stat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "radiology_report_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RadiologyReportStatus {
    Draft,
    Preliminary,
    Final,
    Amended,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyModality {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub modality_id: Uuid,
    pub ordered_by: Uuid,
    pub body_part: Option<String>,
    /// FMA concept from the body-site picker; None when typed.
    pub body_part_code: Option<String>,
    pub body_part_laterality: Option<String>,
    pub clinical_indication: Option<String>,
    pub priority: RadiologyPriority,
    pub status: RadiologyOrderStatus,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub contrast_required: bool,
    pub pregnancy_checked: bool,
    pub allergy_flagged: bool,
    pub cancellation_reason: Option<String>,
    /// The catalogue exam ordered; `None` for orders placed by modality alone.
    #[sqlx(default)]
    #[serde(default)]
    pub exam_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One orderable imaging exam ("CT Brain Plain") under one modality.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyExam {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub modality_id: Uuid,
    pub code: String,
    pub name: String,
    pub body_part: Option<String>,
    pub body_part_code: Option<String>,
    pub laterality_required: bool,
    /// `none`, `with`, `without` or `with_and_without`.
    pub contrast: String,
    pub synonyms: Vec<String>,
    /// The `charge_master` code this exam is billed under.
    pub charge_code: Option<String>,
    pub preparation: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub reported_by: Uuid,
    pub verified_by: Option<Uuid>,
    pub status: RadiologyReportStatus,
    pub findings: String,
    pub impression: Option<String>,
    pub recommendations: Option<String>,
    pub is_critical: bool,
    pub template_name: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiationDoseRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub modality_code: String,
    pub body_part: Option<String>,
    pub dose_value: Option<Decimal>,
    pub dose_unit: String,
    pub dlp: Option<Decimal>,
    pub ctdi_vol: Option<Decimal>,
    pub dap: Option<Decimal>,
    pub fluoroscopy_time_seconds: Option<i32>,
    pub recorded_by: Option<Uuid>,
    pub recorded_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
