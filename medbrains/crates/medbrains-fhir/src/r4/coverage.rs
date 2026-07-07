use serde::{Deserialize, Serialize};

use super::identifier::Identifier;
use super::reference::Reference;

/// FHIR R4 `Coverage` — the patient's insurance policy, as required by the NHCX
/// cashless claim cycle (referenced from `Claim.insurance.coverage`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coverage {
    pub id: String,

    /// `active` | `cancelled` | `draft` | `entered-in-error`.
    pub status: String,

    /// Policy / member identifier(s) (policy number, member id).
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub identifier: Vec<Identifier>,

    /// The insured patient.
    pub beneficiary: Reference,

    /// The subscriber/member id on the policy.
    #[serde(skip_serializing_if = "Option::is_none", rename = "subscriberId")]
    pub subscriber_id: Option<String>,

    /// The payer(s) — insurer / TPA organisation.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub payor: Vec<Reference>,
}
