use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bedside_request_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BedsideRequestType {
    NurseCall,
    PainManagement,
    BathroomAssist,
    WaterFood,
    BlanketPillow,
    PositionChange,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bedside_request_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BedsideRequestStatus {
    Pending,
    Acknowledged,
    InProgress,
    Completed,
    Cancelled,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedsideSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub bed_location: Option<String>,
    pub device_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedsideNurseRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub request_type: BedsideRequestType,
    pub status: BedsideRequestStatus,
    pub notes: Option<String>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedsideEducationVideo {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub video_url: String,
    pub thumbnail_url: Option<String>,
    pub category: String,
    pub condition_codes: Option<serde_json::Value>,
    pub language: Option<String>,
    pub duration_seconds: Option<i32>,
    pub is_active: bool,
    pub sort_order: Option<i32>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedsideEducationView {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub video_id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Uuid,
    pub watched_seconds: Option<i32>,
    pub completed: bool,
    pub viewed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedsideRealtimeFeedback {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub pain_level: Option<i32>,
    pub comfort_level: Option<i32>,
    pub cleanliness_level: Option<i32>,
    pub noise_level: Option<i32>,
    pub staff_response: Option<i32>,
    pub comments: Option<String>,
    pub submitted_at: DateTime<Utc>,
}
