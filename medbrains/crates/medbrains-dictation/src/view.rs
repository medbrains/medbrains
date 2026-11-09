//! A session as read back: its metadata from the audited table, its words
//! from the unaudited one, and the sentence the doctor reads when a step
//! failed.

use chrono::{DateTime, Utc};
use medbrains_kernel::{Claims, Tx};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::structure::Draft;

/// A session with its transcript and draft, when it still has them.
#[derive(Debug, Clone)]
pub struct SessionRow {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub status: String,
    pub failure: Option<String>,
    pub stt_adapter: Option<String>,
    pub llm_model: Option<String>,
    pub transcript: Option<String>,
    pub draft: Option<serde_json::Value>,
    pub duration_ms: i32,
    pub started_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// What the screen shows: the state, a plain sentence when a step failed,
/// the transcript and the draft.
#[derive(Debug, Serialize)]
pub struct SessionView {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub status: String,
    pub failure: Option<String>,
    pub message: Option<&'static str>,
    pub stt_adapter: Option<String>,
    pub transcript: Option<String>,
    pub draft: Option<Draft>,
    pub duration_ms: i32,
    pub created_at: DateTime<Utc>,
}

impl From<SessionRow> for SessionView {
    /// The screen's view of a stored session.
    fn from(row: SessionRow) -> Self {
        Self {
            id: row.id,
            encounter_id: row.encounter_id,
            message: row.failure.as_deref().map(message_for),
            draft: row.draft.and_then(|d| serde_json::from_value(d).ok()),
            status: row.status,
            failure: row.failure,
            stt_adapter: row.stt_adapter,
            transcript: row.transcript,
            duration_ms: row.duration_ms,
            created_at: row.created_at,
        }
    }
}

/// What each failure class means to the doctor, and what to do.
fn message_for(class: &str) -> &'static str {
    match class {
        "stt_unreachable" | "stt_timeout" | "stt_refused" | "interrupted" => {
            "Speech-to-text is not available, so nothing was transcribed. Type the note as usual, or try again."
        }
        "no_speech" => "No speech was heard in the recording. Nothing was drafted.",
        "transcript_too_long" => {
            "The recording was too long to draft a note from, so it was deleted. Dictate in shorter parts, or type the note as usual."
        }
        "llm_unsafe" => {
            "The transcript could not be made safe to send to the model, so nothing was sent. The transcript is below; type the note as usual."
        }
        "ai_disabled" => {
            "AI drafting is turned off for this hospital. The transcript is below; type the note as usual."
        }
        _ => {
            "The transcript is below, but the note could not be drafted from it: the model is not available. Type the note as usual, or try again."
        }
    }
}

/// The caller's own session; anyone else's is not found.
///
/// # Errors
/// `NotFound` when absent or another doctor's.
pub async fn load_own(tx: &mut Tx, claims: &Claims, id: Uuid) -> Result<SessionRow, AppError> {
    sqlx::query_as!(
        SessionRow,
        r#"SELECT s.id, s.encounter_id, s.patient_id, s.status, s.failure, s.stt_adapter,
                  s.llm_model, c.transcript AS "transcript?", c.draft AS "draft?",
                  s.duration_ms, s.started_at, s.created_at
             FROM dictation_sessions s
             LEFT JOIN dictation_content c ON c.session_id = s.id AND c.tenant_id = s.tenant_id
            WHERE s.id = $1 AND s.tenant_id = $2 AND s.doctor_id = $3 AND s.deleted_at IS NULL"#,
        id,
        claims.tenant_id,
        claims.sub,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}
