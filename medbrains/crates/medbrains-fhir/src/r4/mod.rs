//! FHIR R4 resource definitions. Hand-rolled to avoid the 4MB+ generated
//! crates; we cover only the resources MedBrains needs (Patient,
//! Encounter, Observation, DiagnosticReport, Composition, Procedure,
//! MedicationRequest, Coverage, Claim, ClaimResponse, Bundle).

pub mod bundle;
pub mod coding;
pub mod encounter;
pub mod identifier;
pub mod observation;
pub mod patient;
pub mod reference;

use serde::{Deserialize, Serialize};

/// FHIR `Resource` discriminated union. `resourceType` field is emitted
/// via the serde tag, matching FHIR JSON wire format.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "resourceType")]
pub enum Resource {
    Patient(patient::Patient),
    Encounter(encounter::Encounter),
    Observation(observation::Observation),
    Bundle(bundle::Bundle),
}
