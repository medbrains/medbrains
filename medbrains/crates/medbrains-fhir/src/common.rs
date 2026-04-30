//! Common FHIR R4 datatypes shared across resources.
//!
//! Spec references map to <https://www.hl7.org/fhir/R4/datatypes.html>.

use serde::{Deserialize, Serialize};

/// FHIR `Identifier` — a business identifier for a resource.
/// <https://www.hl7.org/fhir/R4/datatypes.html#Identifier>
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Identifier {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
}

impl Identifier {
    pub fn new(system: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            system: Some(system.into()),
            value: Some(value.into()),
            r#use: None,
        }
    }
}

/// FHIR `Coding` — a code from a terminology system.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Coding {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

impl Coding {
    pub fn new(system: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            system: Some(system.into()),
            code: Some(code.into()),
            display: None,
        }
    }
}

/// FHIR `CodeableConcept` — concept that is coded with one or more
/// codings.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct CodeableConcept {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub coding: Vec<Coding>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

impl CodeableConcept {
    pub fn from_text(text: impl Into<String>) -> Self {
        Self { coding: vec![], text: Some(text.into()) }
    }

    pub fn from_coding(coding: Coding) -> Self {
        Self { coding: vec![coding], text: None }
    }
}

/// FHIR `HumanName`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct HumanName {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub given: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// FHIR `Address` — IndianAdministrativeUnits if used inside ABDM.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Address {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub line: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub postal_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
}

/// FHIR `ContactPoint` — phone / email / URL.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct ContactPoint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#use: Option<String>,
}

/// FHIR `Reference` — pointer to another resource.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Reference {
    /// `ResourceType/id` form (e.g., `"Patient/123"`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

impl Reference {
    pub fn to_resource(resource_type: &str, id: impl Into<String>) -> Self {
        Self {
            reference: Some(format!("{resource_type}/{}", id.into())),
            display: None,
        }
    }
}

/// FHIR `Period`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Period {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<chrono::DateTime<chrono::Utc>>,
}

/// FHIR `Money` — value + currency code.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Money {
    pub value: f64,
    pub currency: String,
}

impl Money {
    pub fn inr(value: f64) -> Self {
        Self { value, currency: "INR".to_owned() }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn identifier_serializes_omits_none() {
        let id = Identifier::new("https://abdm.gov.in/health-id", "12-3456-7890-1234");
        let json = serde_json::to_value(&id).unwrap();
        assert_eq!(json["system"], "https://abdm.gov.in/health-id");
        assert_eq!(json["value"], "12-3456-7890-1234");
        assert!(json.get("use").is_none(), "None fields must be omitted");
    }

    #[test]
    fn reference_uses_resource_slash_id_form() {
        let r = Reference::to_resource("Patient", "abc");
        assert_eq!(r.reference.as_deref(), Some("Patient/abc"));
    }

    #[test]
    fn money_inr_helper() {
        let m = Money::inr(1500.50);
        assert_eq!(m.currency, "INR");
        assert!((m.value - 1500.50).abs() < f64::EPSILON);
    }
}
