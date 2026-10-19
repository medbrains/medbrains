//! ABHA creation by Aadhaar OTP (ABHA V3 SOP §3).
//!
//! request OTP (encrypted Aadhaar) → enrol with the OTP and the mobile the
//! person wants on their ABHA → if that mobile is not the Aadhaar-linked one,
//! verify it by a second OTP → pick an ABHA address. The Aadhaar number goes
//! to ABDM encrypted and is never kept here.

use serde::{Deserialize, Serialize};

use crate::abha::{AbdmAbhaClient, AbdmError, send_json};

pub const ENROL_REQUEST_OTP_PATH: &str = "/v3/enrollment/request/otp";
// sic: ABDM spells the path "byAadhar".
pub const ENROL_BY_AADHAAR_PATH: &str = "/v3/enrollment/enrol/byAadhar";
pub const ENROL_AUTH_BY_ABDM_PATH: &str = "/v3/enrollment/auth/byAbdm";
pub const ENROL_SUGGESTION_PATH: &str = "/v3/enrollment/enrol/suggestion";
pub const ENROL_ABHA_ADDRESS_PATH: &str = "/v3/enrollment/enrol/abha-address";

pub const ABHA_ENROL_SCOPE: &str = "abha-enrol";
pub const ENROL_CONSENT_CODE: &str = "abha-enrollment";
pub const ENROL_CONSENT_VERSION: &str = "1.4";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolOtpRequest {
    pub txn_id: String,
    pub scope: Vec<String>,
    /// `aadhaar` for the first OTP, `mobile` to verify a different mobile.
    pub login_hint: String,
    pub login_id: String,
    pub otp_system: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolByAadhaarRequest {
    pub auth_data: EnrolAuthData,
    pub consent: EnrolConsent,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolAuthData {
    pub auth_methods: Vec<String>,
    pub otp: EnrolOtp,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolOtp {
    pub txn_id: String,
    /// Encrypted OTP.
    pub otp_value: String,
    /// The mobile for the ABHA, in clear, as the SOP sends it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mobile: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct EnrolConsent {
    pub code: String,
    pub version: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolResponse {
    pub txn_id: Option<String>,
    pub message: Option<String>,
    pub tokens: Option<EnrolTokens>,
    #[serde(rename = "ABHAProfile")]
    pub abha_profile: EnrolProfile,
    /// False when the person already had an ABHA; ABDM returns that one.
    #[serde(default)]
    pub is_new: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolTokens {
    pub token: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolProfile {
    #[serde(rename = "ABHANumber")]
    pub abha_number: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    /// `DD-MM-YYYY`.
    pub dob: Option<String>,
    pub gender: Option<String>,
    /// Null when the mobile asked for is not the Aadhaar-linked one — it must
    /// then be verified by OTP before it is saved.
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub photo: Option<String>,
    #[serde(default)]
    pub phr_address: Vec<String>,
    pub address: Option<String>,
    pub district_name: Option<String>,
    pub state_name: Option<String>,
    pub pin_code: Option<String>,
    pub abha_status: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolMobileVerifyRequest {
    pub scope: Vec<String>,
    pub auth_data: EnrolAuthData,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolAuthResponse {
    pub txn_id: Option<String>,
    pub auth_result: Option<String>,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressSuggestions {
    #[serde(default)]
    pub abha_address_list: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAddressRequest {
    pub txn_id: String,
    pub abha_address: String,
    pub preferred: u8,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAddressResponse {
    pub health_id_number: Option<String>,
    pub preferred_abha_address: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolOtpResponse {
    pub txn_id: String,
    pub message: Option<String>,
}

impl AbdmAbhaClient {
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn enrol_request_otp(
        &self,
        session: &str,
        request: &EnrolOtpRequest,
    ) -> Result<EnrolOtpResponse, AbdmError> {
        send_json(
            self.post(ENROL_REQUEST_OTP_PATH, session, None)
                .json(request),
        )
        .await
    }

    /// # Errors
    /// [`AbdmError`] as for every call; a wrong OTP is a `Status`.
    pub async fn enrol_by_aadhaar(
        &self,
        session: &str,
        request: &EnrolByAadhaarRequest,
    ) -> Result<EnrolResponse, AbdmError> {
        send_json(
            self.post(ENROL_BY_AADHAAR_PATH, session, None)
                .json(request),
        )
        .await
    }

    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn enrol_verify_mobile(
        &self,
        session: &str,
        request: &EnrolMobileVerifyRequest,
    ) -> Result<EnrolAuthResponse, AbdmError> {
        send_json(
            self.post(ENROL_AUTH_BY_ABDM_PATH, session, None)
                .json(request),
        )
        .await
    }

    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn address_suggestions(
        &self,
        session: &str,
        txn_id: &str,
    ) -> Result<AddressSuggestions, AbdmError> {
        let builder = self
            .get(ENROL_SUGGESTION_PATH, session, None)
            .header("Transaction_Id", txn_id);
        send_json(builder).await
    }

    /// # Errors
    /// [`AbdmError`] as for every call; a taken address is a `Status`.
    pub async fn create_address(
        &self,
        session: &str,
        request: &CreateAddressRequest,
    ) -> Result<CreateAddressResponse, AbdmError> {
        send_json(
            self.post(ENROL_ABHA_ADDRESS_PATH, session, None)
                .json(request),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::EnrolResponse;

    /// The SOP's enrolment answer, trimmed: a new ABHA whose mobile differs
    /// from the Aadhaar one comes back with `mobile: null`.
    #[test]
    fn an_enrolment_response_parses() -> Result<(), serde_json::Error> {
        let parsed: EnrolResponse = serde_json::from_str(
            r#"{"message":"Account created successfully","txnId":"t",
                "tokens":{"token":"x","expiresIn":1800},
                "ABHAProfile":{"firstName":"Priyanka","lastName":"Varude","dob":"26-11-1989",
                  "gender":"F","mobile":null,"phrAddress":["91160145481380@sbx"],
                  "ABHANumber":"91-1601-4548-1380","abhaStatus":"ACTIVE"},
                "isNew":true}"#,
        )?;
        assert!(parsed.is_new);
        assert!(parsed.abha_profile.mobile.is_none());
        assert_eq!(parsed.abha_profile.phr_address.len(), 1);
        Ok(())
    }
}
