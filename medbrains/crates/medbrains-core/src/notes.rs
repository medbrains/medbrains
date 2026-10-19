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
    /// Written by the system from a notification: its text cannot be edited
    /// and it is never shared, only dismissed.
    pub is_system: bool,
    /// Where the item behind the note lives in the app.
    pub source_url: Option<String>,
    /// Whether the note clears itself when its source is resolved.
    pub auto_resolve: bool,
    /// Whether the source is one the server knows how to resolve — the
    /// auto-resolve switch is offered only then.
    pub can_auto_resolve: bool,
    /// When the source was resolved and the note cleared itself.
    pub resolved_at: Option<DateTime<Utc>>,
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

/// Kinds of notification a person may choose to always turn into a note:
/// `(key, label)`. `urgent` matches any notification of kind `danger`; the
/// rest match the notification's category. The matching itself is the
/// `sticky_notes_from_notification` trigger (migration 1119).
pub const NOTE_FROM_NOTIFICATION_KINDS: &[(&str, &str)] = &[
    ("urgent", "Urgent alerts — critical values and findings"),
    ("lab", "Laboratory"),
    ("radiology", "Radiology"),
    ("clinical", "Clinical — orders and refills"),
    ("nursing", "Nursing"),
    ("emergency", "Emergency"),
    ("access", "Access requests"),
    ("security", "Security"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteKindChoice {
    pub key: String,
    pub label: String,
}

/// The kinds of notification that always become a note for the reader.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNotePreferences {
    pub kinds: Vec<String>,
    pub choices: Vec<NoteKindChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveStickyNotePreferences {
    #[serde(default)]
    pub kinds: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetStickyNoteAutoResolve {
    pub auto_resolve: bool,
}
