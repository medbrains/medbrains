//! FHIR R4 resource types and mappers.
//!
//! Scope: enough of FHIR R4 to satisfy ABDM IG profiles and NHCX claim
//! bundles. We hand-roll the structs (no `fhir-model` dep — those crates
//! pull in 4MB+ of generated code we don't need) and only encode the
//! fields we actually populate.
//!
//! Each resource serializes as canonical FHIR JSON. The `resourceType`
//! discriminator is rendered via `#[serde(tag = "resourceType")]` on
//! `Resource`. References use the FHIR `{type}/{id}` literal form.
//!
//! Bundle batch/transaction support is in `bundle.rs`; mappers from
//! internal MedBrains domain types live in `mapper.rs`.

pub mod r4;
pub mod mapper;

pub use r4::{
    bundle::{Bundle, BundleEntry, BundleType},
    coding::{CodeableConcept, Coding},
    encounter::Encounter,
    identifier::Identifier,
    observation::Observation,
    patient::{HumanName, Patient},
    reference::Reference,
    Resource,
};
