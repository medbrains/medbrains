//! What a note is on the wire, and the rules about its content that need no
//! database to check.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// The most a section may hold — a long discharge history, not a pasted book.
pub const SECTION_MAX_CHARS: usize = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Section {
    pub code: String,
    pub title: String,
    #[serde(default)]
    pub text: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NoteType {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub loinc_code: Option<String>,
    pub category: String,
    pub sections: Value,
}

/// A note as the case sheet shows it: who, where, when, and what it says.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Note {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub note_type_code: String,
    pub note_type_name: String,
    pub author_id: Uuid,
    pub author_name: String,
    pub author_role: String,
    pub author_registration: Option<String>,
    pub department_name: Option<String>,
    pub status: String,
    pub service_at: DateTime<Utc>,
    pub signed_at: Option<DateTime<Utc>>,
    pub locked_at: Option<DateTime<Utc>>,
    pub late_entry_reason: Option<String>,
    pub current_version: i32,
    pub amends_note_id: Option<Uuid>,
    pub migrated_from: Option<String>,
    pub entered_in_error_at: Option<DateTime<Utc>>,
    pub entered_in_error_reason: Option<String>,
    pub sections: Value,
    pub saved_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    /// The caller wrote it.
    pub is_mine: bool,
    /// The caller may still revise it: theirs, signed, inside the grace.
    pub revisable: bool,
}

/// The sections a draft may hold: the type's own, in its order, each within
/// the size limit. Text the type has no section for is refused, not dropped.
pub fn merge_sections(template: &[Section], incoming: &[Section]) -> Result<Vec<Section>, String> {
    if let Some(stray) = incoming
        .iter()
        .find(|s| !template.iter().any(|t| t.code == s.code))
    {
        return Err(format!("This note has no section '{}'", stray.code));
    }
    if let Some(long) = incoming
        .iter()
        .find(|s| s.text.chars().count() > SECTION_MAX_CHARS)
    {
        return Err(format!(
            "{} is longer than {SECTION_MAX_CHARS} characters",
            long.title
        ));
    }
    Ok(template
        .iter()
        .map(|t| Section {
            text: incoming
                .iter()
                .find(|s| s.code == t.code)
                .map_or_else(String::new, |s| s.text.clone()),
            ..t.clone()
        })
        .collect())
}

/// Text with the editor's markup taken out: what a reader would see.
pub fn plain(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_tag = false;
    for c in text.chars() {
        match c {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&nbsp;", " ").trim().to_owned()
}

/// Whether a note says anything at all — an empty note is not signed.
pub fn has_content(sections: &[Section]) -> bool {
    sections.iter().any(|s| !plain(&s.text).is_empty())
}

/// The fingerprint a signature is over: the sections exactly as signed.
pub fn content_hash(sections: &[Section]) -> String {
    let canonical = serde_json::to_vec(sections).unwrap_or_default();
    hex::encode(Sha256::digest(canonical))
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;

    fn soap() -> Vec<Section> {
        ["subjective", "plan"]
            .iter()
            .map(|c| Section {
                code: (*c).into(),
                title: (*c).into(),
                text: String::new(),
            })
            .collect()
    }

    #[test]
    fn a_draft_keeps_the_types_sections_in_order() {
        let incoming = vec![Section {
            code: "plan".into(),
            title: "x".into(),
            text: "CXR".into(),
        }];
        let merged = merge_sections(&soap(), &incoming).expect("merged");
        assert_eq!(merged[0].text, "");
        assert_eq!(
            (merged[1].title.as_str(), merged[1].text.as_str()),
            ("plan", "CXR")
        );
    }

    #[test]
    fn text_for_a_section_the_type_lacks_is_refused() {
        let stray = vec![Section {
            code: "billing".into(),
            title: "x".into(),
            text: "y".into(),
        }];
        assert!(merge_sections(&soap(), &stray).is_err());
    }

    #[test]
    fn an_empty_editor_document_is_no_content() {
        let mut s = soap();
        s[0].text = "<p></p>".into();
        assert!(!has_content(&s));
        s[1].text = "<p>Review in a week</p>".into();
        assert!(has_content(&s));
    }

    #[test]
    fn the_hash_changes_with_a_single_character() {
        let mut s = soap();
        let before = content_hash(&s);
        s[0].text = "a".into();
        assert_ne!(before, content_hash(&s));
    }
}
