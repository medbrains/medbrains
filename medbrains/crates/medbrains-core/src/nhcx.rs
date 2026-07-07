//! NHCX (National Health Claims Exchange) external endpoints — the ABDM/NHA gateway
//! URLs, centralised here (not scattered across the outbox handler + the onboarding /
//! exchange routes). Values are from the official NHCX documentation + Postman
//! collections. Kept in `medbrains-core` so both `medbrains-server` and
//! `medbrains-outbox` reference the same source of truth.

/// ABDM sessions API — exchanges `clientId`/`clientSecret` for a time-limited bearer
/// token ("Authenticating with NHCX"). The same ABDM/ABHA creds work for NHCX.
pub const ABDM_SESSIONS_URL: &str = "https://dev.abdm.gov.in/gateway/v0.5/sessions";

/// HCX claim-exchange gateway HOST (sandbox). Exchange operations are under
/// `/hcx/v1/...` (e.g. `coverageeligibility/check`, `preauth/submit`, `claim/submit`).
pub const GATEWAY_HOST_SANDBOX: &str = "https://apisbx.abdm.gov.in";
/// HCX claim-exchange gateway HOST — production.
pub const GATEWAY_HOST_PROD: &str = "https://apisprod.nha.gov.in";

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
pub const CONFIDENTIALITY_SYSTEM: &str =
    "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
/// SNOMED institutional-claim code used for `Claim.type` (per the NHCX sample).
pub const SNOMED_INSTITUTIONAL_CLAIM_CODE: &str = "737481003";
/// SNOMED code for the careTeam role "Healthcare professional (occupation)".
pub const SNOMED_HEALTHCARE_PROFESSIONAL_CODE: &str = "223366009";
