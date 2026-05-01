use serde::{Deserialize, Serialize};

/// FHIR `Coding` — a single code from a terminology system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coding {
    /// Terminology system URI.
    /// LOINC: "http://loinc.org"
    /// SNOMED CT: "http://snomed.info/sct"
    /// ICD-10: "http://hl7.org/fhir/sid/icd-10"
    /// RxNorm: "http://www.nlm.nih.gov/research/umls/rxnorm"
    /// ATC: "http://www.whocc.no/atc"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,

    pub code: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

/// FHIR `CodeableConcept` — a code drawn from one or more terminology
/// systems plus optional human-readable text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeableConcept {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub coding: Vec<Coding>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

impl CodeableConcept {
    pub fn from_text(text: impl Into<String>) -> Self {
        Self {
            coding: Vec::new(),
            text: Some(text.into()),
        }
    }

    pub fn from_coding(system: impl Into<String>, code: impl Into<String>, display: impl Into<String>) -> Self {
        let display_str = display.into();
        Self {
            coding: vec![Coding {
                system: Some(system.into()),
                code: code.into(),
                display: Some(display_str.clone()),
            }],
            text: Some(display_str),
        }
    }
}
