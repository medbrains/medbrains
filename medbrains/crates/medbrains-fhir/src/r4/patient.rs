use serde::{Deserialize, Serialize};

use super::identifier::Identifier;

/// FHIR R4 `Patient` resource (subset).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    /// Logical id (typically our internal patient UUID stringified).
    pub id: String,

    /// External identifiers — UHID, ABHA, MRN, passport, etc.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub identifier: Vec<Identifier>,

    pub active: bool,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub name: Vec<HumanName>,

    /// Telecom entries — phone, email.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub telecom: Vec<ContactPoint>,

    /// `male` | `female` | `other` | `unknown` (FHIR AdministrativeGender).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,

    /// ISO date `YYYY-MM-DD`.
    #[serde(skip_serializing_if = "Option::is_none", rename = "birthDate")]
    pub birth_date: Option<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub address: Vec<Address>,
}

/// FHIR `HumanName`. We populate `family` + `given` and a precomputed
/// `text` for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HumanName {
    /// `usual`, `official`, `nickname`, `maiden`, `temp`, `anonymous`, `old`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub given: Vec<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub prefix: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactPoint {
    /// `phone` | `fax` | `email` | `pager` | `url` | `sms` | `other`.
    pub system: String,
    pub value: String,
    /// `home` | `work` | `temp` | `old` | `mobile`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub line: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(rename = "postalCode", skip_serializing_if = "Option::is_none")]
    pub postal_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
}
