//! What a note is on the wire, and the rules about its content that need no
//! database to check.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// The most a section may hold — a long discharge history, not a pasted book.
pub const SECTION_MAX_CHARS: usize = 20_000;
/// The most a structured section's data may hold, serialised.
pub const SECTION_MAX_DATA_BYTES: usize = 200_000;

/// A part of a note: free text, or a structured record (history, review of
/// systems, examination) whose shape the screen that edits it owns.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Section {
    pub code: String,
    pub title: String,
    #[serde(default)]
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// A change to one section of a draft: what is sent replaces, what is not
/// sent stays — the History tab saving the history leaves the plan alone.
#[derive(Debug, Clone, Deserialize)]
pub struct SectionPatch {
    pub code: String,
    pub text: Option<String>,
    pub data: Option<Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NoteType {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub loinc_code: Option<String>,
    pub category: String,
    pub sections: Value,
    /// Roles that write this type; empty: anyone who writes notes.
    pub author_roles: Vec<String>,
    /// `opd`, `ipd`, `emergency` — the visits it is written on.
    pub encounter_kinds: Vec<String>,
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
    /// The consultant who countersigns it, when its author has one.
    pub cosigner_name: Option<String>,
    /// `pending`, `countersigned` or `returned`.
    pub cosign_status: Option<String>,
    pub cosigned_at: Option<DateTime<Utc>>,
    /// Why it was returned to its author.
    pub cosign_comment: Option<String>,
    /// The caller is the consultant asked to countersign it, and has not yet.
    pub is_my_cosign: bool,
}

/// The note's sections with the patches applied, in the note's own order.
/// A patch for a section the note does not have is refused, not dropped.
pub fn apply_patches(base: &[Section], patches: &[SectionPatch]) -> Result<Vec<Section>, String> {
    if let Some(stray) = patches
        .iter()
        .find(|p| !base.iter().any(|b| b.code == p.code))
    {
        return Err(format!("This note has no section '{}'", stray.code));
    }
    let mut out = Vec::with_capacity(base.len());
    for section in base {
        let mut next = section.clone();
        if let Some(patch) = patches.iter().find(|p| p.code == section.code) {
            if let Some(text) = &patch.text {
                if text.chars().count() > SECTION_MAX_CHARS {
                    return Err(format!(
                        "{} is longer than {SECTION_MAX_CHARS} characters",
                        section.title
                    ));
                }
                next.text.clone_from(text);
            }
            if let Some(data) = &patch.data {
                if data.to_string().len() > SECTION_MAX_DATA_BYTES {
                    return Err(format!("{} holds too much", section.title));
                }
                next.data = Some(data.clone());
            }
        }
        out.push(next);
    }
    Ok(out)
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
    sections
        .iter()
        .any(|s| !plain(&s.text).is_empty() || s.data.as_ref().is_some_and(has_data))
}

/// Whether structured data records anything: an empty list or a record of
/// empty values is not a finding.
fn has_data(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::String(s) => !s.trim().is_empty(),
        Value::Array(items) => items.iter().any(has_data),
        Value::Object(map) => map.values().any(has_data),
        Value::Bool(_) | Value::Number(_) => true,
    }
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
    use serde_json::json;

    fn note() -> Vec<Section> {
        ["subjective", "history", "plan"]
            .iter()
            .map(|c| Section {
                code: (*c).into(),
                title: (*c).into(),
                text: String::new(),
                data: None,
            })
            .collect()
    }

    fn patch(code: &str, text: Option<&str>, data: Option<Value>) -> SectionPatch {
        SectionPatch {
            code: code.into(),
            text: text.map(Into::into),
            data,
        }
    }

    #[test]
    fn a_patch_changes_only_what_it_sends() {
        let mut base = note();
        base[2].text = "Chest X-ray".into();
        let history = json!({ "hpi": "Cough for three weeks" });
        let next = apply_patches(&base, &[patch("history", None, Some(history.clone()))])
            .expect("applied");
        assert_eq!(next[1].data, Some(history));
        assert_eq!(next[2].text, "Chest X-ray", "the plan is left alone");
    }

    #[test]
    fn a_patch_for_a_section_the_note_lacks_is_refused() {
        assert!(apply_patches(&note(), &[patch("billing", Some("x"), None)]).is_err());
    }

    #[test]
    fn empty_text_and_empty_records_are_no_content() {
        let mut s = note();
        s[0].text = "<p></p>".into();
        s[1].data = Some(json!({ "hpi": "", "past_medical_history": [] }));
        assert!(!has_content(&s));
        s[1].data = Some(json!({ "past_medical_history": [{ "condition": "Diabetes" }] }));
        assert!(has_content(&s));
    }

    #[test]
    fn the_hash_changes_with_the_data() {
        let mut s = note();
        let before = content_hash(&s);
        s[1].data = Some(json!({ "hpi": "a" }));
        assert_ne!(before, content_hash(&s));
    }
}
