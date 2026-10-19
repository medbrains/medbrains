use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::identifier::Identifier;

/// FHIR `Reference` — a pointer to another resource. Wire form is the
/// FHIR-relative URL `{ResourceType}/{id}` plus optional display, and the
/// target's business identifier when one is known (an HPR ID for a
/// Practitioner, an HFR ID for an Organization) so a receiver that never
/// sees the referenced resource can still resolve it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub reference: String,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub identifier: Option<Identifier>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

impl Reference {
    pub fn to(resource_type: &str, id: Uuid) -> Self {
        Self {
            reference: format!("{resource_type}/{id}"),
            identifier: None,
            display: None,
        }
    }

    pub fn with_display(mut self, display: impl Into<String>) -> Self {
        self.display = Some(display.into());
        self
    }

    /// Attach `system|value` when `value` is present and non-blank.
    pub fn with_identifier(mut self, system: &str, value: Option<&str>) -> Self {
        self.identifier = value
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|v| Identifier::new(system, v));
        self
    }
}
