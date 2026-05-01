use serde::{Deserialize, Serialize};

use super::coding::{CodeableConcept, Coding};
use super::reference::Reference;

/// FHIR R4 `Encounter` resource (subset).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Encounter {
    pub id: String,

    /// `planned` | `arrived` | `triaged` | `in-progress` | `onleave` |
    /// `finished` | `cancelled` | `entered-in-error` | `unknown`.
    pub status: String,

    /// EncounterClass — `IMP` (inpatient), `AMB` (ambulatory/OPD),
    /// `EMER` (emergency), `HH` (home health), etc. From
    /// `http://terminology.hl7.org/CodeSystem/v3-ActCode`.
    pub class: Coding,

    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "type")]
    pub kind: Vec<CodeableConcept>,

    pub subject: Reference,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub participant: Vec<EncounterParticipant>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<Period>,

    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "reasonCode")]
    pub reason_code: Vec<CodeableConcept>,

    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "serviceProvider")]
    pub service_provider: Vec<Reference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncounterParticipant {
    /// e.g. attending physician, consulting nurse, admitter.
    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "type")]
    pub kind: Vec<CodeableConcept>,
    pub individual: Reference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Period {
    /// ISO 8601 datetime (FHIR `instant` precision).
    pub start: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<String>,
}
