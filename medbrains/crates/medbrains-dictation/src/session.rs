//! Starting a dictation and trying a failed one again: who may, on which
//! visit, one at a time, with the upload held once.

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, Path, Query, State};
use axum::http::HeaderMap;
use medbrains_core::permissions;
use medbrains_kernel::authz::is_bypass_role;
use medbrains_kernel::{Claims, Tx};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use uuid::Uuid;

use crate::process::{self, Job, ai_turned_off, begin};
use crate::settings;
use crate::stt::{Form, form_model};
use crate::view::{SessionView, load_own};

/// Ten minutes, as the browser reports it. Advisory: kept for the KPI, never
/// trusted as a bound (the size limit below is the bound).
pub const MAX_DURATION_MS: u32 = 600_000;
/// About ten minutes of uncompressed 16 kHz mono WAV; opus is far smaller.
/// The route's body limit enforces it before the handler runs.
pub const MAX_AUDIO_BYTES: usize = 24 * 1024 * 1024;
/// A dictation still `processing` after this was interrupted (a restart).
const STALE_MINUTES: i32 = 5;
const ONE_AT_A_TIME: &str = "uq_dictation_one_processing_per_doctor";

#[derive(Debug, Deserialize)]
pub struct CreateQuery {
    /// How long the doctor spoke, as the browser measured it.
    pub duration_ms: u32,
    /// `recorded` (the default) or `uploaded`.
    pub source: Option<String>,
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

/// The visit's patient, once the caller may dictate on it: an OPD visit
/// that is still open, a patient they may see (404 otherwise), and their own
/// visit unless an admin.
async fn dictatable_visit(
    state: &AppState,
    tx: &mut Tx,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<Uuid, AppError> {
    let visit = sqlx::query!(
        "SELECT patient_id, doctor_id, status::text AS \"status!\" FROM encounters \
          WHERE id = $1 AND tenant_id = $2 AND encounter_type::text = 'opd'",
        encounter_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_health_services::patient::require_patient_access(state, claims, visit.patient_id)
        .await?;
    if !is_bypass_role(claims) && visit.doctor_id != Some(claims.sub) {
        return Err(AppError::ForbiddenReason(
            "Only the visit's own doctor dictates its note".to_owned(),
        ));
    }
    if !matches!(visit.status.as_str(), "open" | "in_progress") {
        return Err(AppError::Conflict("This visit is closed".to_owned()));
    }
    Ok(visit.patient_id)
}

/// A second dictation while one is processing is refused, not queued.
fn one_at_a_time(err: sqlx::Error) -> AppError {
    match &err {
        sqlx::Error::Database(db) if db.constraint() == Some(ONE_AT_A_TIME) => AppError::Conflict(
            "Your last dictation is still being transcribed. Wait for it, then dictate again."
                .to_owned(),
        ),
        _ => err.into(),
    }
}

/// A dictation left `processing` by a restart no longer blocks its doctor.
async fn release_stale(tx: &mut Tx, claims: &Claims) -> Result<(), AppError> {
    sqlx::query!(
        "UPDATE dictation_sessions SET status = 'stt_failed', failure = 'interrupted' \
          WHERE tenant_id = $1 AND doctor_id = $2 AND status = 'processing' \
            AND created_at < now() - make_interval(mins => $3)",
        claims.tenant_id,
        claims.sub,
        STALE_MINUTES,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
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
    let source = match query.source.as_deref() {
        None | Some("recorded") => "recorded",
        Some("uploaded") => "uploaded",
        Some(_) => {
            return Err(AppError::BadRequest(
                "source is recorded or uploaded".to_owned(),
            ));
        }
    };
    // Advisory only: clamp rather than trust or refuse.
    let duration_ms = i32::try_from(query.duration_ms.min(MAX_DURATION_MS)).unwrap_or(0);
    let mut tx = begin(&state, &claims).await?;
    let patient_id = dictatable_visit(&state, &mut tx, &claims, encounter_id).await?;
    let config = settings::load(&mut tx).await?;
    let ai_off = ai_turned_off(&mut tx).await?;
    // The form is the one copy kept; the upload buffer goes now.
    let form = Form::new(&body, &content_type, form_model(&config));
    let audio_bytes = i32::try_from(body.len()).unwrap_or(i32::MAX);
    drop(body);
    release_stale(&mut tx, &claims).await?;
    let id: Uuid = sqlx::query_scalar!(
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
        audio_bytes,
        duration_ms,
        duration_ms,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(one_at_a_time)?;
    sqlx::query!(
        "INSERT INTO dictation_audio (session_id, tenant_id, content_type, audio) \
         VALUES ($1, $2, $3, $4)",
        id,
        claims.tenant_id,
        form.content_type(),
        form.audio(),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    let job = Job {
        id,
        patient_id,
        config: &config,
        ai_off,
        form,
    };
    process::run(&state, &claims, job).await
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
    dictatable_visit(&state, &mut tx, &claims, session.encounter_id).await?;
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
    .await?
    .ok_or_else(|| AppError::Conflict("The recording has been deleted".to_owned()))?;
    let config = settings::load(&mut tx).await?;
    let ai_off = ai_turned_off(&mut tx).await?;
    release_stale(&mut tx, &claims).await?;
    // Claiming it as processing is what keeps it to one at a time; a retry
    // that lost a race to another finds the row already claimed.
    let claimed = sqlx::query!(
        "UPDATE dictation_sessions SET status = 'processing', failure = NULL \
          WHERE id = $1 AND tenant_id = $2 AND status IN ('stt_failed', 'llm_failed')",
        id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await
    .map_err(one_at_a_time)?;
    if claimed.rows_affected() != 1 {
        return Err(AppError::Conflict(
            "This dictation is already being tried again".to_owned(),
        ));
    }
    tx.commit().await?;
    let form = Form::new(&held.audio, &held.content_type, form_model(&config));
    drop(held);
    let job = Job {
        id,
        patient_id: session.patient_id,
        config: &config,
        ai_off,
        form,
    };
    process::run(&state, &claims, job).await
}
