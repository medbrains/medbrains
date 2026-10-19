//! ABDM HIE-CM gateway (v3) — the calls a Health Information Provider makes.
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
/// Consent: acknowledge a consent notification.
pub const CONSENT_ON_NOTIFY_PATH: &str = "/api/hiecm/consent/v3/request/hip/on-notify";
/// Data flow: acknowledge a health-information request.
pub const HI_ON_REQUEST_PATH: &str = "/api/hiecm/data-flow/v3/health-information/hip/on-request";
/// Data flow: report the outcome of a transfer.
pub const HI_NOTIFY_PATH: &str = "/api/hiecm/data-flow/v3/health-information/notify";
/// The gateway's public keys (JWKS) its callback JWTs are signed with.
pub const GATEWAY_CERTS_PATH: &str = "/api/hiecm/gateway/v3/certs";

// ── Inbound (gateway → HIP), relative to the HIP's registered base URL ──
pub const CB_ON_GENERATE_TOKEN: &str = "/api/v3/hip/token/on-generate-token";
pub const CB_ON_LINK_CARE_CONTEXT: &str = "/api/v3/link/on_carecontext";
pub const CB_DISCOVER: &str = "/api/v3/hip/patient/care-context/discover";
pub const CB_LINK_INIT: &str = "/api/v3/hip/link/care-context/init";
pub const CB_LINK_CONFIRM: &str = "/api/v3/hip/link/care-context/confirm";
pub const CB_CONSENT_NOTIFY: &str = "/api/v3/consent/request/hip/notify";
pub const CB_HI_REQUEST: &str = "/api/v3/hip/health-information/request";

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
            .header("X-HIP-ID", hip_id)
            .json(body);
        if let Some(token) = link_token {
            builder = builder.header("X-LINK-TOKEN", token);
        }
        expect_success(builder).await?;
        Ok(request_id)
    }

    /// The gateway's signing keys (a JWKS document). ABDM's docs ask for the
    /// session and the usual headers even here.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn certs(&self, session: &str) -> Result<Value, AbdmError> {
        let response = self
            .http
            .get(format!("{}{GATEWAY_CERTS_PATH}", self.base_url))
            .bearer_auth(session)
            .header("REQUEST-ID", Uuid::new_v4().to_string())
            .header(
                "TIMESTAMP",
                Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            )
            .header("X-CM-ID", self.cm_id)
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AbdmError::Status {
                status,
                message: abdm_message(&body),
            });
        }
        Ok(response.json().await?)
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
