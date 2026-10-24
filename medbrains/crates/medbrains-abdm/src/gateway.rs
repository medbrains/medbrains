//! ABDM HIE-CM gateway (v3) — the calls a Health Information Provider (M2)
//! and a Health Information User (M3) make.
//!
//! Every call is asynchronous at ABDM: the gateway answers `202 Accepted`
//! and delivers the result later to one of our callback routes, matched by
//! the `REQUEST-ID` we sent (echoed back as `response.requestId`). So each
//! method here returns the request id it used, for the caller to record.
//!
//! Every path is one constant. Paths marked *inferred* could not be checked
//! against an official document and are the first thing to confirm in the
//! sandbox.

use std::time::Duration;

use chrono::{SecondsFormat, Utc};
use serde_json::Value;
use uuid::Uuid;

use crate::abha::{AbdmEnvironment, AbdmError, abdm_message};

pub const ABDM_SANDBOX_GATEWAY_BASE_URL: &str = "https://dev.abdm.gov.in";
pub const ABDM_PRODUCTION_GATEWAY_BASE_URL: &str = "https://apis.abdm.gov.in";

/// Secret-store key pointing gateway calls at a stand-in. Never set in production.
pub const ABDM_GATEWAY_BASE_URL_OVERRIDE: &str = "ABDM_GATEWAY_BASE_URL_OVERRIDE";

// ── Outbound (HIP → gateway) ─────────────────────────────────────────
/// HIP-initiated linking: ask for a link token for one ABHA.
pub const GENERATE_LINK_TOKEN_PATH: &str = "/api/hiecm/v3/token/generate-token";
/// HIP-initiated linking: link care contexts (carries `X-LINK-TOKEN`).
pub const LINK_CARE_CONTEXT_PATH: &str = "/api/hiecm/hip/v3/link/carecontext";
/// User-initiated linking: our answer to a discovery.
pub const ON_DISCOVER_PATH: &str =
    "/api/hiecm/user-initiated-linking/v3/patient/care-context/on-discover";
/// User-initiated linking: our answer to link init (OTP sent).
pub const ON_LINK_INIT_PATH: &str =
    "/api/hiecm/user-initiated-linking/v3/link/care-context/on-init";
/// User-initiated linking: our answer to link confirm (linked contexts).
pub const ON_LINK_CONFIRM_PATH: &str =
    "/api/hiecm/user-initiated-linking/v3/link/care-context/on-confirm";
/// HIP-initiated linking: tell the patient's app a linked context has data.
pub const LINK_CONTEXT_NOTIFY_PATH: &str = "/api/hiecm/hip/v3/link/context/notify";
/// The deep-link SMS: ABDM texts a patient with no ABHA here a link to the
/// ABHA app (M2 test case HIP_INIT_NOTIFY_HIECM).
pub const SMS_NOTIFY_PATH: &str = "/api/hiecm/hip/v3/link/patient/links/sms/notify2";
/// Consent: acknowledge a consent notification.
pub const CONSENT_ON_NOTIFY_PATH: &str = "/api/hiecm/consent/v3/request/hip/on-notify";
/// Data flow: acknowledge a health-information request.
pub const HI_ON_REQUEST_PATH: &str = "/api/hiecm/data-flow/v3/health-information/hip/on-request";
/// Data flow: report the outcome of a transfer.
pub const HI_NOTIFY_PATH: &str = "/api/hiecm/data-flow/v3/health-information/notify";
/// The gateway's signing keys (JWKS) for its callback JWTs.
///
/// RS256 and RS512 keys (`dev.abdm.gov.in/api/hiecm/gateway/v3/certs`). The
/// v3 path answers 401 without a session (nha-in/docs, integration learnings 1.5).
pub const GATEWAY_CERTS_PATH: &str = "/api/hiecm/gateway/v3/certs";
/// Bridge registration: where the gateway delivers our callbacks
/// (`PATCH {url}`, gateway swagger `gateway_1_0d212e29a3.yaml`).
pub const BRIDGE_URL_PATH: &str = "/api/hiecm/gateway/v3/bridge/url";
/// The service (HFR facility) IDs registered against our bridge.
pub const BRIDGE_SERVICES_PATH: &str = "/api/hiecm/gateway/v3/bridge-services";

// ── Outbound (HIU → gateway) ─────────────────────────────────────────
// Checked against NHA's ABDM wrapper (`application-v3.properties`), which
// names them relative to the gateway's `/api/hiecm` base — the base every M2
// path above uses. Not yet seen in the sandbox.
/// Consent: ask the patient's consent manager for a consent.
pub const CONSENT_INIT_PATH: &str = "/api/hiecm/consent/v3/request/init";
/// Consent: acknowledge a consent notification (HIU side).
pub const CONSENT_HIU_ON_NOTIFY_PATH: &str = "/api/hiecm/consent/v3/request/hiu/on-notify";
/// Consent: ask where a consent request stands, answered at `on-status`
/// (the wrapper's `consentStatusPath`).
pub const CONSENT_STATUS_PATH: &str = "/api/hiecm/consent/v3/request/status";
/// Consent: fetch one granted consent artefact.
pub const CONSENT_FETCH_PATH: &str = "/api/hiecm/consent/v3/fetch";
/// Data flow: ask for the records a consent artefact covers.
pub const HIU_HI_REQUEST_PATH: &str = "/api/hiecm/data-flow/v3/health-information/request";

// ── Inbound (gateway → HIP), relative to the HIP's registered base URL ──
pub const CB_ON_GENERATE_TOKEN: &str = "/api/v3/hip/token/on-generate-token";
pub const CB_ON_LINK_CARE_CONTEXT: &str = "/api/v3/link/on_carecontext";
pub const CB_LINK_CONTEXT_ON_NOTIFY: &str = "/api/v3/links/context/on-notify";
/// The answer to [`SMS_NOTIFY_PATH`].
pub const CB_SMS_ON_NOTIFY: &str = "/api/v3/patients/sms/on-notify";
pub const CB_DISCOVER: &str = "/api/v3/hip/patient/care-context/discover";
pub const CB_LINK_INIT: &str = "/api/v3/hip/link/care-context/init";
pub const CB_LINK_CONFIRM: &str = "/api/v3/hip/link/care-context/confirm";
pub const CB_CONSENT_NOTIFY: &str = "/api/v3/consent/request/hip/notify";
pub const CB_HI_REQUEST: &str = "/api/v3/hip/health-information/request";

// ── Inbound (gateway → HIU) — the wrapper's `GatewayURL` (v3) ──────────
pub const CB_HIU_CONSENT_ON_INIT: &str = "/api/v3/hiu/consent/request/on-init";
pub const CB_HIU_CONSENT_ON_STATUS: &str = "/api/v3/hiu/consent/request/on-status";
pub const CB_HIU_CONSENT_NOTIFY: &str = "/api/v3/hiu/consent/request/notify";
pub const CB_HIU_CONSENT_ON_FETCH: &str = "/api/v3/hiu/consent/on-fetch";
pub const CB_HIU_HI_ON_REQUEST: &str = "/api/v3/hiu/health-information/on-request";
/// Where HIPs push encrypted records: our own path, sent as `dataPushUrl`
/// (ABDM takes any URL the HIU names), so not an ABDM constant at all.
pub const HIU_DATA_PUSH_PATH: &str = "/api/v3/hiu/data/push";

const HTTP_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Debug)]
pub struct AbdmGatewayClient {
    http: reqwest::Client,
    base_url: String,
    cm_id: &'static str,
}

impl AbdmGatewayClient {
    /// # Errors
    /// When the HTTP client cannot be built.
    pub fn new(
        environment: AbdmEnvironment,
        base_override: Option<&str>,
    ) -> Result<Self, AbdmError> {
        let http = reqwest::Client::builder().timeout(HTTP_TIMEOUT).build()?;
        let base_url = match base_override.map(str::trim) {
            Some(base) if !base.is_empty() => base.trim_end_matches('/').to_owned(),
            _ => match environment {
                AbdmEnvironment::Sandbox => ABDM_SANDBOX_GATEWAY_BASE_URL.to_owned(),
                AbdmEnvironment::Production => ABDM_PRODUCTION_GATEWAY_BASE_URL.to_owned(),
            },
        };
        Ok(Self {
            http,
            base_url,
            cm_id: environment.cm_id(),
        })
    }

    #[must_use]
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// POST a v3 gateway call as `hip_id`. Returns the `REQUEST-ID` sent.
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway is unreachable or refuses the call.
    pub async fn send(
        &self,
        path: &str,
        session: &str,
        hip_id: &str,
        link_token: Option<&str>,
        body: &Value,
    ) -> Result<Uuid, AbdmError> {
        let request_id = Uuid::new_v4();
        self.post(
            path,
            session,
            ("X-HIP-ID", hip_id, request_id),
            link_token,
            body,
        )
        .await?;
        Ok(request_id)
    }

    /// As [`Self::send`], with a `REQUEST-ID` the caller chose and recorded
    /// first — the gateway may answer before this call returns.
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway is unreachable or refuses the call.
    pub async fn send_with_id(
        &self,
        path: &str,
        session: &str,
        (hip_id, request_id): (&str, Uuid),
        body: &Value,
    ) -> Result<(), AbdmError> {
        self.post(path, session, ("X-HIP-ID", hip_id, request_id), None, body)
            .await
    }

    /// POST a v3 gateway call as HIU `hiu_id` (`X-HIU-ID`). Returns the
    /// `REQUEST-ID` sent.
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway is unreachable or refuses the call.
    pub async fn send_as_hiu(
        &self,
        path: &str,
        session: &str,
        hiu_id: &str,
        body: &Value,
    ) -> Result<Uuid, AbdmError> {
        let request_id = Uuid::new_v4();
        self.send_as_hiu_with_id(path, session, (hiu_id, request_id), body)
            .await?;
        Ok(request_id)
    }

    /// As [`Self::send_as_hiu`], with a `REQUEST-ID` the caller chose and
    /// recorded first — the gateway may answer before this call returns.
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway is unreachable or refuses the call.
    pub async fn send_as_hiu_with_id(
        &self,
        path: &str,
        session: &str,
        (hiu_id, request_id): (&str, Uuid),
        body: &Value,
    ) -> Result<(), AbdmError> {
        self.post(path, session, ("X-HIU-ID", hiu_id, request_id), None, body)
            .await
    }

    async fn post(
        &self,
        path: &str,
        session: &str,
        (id_header, id, request_id): (&str, &str, Uuid),
        link_token: Option<&str>,
        body: &Value,
    ) -> Result<(), AbdmError> {
        let mut builder = self
            .http
            .post(format!("{}{path}", self.base_url))
            .bearer_auth(session)
            .header("REQUEST-ID", request_id.to_string())
            .header(
                "TIMESTAMP",
                Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            )
            .header("X-CM-ID", self.cm_id)
            .header(id_header, id)
            .json(body);
        if let Some(token) = link_token {
            builder = builder.header("X-LINK-TOKEN", token);
        }
        expect_success(builder).await
    }

    /// The gateway's signing keys (a JWKS document), fetched with a session
    /// and the usual headers.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn certs(&self, session: &str) -> Result<Value, AbdmError> {
        self.call(reqwest::Method::GET, GATEWAY_CERTS_PATH, Some(session), None)
            .await
    }

    /// Point the gateway at our callback base URL (`<cb>`).
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway refuses or is unreachable.
    pub async fn update_bridge_url(&self, session: &str, url: &str) -> Result<(), AbdmError> {
        let body = serde_json::json!({ "url": url });
        self.call(reqwest::Method::PATCH, BRIDGE_URL_PATH, Some(session), Some(&body))
            .await
            .map(|_| ())
    }

    /// Our bridge as the gateway holds it: `{bridge{id,url,active,…}, services[…]}`.
    ///
    /// # Errors
    /// [`AbdmError`] when the gateway refuses or is unreachable.
    pub async fn bridge_services(&self, session: &str) -> Result<Value, AbdmError> {
        self.call(reqwest::Method::GET, BRIDGE_SERVICES_PATH, Some(session), None)
            .await
    }

    /// A gateway call without `X-HIP-ID`/`X-HIU-ID`. An empty answer (202,
    /// 204) is `Null`.
    async fn call(
        &self,
        method: reqwest::Method,
        path: &str,
        session: Option<&str>,
        body: Option<&Value>,
    ) -> Result<Value, AbdmError> {
        let mut builder = self
            .http
            .request(method, format!("{}{path}", self.base_url))
            .header("REQUEST-ID", Uuid::new_v4().to_string())
            .header(
                "TIMESTAMP",
                Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            )
            .header("X-CM-ID", self.cm_id);
        if let Some(token) = session {
            builder = builder.bearer_auth(token);
        }
        if let Some(body) = body {
            builder = builder.json(body);
        }
        let response = builder.send().await?;
        let status = response.status();
        let text = response.text().await?;
        if !status.is_success() {
            return Err(AbdmError::Status {
                status,
                message: abdm_message(&text),
            });
        }
        Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
    }

    /// POST the encrypted bundles to the HIU's `dataPushUrl`. The URL comes
    /// from the consent manager's request, never from the patient or staff.
    ///
    /// # Errors
    /// [`AbdmError`] when the HIU is unreachable or refuses the push.
    pub async fn push_data(&self, data_push_url: &str, body: &Value) -> Result<(), AbdmError> {
        expect_success(self.http.post(data_push_url).json(body)).await
    }
}

async fn expect_success(builder: reqwest::RequestBuilder) -> Result<(), AbdmError> {
    let response = builder.send().await?;
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let body = response.text().await.unwrap_or_default();
    Err(AbdmError::Status {
        status,
        message: abdm_message(&body),
    })
}

#[cfg(test)]
mod tests {
    use super::{AbdmGatewayClient, GENERATE_LINK_TOKEN_PATH};
    use crate::abha::AbdmEnvironment;

    #[test]
    fn an_override_replaces_the_gateway_host() -> Result<(), crate::abha::AbdmError> {
        let c = AbdmGatewayClient::new(AbdmEnvironment::Sandbox, Some("http://127.0.0.1:9/"))?;
        assert_eq!(c.base_url(), "http://127.0.0.1:9");
        let c = AbdmGatewayClient::new(AbdmEnvironment::Production, None)?;
        assert_eq!(c.base_url(), "https://apis.abdm.gov.in");
        assert!(GENERATE_LINK_TOKEN_PATH.starts_with("/api/hiecm/"));
        Ok(())
    }
}
