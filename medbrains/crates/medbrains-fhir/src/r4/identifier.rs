use serde::{Deserialize, Serialize};

/// FHIR `Identifier` — used for any external identifier on a resource
/// (UHID, MRN, ABHA, policy number, etc.).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identifier {
    /// Identifier system URI. Examples:
    ///   - "https://healthid.ndhm.gov.in" for ABHA
    ///   - "https://medbrains.health/uhid" for our internal UHID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,

    pub value: String,

    /// Optional usage tag — `usual`, `official`, `temp`, `secondary`, `old`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
}

impl Identifier {
    pub fn new(system: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            system: Some(system.into()),
            value: value.into(),
            r#use: None,
        }
    }
}
