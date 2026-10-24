//! Verify by ABHA address (`name@abdm`, SOP §12) — the PHR APIs, which differ
//! from the ABHA-number login only in their paths, token and profile shape.
//! Also the one place that picks which API sends a login OTP.

use axum::Json;
use medbrains_abdm::{
    AADHAAR_VERIFY_SCOPE, ABHA_LOGIN_SCOPE, AbdmEnvironment, AbhaProfile, LoginHint,
    MOBILE_VERIFY_SCOPE, OtpSystem, RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest,
    phr::{ABHA_ADDRESS_LOGIN_SCOPE, PhrProfile},
};
use uuid::Uuid;

use super::abha::{Abdm, map_abdm_error};
use super::abha_common::{VerificationStep, keep_token, record_verified, to_profile};
use super::abha_verify::{OtpVia, VerifyMethod};
use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// The address ABDM expects: lower-case, with the domain of the environment
/// when staff typed only the name.
pub(crate) fn full_address(typed: &str, environment: AbdmEnvironment) -> Option<String> {
    let address = typed.trim().to_ascii_lowercase();
    if address.is_empty() {
        return None;
    }
    if address.contains('@') {
        return Some(address);
    }
    let domain = match environment {
        AbdmEnvironment::Sandbox => "sbx",
        AbdmEnvironment::Production => "abdm",
    };
    Some(format!("{address}@{domain}"))
}

pub(crate) fn scope(method: VerifyMethod, via: OtpSystem) -> Vec<String> {
    let second = match (method, via) {
        (
            VerifyMethod::AbhaNumber | VerifyMethod::AbhaAddress | VerifyMethod::Aadhaar,
            OtpSystem::Aadhaar,
        ) => AADHAAR_VERIFY_SCOPE,
        _ => MOBILE_VERIFY_SCOPE,
    };
    let first = if method == VerifyMethod::AbhaAddress {
        ABHA_ADDRESS_LOGIN_SCOPE
    } else {
        ABHA_LOGIN_SCOPE
    };
    vec![first.to_owned(), second.to_owned()]
}

pub(crate) const fn hint(method: VerifyMethod) -> LoginHint {
    match method {
        VerifyMethod::AbhaNumber => LoginHint::AbhaNumber,
        VerifyMethod::Mobile => LoginHint::Mobile,
        VerifyMethod::AbhaAddress => LoginHint::AbhaAddress,
        VerifyMethod::Aadhaar => LoginHint::Aadhaar,
        VerifyMethod::FindMobile => LoginHint::Index,
    }
}

pub(crate) const fn otp_system(via: Option<OtpVia>) -> OtpSystem {
    match via {
        Some(OtpVia::Aadhaar) | None => OtpSystem::Aadhaar,
        Some(OtpVia::Abdm) => OtpSystem::Abdm,
    }
}

/// Send the login OTP on the API that owns `hint`.
pub(crate) async fn request_otp(
    abdm: &Abdm,
    request: &RequestOtpRequest,
) -> Result<RequestOtpResponse, AppError> {
    let sent = if request.login_hint == LoginHint::AbhaAddress {
        abdm.client.phr_request_otp(&abdm.session, request).await
    } else {
        abdm.client.request_login_otp(&abdm.session, request).await
    };
    sent.map_err(map_abdm_error)
}

/// Check the OTP on the PHR API, fetch the profile and record the verification.
pub(crate) async fn verify_and_finish(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    request: &VerifyOtpRequest,
) -> Result<Json<VerificationStep>, AppError> {
    let verified = abdm
        .client
        .phr_verify(&abdm.session, request)
        .await
        .map_err(map_abdm_error)?;
    let token = verified
        .tokens
        .map(|t| t.token)
        .ok_or_else(|| AppError::ServiceUnavailable("ABDM did not return a session".to_owned()))?;
    let raw = abdm
        .client
        .phr_profile(&abdm.session, &token)
        .await
        .map_err(map_abdm_error)?;
    keep_token(id, &token);
    record_verified(state, claims, id, to_profile(from_phr(raw))?).await
}

/// The PHR profile in the ABHA profile's shape, so one mapping serves both.
fn from_phr(p: PhrProfile) -> AbhaProfile {
    AbhaProfile {
        abha_number: p.abha_number,
        preferred_abha_address: p.abha_address,
        name: p.full_name,
        first_name: p.first_name,
        middle_name: p.middle_name,
        last_name: p.last_name,
        year_of_birth: p.year_of_birth,
        month_of_birth: p.month_of_birth,
        day_of_birth: p.day_of_birth,
        gender: p.gender,
        mobile: p.mobile,
        email: p.email,
        address: p.address,
        pincode: p.pin_code,
        state_name: p.state_name,
        district_name: None,
        kyc_verified: p.kyc_status.map(|s| s.eq_ignore_ascii_case("VERIFIED")),
        verification_type: None,
        status: p.status,
        profile_photo: p.profile_photo,
    }
}

/// Whether a verification was made through the PHR APIs (its token only
/// opens the PHR card and QR).
pub(crate) fn is_address(method: &str) -> bool {
    method == "abha_address"
}

#[cfg(test)]
mod tests {
    use super::full_address;
    use medbrains_abdm::AbdmEnvironment;

    #[test]
    fn a_bare_name_gets_the_environment_domain() {
        assert_eq!(
            full_address(" Priya.V ", AbdmEnvironment::Sandbox).as_deref(),
            Some("priya.v@sbx")
        );
        assert_eq!(
            full_address("priya@abdm", AbdmEnvironment::Sandbox).as_deref(),
            Some("priya@abdm")
        );
        assert_eq!(
            full_address("x", AbdmEnvironment::Production).as_deref(),
            Some("x@abdm")
        );
        assert_eq!(full_address("  ", AbdmEnvironment::Sandbox), None);
    }
}
