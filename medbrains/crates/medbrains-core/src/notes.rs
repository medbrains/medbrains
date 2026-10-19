//! Sticky notes: a person's own notes, shared to department boards or to
//! colleagues. The author owns a note; a share is who else may read it.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The colours a note may take — names of theme palettes, never hexes.
pub const NOTE_COLOURS: &[&str] = &["yellow", "blue", "green", "pink", "gray"];

/// Longest note body, matching the column's CHECK.
pub const MAX_NOTE_CHARS: usize = 1_000;

/// Where one of the author's notes has been shared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNoteShare {
    pub id: Uuid,
    pub department_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// Department or colleague name, for the chip.
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNote {
    pub id: Uuid,
    pub body: String,
    pub colour: String,
    pub pinned: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub author_id: Uuid,
    pub author_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// The share that put this note in front of the reader (absent on the
    /// author's own list) — removing it takes the note off that board or list.
    pub share_id: Option<Uuid>,
    /// Every share, on the author's own notes only.
    pub shares: Vec<StickyNoteShare>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNoteBoard {
    pub department_id: Uuid,
    pub department_name: String,
    pub notes: Vec<StickyNote>,
}

/// Everything the notes panel shows, in one round trip.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNotesView {
    pub mine: Vec<StickyNote>,
    pub shared_with_me: Vec<StickyNote>,
    pub boards: Vec<StickyNoteBoard>,
    /// Whether the reader may take others' notes off their departments' boards.
    pub can_moderate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveStickyNote {
    pub body: String,
    pub colour: String,
    #[serde(default)]
    pub pinned: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetStickyNoteShares {
    #[serde(default)]
    pub department_ids: Vec<Uuid>,
    #[serde(default)]
    pub user_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteRecipient {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteRecipients {
    pub departments: Vec<NoteRecipient>,
    pub users: Vec<NoteRecipient>,
}
