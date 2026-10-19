//! Sticky notes — a person's own notes, shared to department boards or to
//! colleagues.
//!
//! - `GET    /api/notes`                  — the reader's notes, shared notes and boards
//! - `POST   /api/notes`                  — write a note
//! - `PUT    /api/notes/{id}`             — edit one of my notes
//! - `DELETE /api/notes/{id}`             — remove one of my notes
//! - `PUT    /api/notes/{id}/shares`      — set where one of my notes is shared
//! - `DELETE /api/notes/shares/{share_id}` — take a note off a board or my list
//! - `GET    /api/notes/recipients`       — departments and colleagues to share with
//!
//! A note nobody may see answers 404, never 403: a refusal must not confirm
//! that a colleague's private note exists.

mod view;
mod write;

use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    routing::{delete, get, put},
};
use medbrains_core::{
    notes::{NoteRecipient, NoteRecipients},
    permissions,
};
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::Deserialize;

/// How many matches the share picker offers per kind.
const RECIPIENT_LIMIT: i64 = 20;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/notes", get(view::list_notes).post(write::create_note))
        .route("/api/notes/recipients", get(list_recipients))
        .route("/api/notes/{id}", put(write::update_note).delete(write::delete_note))
        .route("/api/notes/{id}/shares", put(write::set_shares))
        .route("/api/notes/shares/{share_id}", delete(write::remove_share))
}

#[derive(Debug, Deserialize)]
pub struct RecipientQuery {
    pub q: Option<String>,
}

/// `GET /api/notes/recipients?q=` — departments and colleagues by name.
///
/// Names only: the picker needs nothing else, and every staff member may use
/// it, so it must not become a staff directory with phone numbers in it.
///
/// # Errors
/// 403 without `notes.use`.
pub async fn list_recipients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<RecipientQuery>,
) -> Result<Json<NoteRecipients>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let pattern = format!("%{}%", query.q.as_deref().unwrap_or("").trim());
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let departments = sqlx::query_as::<_, (uuid::Uuid, String)>(
        "SELECT id, name FROM departments \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL AND name ILIKE $2 \
         ORDER BY name LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(&pattern)
    .bind(RECIPIENT_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let users = sqlx::query_as::<_, (uuid::Uuid, String)>(
        "SELECT id, full_name FROM users \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL AND id <> $2 \
           AND full_name ILIKE $3 \
         ORDER BY full_name LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&pattern)
    .bind(RECIPIENT_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let to_recipient = |(id, name): (uuid::Uuid, String)| NoteRecipient { id, name };
    Ok(Json(NoteRecipients {
        departments: departments.into_iter().map(to_recipient).collect(),
        users: users.into_iter().map(to_recipient).collect(),
    }))
}
