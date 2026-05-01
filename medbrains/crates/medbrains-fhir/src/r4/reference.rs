use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// FHIR `Reference` — a pointer to another resource. Wire form is the
/// FHIR-relative URL `{ResourceType}/{id}` plus optional display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub reference: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

impl Reference {
    pub fn to(resource_type: &str, id: Uuid) -> Self {
        Self {
            reference: format!("{resource_type}/{id}"),
            display: None,
        }
    }

    pub fn with_display(mut self, display: impl Into<String>) -> Self {
        self.display = Some(display.into());
        self
    }
}
