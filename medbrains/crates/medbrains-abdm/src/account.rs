//! The person's own ABHA during a live verification (SOP §7.6, §8): find it
//! by mobile, change its mobile or email, refresh its KYC from Aadhaar,
//! change its photo, delete or deactivate it.

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::abha::{AbdmAbhaClient, AbdmError, UserToken, send_json};
use crate::types::{RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse};

pub const ACCOUNT_REQUEST_OTP_PATH: &str = "/v3/profile/account/request/otp";
pub const ACCOUNT_VERIFY_PATH: &str = "/v3/profile/account/verify";
pub const EMAIL_LINK_PATH: &str = "/v3/profile/account/request/emailVerificationLink";
/// Find the ABHAs on a mobile (SOP §7.6.1.1); then an OTP for the one chosen.
pub const ABHA_SEARCH_PATH: &str = "/v3/profile/account/abha/search";
/// `PATCH` — the photo (SOP §8, test case PROF_ABHA_602).
pub const ACCOUNT_PATH: &str = "/v3/profile/account";
pub const ABHA_PROFILE_SCOPE: &str = "abha-profile";
pub const SEARCH_ABHA_SCOPE: &str = "search-abha";
pub const RE_KYC_SCOPE: &str = "re-kyc";
pub const DELETE_SCOPE: &str = "delete";
pub const DEACTIVATE_SCOPE: &str = "de-activate";

/// One account a mobile search found. ABDM masks the number.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct SearchedAbha {
    pub index: i64,
    #[serde(rename = "ABHANumber")]
    pub abha_number: String,
    pub name: Option<String>,
    pub gender: Option<String>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct AbhaSearch {
    pub txn_id: String,
    pub accounts: Vec<SearchedAbha>,
}

impl AbhaSearch {
    /// The schema says an array holding one `{txnId, ABHA[]}`; a plain
    /// object is read the same way.
    fn from_value(v: &Value) -> Self {
        let node = v.as_array().and_then(|a| a.first()).unwrap_or(v);
        Self {
            txn_id: node["txnId"].as_str().unwrap_or_default().to_owned(),
            accounts: serde_json::from_value(node["ABHA"].clone()).unwrap_or_default(),
        }
    }
}

impl AbdmAbhaClient {
    /// The ABHAs registered on `mobile` (encrypted).
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn search_abha(&self, session: &str, mobile: &str) -> Result<AbhaSearch, AbdmError> {
        let body = json!({ "scope": [SEARCH_ABHA_SCOPE], "mobile": mobile });
        let builder = self.post(ABHA_SEARCH_PATH, session, None);
        let found: Value = send_json(builder.json(&body)).await?;
        Ok(AbhaSearch::from_value(&found))
    }

    /// OTP to the new mobile, or the email verification link, by `request.login_hint`.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn account_request(
        &self,
        session: &str,
        x_token: &str,
        request: &RequestOtpRequest,
        email_link: bool,
    ) -> Result<RequestOtpResponse, AbdmError> {
        let path = if email_link {
            EMAIL_LINK_PATH
        } else {
            ACCOUNT_REQUEST_OTP_PATH
        };
        let builder = self.post(path, session, Some(UserToken::X(x_token)));
        send_json(builder.json(request)).await
    }

    /// Check the OTP for a profile change. `reasons` is required by the
    /// swagger (`ABHA_API_V3_SWAGGER_31_07_2025`): empty, or why the person
    /// deletes or deactivates their ABHA.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call; a wrong OTP is a `Status`.
    pub async fn account_verify(
        &self,
        session: &str,
        x_token: &str,
        request: &VerifyOtpRequest,
        reasons: &[String],
    ) -> Result<VerifyOtpResponse, AbdmError> {
        let mut body = serde_json::to_value(request).unwrap_or_default();
        body["reasons"] = json!(reasons);
        let builder = self.post(ACCOUNT_VERIFY_PATH, session, Some(UserToken::X(x_token)));
        send_json(builder.json(&body)).await
    }

    /// Replace the ABHA's photo with `photo` (base64 JPEG).
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn update_photo(
        &self,
        session: &str,
        x_token: &str,
        photo: &str,
    ) -> Result<Value, AbdmError> {
        let builder = self.patch(ACCOUNT_PATH, session, Some(UserToken::X(x_token)));
        send_json(builder.json(&json!({ "profilePhoto": photo }))).await
    }
}

#[cfg(test)]
mod tests {
    use super::AbhaSearch;
    use serde_json::json;

    /// The documented array and the Postman object both give the accounts.
    #[test]
    fn a_mobile_search_is_read_in_either_shape() {
        let documented = json!([{ "txnId": "t1", "ABHA": [{ "index": 1, "ABHANumber": "xx-xxxx-xxxx-XX31",
            "name": "Asha", "gender": "F", "kycVerified": "true", "authMethods": ["MOBILE_OTP"] }] }]);
        let found = AbhaSearch::from_value(&documented);
        assert_eq!(found.txn_id, "t1");
        assert_eq!(found.accounts.len(), 1);
        assert_eq!(found.accounts[0].index, 1);
        let plain = json!({ "txnId": "t2", "ABHA": [] });
        assert_eq!(AbhaSearch::from_value(&plain).txn_id, "t2");
        assert!(AbhaSearch::from_value(&plain).accounts.is_empty());
    }
}
