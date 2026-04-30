//! FHIR `Encounter` resource. <https://www.hl7.org/fhir/R4/encounter.html>
//!
//! In NHCX claims this is the visit / admission the claim is for.

use serde::{Deserialize, Serialize};

use crate::common::{CodeableConcept, Coding, Identifier, Period, Reference};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Encounter {
    #[serde(rename = "resourceType")]
    pub resource_type: EncounterType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    /// `planned` | `arrived` | `triaged` | `in-progress` |
    /// `onleave` | `finished` | `cancelled` | `entered-in-error` |
    /// `unknown`.
    pub status: String,

    /// FHIR `class` is required and uses ActEncounterCode:
    /// `AMB` (ambulatory / OPD), `IMP` (inpatient), `EMER`,
    /// `OBSENC` (observation), `HH` (home health).
    pub class: Coding,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub identifier: Vec<Identifier>,

    pub subject: Reference,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<Period>,

    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "type")]
    pub r#type: Vec<CodeableConcept>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum EncounterType {
    Encounter,
}

impl Default for EncounterType {
    fn default() -> Self {
        Self::Encounter
    }
}

const ACT_ENCOUNTER_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

impl Encounter {
    pub fn outpatient(id: impl Into<String>, patient_id: impl AsRef<str>) -> Self {
        Self {
            resource_type: EncounterType::Encounter,
            id: Some(id.into()),
            status: "finished".to_owned(),
            class: Coding::new(ACT_ENCOUNTER_SYSTEM, "AMB"),
            identifier: vec![],
            subject: Reference::to_resource("Patient", patient_id.as_ref()),
            period: None,
            r#type: vec![],
        }
    }

    pub fn inpatient(id: impl Into<String>, patient_id: impl AsRef<str>) -> Self {
        Self {
            resource_type: EncounterType::Encounter,
            id: Some(id.into()),
            status: "in-progress".to_owned(),
            class: Coding::new(ACT_ENCOUNTER_SYSTEM, "IMP"),
            identifier: vec![],
            subject: Reference::to_resource("Patient", patient_id.as_ref()),
            period: None,
            r#type: vec![],
        }
    }

    pub fn emergency(id: impl Into<String>, patient_id: impl AsRef<str>) -> Self {
        Self {
            resource_type: EncounterType::Encounter,
            id: Some(id.into()),
            status: "in-progress".to_owned(),
            class: Coding::new(ACT_ENCOUNTER_SYSTEM, "EMER"),
            identifier: vec![],
            subject: Reference::to_resource("Patient", patient_id.as_ref()),
            period: None,
            r#type: vec![],
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn outpatient_class_code() {
        let e = Encounter::outpatient("enc-1", "pat-1");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["resourceType"], "Encounter");
        assert_eq!(json["status"], "finished");
        assert_eq!(json["class"]["code"], "AMB");
        assert_eq!(json["class"]["system"], ACT_ENCOUNTER_SYSTEM);
    }

    #[test]
    fn inpatient_status_in_progress() {
        let e = Encounter::inpatient("enc-2", "pat-2");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["status"], "in-progress");
        assert_eq!(json["class"]["code"], "IMP");
    }

    #[test]
    fn emergency_class_code() {
        let e = Encounter::emergency("enc-3", "pat-3");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["class"]["code"], "EMER");
    }
}
