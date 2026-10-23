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
    /// The hospital's answer to a payer's `communication/request`.
    Communication,
    /// A Task asking where a claim or pre-authorisation stands.
    Status,
    /// A Task asking the payer for its claims in a date range.
    Search,
    /// A Task asking the payer to cancel a claim.
    Cancel,
    /// A Task asking the payer to reprocess a claim.
    Reprocess,
    /// The hospital's acknowledgement of a payer's payment notice.
    PaymentAck,
}

// Paths below the gateway host (docs.abdm.gov.in, NHCX endpoints): a
// status enquiry is `/v1/status` — an empty sealed payload whose
// correlation id is the checked message's api_call_id; the cancel and
// reprocess Tasks go to `/v1/task/submit`, a search to `/v1/search/submit`.
pub const PATH_ELIGIBILITY: &str = "/hcx/v1/coverageeligibility/check";
pub const PATH_PREAUTH: &str = "/hcx/v1/preauth/submit";
pub const PATH_CLAIM: &str = "/hcx/v1/claim/submit";
pub const PATH_COMMUNICATION: &str = "/hcx/v1/communication/on_request";
pub const PATH_PAYMENT_ACK: &str = "/hcx/v1/paymentnotice/on_request";
pub const PATH_STATUS: &str = "/hcx/v1/status";
pub const PATH_TASK: &str = "/hcx/v1/task/submit";
pub const PATH_SEARCH: &str = "/hcx/v1/search/submit";

impl NhcxOperation {
    /// Outbox `event_type` that carries this operation.
    #[must_use]
    pub const fn event_type(self) -> &'static str {
        match self {
            Self::CoverageEligibility => "nhcx.coverage_eligibility_check",
            Self::Preauth => "nhcx.preauth_submit",
            Self::Claim => "nhcx.claim_submit",
            Self::Communication => "nhcx.communication",
            Self::Status => "nhcx.status",
            Self::Search => "nhcx.search",
            Self::Cancel => "nhcx.cancel",
            Self::Reprocess => "nhcx.reprocess",
            Self::PaymentAck => "nhcx.payment_ack",
        }
    }

    /// Gateway path below the host.
    #[must_use]
    pub const fn path(self) -> &'static str {
        match self {
            Self::CoverageEligibility => PATH_ELIGIBILITY,
            Self::Preauth => PATH_PREAUTH,
            Self::Claim => PATH_CLAIM,
            Self::Communication => PATH_COMMUNICATION,
            Self::PaymentAck => PATH_PAYMENT_ACK,
            Self::Status => PATH_STATUS,
            Self::Cancel | Self::Reprocess => PATH_TASK,
            Self::Search => PATH_SEARCH,
        }
    }

    /// An answer to the payer's own request (`on_*` paths), as opposed to a
    /// request the hospital starts.
    #[must_use]
    pub const fn is_reply(self) -> bool {
        matches!(self, Self::Communication | Self::PaymentAck)
    }

    /// Whether a retry keeps the correlation id: a reply echoes the payer's,
    /// and a status enquiry names the message it asks about.
    #[must_use]
    pub const fn keeps_correlation(self) -> bool {
        self.is_reply() || matches!(self, Self::Status)
    }

    /// `x-hcx-status`: every send to a request path is `request.initiated`
    /// (NHCX refuses anything else there with `NHCX-1011`); only an `on_*`
    /// reply is `response.complete`.
    #[must_use]
    pub const fn hcx_status(self) -> &'static str {
        if self.is_reply() {
            "response.complete"
        } else {
            "request.initiated"
        }
    }

    /// The step code this operation always travels under, where it has one
    /// regardless of the case (NHA Workflow Status Sheet): a claim 15, a
    /// cancellation PC01, a reprocess 36. A pre-auth's code depends on its
    /// stage ([`crate::nhcx_wire::preauth_workflow_code`]); a reply echoes
    /// the payer's; eligibility, status and search have none.
    #[must_use]
    pub const fn fixed_workflow_code(self) -> Option<&'static str> {
        match self {
            Self::Claim => Some("15"),
            Self::Cancel => Some("PC01"),
            Self::Reprocess => Some("36"),
            _ => None,
        }
    }
}

/// Every operation the outbox sends — one handler each.
pub const OPERATIONS: [NhcxOperation; 9] = [
    NhcxOperation::CoverageEligibility,
    NhcxOperation::Preauth,
    NhcxOperation::Claim,
    NhcxOperation::Communication,
    NhcxOperation::Status,
    NhcxOperation::Search,
    NhcxOperation::Cancel,
    NhcxOperation::Reprocess,
    NhcxOperation::PaymentAck,
];

/// The record an outbound NHCX message belongs to — where the outbox marks
/// it sent or refused. Each table carries `nhcx_status`,
/// `nhcx_disposition`, `nhcx_submitted_at` and `nhcx_correlation_id`.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NhcxRecord {
    InsuranceClaim,
    PriorAuth,
    Verification,
    PayerQuery,
    /// A status, search, cancel or reprocess Task.
    Task,
    /// The acknowledgement of a payer's payment notice.
    PaymentNotice,
}

impl NhcxRecord {
    /// The table holding the record. A closed set, so it is safe to splice
    /// into SQL.
    #[must_use]
    pub const fn table(self) -> &'static str {
        match self {
            Self::InsuranceClaim => "insurance_claims",
            Self::PriorAuth => "prior_auth_requests",
            Self::Verification => "insurance_verifications",
            Self::PayerQuery => "nhcx_payer_queries",
            Self::Task => "nhcx_tasks",
            Self::PaymentNotice => "nhcx_payment_notices",
        }
    }
}

// ── IRDAI turnaround (Master Circular on Health Insurance, 29 May 2024) ─────

/// An insurer decides a cashless authorisation request within one hour of
/// receiving it.
pub const CASHLESS_DECISION_MINUTES: i64 = 60;
/// An insurer grants final (discharge) authorisation within three hours of
/// receiving the discharge request.
pub const DISCHARGE_DECISION_MINUTES: i64 = 180;

/// Where a pre-authorisation stands against its IRDAI turnaround.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SlaState {
    /// Not yet sent to the payer — no clock.
    NotStarted,
    /// Waiting, within the limit.
    Running,
    /// Decided within the limit.
    Met,
    /// Over the limit — waiting or decided late.
    Breached,
}

/// The clock on one pre-authorisation, computed from its timestamps.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PreauthSla {
    pub limit_minutes: i64,
    pub elapsed_minutes: Option<i64>,
    pub state: SlaState,
}

/// The IRDAI clock: one hour for a cashless request, three for a discharge
/// request; it runs from when the payer received the request until it
/// decided, or until `now`. A payer query does not stop it — the circular
/// names no pause.
#[must_use]
pub fn preauth_sla(
    is_discharge: bool,
    received_at: Option<chrono::DateTime<chrono::Utc>>,
    decided_at: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> PreauthSla {
    let limit_minutes = if is_discharge {
        DISCHARGE_DECISION_MINUTES
    } else {
        CASHLESS_DECISION_MINUTES
    };
    let Some(start) = received_at else {
        return PreauthSla {
            limit_minutes,
            elapsed_minutes: None,
            state: SlaState::NotStarted,
        };
    };
    let elapsed = (decided_at.unwrap_or(now) - start).num_minutes().max(0);
    let state = match (elapsed > limit_minutes, decided_at.is_some()) {
        (true, _) => SlaState::Breached,
        (false, true) => SlaState::Met,
        (false, false) => SlaState::Running,
    };
    PreauthSla {
        limit_minutes,
        elapsed_minutes: Some(elapsed),
        state,
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
/// NHCX `Communication` profile — the provider's answer to a payer query
/// (NRCeS lists no bundle profile for it, so the resource is the payload).
pub const COMMUNICATION_PROFILE: &str =
    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Communication";
/// NHCX `TaskBundle` profile — status, search, cancel, reprocess and the
/// payment-notice exchange.
pub const TASK_BUNDLE_PROFILE: &str =
    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/TaskBundle";
/// HL7 financial task codes (`status`, `cancel`, `reprocess`, `poll`).
pub const FINANCIAL_TASK_CODE_SYSTEM: &str =
    "http://terminology.hl7.org/CodeSystem/financialtaskcode";
/// NRCeS task codes (`nullify`, `deliver`, `search`).
pub const NDHM_TASK_CODE_SYSTEM: &str = "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-task-codes";
/// NRCeS Task.input types (`claimNumber`, `fromDate`, `toDate`, …).
pub const NDHM_TASK_INPUT_TYPE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-task-input-type-code";
/// NRCeS Task.output types (`status`, `include`).
pub const NDHM_TASK_OUTPUT_TYPE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-task-output-type";
/// NRCeS Task.output values (`paymentack`).
pub const NDHM_TASK_OUTPUT_VALUE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-task-output-value";
/// NRCeS Task.reasonCode (`claimrejected`).
pub const NDHM_REASON_CODE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-reason-code";
/// NRCeS PaymentReconciliation.detail types (`approvedAmount`, `tds`).
pub const NDHM_PAYMENT_TYPE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-payment-type";
/// ICD-11 MMS code system (the WHO release URI).
pub const ICD11_SYSTEM: &str = "http://id.who.int/icd/release/11/mms";
/// HL7 example benefit categories — the services an eligibility check asks about.
pub const BENEFIT_CATEGORY_SYSTEM: &str =
    "http://terminology.hl7.org/CodeSystem/ex-benefitcategory";
/// The benefit categories a desk may ask about, `(code, display)`.
pub const BENEFIT_CATEGORIES: &[(&str, &str)] = &[
    ("1", "Medical Care"),
    ("2", "Surgical"),
    ("3", "Consultation"),
    ("4", "Diagnostic XRay"),
    ("5", "Diagnostic Lab"),
    ("30", "Health Benefit Plan Coverage"),
    ("49", "Hospital Room and Board"),
    ("69", "Maternity"),
    ("76", "Renal Dialysis"),
];
/// HL7 diagnosis types for `Claim.diagnosis.type`.
pub const DIAGNOSIS_TYPE_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/ex-diagnosistype";
/// HL7 claim information categories for `Claim.supportingInfo.category`.
pub const CLAIM_INFO_CATEGORY_SYSTEM: &str =
    "http://terminology.hl7.org/CodeSystem/claiminformationcategory";
/// NRCeS supporting-information categories (`HDS` discharge summary, `MB`
/// medical bill, `INV` investigation, `ATT` attachment) — IG 6.5.0.
pub const NDHM_SUPPORTING_INFO_CATEGORY_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-supportinginfo-category";
/// NRCeS supporting-information codes (`DCR` discharge summary report, `FB`
/// final bill, `LIR` lab investigation report) — IG 6.5.0.
pub const NDHM_SUPPORTING_INFO_CODE_SYSTEM: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-supportinginfo-code";
/// HL7 v3 Confidentiality code system (for the bundle `meta.security` tag).
pub const CONFIDENTIALITY_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
/// SNOMED institutional-claim code used for `Claim.type` (per the NHCX sample).
pub const SNOMED_INSTITUTIONAL_CLAIM_CODE: &str = "737481003";
/// SNOMED code for the careTeam role "Healthcare professional (occupation)".
pub const SNOMED_HEALTHCARE_PROFESSIONAL_CODE: &str = "223366009";

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    #[test]
    fn the_cashless_clock_breaches_after_an_hour_and_the_discharge_clock_after_three() {
        let now = Utc::now();
        let sent = Some(now - Duration::minutes(61));
        assert_eq!(
            preauth_sla(false, sent, None, now).state,
            SlaState::Breached
        );
        assert_eq!(preauth_sla(true, sent, None, now).state, SlaState::Running);
        let decided = Some(now - Duration::minutes(5));
        assert_eq!(preauth_sla(false, sent, decided, now).state, SlaState::Met);
        assert_eq!(
            preauth_sla(false, sent, decided, now).elapsed_minutes,
            Some(56)
        );
        assert_eq!(
            preauth_sla(false, None, None, now).state,
            SlaState::NotStarted
        );
    }
}
