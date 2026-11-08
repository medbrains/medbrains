//! One recording: uploaded, transcribed, drafted. Each step that fails says
//! which one and stops there, so the doctor is never shown an empty draft as
//! if nothing had been said, and can always type the note instead.

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, Path, Query, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, Tx};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::settings::{self, DictationConfig};
use crate::structure::{self, Draft};
use crate::stt::{self, Audio, SpeechToText as _};

/// Ten minutes: a consultation, not a ward round.
pub const MAX_DURATION_MS: u32 = 600_000;
/// About ten minutes of uncompressed 16 kHz mono WAV; opus is far smaller.
pub const MAX_AUDIO_BYTES: usize = 24 * 1024 * 1024;

#[derive(Debug, Deserialize)]
pub struct CreateQuery {
    /// How long the doctor spoke, from the recorder or the file.
    pub duration_ms: u32,
    /// `recorded` (the default) or `uploaded`.
    pub source: Option<String>,
}

/// The session as stored.
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
        "stt_unreachable" | "stt_timeout" | "stt_refused" => {
            "Speech-to-text is not available, so nothing was transcribed. Type the note as usual, or try again."
        }
        "no_speech" => "No speech was heard in the recording. Nothing was drafted.",
        "llm_unsafe" => {
            "The transcript could not be made safe to send to the model, so nothing was sent. The transcript is below; type the note as usual."
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
        "SELECT id, encounter_id, patient_id, status, failure, stt_adapter, llm_model, \
                transcript, draft, duration_ms, started_at, created_at \
           FROM dictation_sessions \
          WHERE id = $1 AND tenant_id = $2 AND doctor_id = $3 AND deleted_at IS NULL",
        id,
        claims.tenant_id,
        claims.sub,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// A unit of work as the caller.
async fn begin(state: &AppState, claims: &Claims) -> Result<Tx, AppError> {
    Ok(medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?)
}

/// The recording's media type without parameters, if it is audio.
fn audio_type(headers: &HeaderMap) -> Result<String, AppError> {
    let raw = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    let base = raw
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    let ok = base.strip_prefix("audio/").is_some_and(|sub| {
        (1..=40).contains(&sub.len())
            && sub
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "+.-".contains(c))
    });
    if ok {
        Ok(base)
    } else {
        Err(AppError::BadRequest("Upload an audio recording".to_owned()))
    }
}

/// `POST /api/opd/encounters/{id}/dictations` — the body is the recording.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id, encounter_id = %encounter_id))]
pub async fn create_dictation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Query(query): Query<CreateQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<SessionView>, AppError> {
    medbrains_kernel::require_permission(&claims, permissions::opd::dictation::USE)?;
    let content_type = audio_type(&headers)?;
    if body.is_empty() || body.len() > MAX_AUDIO_BYTES {
        return Err(AppError::BadRequest(
            "The recording is empty or larger than 24 MB".to_owned(),
        ));
    }
    if query.duration_ms > MAX_DURATION_MS {
        return Err(AppError::BadRequest(
            "A dictation is at most 10 minutes".to_owned(),
        ));
    }
    let source = match query.source.as_deref() {
        None | Some("recorded") => "recorded",
        Some("uploaded") => "uploaded",
        Some(_) => {
            return Err(AppError::BadRequest(
                "source is recorded or uploaded".to_owned(),
            ));
        }
    };
    let mut tx = begin(&state, &claims).await?;
    let patient_id: Uuid = sqlx::query_scalar!(
        "SELECT patient_id FROM encounters \
          WHERE id = $1 AND tenant_id = $2 AND encounter_type::text = 'opd'",
        encounter_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // A doctor dictates only for a patient they may see; otherwise 404.
    medbrains_health_services::patient::require_patient_access(&state, &claims, patient_id).await?;
    let duration_ms = i32::try_from(query.duration_ms).unwrap_or(i32::MAX);
    // The doctor began speaking this long before the upload arrived.
    let session_id: Uuid = sqlx::query_scalar!(
        "INSERT INTO dictation_sessions \
           (tenant_id, encounter_id, patient_id, doctor_id, source, audio_bytes, duration_ms, \
            started_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - ($8::int4 * interval '1 millisecond')) \
         RETURNING id",
        claims.tenant_id,
        encounter_id,
        patient_id,
        claims.sub,
        source,
        i32::try_from(body.len()).unwrap_or(i32::MAX),
        duration_ms,
        duration_ms,
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO dictation_audio (session_id, tenant_id, content_type, audio) \
         VALUES ($1, $2, $3, $4)",
        session_id,
        claims.tenant_id,
        content_type,
        body.as_ref(),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    let audio = Audio {
        bytes: &body,
        content_type: &content_type,
    };
    process(&state, &claims, session_id, patient_id, audio).await
}

/// `POST /api/opd/dictations/{id}/retry` — run a failed recording again,
/// while it is still held.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id, dictation_id = %id))]
pub async fn retry_dictation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionView>, AppError> {
    medbrains_kernel::require_permission(&claims, permissions::opd::dictation::USE)?;
    let mut tx = begin(&state, &claims).await?;
    let session = load_own(&mut tx, &claims, id).await?;
    medbrains_health_services::patient::require_patient_access(&state, &claims, session.patient_id)
        .await?;
    if !matches!(session.status.as_str(), "stt_failed" | "llm_failed") {
        return Err(AppError::Conflict(
            "Only a failed dictation is tried again".to_owned(),
        ));
    }
    let held = sqlx::query!(
        "SELECT content_type, audio FROM dictation_audio WHERE session_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let held =
        held.ok_or_else(|| AppError::Conflict("The recording has been deleted".to_owned()))?;
    let (content_type, bytes) = (held.content_type, held.audio);
    let audio = Audio {
        bytes: &bytes,
        content_type: &content_type,
    };
    process(&state, &claims, id, session.patient_id, audio).await
}

/// Transcribe, then draft, storing each result as it arrives. No
/// transaction is held open across either call.
async fn process(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    patient_id: Uuid,
    audio: Audio<'_>,
) -> Result<Json<SessionView>, AppError> {
    let mut tx = begin(state, claims).await?;
    let config = settings::load(&mut tx).await?;
    tx.commit().await?;
    let adapter = stt::choose(&config, |secret| async move {
        state.secret_resolver.get(&secret).await.map_err(|e| {
            AppError::ServiceUnavailable(format!("Dictation cloud key '{secret}' unavailable: {e}"))
        })
    })
    .await?;
    let transcript = match adapter.transcribe(audio).await {
        Ok(text) if text.trim().is_empty() => Err("no_speech"),
        Ok(text) => Ok(text),
        Err(failure) => Err(failure.class()),
    };
    let transcript = match transcript {
        Ok(text) => text,
        Err(class) => {
            let status = if class == "no_speech" {
                "no_speech"
            } else {
                "stt_failed"
            };
            return store(
                state,
                claims,
                id,
                Stored::failed(status, class, adapter.name()),
            )
            .await;
        }
    };
    let mut redactor = medbrains_ai::session_for(state, claims, Some(patient_id), None).await?;
    let stored = match structure::draft_note(&config, &mut redactor, &transcript).await {
        Ok(draft) => Stored::drafted(&transcript, &draft, adapter.name(), &config),
        Err(failure) => Stored::llm_failed(&transcript, failure.class(), adapter.name(), &config),
    };
    store(state, claims, id, stored).await
}

/// One step's result, ready to write.
struct Stored {
    status: &'static str,
    failure: Option<&'static str>,
    adapter: &'static str,
    model: Option<String>,
    transcript: Option<String>,
    draft: Option<serde_json::Value>,
}

impl Stored {
    /// Speech-to-text gave nothing usable.
    const fn failed(status: &'static str, class: &'static str, adapter: &'static str) -> Self {
        Self {
            status,
            failure: Some(class),
            adapter,
            model: None,
            transcript: None,
            draft: None,
        }
    }

    /// A transcript, but no draft.
    fn llm_failed(
        transcript: &str,
        class: &'static str,
        adapter: &'static str,
        config: &DictationConfig,
    ) -> Self {
        Self {
            status: "llm_failed",
            failure: Some(class),
            adapter,
            model: Some(config.llm_model.clone()),
            transcript: Some(transcript.to_owned()),
            draft: None,
        }
    }

    /// A transcript and a draft to review.
    fn drafted(
        transcript: &str,
        draft: &Draft,
        adapter: &'static str,
        config: &DictationConfig,
    ) -> Self {
        Self {
            status: "drafted",
            failure: None,
            adapter,
            model: Some(config.llm_model.clone()),
            transcript: Some(transcript.to_owned()),
            draft: serde_json::to_value(draft).ok(),
        }
    }
}

/// Write the step's result and answer with the session.
async fn store(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    s: Stored,
) -> Result<Json<SessionView>, AppError> {
    let mut tx = begin(state, claims).await?;
    let row = sqlx::query_as!(
        SessionRow,
        "UPDATE dictation_sessions \
            SET status = $3, failure = $4, stt_adapter = $5, llm_model = $6, \
                transcript = $7, draft = $8 \
          WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, encounter_id, patient_id, status, failure, stt_adapter, llm_model, \
                   transcript, draft, duration_ms, started_at, created_at",
        id,
        claims.tenant_id,
        s.status,
        s.failure,
        s.adapter,
        s.model,
        s.transcript,
        s.draft,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row.into()))
}
