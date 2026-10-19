//! The notes panel: my notes, notes handed to me, and my departments' boards.

use std::collections::HashMap;

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::{
    notes::{StickyNote, StickyNoteBoard, StickyNoteShare, StickyNotesView},
    permissions,
};
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use uuid::Uuid;

/// Rows read for one panel. A board is a wall, not an archive: past this the
/// oldest unpinned notes simply do not show.
const ROW_LIMIT: i64 = 600;

#[derive(Debug, sqlx::FromRow)]
struct NoteRow {
    id: Uuid,
    body: String,
    colour: String,
    pinned: bool,
    expires_at: Option<DateTime<Utc>>,
    author_id: Uuid,
    author_name: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    share_id: Option<Uuid>,
    department_id: Option<Uuid>,
    share_user_id: Option<Uuid>,
    share_label: Option<String>,
}

impl NoteRow {
    fn note(&self, share_id: Option<Uuid>) -> StickyNote {
        StickyNote {
            id: self.id,
            body: self.body.clone(),
            colour: self.colour.clone(),
            pinned: self.pinned,
            expires_at: self.expires_at,
            author_id: self.author_id,
            author_name: self.author_name.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            share_id,
            shares: Vec::new(),
        }
    }
}

/// `GET /api/notes` — everything the panel shows, in one round trip.
///
/// One row per (note, share) the reader may see: all shares of the reader's
/// own notes, and only the shares addressed to the reader or the reader's
/// departments on anyone else's. A note that has cleared itself
/// (`expires_at` passed) is not returned.
///
/// # Errors
/// 403 without `notes.use`.
pub async fn list_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<StickyNotesView>, AppError> {
    require_permission(&claims, permissions::notes::USE)?;
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The live column, not the token: a department added since sign-in shows
    // its board now, not at the next login.
    let departments = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT d.id, d.name FROM departments d \
         JOIN users u ON d.id = ANY(u.department_ids) \
         WHERE u.id = $1 AND u.tenant_id = $2 AND d.deleted_at IS NULL \
         ORDER BY d.name",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let department_ids: Vec<Uuid> = departments.iter().map(|(id, _)| *id).collect();

    let rows = sqlx::query_as::<_, NoteRow>(
        "SELECT n.id, n.body, n.colour, n.pinned, n.expires_at, n.author_id, \
                a.full_name AS author_name, n.created_at, n.updated_at, \
                s.id AS share_id, s.department_id, s.user_id AS share_user_id, \
                COALESCE(d.name, su.full_name) AS share_label \
         FROM sticky_notes n \
         JOIN users a ON a.id = n.author_id \
         LEFT JOIN sticky_note_shares s ON s.note_id = n.id AND s.deleted_at IS NULL \
         LEFT JOIN departments d ON d.id = s.department_id \
         LEFT JOIN users su ON su.id = s.user_id \
         WHERE n.tenant_id = $1 AND n.deleted_at IS NULL \
           AND (n.expires_at IS NULL OR n.expires_at > now()) \
           AND (n.author_id = $2 OR s.user_id = $2 OR s.department_id = ANY($3)) \
         ORDER BY n.pinned DESC, n.updated_at DESC \
         LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&department_ids)
    .bind(ROW_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(StickyNotesView {
        can_moderate: is_bypass_role(&claims)
            || claims.permissions.iter().any(|p| p == permissions::notes::MODERATE),
        ..group(&rows, claims.sub, &departments)
    }))
}

/// Sort the rows into the three lists, keeping the query's order.
fn group(rows: &[NoteRow], me: Uuid, departments: &[(Uuid, String)]) -> StickyNotesView {
    let mut mine: Vec<StickyNote> = Vec::new();
    let mut mine_at: HashMap<Uuid, usize> = HashMap::new();
    let mut shared_with_me = Vec::new();
    let mut boards: Vec<StickyNoteBoard> = departments
        .iter()
        .map(|(id, name)| StickyNoteBoard {
            department_id: *id,
            department_name: name.clone(),
            notes: Vec::new(),
        })
        .collect();
    let board_at: HashMap<Uuid, usize> =
        departments.iter().enumerate().map(|(i, (id, _))| (*id, i)).collect();

    for row in rows {
        if row.author_id == me {
            let at = *mine_at.entry(row.id).or_insert_with(|| {
                mine.push(row.note(None));
                mine.len() - 1
            });
            if let (Some(id), Some(label)) = (row.share_id, row.share_label.clone()) {
                mine[at].shares.push(StickyNoteShare {
                    id,
                    department_id: row.department_id,
                    user_id: row.share_user_id,
                    label,
                });
            }
        } else if row.share_user_id == Some(me) {
            shared_with_me.push(row.note(row.share_id));
        }
        if let Some(&at) = row.department_id.and_then(|d| board_at.get(&d)) {
            boards[at].notes.push(row.note(row.share_id));
        }
    }
    StickyNotesView { mine, shared_with_me, boards, can_moderate: false }
}

#[cfg(test)]
mod tests {
    use super::{NoteRow, group};
    use chrono::Utc;
    use uuid::Uuid;

    fn row(author: Uuid, dept: Option<Uuid>, user: Option<Uuid>) -> NoteRow {
        NoteRow {
            id: Uuid::new_v4(),
            body: "Crash cart check at 6".to_owned(),
            colour: "yellow".to_owned(),
            pinned: false,
            expires_at: None,
            author_id: author,
            author_name: "Sr Mary".to_owned(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            share_id: (dept.is_some() || user.is_some()).then(Uuid::new_v4),
            department_id: dept,
            share_user_id: user,
            share_label: dept.map(|_| "Ward 3".to_owned()).or(user.map(|_| "Dr Rao".to_owned())),
        }
    }

    /// My note shared to my own ward shows once in "mine" with its share chip
    /// and once on the ward's board; a colleague's note handed to me lands in
    /// "shared with me" only.
    #[test]
    fn rows_sort_into_mine_shared_and_boards() {
        let (me, colleague, ward) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let rows = vec![
            row(me, Some(ward), None),
            row(colleague, None, Some(me)),
            row(me, None, None),
        ];
        let view = group(&rows, me, &[(ward, "Ward 3".to_owned())]);
        assert_eq!(view.mine.len(), 2);
        assert_eq!(view.mine[0].shares.len(), 1, "the board share is on my note");
        assert_eq!(view.shared_with_me.len(), 1);
        assert_eq!(view.boards[0].notes.len(), 1);
        assert!(view.boards[0].notes[0].share_id.is_some(), "removable from the board");
    }
}
