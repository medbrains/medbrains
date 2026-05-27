//! ABDM integration boundary.
//!
//! This crate keeps Ayushman Bharat Digital Mission contracts and client
//! helpers away from HMS domain modules. Live route wiring stays in
//! `medbrains-server`, while UI code talks only to `MedBrains` backend APIs.

pub mod abha;

pub use abha::{
    AADHAAR_VERIFY_SCOPE, ABDM_PRODUCTION_ABHA_BASE_URL, ABDM_PRODUCTION_SESSION_URL,
    ABDM_PROFILE_LOGIN_REQUEST_OTP_PATH, ABDM_PROFILE_LOGIN_VERIFY_PATH,
    ABDM_PROFILE_PUBLIC_CERTIFICATE_PATH, ABDM_SANDBOX_ABHA_BASE_URL, ABDM_SANDBOX_SESSION_URL,
    ABHA_LOGIN_SCOPE, ABHA_PROFILE_SCOPE, AbdmAbhaClient, AbdmAbhaConfig, AbdmEnvironment,
    AbdmError, AbdmRequestContext, AbhaAccountSummary, AbhaIntegrationReadiness, AbhaProfile,
    AuthMethod, AuthToken, LoginHint, MOBILE_VERIFY_SCOPE, OtpSystem, ProfileTokenResponse,
    PublicCertificateResponse, RequestOtpRequest, RequestOtpResponse, SessionTokenRequest,
    SessionTokenResponse, VerifyOtpAuthData, VerifyOtpPayload, VerifyOtpRequest, VerifyOtpResponse,
};
