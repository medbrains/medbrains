//! Request and response bodies of the ABHA V3 APIs, as the SOP names them.

use serde::{Deserialize, Serialize};

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
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCertificateResponse {
    pub public_key: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LoginHint {
    AbhaNumber,
    Mobile,
    AbhaAddress,
    Email,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OtpSystem {
    Aadhaar,
    Abdm,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOtpRequest {
    pub scope: Vec<String>,
    pub login_hint: LoginHint,
    /// Encrypted ABHA number or mobile.
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
    pub auth_methods: Vec<String>,
    pub otp: VerifyOtpPayload,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpPayload {
    pub txn_id: String,
    /// Encrypted OTP.
    pub otp_value: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpResponse {
    pub txn_id: Option<String>,
    pub auth_result: Option<String>,
    pub message: Option<String>,
    /// An X-token after an ABHA-number login; a T-token after a mobile login.
    pub token: Option<String>,
    #[serde(default)]
    pub accounts: Vec<AbhaAccountSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AbhaAccountSummary {
    #[serde(rename = "ABHANumber")]
    pub abha_number: String,
    #[serde(rename = "preferredAbhaAddress")]
    pub preferred_abha_address: Option<String>,
    pub name: Option<String>,
    pub gender: Option<String>,
    pub dob: Option<String>,
    pub status: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct VerifyUserRequest {
    /// Encrypted ABHA number of the chosen account.
    #[serde(rename = "ABHANumber")]
    pub abha_number: String,
    #[serde(rename = "txnId")]
    pub txn_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct VerifyUserResponse {
    pub token: String,
}

/// SOP §8. Every field is optional: ABDM leaves out what it does not hold.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbhaProfile {
    #[serde(rename = "ABHANumber")]
    pub abha_number: Option<String>,
    pub preferred_abha_address: Option<String>,
    pub name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub year_of_birth: Option<String>,
    pub month_of_birth: Option<String>,
    pub day_of_birth: Option<String>,
    pub gender: Option<String>,
    /// Masked by ABDM (`******7930`).
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub pincode: Option<String>,
    pub state_name: Option<String>,
    pub district_name: Option<String>,
    pub kyc_verified: Option<bool>,
    pub verification_type: Option<String>,
    pub status: Option<String>,
    /// Base64 JPEG. Shown to staff to confirm the person; never stored.
    pub profile_photo: Option<String>,
}
