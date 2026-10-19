//! ABHA V3 client (ABDM "ABHA V3 APIs SOP" v1.2).
//!
//! Every call carries `REQUEST-ID`, `TIMESTAMP` and the gateway session token;
//! calls made on a person's behalf also carry their `X-token` (or, choosing
//! between several accounts after a mobile login, a `T-token`). Sensitive
//! fields — ABHA number, mobile, OTP — are RSA-OAEP encrypted by the caller
//! before they reach this client.

use std::time::Duration;

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::types::{
    AbhaAccountSummary, AbhaProfile, LoginHint, OtpSystem, PublicCertificateResponse,
    RequestOtpRequest, RequestOtpResponse, SessionTokenRequest, SessionTokenResponse,
    VerifyOtpAuthData, VerifyOtpPayload, VerifyOtpRequest, VerifyOtpResponse, VerifyUserRequest,
    VerifyUserResponse,
};

pub const ABDM_SANDBOX_ABHA_BASE_URL: &str = "https://abhasbx.abdm.gov.in/abha/api";
pub const ABDM_PRODUCTION_ABHA_BASE_URL: &str = "https://abha.abdm.gov.in/api/abha";
pub const ABDM_SANDBOX_SESSION_URL: &str = "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions";
pub const ABDM_PRODUCTION_SESSION_URL: &str =
    "https://apis.abdm.gov.in/api/hiecm/gateway/v3/sessions";
pub const ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH: &str = "/v3/profile/public/certificate";
pub const ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH: &str = "/v3/profile/login/request/otp";
pub const ABDM_PROFILE_LOGIN_VERIFY_PATH: &str = "/v3/profile/login/verify";
pub const ABDM_PROFILE_LOGIN_VERIFY_USER_PATH: &str = "/v3/profile/login/verify/user";
pub const ABDM_PROFILE_ACCOUNT_PATH: &str = "/v3/profile/account";

pub const ABHA_LOGIN_SCOPE: &str = "abha-login";
pub const AADHAAR_VERIFY_SCOPE: &str = "aadhaar-verify";
pub const MOBILE_VERIFY_SCOPE: &str = "mobile-verify";

/// ABDM answers slowly at times; a desk must not wait on it for ever.
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AbdmEnvironment {
    Sandbox,
    Production,
}

impl AbdmEnvironment {
    const fn abha_base_url(self) -> &'static str {
        match self {
            Self::Sandbox => ABDM_SANDBOX_ABHA_BASE_URL,
            Self::Production => ABDM_PRODUCTION_ABHA_BASE_URL,
        }
    }

    const fn session_url(self) -> &'static str {
        match self {
            Self::Sandbox => ABDM_SANDBOX_SESSION_URL,
            Self::Production => ABDM_PRODUCTION_SESSION_URL,
        }
    }

    /// The gateway's consent-manager id; the v3 gateway reads it on sessions.
    const fn phr_base_url(self) -> &'static str {
        match self {
            Self::Sandbox => "https://abhasbx.abdm.gov.in/abha/api/v3/phr/web",
            Self::Production => "https://phr.abdm.gov.in/api/phr/web/v3",
        }
    }

    const fn cm_id(self) -> &'static str {
        match self {
            Self::Sandbox => "sbx",
            Self::Production => "abdm",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AbhaIntegrationReadiness {
    pub environment: AbdmEnvironment,
    pub abha_base_url: String,
    pub session_url: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AbdmError {
    #[error("ABDM HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    /// ABDM refused the call. `message` is ABDM's own explanation when it
    /// sent one (wrong OTP, expired transaction), safe to show to staff.
    #[error("ABDM returned status {status}: {message}")]
    Status {
        status: reqwest::StatusCode,
        message: String,
    },
}

/// The person-level token a call is made with, when there is one.
#[derive(Clone, Copy, Debug)]
pub enum UserToken<'a> {
    /// Full access to the person's ABHA profile.
    X(&'a str),
    /// Short-lived: only good for choosing among accounts after a mobile login.
    T(&'a str),
}

#[derive(Clone, Debug)]
pub struct AbdmAbhaClient {
    http: reqwest::Client,
    environment: AbdmEnvironment,
    abha_base_url: String,
    session_url: String,
    /// ABHA-address (PHR) APIs: under the ABHA host in the sandbox, their own
    /// host in production (SOP §12).
    phr_base_url: String,
}

/// Secret-store key pointing every ABDM call at another server — a local mock
/// in tests and staging rehearsals. Never set in production.
pub const ABDM_BASE_URL_OVERRIDE: &str = "ABDM_BASE_URL_OVERRIDE";

impl AbdmAbhaClient {
    /// # Errors
    /// When the HTTP client cannot be built (TLS backend unavailable).
    pub fn new(
        environment: AbdmEnvironment,
        base_url_override: Option<&str>,
    ) -> Result<Self, AbdmError> {
        let http = reqwest::Client::builder().timeout(HTTP_TIMEOUT).build()?;
        let (abha_base_url, session_url, phr_base_url) = match base_url_override.map(str::trim) {
            Some(base) if !base.is_empty() => {
                let base = base.trim_end_matches('/').to_owned();
                (
                    base.clone(),
                    format!("{base}/sessions"),
                    format!("{base}/v3/phr/web"),
                )
            }
            _ => (
                environment.abha_base_url().to_owned(),
                environment.session_url().to_owned(),
                environment.phr_base_url().to_owned(),
            ),
        };
        Ok(Self {
            http,
            environment,
            abha_base_url,
            session_url,
            phr_base_url,
        })
    }

    pub fn readiness(&self) -> AbhaIntegrationReadiness {
        AbhaIntegrationReadiness {
            environment: self.environment,
            abha_base_url: self.abha_base_url.clone(),
            session_url: self.session_url.clone(),
        }
    }

    /// # Errors
    /// [`AbdmError`] when ABDM is unreachable or refuses the credentials.
    pub async fn create_session(
        &self,
        request: &SessionTokenRequest,
    ) -> Result<SessionTokenResponse, AbdmError> {
        let builder = self
            .http
            .post(&self.session_url)
            .header("REQUEST-ID", Uuid::new_v4().to_string())
            .header("TIMESTAMP", timestamp(Utc::now()))
            .header("X-CM-ID", self.environment.cm_id())
            .json(request);
        send_json(builder).await
    }

    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn public_certificate(
        &self,
        session_token: &str,
    ) -> Result<PublicCertificateResponse, AbdmError> {
        send_json(self.get(ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH, session_token, None)).await
    }

    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn request_login_otp(
        &self,
        session_token: &str,
        request: &RequestOtpRequest,
    ) -> Result<RequestOtpResponse, AbdmError> {
        let builder = self.post(ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH, session_token, None);
        send_json(builder.json(request)).await
    }

    /// # Errors
    /// [`AbdmError`] as for every call; a wrong or expired OTP is a `Status`.
    pub async fn verify_login_otp(
        &self,
        session_token: &str,
        request: &VerifyOtpRequest,
    ) -> Result<VerifyOtpResponse, AbdmError> {
        let builder = self.post(ABDM_PROFILE_LOGIN_VERIFY_PATH, session_token, None);
        send_json(builder.json(request)).await
    }

    /// After a mobile login, pick the account to continue with (SOP §6.3 step 3).
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn verify_user(
        &self,
        session_token: &str,
        t_token: &str,
        request: &VerifyUserRequest,
    ) -> Result<VerifyUserResponse, AbdmError> {
        let builder = self.post(
            ABDM_PROFILE_LOGIN_VERIFY_USER_PATH,
            session_token,
            Some(UserToken::T(t_token)),
        );
        send_json(builder.json(request)).await
    }

    /// The person's ABHA profile (SOP §8).
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn profile(
        &self,
        session_token: &str,
        x_token: &str,
    ) -> Result<AbhaProfile, AbdmError> {
        let builder = self.get(
            ABDM_PROFILE_ACCOUNT_PATH,
            session_token,
            Some(UserToken::X(x_token)),
        );
        send_json(builder).await
    }

    fn url(&self, path: &str) -> String {
        format!("{}/{}", self.abha_base_url, path.trim_start_matches('/'))
    }

    pub(crate) fn get(
        &self,
        path: &str,
        session: &str,
        user: Option<UserToken<'_>>,
    ) -> reqwest::RequestBuilder {
        with_headers(self.http.get(self.url(path)), session, user)
    }

    pub(crate) fn post(
        &self,
        path: &str,
        session: &str,
        user: Option<UserToken<'_>>,
    ) -> reqwest::RequestBuilder {
        with_headers(self.http.post(self.url(path)), session, user)
    }

    pub(crate) fn phr_get(
        &self,
        path: &str,
        session: &str,
        user: Option<UserToken<'_>>,
    ) -> reqwest::RequestBuilder {
        let url = format!("{}/{}", self.phr_base_url, path.trim_start_matches('/'));
        with_headers(self.http.get(url), session, user)
    }

    pub(crate) fn phr_post(
        &self,
        path: &str,
        session: &str,
        user: Option<UserToken<'_>>,
    ) -> reqwest::RequestBuilder {
        let url = format!("{}/{}", self.phr_base_url, path.trim_start_matches('/'));
        with_headers(self.http.post(url), session, user)
    }
}

/// ISO 8601 with milliseconds, as the SOP's `TIMESTAMP` header asks.
fn timestamp(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn with_headers(
    builder: reqwest::RequestBuilder,
    session: &str,
    user: Option<UserToken<'_>>,
) -> reqwest::RequestBuilder {
    let builder = builder
        .bearer_auth(session)
        .header("REQUEST-ID", Uuid::new_v4().to_string())
        .header("TIMESTAMP", timestamp(Utc::now()));
    match user {
        Some(UserToken::X(token)) => builder.header("X-token", format!("Bearer {token}")),
        Some(UserToken::T(token)) => builder.header("T-token", format!("Bearer {token}")),
        None => builder,
    }
}

pub(crate) async fn send_json<T>(builder: reqwest::RequestBuilder) -> Result<T, AbdmError>
where
    T: for<'de> Deserialize<'de>,
{
    let response = builder.send().await?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AbdmError::Status {
            status,
            message: abdm_message(&body),
        });
    }
    Ok(response.json::<T>().await?)
}

/// ABDM's human message out of an error body, never the raw body: it can echo
/// back what was sent.
pub(crate) fn abdm_message(body: &str) -> String {
    let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
    let pick = |v: &serde_json::Value| {
        ["message", "errorMessage", "error"]
            .iter()
            .find_map(|k| match &v[*k] {
                serde_json::Value::String(s) => Some(s.clone()),
                serde_json::Value::Object(o) => o
                    .get("message")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_owned),
                _ => None,
            })
    };
    parsed
        .as_ref()
        .and_then(pick)
        .unwrap_or_else(|| "ABDM could not complete the request".to_owned())
}

#[cfg(test)]
mod tests {
    use super::{AbhaProfile, VerifyOtpResponse, abdm_message, timestamp};
    use chrono::{TimeZone, Utc};

    #[test]
    fn the_timestamp_header_carries_milliseconds_in_utc() {
        let at = Utc
            .with_ymd_and_hms(2026, 10, 19, 5, 6, 7)
            .single()
            .unwrap_or_default();
        assert_eq!(timestamp(at), "2026-10-19T05:06:07.000Z");
    }

    /// An ABHA-number login answers with no `accounts` at all; that must
    /// parse, not fail the whole verification.
    #[test]
    fn a_verify_response_without_accounts_parses() -> Result<(), serde_json::Error> {
        let parsed: VerifyOtpResponse = serde_json::from_str(
            r#"{"txnId":"t","authResult":"success","message":"OTP verified successfully","token":"x"}"#,
        )?;
        assert!(parsed.accounts.is_empty());
        assert_eq!(parsed.token.as_deref(), Some("x"));
        Ok(())
    }

    #[test]
    fn the_sop_profile_shape_parses() -> Result<(), serde_json::Error> {
        let parsed: AbhaProfile = serde_json::from_str(
            r#"{"ABHANumber":"91-4173-3253-1234","preferredAbhaAddress":"gk@sbx","firstName":"Gaurav",
                "dayOfBirth":"9","monthOfBirth":"10","yearOfBirth":"1991","gender":"M",
                "mobile":"******7930","kycVerified":true,"pincode":"821307","stateName":"BIHAR"}"#,
        )?;
        assert_eq!(parsed.abha_number.as_deref(), Some("91-4173-3253-1234"));
        assert_eq!(parsed.kyc_verified, Some(true));
        Ok(())
    }

    /// Staff see ABDM's reason, never the raw body.
    #[test]
    fn an_abdm_error_body_becomes_its_message() {
        assert_eq!(abdm_message(r#"{"message":"Invalid OTP"}"#), "Invalid OTP");
        assert_eq!(
            abdm_message(r#"{"error":{"message":"Txn expired"}}"#),
            "Txn expired"
        );
        assert_eq!(
            abdm_message("<html>"),
            "ABDM could not complete the request"
        );
    }
}
