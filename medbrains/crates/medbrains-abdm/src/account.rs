//! Updating the person's own ABHA during a live verification (SOP §7.1–7.2):
//! a new mobile, by OTP to that mobile; an email, by a verification link.

use crate::abha::{AbdmAbhaClient, AbdmError, UserToken, send_json};
use crate::types::{RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse};

pub const ACCOUNT_REQUEST_OTP_PATH: &str = "/v3/profile/account/request/otp";
pub const ACCOUNT_VERIFY_PATH: &str = "/v3/profile/account/verify";
pub const EMAIL_LINK_PATH: &str = "/v3/profile/account/request/emailVerificationLink";
pub const ABHA_PROFILE_SCOPE: &str = "abha-profile";

impl AbdmAbhaClient {
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

    /// # Errors
    /// [`AbdmError`] as for every call; a wrong OTP is a `Status`.
    pub async fn account_verify(
        &self,
        session: &str,
        x_token: &str,
        request: &VerifyOtpRequest,
    ) -> Result<VerifyOtpResponse, AbdmError> {
        let builder = self.post(ACCOUNT_VERIFY_PATH, session, Some(UserToken::X(x_token)));
        send_json(builder.json(request)).await
    }
}
