//! Writing notes and deciding who sees them.

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use medbrains_core::{
    notes::{MAX_NOTE_CHARS, NOTE_COLOURS, SaveStickyNote, SetStickyNoteShares},
    permissions,
};
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use serde::Serialize;
use uuid::Uuid;

/// Most departments and colleagues one note may be shared with — a note for
/// the whole hospital belongs on a hospital board, not on forty lists.
const MAX_DEPARTMENT_SHARES: usize = 20;
const MAX_USER_SHARES: usize = 50;

#[derive(Debug, Serialize)]
pub(crate) struct NoteId {
    pub(crate) id: Uuid,
}

fn validate(body: &SaveStickyNote) -> Result<String, AppError> {
    let text = body.body.trim();
    if text.is_empty() {
        return Err(AppError::BadRequest("a note needs some text".to_owned()));
    }
    if text.chars().count() > MAX_NOTE_CHARS {
        return Err(AppError::BadRequest(format!(
            "a note holds at most {MAX_NOTE_CHARS} characters"
        )));
    }
    if !NOTE_COLOURS.contains(&body.colour.as_str()) {
        return Err(AppError::BadRequest(format!("unknown note colour '{}'", body.colour)));
    }
    if body.expires_at.is_some_and(|at| at <= Utc::now()) {
        return Err(AppError::BadRequest(
            "the time a note clears itself must be in the future".to_owned(),
        ));
    }
    Ok(text.to_owned())
}

/// `POST /api/notes` — write a note. It is private until shared.
///
/// # Errors
/// 403 without `notes.use`; 400 for an empty or over-long note, an unknown
/// colour or a clear-by time in the past.
pub(crate) async fn create_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveStickyNote>,
) -> Result<(StatusCode, Json<NoteId>), AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let text = validate(&body)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO sticky_notes (tenant_id, author_id, body, colour, pinned, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(text)
    .bind(&body.colour)
    .bind(body.pinned)
    .bind(body.expires_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(NoteId { id })))
}

/// `PUT /api/notes/{id}` — edit one of my notes.
///
/// # Errors
/// 404 when the note is not the caller's (or does not exist); 400 as for create.
pub(crate) async fn update_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveStickyNote>,
) -> Result<Json<NoteId>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let text = validate(&body)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let updated = sqlx::query(
        "UPDATE sticky_notes SET body = $4, colour = $5, pinned = $6, expires_at = $7 \
         WHERE id = $1 AND tenant_id = $2 AND author_id = $3 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(text)
    .bind(&body.colour)
    .bind(body.pinned)
    .bind(body.expires_at)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(NoteId { id }))
}

/// `DELETE /api/notes/{id}` — remove one of my notes from everywhere it shows.
///
/// # Errors
/// 404 when the note is not the caller's.
pub(crate) async fn delete_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let removed = sqlx::query(
        "UPDATE sticky_notes SET deleted_at = now(), deleted_by = $3 \
         WHERE id = $1 AND tenant_id = $2 AND author_id = $3 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if removed.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `PUT /api/notes/{id}/shares` — the full list of where my note is shared.
///
/// Shares not in the list are withdrawn; new ones are added. Departments and
/// colleagues must belong to the caller's hospital and be active.
///
/// # Errors
/// 404 when the note is not the caller's; 400 for too many targets or one
/// that is not an active department or colleague here.
pub(crate) async fn set_shares(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetStickyNoteShares>,
) -> Result<Json<NoteId>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    if body.department_ids.len() > MAX_DEPARTMENT_SHARES || body.user_ids.len() > MAX_USER_SHARES {
        return Err(AppError::BadRequest(format!(
            "share a note with at most {MAX_DEPARTMENT_SHARES} departments and {MAX_USER_SHARES} colleagues"
        )));
    }
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let owned: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM sticky_notes \
         WHERE id = $1 AND tenant_id = $2 AND author_id = $3 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    if owned.is_none() {
        return Err(AppError::NotFound);
    }

    let (departments, users): (i64, i64) = sqlx::query_as(
        "SELECT \
           (SELECT count(*) FROM departments WHERE tenant_id = $1 AND id = ANY($2) \
              AND is_active AND deleted_at IS NULL), \
           (SELECT count(*) FROM users WHERE tenant_id = $1 AND id = ANY($3) \
              AND is_active AND deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .bind(&body.department_ids)
    .bind(&body.user_ids)
    .fetch_one(&mut *tx)
    .await?;
    if usize::try_from(departments).ok() != Some(dedup_len(&body.department_ids))
        || usize::try_from(users).ok() != Some(dedup_len(&body.user_ids))
    {
        return Err(AppError::BadRequest(
            "a department or colleague in the list is not active in this hospital".to_owned(),
        ));
    }

    sqlx::query(
        "UPDATE sticky_note_shares SET deleted_at = now(), deleted_by = $2, \
                delete_reason = 'unshared by author' \
         WHERE note_id = $1 AND deleted_at IS NULL \
           AND NOT (COALESCE(department_id = ANY($3), false) \
                    OR COALESCE(user_id = ANY($4), false))",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.department_ids)
    .bind(&body.user_ids)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO sticky_note_shares (tenant_id, note_id, department_id, user_id, shared_by) \
         SELECT $1, $2, t.department_id, t.user_id, $3 FROM ( \
             SELECT DISTINCT unnest($4::uuid[]) AS department_id, NULL::uuid AS user_id \
             UNION SELECT DISTINCT NULL::uuid, unnest($5::uuid[]) \
         ) t \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM sticky_note_shares s \
             WHERE s.note_id = $2 AND s.deleted_at IS NULL \
               AND (s.department_id = t.department_id OR s.user_id = t.user_id))",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(&body.department_ids)
    .bind(&body.user_ids)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(NoteId { id }))
}

fn dedup_len(ids: &[Uuid]) -> usize {
    ids.iter().collect::<std::collections::HashSet<_>>().len()
}

/// `DELETE /api/notes/shares/{share_id}` — take a note off a board or a list.
///
/// Allowed to the note's author, to the colleague it was handed to (who is
/// dismissing it), and to a holder of `notes.moderate` for a board of a
/// department they belong to.
///
/// # Errors
/// 404 when none of those applies — the same answer as a share that does not
/// exist, so the endpoint does not reveal other people's notes.
pub(crate) async fn remove_share(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(share_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let can_moderate =
        is_bypass_role(&claims) || claims.permissions.iter().any(|p| p == permissions::notes::MODERATE);
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let removed = sqlx::query(
        "UPDATE sticky_note_shares s SET deleted_at = now(), deleted_by = $3, \
                delete_reason = CASE WHEN n.author_id = $3 THEN 'unshared by author' \
                                     WHEN s.user_id = $3 THEN 'dismissed by recipient' \
                                     ELSE 'removed from board' END \
         FROM sticky_notes n, users me \
         WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL \
           AND n.id = s.note_id AND me.id = $3 \
           AND (n.author_id = $3 OR s.user_id = $3 \
                OR ($4 AND s.department_id = ANY(me.department_ids)))",
    )
    .bind(share_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(can_moderate)
    .execute(&mut *tx)
    .await?;
    if removed.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
