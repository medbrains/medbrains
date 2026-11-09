//! Transcribe, then draft, storing each result as it arrives. No transaction
//! is held open across either call. Each step that fails says which one and
//! stops there, so the doctor is never shown an empty draft as if nothing had
//! been said, and can always type the note instead.

use axum::Json;
use medbrains_kernel::{Actor, Claims, Tx};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use crate::settings::{DictationConfig, cloud_secret_path};
use crate::structure::{self, Draft};
use crate::stt::{self, Form, SpeechToText as _};
use crate::view::{SessionRow, SessionView};

/// The longest transcript kept: far beyond ten minutes of speech.
const MAX_TRANSCRIPT_CHARS: usize = 100_000;

/// A unit of work as the caller.
pub async fn begin(state: &AppState, claims: &Claims) -> Result<Tx, AppError> {
    Ok(medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?)
}

/// Whether the tenant has turned AI off (`ai.config.assistant_enabled =
/// false`): dictation still transcribes, but drafts nothing.
///
/// # Errors
/// The database read.
pub async fn ai_turned_off(tx: &mut Tx) -> Result<bool, AppError> {
    let config = medbrains_kernel::config::get(tx, "ai/config").await?;
    Ok(config.and_then(|c| {
        c.get("assistant_enabled")
            .and_then(serde_json::Value::as_bool)
    }) == Some(false))
}

/// Everything one pass needs.
#[derive(Debug)]
pub struct Job<'a> {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub config: &'a DictationConfig,
    pub ai_off: bool,
    pub form: Form,
}

/// Run one pass over a recording and answer with the session.
///
/// # Errors
/// A database error, or the cloud key unavailable.
pub async fn run(
    state: &AppState,
    claims: &Claims,
    job: Job<'_>,
) -> Result<Json<SessionView>, AppError> {
    let tenant = claims.tenant_id;
    let adapter = stt::choose(job.config, |name| async move {
        let path = cloud_secret_path(tenant, &name);
        state.secret_resolver.get(&path).await.map_err(|_| {
            AppError::ServiceUnavailable(format!(
                "Dictation cloud key '{name}' is not set for this hospital"
            ))
        })
    })
    .await?;
    let heard = adapter.transcribe(&job.form).await;
    drop(job.form);
    let transcript = match heard {
        Ok(text) if text.trim().is_empty() => {
            return store(
                state,
                claims,
                job.id,
                Stored::failed("no_speech", "no_speech", adapter.name()),
            )
            .await;
        }
        Ok(text) if text.chars().count() > MAX_TRANSCRIPT_CHARS => {
            delete_audio(state, claims, job.id).await?;
            let stored = Stored::failed("stt_failed", "transcript_too_long", adapter.name());
            return store(state, claims, job.id, stored).await;
        }
        Ok(text) => text,
        Err(failure) => {
            return store(
                state,
                claims,
                job.id,
                Stored::failed("stt_failed", failure.class(), adapter.name()),
            )
            .await;
        }
    };
    if job.ai_off {
        let stored = Stored::words(
            &transcript,
            None,
            "llm_failed",
            Some("ai_disabled"),
            adapter.name(),
            job.config,
        );
        return store(state, claims, job.id, stored).await;
    }
    let mut redactor = medbrains_ai::session_for(state, claims, Some(job.patient_id), None).await?;
    let stored = match structure::draft_note(job.config, &mut redactor, &transcript).await {
        Ok(draft) => Stored::words(
            &transcript,
            Some(&draft),
            "drafted",
            None,
            adapter.name(),
            job.config,
        ),
        Err(failure) => Stored::words(
            &transcript,
            None,
            "llm_failed",
            Some(failure.class()),
            adapter.name(),
            job.config,
        ),
    };
    store(state, claims, job.id, stored).await
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

    /// A transcript, with a draft when one was made.
    fn words(
        transcript: &str,
        draft: Option<&Draft>,
        status: &'static str,
        failure: Option<&'static str>,
        adapter: &'static str,
        config: &DictationConfig,
    ) -> Self {
        Self {
            status,
            failure,
            adapter,
            model: Some(config.llm_model.clone()),
            transcript: Some(transcript.to_owned()),
            draft: draft.and_then(|d| serde_json::to_value(d).ok()),
        }
    }
}

/// Delete a recording that can no longer be used.
async fn delete_audio(state: &AppState, claims: &Claims, id: Uuid) -> Result<(), AppError> {
    let mut tx = begin(state, claims).await?;
    sqlx::query!(
        "DELETE FROM dictation_audio WHERE session_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE dictation_sessions SET audio_deleted_at = now() WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Write the step's result: metadata on the audited session, the words in
/// the unaudited content row. Answer with the session.
async fn store(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    s: Stored,
) -> Result<Json<SessionView>, AppError> {
    let mut tx = begin(state, claims).await?;
    let chars = s
        .transcript
        .as_ref()
        .map(|t| i32::try_from(t.chars().count()).unwrap_or(i32::MAX));
    sqlx::query!(
        "UPDATE dictation_sessions \
            SET status = $3, failure = $4, stt_adapter = $5, llm_model = $6, transcript_chars = $7 \
          WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id,
        s.status,
        s.failure,
        s.adapter,
        s.model,
        chars,
    )
    .execute(&mut *tx)
    .await?;
    if let Some(transcript) = &s.transcript {
        sqlx::query!(
            "INSERT INTO dictation_content (session_id, tenant_id, transcript, draft) \
             VALUES ($1, $2, $3, $4) \
             ON CONFLICT (session_id) DO UPDATE SET transcript = EXCLUDED.transcript, draft = EXCLUDED.draft",
            id,
            claims.tenant_id,
            transcript,
            s.draft,
        )
        .execute(&mut *tx)
        .await?;
    }
    let row: SessionRow = crate::view::load_own(&mut tx, claims, id).await?;
    tx.commit().await?;
    Ok(Json(row.into()))
}
