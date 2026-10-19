use std::fmt::Write;

use serde::{Deserialize, Serialize};

use super::coding::CodeableConcept;
use super::reference::Reference;

/// FHIR R4 `Composition` (subset): one clinical note — who wrote it, about
/// whom, on which visit, its sections, and who attested it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Composition {
    pub id: String,

    /// `preliminary` | `final` | `amended` | `entered-in-error`.
    pub status: String,

    /// The kind of note — LOINC document type when the note type has one.
    #[serde(rename = "type")]
    pub kind: CodeableConcept,

    pub subject: Reference,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub encounter: Option<Reference>,

    /// When the care the note records happened (ISO 8601).
    pub date: String,

    pub author: Vec<Reference>,

    pub title: String,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub attester: Vec<Attester>,

    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "relatesTo")]
    pub relates_to: Vec<RelatesTo>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub section: Vec<CompositionSection>,
}

/// Who vouched for the note: `legal` (the signing author) or `professional`
/// (the countersigning consultant).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attester {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub party: Option<Reference>,
}

/// An addendum `appends` the note it adds to.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatesTo {
    pub code: String,
    #[serde(rename = "targetReference")]
    pub target_reference: Reference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositionSection {
    pub title: String,
    pub text: Narrative,
}

/// Human-readable XHTML; `generated` from the note's own content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Narrative {
    pub status: String,
    pub div: String,
}

impl Narrative {
    /// Lines of plain text as an escaped XHTML div, one paragraph each.
    pub fn from_lines<S: AsRef<str>>(lines: &[S]) -> Self {
        let body = lines.iter().fold(String::new(), |mut acc, l| {
            let _ = write!(acc, "<p>{}</p>", escape(l.as_ref()));
            acc
        });
        Self {
            status: "generated".to_owned(),
            div: format!("<div xmlns=\"http://www.w3.org/1999/xhtml\">{body}</div>"),
        }
    }
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::Narrative;

    #[test]
    fn narrative_text_is_escaped_xhtml() {
        let n = Narrative::from_lines(&["BP <140 & stable"]);
        assert_eq!(
            n.div,
            "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p>BP &lt;140 &amp; stable</p></div>"
        );
    }
}
