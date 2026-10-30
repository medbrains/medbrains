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
    /// An ultrasound on a pregnant woman needs a PC-PNDT Form F.
    #[sqlx(default)]
    pub is_ultrasound: bool,
    /// X-ray, CT, fluoroscopy, mammography, nuclear medicine: a woman of
    /// reproductive age is asked about pregnancy before the exposure.
    #[sqlx(default)]
    pub is_ionising: bool,
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
    /// She is pregnant: an ultrasound then needs a PC-PNDT Form F.
    #[sqlx(default)]
    pub patient_pregnant: bool,
    pub allergy_flagged: bool,
    pub cancellation_reason: Option<String>,
    /// The catalogue exam ordered; `None` for orders placed by modality alone.
    #[sqlx(default)]
    #[serde(default)]
    pub exam_id: Option<Uuid>,
    /// Written into every image; links the study back to this order (#226).
    #[sqlx(default)]
    #[serde(default)]
    pub accession_number: String,
    /// The study the PACS holds for this order, once it has arrived.
    #[sqlx(default)]
    #[serde(default)]
    pub pacs_study_uid: Option<String>,
    /// `not_pregnant`, `pregnant` or `cannot_rule_out`, asked before an
    /// ionising exposure.
    #[sqlx(default)]
    #[serde(default)]
    pub pregnancy_status: Option<String>,
    /// How it was established: asked, LMP, urine or serum test.
    #[sqlx(default)]
    #[serde(default)]
    pub pregnancy_check_method: Option<String>,
    /// Why the exam goes ahead when she is or may be pregnant.
    #[sqlx(default)]
    #[serde(default)]
    pub pregnancy_justification: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub pregnancy_checked_by: Option<Uuid>,
    #[sqlx(default)]
    #[serde(default)]
    pub pregnancy_checked_at: Option<DateTime<Utc>>,
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
    /// A scan of a pregnancy: ordering it opens a PC-PNDT Form F.
    #[sqlx(default)]
    pub pcpndt_applicable: bool,
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
    /// Radiographs: how many exposures were taken.
    pub exposure_count: Option<i32>,
    pub kvp: Option<Decimal>,
    pub mas: Option<Decimal>,
    /// `manual`, `rdsr` (the scanner's dose report) or `dicom_header`.
    pub source: String,
    /// The PACS study an automatic figure was read from.
    pub dicom_study_id: Option<Uuid>,
    pub recorded_by: Option<Uuid>,
    pub recorded_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
