//! Reading ABDM's answers while verifying an ABHA, in NHA's exact words.
//!
//! Split from `abha_verify` so that file stays inside its size budget.

use medbrains_abdm::{VerifyOtpResponse, rules::OTP_INVALID};

use super::abha_common::{aadhaar_digits, mobile_digits};
use super::abha_verify::VerifyMethod;
use crate::error::AppError;

/// NHA's exact refusals for a malformed mobile or Aadhaar number, before ABDM
/// is asked anything (`VRFY_ABHA_301`).
pub(super) fn refuse_early(method: VerifyMethod, value: &str) -> Result<(), AppError> {
    match method {
        VerifyMethod::Mobile | VerifyMethod::FindMobile => mobile_digits(value).map(drop),
        VerifyMethod::Aadhaar => aadhaar_digits(value).map(drop),
        VerifyMethod::AbhaNumber | VerifyMethod::AbhaAddress => Ok(()),
    }
}

/// ABDM answers a wrong OTP with 200 and `authResult: failed`; that is a
/// refusal in ABDM's words, not a missing session.
pub(super) fn accepted(verified: VerifyOtpResponse) -> Result<VerifyOtpResponse, AppError> {
    if verified
        .auth_result
        .as_deref()
        .is_some_and(|r| !r.eq_ignore_ascii_case("success"))
    {
        return Err(AppError::BadRequest(verified.message.unwrap_or_else(
            || "ABDM did not accept the OTP. Check it with the patient.".to_owned(),
        )));
    }
    Ok(verified)
}

/// Finding an ABHA by mobile, a refused OTP gets NHA's exact words
/// (`VRFY_ABHA_307`); ABDM's are logged. Every other method keeps ABDM's.
pub(super) fn wrong_otp(method: VerifyMethod, error: AppError) -> AppError {
    match error {
        AppError::BadRequest(why) if method == VerifyMethod::FindMobile => {
            tracing::warn!(detail = %why, "ABDM refused the find-by-mobile OTP");
            AppError::BadRequest(OTP_INVALID.to_owned())
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::{accepted, wrong_otp};
    use crate::error::AppError;
    use crate::routes::abdm::abha_verify::VerifyMethod;
    use medbrains_abdm::{VerifyOtpResponse, rules::OTP_INVALID};

    fn answer(result: &str, message: Option<&str>) -> VerifyOtpResponse {
        VerifyOtpResponse {
            txn_id: None,
            auth_result: Some(result.to_owned()),
            message: message.map(str::to_owned),
            token: None,
            accounts: Vec::new(),
        }
    }

    /// A 200 with `authResult: failed` is a refusal in ABDM's words.
    #[test]
    fn a_failed_auth_result_is_a_refusal() {
        let refused = accepted(answer(
            "failed",
            Some("OTP did not match, please try again."),
        ));
        assert!(
            matches!(refused, Err(AppError::BadRequest(m)) if m == "OTP did not match, please try again.")
        );
        assert!(accepted(answer("success", None)).is_ok());
    }

    /// `VRFY_ABHA_307`: only find-by-mobile swaps ABDM's words for NHA's;
    /// an outage is never dressed as a wrong OTP.
    #[test]
    fn find_by_mobile_says_invalid_otp_exactly() {
        let wrong = || AppError::BadRequest("OTP did not match".to_owned());
        assert!(
            matches!(wrong_otp(VerifyMethod::FindMobile, wrong()), AppError::BadRequest(m) if m == OTP_INVALID)
        );
        assert!(
            matches!(wrong_otp(VerifyMethod::Mobile, wrong()), AppError::BadRequest(m) if m == "OTP did not match")
        );
        let down = AppError::ServiceUnavailable("ABDM is not responding".to_owned());
        assert!(matches!(
            wrong_otp(VerifyMethod::FindMobile, down),
            AppError::ServiceUnavailable(_)
        ));
    }
}
