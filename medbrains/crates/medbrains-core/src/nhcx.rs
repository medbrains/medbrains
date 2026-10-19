//! NHCX (National Health Claims Exchange) external endpoints — the ABDM/NHA gateway
//! URLs, centralised here (not scattered across the outbox handler + the onboarding /
//! exchange routes). Values are from the official NHCX documentation + Postman
//! collections. Kept in `medbrains-core` so both `medbrains-server` and
//! `medbrains-outbox` reference the same source of truth.

/// ABDM v3 sessions API — exchanges `clientId`/`clientSecret` for a time-limited bearer
/// token ("Authenticating with NHCX"). The same ABDM client credentials work for NHCX.
pub const SESSIONS_URL_SANDBOX: &str = "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions";
/// ABDM v3 sessions API — production.
pub const SESSIONS_URL_PROD: &str = "https://apis.abdm.gov.in/api/hiecm/gateway/v3/sessions";

/// HCX claim-exchange gateway HOST (sandbox). Exchange operations are under
/// `/hcx/v1/...` (e.g. `coverageeligibility/check`, `preauth/submit`, `claim/submit`).
pub const GATEWAY_HOST_SANDBOX: &str = "https://apisbx.abdm.gov.in";
/// HCX claim-exchange gateway HOST — production.
pub const GATEWAY_HOST_PROD: &str = "https://apisprod.nha.gov.in";

/// Secret-store key pointing every NHCX call (sessions + gateway) at another
/// server — a local mock in tests and rehearsals. Never set in production.
pub const BASE_URL_OVERRIDE: &str = "NHCX_BASE_URL_OVERRIDE";

/// Which NHCX the hospital talks to.
#[derive(
    Clone, Copy, Debug, Default, Eq, PartialEq, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "snake_case")]
pub enum NhcxEnvironment {
    #[default]
    Sandbox,
    Production,
}

impl NhcxEnvironment {
    /// The gateway host for exchange calls.
    #[must_use]
    pub const fn gateway_host(self) -> &'static str {
        match self {
            Self::Sandbox => GATEWAY_HOST_SANDBOX,
            Self::Production => GATEWAY_HOST_PROD,
        }
    }

    /// The ABDM sessions endpoint for this environment.
    #[must_use]
    pub const fn sessions_url(self) -> &'static str {
        match self {
            Self::Sandbox => SESSIONS_URL_SANDBOX,
            Self::Production => SESSIONS_URL_PROD,
        }
    }

    /// The `X-CM-ID` the v3 gateway reads on sessions.
    #[must_use]
    pub const fn cm_id(self) -> &'static str {
        match self {
            Self::Sandbox => "sbx",
            Self::Production => "abdm",
        }
    }
}

/// An outbound HCX operation and where the gateway takes it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NhcxOperation {
    CoverageEligibility,
    Preauth,
    Claim,
}

impl NhcxOperation {
    /// Outbox `event_type` that carries this operation.
    #[must_use]
    pub const fn event_type(self) -> &'static str {
        match self {
            Self::CoverageEligibility => "nhcx.coverage_eligibility_check",
            Self::Preauth => "nhcx.preauth_submit",
            Self::Claim => "nhcx.claim_submit",
        }
    }

    /// Gateway path below the host.
    #[must_use]
    pub const fn path(self) -> &'static str {
        match self {
            Self::CoverageEligibility => "/hcx/v1/coverageeligibility/check",
            Self::Preauth => "/hcx/v1/preauth/submit",
            Self::Claim => "/hcx/v1/claim/submit",
        }
    }
}

/// Participant service base (sandbox) — participant create/update/validate, fetch
/// participants list, fetch certs, get/link/delink policies.
pub const PARTICIPANT_SERVICE_SANDBOX: &str =
    "https://apisbx.abdm.gov.in/pmjay/sbxhcx/participanthcxservice";
/// Participant service base — production (v2).
pub const PARTICIPANT_SERVICE_PROD: &str =
    "https://apisprod.nha.gov.in/pmjay/hcx/participanthcxservice/v2";

// ── FHIR profile / system URIs used in NHCX bundles ─────────────────────────
// (generic FHIR base systems — SNOMED, UHID, ABHA, process-priority — are reused
// from `medbrains_fhir::mapper`; these are the NHCX-specific ones.)

/// NHCX `ClaimBundle` conformance profile.
pub const CLAIM_BUNDLE_PROFILE: &str =
    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClaimBundle";
/// NHCX `CoverageEligibilityRequestBundle` conformance profile.
pub const COVERAGE_ELIGIBILITY_BUNDLE_PROFILE: &str =
    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/CoverageEligibilityRequestBundle";
/// HL7 v3 Confidentiality code system (for the bundle `meta.security` tag).
pub const CONFIDENTIALITY_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
/// SNOMED institutional-claim code used for `Claim.type` (per the NHCX sample).
pub const SNOMED_INSTITUTIONAL_CLAIM_CODE: &str = "737481003";
/// SNOMED code for the careTeam role "Healthcare professional (occupation)".
pub const SNOMED_HEALTHCARE_PROFESSIONAL_CODE: &str = "223366009";
