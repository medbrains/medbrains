use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const ABDM_SANDBOX_ABHA_BASE_URL: &str = "https://abhasbx.abdm.gov.in/abha/api";
pub const ABDM_PRODUCTION_ABHA_BASE_URL: &str = "https://abha.abdm.gov.in/api/abha";
pub const ABDM_SANDBOX_SESSION_URL: &str = "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions";
pub const ABDM_PRODUCTION_SESSION_URL: &str =
    "https://apis.abdm.gov.in/api/hiecm/gateway/v3/sessions";
pub const ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH: &str = "/v3/profile/public/certificate";
pub const ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH: &str = "/v3/profile/login/request/otp";
pub const ABDM_PROFILE_LOGIN_VERIFY_PATH: &str = "/v3/profile/login/verify";

pub const ABHA_LOGIN_SCOPE: &str = "abha-login";
pub const ABHA_PROFILE_SCOPE: &str = "abha-profile";
pub const AADHAAR_VERIFY_SCOPE: &str = "aadhaar-verify";
pub const MOBILE_VERIFY_SCOPE: &str = "mobile-verify";

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AbdmEnvironment {
    Sandbox,
    Production,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AbdmAbhaConfig {
    pub environment: AbdmEnvironment,
    pub abha_base_url: String,
    pub session_url: String,
}

impl AbdmAbhaConfig {
    pub fn sandbox() -> Self {
        Self {
            environment: AbdmEnvironment::Sandbox,
            abha_base_url: ABDM_SANDBOX_ABHA_BASE_URL.to_owned(),
            session_url: ABDM_SANDBOX_SESSION_URL.to_owned(),
        }
    }

    pub fn production() -> Self {
        Self {
            environment: AbdmEnvironment::Production,
            abha_base_url: ABDM_PRODUCTION_ABHA_BASE_URL.to_owned(),
            session_url: ABDM_PRODUCTION_SESSION_URL.to_owned(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AbhaIntegrationReadiness {
    pub environment: AbdmEnvironment,
    pub abha_base_url: String,
    pub session_url: String,
    pub public_certificate_path: String,
    pub login_request_otp_path: String,
    pub login_verify_path: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AbdmRequestContext {
    pub request_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub access_token: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AbdmError {
    #[error("ABDM HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("ABDM returned status {status}: {body}")]
    Status {
        status: reqwest::StatusCode,
        body: String,
    },
}

#[derive(Clone, Debug)]
pub struct AbdmAbhaClient {
    http: reqwest::Client,
    config: AbdmAbhaConfig,
}

impl AbdmAbhaClient {
    pub const fn new(http: reqwest::Client, config: AbdmAbhaConfig) -> Self {
        Self { http, config }
    }

    pub fn readiness(&self) -> AbhaIntegrationReadiness {
        AbhaIntegrationReadiness {
            environment: self.config.environment.clone(),
            abha_base_url: self.config.abha_base_url.clone(),
            session_url: self.config.session_url.clone(),
            public_certificate_path: ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH.to_owned(),
            login_request_otp_path: ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH.to_owned(),
            login_verify_path: ABDM_PROFILE_LOGIN_VERIFY_PATH.to_owned(),
        }
    }

    pub async fn create_session(
        &self,
        request: &SessionTokenRequest,
    ) -> Result<SessionTokenResponse, AbdmError> {
        let request_builder = self.http.post(&self.config.session_url).json(request);
        send_json(request_builder).await
    }

    pub async fn public_certificate(
        &self,
        context: &AbdmRequestContext,
    ) -> Result<PublicCertificateResponse, AbdmError> {
        let request_builder = Self::with_context(
            self.http
                .get(self.endpoint(ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH)),
            context,
        );
        send_json(request_builder).await
    }

    pub async fn request_login_otp(
        &self,
        context: &AbdmRequestContext,
        request: &RequestOtpRequest,
    ) -> Result<RequestOtpResponse, AbdmError> {
        let request_builder = Self::with_context(
            self.http
                .post(self.endpoint(ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH)),
            context,
        )
        .json(request);
        send_json(request_builder).await
    }

    pub async fn verify_login_otp(
        &self,
        context: &AbdmRequestContext,
        request: &VerifyOtpRequest,
    ) -> Result<VerifyOtpResponse, AbdmError> {
        let request_builder = Self::with_context(
            self.http
                .post(self.endpoint(ABDM_PROFILE_LOGIN_VERIFY_PATH)),
            context,
        )
        .json(request);
        send_json(request_builder).await
    }

    fn endpoint(&self, path: &str) -> String {
        let base_url = self.config.abha_base_url.trim_end_matches('/');
        let path = path.trim_start_matches('/');
        format!("{base_url}/{path}")
    }

    fn with_context(
        request_builder: reqwest::RequestBuilder,
        context: &AbdmRequestContext,
    ) -> reqwest::RequestBuilder {
        request_builder
            .bearer_auth(&context.access_token)
            .header("REQUEST-ID", context.request_id.to_string())
            .header("TIMESTAMP", context.timestamp.to_rfc3339())
    }
}

async fn send_json<T>(request_builder: reqwest::RequestBuilder) -> Result<T, AbdmError>
where
    T: for<'de> Deserialize<'de>,
{
    let response = request_builder.send().await?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await?;
        return Err(AbdmError::Status { status, body });
    }
    let value = response.json::<T>().await?;
    Ok(value)
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTokenRequest {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTokenResponse {
    pub access_token: String,
    pub expires_in: u64,
    pub refresh_token: String,
    pub refresh_expires_in: u64,
    pub token_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCertificateResponse {
    pub public_key: String,
    pub encryption_algorithm: Option<String>,
    pub kid: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LoginHint {
    AbhaNumber,
    AbhaAddress,
    Mobile,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OtpSystem {
    Aadhaar,
    Abdm,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    Otp,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOtpRequest {
    pub scope: Vec<String>,
    pub login_hint: LoginHint,
    pub login_id: String,
    pub otp_system: OtpSystem,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOtpResponse {
    pub txn_id: String,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpRequest {
    pub scope: Vec<String>,
    pub auth_data: VerifyOtpAuthData,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpAuthData {
    pub auth_methods: Vec<AuthMethod>,
    pub otp: VerifyOtpPayload,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpPayload {
    pub txn_id: String,
    pub otp_value: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpResponse {
    pub txn_id: String,
    pub auth_result: Option<String>,
    pub message: Option<String>,
    pub token: Option<AuthToken>,
    pub accounts: Vec<AbhaAccountSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthToken {
    pub token: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub refresh_expires_in: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileTokenResponse {
    pub token: String,
    pub expires_in: u64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AbhaAccountSummary {
    #[serde(rename = "ABHANumber")]
    pub abha_number: Option<String>,
    #[serde(rename = "preferredAbhaAddress")]
    pub preferred_abha_address: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "profilePhoto")]
    pub profile_photo: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AbhaProfile {
    #[serde(rename = "ABHANumber")]
    pub abha_number: Option<String>,
    #[serde(rename = "preferredAbhaAddress")]
    pub preferred_abha_address: Option<String>,
    pub mobile: Option<String>,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "middleName")]
    pub middle_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "yearOfBirth")]
    pub year_of_birth: Option<String>,
    #[serde(rename = "dayOfBirth")]
    pub day_of_birth: Option<String>,
    #[serde(rename = "monthOfBirth")]
    pub month_of_birth: Option<String>,
    pub gender: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "profilePhoto")]
    pub profile_photo: Option<String>,
}
