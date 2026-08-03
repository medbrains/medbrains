use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "encounter_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EncounterType {
    Opd,
    Ipd,
    Emergency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "encounter_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EncounterStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Encounter {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_type: EncounterType,
    pub status: EncounterStatus,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub encounter_date: NaiveDate,
    pub notes: Option<String>,
    pub attributes: serde_json::Value,
    pub visit_type: Option<String>,
    /// Why the patient came, recorded at the front desk before they ever reach a
    /// doctor. The doctor's own `consultations.chief_complaint` is a separate,
    /// clinical record — this one is the reception/nurse note that travels with
    /// the patient through the queue. Column is plural, the API is singular
    /// everywhere else (camp registrations, consultations), so it is renamed here.
    #[sqlx(rename = "chief_complaints")]
    pub chief_complaint: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "queue_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum QueueStatus {
    Waiting,
    Called,
    InConsultation,
    Completed,
    NoShow,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OpdQueue {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub token_number: i32,
    pub status: QueueStatus,
    pub queue_date: NaiveDate,
    pub called_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
