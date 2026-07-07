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
