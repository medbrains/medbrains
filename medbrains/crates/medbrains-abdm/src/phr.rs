//! Verifying a person by ABHA address — `name@abdm` (ABHA V3 SOP §12).
//!
//! Same OTP shape as the ABHA-number login, but on the PHR APIs, which answer
//! with their own token and profile shape.

use serde::Deserialize;

use crate::abha::{AbdmAbhaClient, AbdmError, UserToken, send_json};
use crate::types::{RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest};

pub const PHR_REQUEST_OTP_PATH: &str = "/login/abha/request/otp";
pub const PHR_VERIFY_PATH: &str = "/login/abha/verify";
pub const PHR_PROFILE_PATH: &str = "/login/profile/abha-profile";
pub const ABHA_ADDRESS_LOGIN_SCOPE: &str = "abha-address-login";

#[derive(Clone, Debug, Deserialize)]
pub struct PhrVerifyResponse {
    pub tokens: Option<PhrTokens>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct PhrTokens {
    pub token: String,
}

/// SOP §12.3.1 — note the PHR spelling (`abhaNumber`, `pinCode`, `kycStatus`).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhrProfile {
    pub abha_address: Option<String>,
    pub abha_number: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub day_of_birth: Option<String>,
    pub month_of_birth: Option<String>,
    pub year_of_birth: Option<String>,
    pub gender: Option<String>,
    pub email: Option<String>,
    pub mobile: Option<String>,
    pub address: Option<String>,
    pub state_name: Option<String>,
    pub pin_code: Option<String>,
    pub kyc_status: Option<String>,
    pub status: Option<String>,
    pub profile_photo: Option<String>,
}

impl AbdmAbhaClient {
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn phr_request_otp(
        &self,
        session: &str,
        request: &RequestOtpRequest,
    ) -> Result<RequestOtpResponse, AbdmError> {
        send_json(
            self.phr_post(PHR_REQUEST_OTP_PATH, session, None)
                .json(request),
        )
        .await
    }

    /// # Errors
    /// [`AbdmError`] as for every call; a wrong OTP is a `Status`.
    pub async fn phr_verify(
        &self,
        session: &str,
        request: &VerifyOtpRequest,
    ) -> Result<PhrVerifyResponse, AbdmError> {
        send_json(self.phr_post(PHR_VERIFY_PATH, session, None).json(request)).await
    }

    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn phr_profile(&self, session: &str, x_token: &str) -> Result<PhrProfile, AbdmError> {
        send_json(self.phr_get(PHR_PROFILE_PATH, session, Some(UserToken::X(x_token)))).await
    }
}

#[cfg(test)]
mod tests {
    use super::PhrProfile;

    #[test]
    fn the_sop_phr_profile_parses() -> Result<(), serde_json::Error> {
        let p: PhrProfile = serde_json::from_str(
            r#"{"abhaAddress":"hemanttest@abdm","fullName":"Hemant Prakash Bodhai","firstName":"Hemant",
                "dayOfBirth":"24","monthOfBirth":"11","yearOfBirth":"1998","gender":"M",
                "abhaNumber":"91-3837-7464-1234","pinCode":"422003","kycStatus":"VERIFIED"}"#,
        )?;
        assert_eq!(p.abha_number.as_deref(), Some("91-3837-7464-1234"));
        assert_eq!(p.kyc_status.as_deref(), Some("VERIFIED"));
        Ok(())
    }
}
