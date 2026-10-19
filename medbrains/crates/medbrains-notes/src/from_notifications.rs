//! Notifications flowing into notes: pin one, choose kinds that always become
//! notes, and let a note clear itself when the item behind it is resolved.
//!
//! The rules themselves live in migration 1119 — the database is the one
//! place every notification passes through, whichever of the ~40 producers
//! wrote it. These handlers only call them.

use std::collections::HashSet;

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use medbrains_core::{
    notes::{
        NOTE_FROM_NOTIFICATION_KINDS, NoteKindChoice, SaveStickyNotePreferences,
        SetStickyNoteAutoResolve, StickyNotePreferences,
    },
    permissions,
};
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use uuid::Uuid;

use crate::write::NoteId;

/// `POST /api/notes/from-notification/{notification_id}` — pin one of my
/// notifications to my notes.
///
/// Idempotent: pinning the same notification again returns the note it
/// already made (200), the first pin answers 201.
///
/// # Errors
/// 403 without `notes.use`; 404 when the notification is not the caller's.
pub(crate) async fn pin_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(notification_id): Path<Uuid>,
) -> Result<(StatusCode, Json<NoteId>), AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let existed: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM sticky_notes \
           WHERE notification_id = $1 AND author_id = $2 AND deleted_at IS NULL)",
    )
    .bind(notification_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let id: Option<Uuid> =
        sqlx::query_scalar("SELECT public.sticky_note_from_notification($1, $2)")
            .bind(notification_id)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;
    let id = id.ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let status = if existed {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };
    Ok((status, Json(NoteId { id })))
}

fn choices() -> Vec<NoteKindChoice> {
    NOTE_FROM_NOTIFICATION_KINDS
        .iter()
        .map(|(key, label)| NoteKindChoice {
            key: (*key).to_owned(),
            label: (*label).to_owned(),
        })
        .collect()
}

/// `GET /api/notes/preferences` — which kinds of notification always become
/// a note for me, and the kinds there are to choose from.
///
/// # Errors
/// 403 without `notes.use`.
pub(crate) async fn get_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<StickyNotePreferences>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let kinds: Option<Vec<String>> = sqlx::query_scalar(
        "SELECT kinds FROM sticky_note_preferences \
         WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(StickyNotePreferences {
        kinds: kinds.unwrap_or_default(),
        choices: choices(),
    }))
}

/// `PUT /api/notes/preferences` — set which kinds always become a note.
///
/// # Errors
/// 403 without `notes.use`; 400 for a kind that is not on the list.
pub(crate) async fn set_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveStickyNotePreferences>,
) -> Result<Json<StickyNotePreferences>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let known: HashSet<&str> = NOTE_FROM_NOTIFICATION_KINDS
        .iter()
        .map(|(k, _)| *k)
        .collect();
    if let Some(unknown) = body.kinds.iter().find(|k| !known.contains(k.as_str())) {
        return Err(AppError::BadRequest(format!(
            "unknown notification kind '{unknown}'"
        )));
    }
    let mut kinds = body.kinds;
    kinds.sort_unstable();
    kinds.dedup();
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO sticky_note_preferences (tenant_id, user_id, kinds) VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id, user_id) WHERE deleted_at IS NULL \
         DO UPDATE SET kinds = EXCLUDED.kinds",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&kinds)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(StickyNotePreferences {
        kinds,
        choices: choices(),
    }))
}

/// `PUT /api/notes/{id}/auto-resolve` — whether one of my notes clears itself
/// when its source is resolved. Only a note with a source the server knows
/// how to resolve may be switched on.
///
/// # Errors
/// 404 when the note is not the caller's; 409 when it has no resolvable source.
pub(crate) async fn set_auto_resolve(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetStickyNoteAutoResolve>,
) -> Result<Json<NoteId>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let resolvable: Option<bool> = sqlx::query_scalar(
        "SELECT source_id IS NOT NULL AND public.sticky_note_resolvable(source_kind) \
         FROM sticky_notes \
         WHERE id = $1 AND tenant_id = $2 AND author_id = $3 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    match resolvable {
        None => return Err(AppError::NotFound),
        Some(false) if body.auto_resolve => {
            return Err(AppError::Conflict(
                "only a note from a notification about a resolvable item can clear itself"
                    .to_owned(),
            ));
        }
        Some(_) => {}
    }
    sqlx::query("UPDATE sticky_notes SET auto_resolve = $2 WHERE id = $1")
        .bind(id)
        .bind(body.auto_resolve)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(NoteId { id }))
}
