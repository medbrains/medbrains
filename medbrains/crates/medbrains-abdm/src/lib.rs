//! ABDM integration boundary.
//!
//! This crate keeps Ayushman Bharat Digital Mission contracts and client
//! helpers away from HMS domain modules. Live route wiring stays in
//! `medbrains-server`, while UI code talks only to `MedBrains` backend APIs.

pub mod abha;
pub mod card;
pub mod enrol;
mod types;

pub use abha::{
    AADHAAR_VERIFY_SCOPE, ABDM_BASE_URL_OVERRIDE, ABHA_LOGIN_SCOPE, AbdmAbhaClient,
    AbdmEnvironment, AbdmError,
    AbhaAccountSummary, AbhaIntegrationReadiness, AbhaProfile, LoginHint, MOBILE_VERIFY_SCOPE,
    OtpSystem, PublicCertificateResponse, RequestOtpRequest, RequestOtpResponse,
    SessionTokenRequest, SessionTokenResponse, UserToken, VerifyOtpAuthData, VerifyOtpPayload,
    VerifyOtpRequest, VerifyOtpResponse, VerifyUserRequest, VerifyUserResponse,
};
pub use card::AbhaCard;
pub use enrol::{
    ABHA_ENROL_SCOPE, AddressSuggestions, CreateAddressRequest, CreateAddressResponse,
    ENROL_CONSENT_CODE, ENROL_CONSENT_VERSION, EnrolAuthData, EnrolAuthResponse,
    EnrolByAadhaarRequest, EnrolConsent, EnrolMobileVerifyRequest, EnrolOtp, EnrolOtpRequest,
    EnrolOtpResponse, EnrolProfile, EnrolResponse, EnrolTokens,
};
