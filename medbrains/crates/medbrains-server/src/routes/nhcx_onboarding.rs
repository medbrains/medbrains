//! NHCX participant onboarding — the contract for registering a facility as an NHCX
//! participant (a `PROVIDER`) before any cashless claim can be exchanged.
//!
//! Mirrors the official ABDM "NHCX-OnBoarding APIs" Postman collection exactly:
//! `POST {base}/participant/create` and `/participant/update` (bearer-authed with an
//! ABDM central-registry token) return a `transactionId`; a follow-up
//! `GET {base}/validate?transactionId=&passcode=` (OTP) confirms the registration.
//!
//! This module is the clean, spec-accurate request/response layer. The live HTTP call,
//! the ABDM session token, and the facility's certs are wired at the call site (needs
//! the tenant's NHCX participant credentials).

use serde::{Deserialize, Serialize};

/// Sandbox participant-service base (ABDM SBX gateway).
pub const SANDBOX_BASE: &str =
    "https://apisbx.abdm.gov.in/pmjay/sbxhcx/participanthcxservice";
/// Production participant-service base (NHA gateway, v2).
pub const PROD_BASE: &str = "https://apisprod.nha.gov.in/pmjay/hcx/participanthcxservice/v2";

/// Participant role codes (from the onboarding collection). A hospital is `Provider`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParticipantRole {
    Provider,
    Payer,
    AgencyTpa,
    AgencyRegulator,
    Research,
    MemberIsnp,
    AgencySponsor,
    HieHioHcx,
}

impl ParticipantRole {
    /// The numeric code NHCX expects in `roles[]`.
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Provider => "10001",
            Self::Payer => "10002",
            Self::AgencyTpa => "10003",
            Self::AgencyRegulator => "10004",
            Self::Research => "10005",
            Self::MemberIsnp => "10006",
            Self::AgencySponsor => "10007",
            Self::HieHioHcx => "10008",
        }
    }
}

/// Linked-registry type codes (from the onboarding collection).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RegistryType {
    /// Health Facility Registry.
    Hfr,
    Nin,
    Rohini,
    Payer,
}

impl RegistryType {
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Hfr => "10001",
            Self::Nin => "10002",
            Self::Rohini => "10003",
            Self::Payer => "10004",
        }
    }
}

/// `POST /participant/create` (and `/update`) request body. Field names match the NHCX
/// wire contract exactly (note the camelCase `primaryEmail`/`primaryMobile`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantRequest {
    /// Linked registry codes (e.g. the HFR facility id).
    pub linked_registry_codes: Vec<String>,
    /// The participant's client/registry id.
    pub registryid: String,
    pub participant_name: String,
    /// Scheme code, e.g. `PMJAY`.
    pub scheme_code: String,
    pub state: String,
    pub district: String,
    /// Role codes — see [`ParticipantRole::code`] (a hospital is `10001`).
    pub roles: Vec<String>,
    #[serde(rename = "primaryEmail")]
    pub primary_email: String,
    pub phone: Vec<String>,
    #[serde(rename = "primaryMobile")]
    pub primary_mobile: String,
    /// URL to the participant's signing certificate.
    pub signing_cert_path: String,
    /// The participant's public encryption certificate, base64 (PEM) only.
    pub encryption_cert: String,
    /// The participant's bridge/callback URL where NHCX posts responses.
    pub endpoint_url: String,
}

/// Response to create/update — carries the `transactionId` used by the validate step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantCreateResponse {
    #[serde(rename = "transactionId", alias = "transaction_id")]
    pub transaction_id: String,
    #[serde(rename = "participantCode", alias = "participant_code", default)]
    pub participant_code: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

/// Build the `GET /validate` URL for an issued transaction + its OTP passcode.
#[must_use]
pub fn validate_url(base: &str, transaction_id: &str, passcode: &str) -> String {
    format!("{base}/validate?transactionId={transaction_id}&passcode={passcode}")
}
