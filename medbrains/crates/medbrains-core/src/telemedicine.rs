use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A video-consultation session — maps to `tele_consultations`.
///
/// Provider-agnostic room model: the join URL is `<base>/<room_id>` where
/// `base` defaults to Jitsi (`https://meet.jit.si`) and is configurable per
/// tenant. No paid SDK required.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TeleConsultation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub appointment_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub room_id: String,
    /// Platform: jitsi | external | google_meet | zoom | teams.
    pub provider: String,
    /// Authoritative join link for externally-created meetings (else derived
    /// from the Jitsi base + `room_id`).
    pub meeting_url: Option<String>,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub doctor_notes: Option<String>,
    pub cancel_reason: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Worklist row — omits `doctor_notes` (free-text, only shown in the detail
/// view, fetched by id). Keeps the worklist response slim (#167 field projection).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TeleConsultationListItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub appointment_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub room_id: String,
    pub provider: String,
    pub meeting_url: Option<String>,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Role-specific join info returned to the client (doctor vs patient).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeleJoinInfo {
    pub consultation_id: Uuid,
    pub room_id: String,
    pub join_url: String,
    pub display_name: String,
    pub status: String,
}
