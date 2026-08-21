//! What a SNOMED concept is, as this system uses it.

use serde::{Deserialize, Serialize};

/// A concept, with whatever the server told us about it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Concept {
    /// The SNOMED CT identifier — always a numeric string, never an integer.
    /// Concept ids exceed 2^53 and JavaScript would silently round them.
    pub code: String,
    pub display: String,
    /// `disorder`, `finding`, `procedure`, and so on. What lets a diagnosis
    /// picker offer disorders while a procedure picker offers procedures,
    /// rather than showing a clinician all 350,000 concepts.
    pub semantic_tag: Option<String>,
    /// `None` means the server did not say — deliberately distinct from
    /// `Some(false)`, so a missing field never retires a live concept.
    pub active: Option<bool>,
    /// Parents and children. The reason for using a terminology server rather
    /// than a code table: without these there is no way to ask whether one
    /// concept is a kind of another.
    #[serde(default)]
    pub relationships: Vec<Relationship>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Relationship {
    /// True for a parent (this concept IS-A that one), false for a child.
    pub is_parent: bool,
    pub code: String,
    pub display: Option<String>,
}
