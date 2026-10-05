//! A note's life after it is written: signed, revised within the grace
//! period, discarded while a draft, or marked entered in error.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{Duration, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use uuid::Uuid;

use crate::model::{self, Note};
use crate::{begin, finish, own_note, require_draft, store};

#[derive(Debug, Deserialize, Default)]
pub struct SignRequest {
    /// Required when the care was longer ago than the hospital's late-entry
    /// window: why the note is being written now.
    pub late_entry_reason: Option<String>,
}

/// `POST /api/clinical-notes/{id}/sign`
pub async fn sign_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<SignRequest>>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::SIGN)?;
    let body = body.map(|Json(b)| b).unwrap_or_default();
    let mut tx = begin(&state, &claims).await?;
    let note = own_note(&mut tx, &claims, id).await?;
    require_draft(&note)?;
    let sections = note.sections()?;
    if !model::has_content(&sections) {
        return Err(AppError::BadRequest(
            "Write the note before signing it".to_owned(),
        ));
    }
    let settings = store::settings(&mut tx, claims.tenant_id).await?;
    let now = Utc::now();
    let reason = body
        .late_entry_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    let is_late = now - note.service_at > Duration::hours(settings.late_entry_hours);
    if is_late && reason.is_none() && note.signed_at.is_none() {
        return Err(AppError::BadRequest(format!(
            "This is a late entry — the care was over {} hours ago. Say why it is written now.",
            settings.late_entry_hours
        )));
    }
    let hash = model::content_hash(&sections);
    sqlx::query("UPDATE note_versions SET frozen = true, content_hash = $3 WHERE note_id = $1 AND version = $2")
        .bind(note.id)
        .bind(note.current_version)
        .bind(&hash)
        .execute(&mut *tx)
        .await?;
    // A revision keeps the lock the first signature set: revising does not
    // extend the time the author has to change what they signed.
    sqlx::query(
        "UPDATE clinical_notes SET status = 'signed', signed_at = $2, \
                locked_at = COALESCE(locked_at, $3), \
                late_entry_reason = COALESCE(late_entry_reason, $4) \
          WHERE id = $1",
    )
    .bind(note.id)
    .bind(now)
    .bind(now + Duration::minutes(settings.grace_minutes))
    .bind(if is_late { reason } else { None })
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO note_signatures (tenant_id, note_id, version, signer_id, mode, signed_at, content_hash) \
         VALUES ($1, $2, $3, $4, 'author', $5, $6)",
    )
    .bind(claims.tenant_id)
    .bind(note.id)
    .bind(note.current_version)
    .bind(claims.sub)
    .bind(now)
    .bind(&hash)
    .execute(&mut *tx)
    .await?;
    finish(tx, &claims, &note).await
}

/// `POST /api/clinical-notes/{id}/revise` — reopen a signed note within the
/// grace period as a new version; the signed one is kept.
pub async fn revise_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::SIGN)?;
    let mut tx = begin(&state, &claims).await?;
    let note = own_note(&mut tx, &claims, id).await?;
    let open = note.status == "signed"
        && note.migrated_from.is_none()
        && note.locked_at.is_some_and(|at| Utc::now() < at);
    if !open {
        return Err(AppError::Conflict(
            "The grace period is over — add an addendum instead".to_owned(),
        ));
    }
    sqlx::query(
        "INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by) \
         SELECT tenant_id, note_id, version + 1, sections, $3 FROM note_versions \
          WHERE note_id = $1 AND version = $2",
    )
    .bind(note.id)
    .bind(note.current_version)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE clinical_notes SET status = 'draft', current_version = current_version + 1 \
          WHERE id = $1",
    )
    .bind(note.id)
    .execute(&mut *tx)
    .await?;
    finish(tx, &claims, &note).await
}

/// `POST /api/clinical-notes/{id}/discard` — throw away a draft: a note
/// never signed goes; a revision goes back to what was signed.
pub async fn discard_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<Note>>, AppError> {
    require_permission(&claims, permissions::clinical_notes::WRITE)?;
    let mut tx = begin(&state, &claims).await?;
    let note = own_note(&mut tx, &claims, id).await?;
    require_draft(&note)?;
    if note.current_version > 1 {
        sqlx::query(
            "UPDATE clinical_notes SET status = 'signed', current_version = current_version - 1 \
              WHERE id = $1",
        )
        .bind(note.id)
        .execute(&mut *tx)
        .await?;
        return finish(tx, &claims, &note)
            .await
            .map(|Json(n)| Json(Some(n)));
    }
    sqlx::query(
        "UPDATE clinical_notes SET deleted_at = now(), deleted_by = $2, \
                delete_reason = 'draft discarded by its author' WHERE id = $1",
    )
    .bind(note.id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if note.type_code == "consultation" {
        store::project_consultation(&mut tx, claims.tenant_id, note.encounter_id).await?;
    }
    tx.commit().await?;
    Ok(Json(None))
}

#[derive(Debug, Deserialize)]
pub struct InErrorRequest {
    pub reason: String,
}

/// `POST /api/clinical-notes/{id}/entered-in-error` — the note stays on the
/// sheet, struck through, with why.
pub async fn mark_in_error(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<InErrorRequest>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::MARK_IN_ERROR)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why the note is in error".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let note = own_note(&mut tx, &claims, id).await?;
    if note.status != "signed" {
        return Err(AppError::Conflict(
            "Only a signed note is marked in error — discard a draft instead".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE clinical_notes SET status = 'entered_in_error', entered_in_error_at = now(), \
                entered_in_error_by = $2, entered_in_error_reason = $3 WHERE id = $1",
    )
    .bind(note.id)
    .bind(claims.sub)
    .bind(reason)
    .execute(&mut *tx)
    .await?;
    finish(tx, &claims, &note).await
}
