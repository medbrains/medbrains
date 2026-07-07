use serde::{Deserialize, Serialize};

use super::coding::CodeableConcept;
use super::identifier::Identifier;
use super::reference::Reference;

/// FHIR R4 `Money`. FHIR serialises the amount as a JSON decimal; we carry it as
/// `f64` on the wire type and convert from `Decimal` in the mapper.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Money {
    pub value: f64,
    pub currency: String,
}

impl Money {
    #[must_use]
    pub fn inr(value: f64) -> Self {
        Self {
            value,
            currency: "INR".to_owned(),
        }
    }
}

/// FHIR R4 `Claim` — a cashless **pre-authorisation** (`use = "preauthorization"`)
/// or final **claim** (`use = "claim"`) request, per the NHCX FHIR profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    pub id: String,

    /// Provider's claim/pre-auth identifier(s).
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub identifier: Vec<Identifier>,

    /// `active` | `cancelled` | `draft` | `entered-in-error`.
    pub status: String,

    /// Claim category, e.g. `institutional`.
    #[serde(rename = "type")]
    pub type_: CodeableConcept,

    /// `claim` | `preauthorization` | `predetermination`.
    #[serde(rename = "use")]
    pub use_: String,

    pub patient: Reference,

    /// Date the claim/pre-auth was created (ISO-8601).
    pub created: String,

    /// The target insurer organisation.
    pub insurer: Reference,

    /// The billing provider (facility).
    pub provider: Reference,

    /// `stat` | `normal` | `deferred`.
    pub priority: CodeableConcept,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub diagnosis: Vec<ClaimDiagnosis>,

    /// Coverage(s) under which the claim is adjudicated (at least one focal).
    pub insurance: Vec<ClaimInsurance>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub item: Vec<ClaimItem>,

    /// Total claimed amount.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<Money>,
}

/// `Claim.diagnosis` — an ICD-coded diagnosis backing the claim.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimDiagnosis {
    pub sequence: u32,

    #[serde(rename = "diagnosisCodeableConcept")]
    pub diagnosis_codeable_concept: CodeableConcept,
}

/// `Claim.insurance` — the coverage the payer adjudicates against.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimInsurance {
    pub sequence: u32,

    /// True for the coverage to be used first for adjudication.
    pub focal: bool,

    pub coverage: Reference,
}

/// `Claim.item` — a billed line (service / product) with its amount.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimItem {
    pub sequence: u32,

    #[serde(rename = "productOrService")]
    pub product_or_service: CodeableConcept,

    #[serde(skip_serializing_if = "Option::is_none", rename = "unitPrice")]
    pub unit_price: Option<Money>,

    /// Line total (`quantity × unitPrice`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub net: Option<Money>,
}
