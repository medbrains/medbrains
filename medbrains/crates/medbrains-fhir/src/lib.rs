//! HL7 FHIR R4 resource builders + serializers.
//!
//! Phase 11 of the hybrid roadmap — ABDM M4 NHCX claims need FHIR
//! R4 envelopes. This crate provides typed builders for the resources
//! NHCX consumes: Patient, Coverage, Encounter, Claim, ClaimResponse.
//!
//! Why a dedicated crate (vs hand-rolled JSON in the outbox):
//! - The same resources show up in FHIR-R4 export, ABDM HIP/HIU
//!   exchanges, and the future health-data-locker integrations. One
//!   place to keep them right.
//! - Compile-time guarantees on cardinality (e.g., Patient.name is
//!   `Vec<HumanName>` not `Option<HumanName>`).
//! - Strict (de)serde — FHIR's `resourceType` discriminator is
//!   handled via serde tags, so accidentally writing a Coverage as a
//!   Patient won't compile.
//!
//! Coverage today: Patient, HumanName, Identifier, CodeableConcept,
//! Coding, Address, ContactPoint, Reference, Period, Money,
//! Coverage, Encounter, Claim (+items), ClaimResponse. Other R4
//! resources land as-needed.

pub mod common;
pub mod patient;
pub mod coverage;
pub mod encounter;
pub mod claim;
pub mod bundle;

pub use common::{
    Address, CodeableConcept, Coding, ContactPoint, HumanName, Identifier,
    Money, Period, Reference,
};
pub use patient::Patient;
pub use coverage::Coverage;
pub use encounter::Encounter;
pub use claim::{Claim, ClaimItem, ClaimResponse};
pub use bundle::{Bundle, BundleEntry, BundleType};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FhirError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),

    #[error("invalid value for {field}: {reason}")]
    Invalid { field: &'static str, reason: String },

    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type FhirResult<T> = Result<T, FhirError>;
