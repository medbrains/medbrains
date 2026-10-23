//! "Create ABHA" at the desk, by Aadhaar OTP (ABHA V3 SOP §3).
//!
//! 1. `POST /api/abdm/abha/enrolments` — the patient's consent and Aadhaar
//!    number; ABDM sends an OTP to the Aadhaar-linked mobile.
//! 2. `POST …/{id}/otp` — that OTP and the mobile the patient wants on the
//!    ABHA. If they already had an ABHA, ABDM returns it and we are done.
//! 3. `POST …/{id}/mobile-otp` — only when that mobile is not the
//!    Aadhaar-linked one: the OTP sent to it.
//! 4. `POST …/{id}/address` — the ABHA address chosen.
//!
//! `POST …/{id}/resend` sends the waiting OTP again — after 60 seconds, at
//! most twice per OTP (M1 test case `CRT_ABHA_106`). The Aadhaar OTP needs the
//! Aadhaar number typed again: it is never stored.
//!
//! The finished record is a verified `abha_verifications` row, linked to the
//! patient exactly like "Verify ABHA". The Aadhaar number is encrypted to ABDM
//! in this request and never stored or logged.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_abdm::{
    ABHA_ENROL_SCOPE, CreateAddressRequest, ENROL_CONSENT_CODE, ENROL_CONSENT_VERSION,
    EnrolAuthData, EnrolByAadhaarRequest, EnrolConsent, EnrolMobileVerifyRequest, EnrolOtp,
    EnrolOtpRequest, MOBILE_VERIFY_SCOPE,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use super::abha::{Abdm, connect, map_abdm_error};
use super::abha_common::{
    RESEND_AFTER_SECONDS, VerificationStep, check_resend, digits, env_name, keep_token,
    peek_token, record_verified, to_profile, update,
};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const ENROLMENT_LIFETIME_MINUTES: i32 = 30;
const MAX_OTP_ATTEMPTS: i32 = 5;

#[derive(Debug, Deserialize)]
pub struct StartEnrolment {
    pub aadhaar: String,
    /// The patient agreed to ABDM's terms for creating an ABHA with Aadhaar.
    pub consent: bool,
}

#[derive(Debug, Deserialize)]
pub struct EnrolOtpInput {
    pub otp: String,
    /// The mobile the patient wants on their ABHA.
    pub mobile: String,
}

#[derive(Debug, Deserialize)]
pub struct ResendEnrolmentOtp {
    /// Needed to resend the Aadhaar OTP, which goes to the Aadhaar number.
    #[serde(default)]
    pub aadhaar: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MobileOtpInput {
    pub otp: String,
}

#[derive(Debug, Deserialize)]
pub struct ChooseAddress {
    pub abha_address: String,
}

fn six_digits(otp: &str) -> Result<String, AppError> {
    let otp = digits(otp);
    if otp.len() == 6 {
        Ok(otp)
    } else {
        Err(AppError::BadRequest("the OTP has 6 digits".to_owned()))
    }
}

/// An OTP stage keeps the resend pause and cap; any other has neither.
fn step(id: Uuid, stage: &'static str, message: Option<String>) -> VerificationStep {
    let waiting = matches!(stage, "otp_sent" | "mobile_otp_sent");
    let sent = VerificationStep::otp_sent(id, message);
    VerificationStep {
        stage,
        resend_after_seconds: sent.resend_after_seconds.filter(|_| waiting),
        resends_left: sent.resends_left.filter(|_| waiting),
        ..sent
    }
}

fn aadhaar_digits(aadhaar: &str) -> Result<String, AppError> {
    let aadhaar = digits(aadhaar);
    if aadhaar.len() == 12 {
        Ok(aadhaar)
    } else {
        Err(AppError::BadRequest("an Aadhaar number has 12 digits".to_owned()))
    }
}

fn aadhaar_otp_request(abdm: &Abdm, aadhaar: &str) -> Result<EnrolOtpRequest, AppError> {
    Ok(EnrolOtpRequest {
        txn_id: String::new(),
        scope: vec![ABHA_ENROL_SCOPE.to_owned()],
        login_hint: "aadhaar".to_owned(),
        login_id: abdm.encrypt(aadhaar)?,
        otp_system: "aadhaar".to_owned(),
    })
}

fn mobile_otp_request(abdm: &Abdm, txn: &str, mobile: &str) -> Result<EnrolOtpRequest, AppError> {
    Ok(EnrolOtpRequest {
        txn_id: txn.to_owned(),
        scope: vec![ABHA_ENROL_SCOPE.to_owned(), MOBILE_VERIFY_SCOPE.to_owned()],
        login_hint: "mobile".to_owned(),
        login_id: abdm.encrypt(mobile)?,
        otp_system: "abdm".to_owned(),
    })
}

/// `POST /api/abdm/abha/enrolments` — send the Aadhaar OTP.
///
/// # Errors
/// 400 without the patient's consent or with a malformed Aadhaar number;
/// 403 without `abdm.abha.manage`; 503 when ABDM is not set up or not answering.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn start(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<StartEnrolment>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    if !body.consent {
        return Err(AppError::BadRequest(
            "the patient's consent is needed before creating an ABHA with Aadhaar".to_owned(),
        ));
    }
    let aadhaar = aadhaar_digits(&body.aadhaar)?;
    let abdm = connect(&state, claims.tenant_id).await?;
    let sent = abdm
        .client
        .enrol_request_otp(&abdm.session, &aadhaar_otp_request(&abdm, &aadhaar)?)
        .await
        .map_err(map_abdm_error)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO abha_verifications \
           (tenant_id, created_by, method, otp_system, environment, abdm_txn_id, expires_at, \
            consent_version) \
         VALUES ($1, $2, 'aadhaar_enrol', 'aadhaar', $3, $4, now() + make_interval(mins => $5), $6) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(env_name(&abdm))
    .bind(&sent.txn_id)
    .bind(ENROLMENT_LIFETIME_MINUTES)
    .bind(format!("{ENROL_CONSENT_CODE}:{ENROL_CONSENT_VERSION}"))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(step(id, "otp_sent", sent.message)))
}

#[derive(sqlx::FromRow)]
struct Enrolment {
    stage: String,
    abdm_txn_id: String,
    otp_attempts: i32,
}

/// The caller's own, unexpired, unlinked enrolment at `stage`.
async fn load(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    stage: &str,
) -> Result<Enrolment, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Enrolment>(
        "SELECT stage, abdm_txn_id, otp_attempts FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND method = 'aadhaar_enrol' \
           AND expires_at > now() AND linked_patient_id IS NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let row = row.ok_or_else(|| {
        AppError::BadRequest("this ABHA creation has expired — start again".to_owned())
    })?;
    if row.stage != stage {
        return Err(AppError::BadRequest(
            "that step is already done — continue below".to_owned(),
        ));
    }
    if row.otp_attempts >= MAX_OTP_ATTEMPTS {
        return Err(AppError::BadRequest(
            "too many wrong OTPs — start again".to_owned(),
        ));
    }
    Ok(row)
}

async fn count_attempt(state: &AppState, claims: &Claims, id: Uuid) -> Result<(), AppError> {
    update(state, claims, id, |q| {
        q.push("otp_attempts = otp_attempts + 1");
    })
    .await
}

/// `POST /api/abdm/abha/enrolments/{id}/otp` — the Aadhaar OTP and the
/// mobile for the ABHA.
///
/// # Errors
/// 400 for a wrong OTP (ABDM's words) or a malformed mobile.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit_otp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EnrolOtpInput>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let otp = six_digits(&body.otp)?;
    let mobile = digits(&body.mobile);
    if mobile.len() != 10 {
        return Err(AppError::BadRequest(
            "a mobile number has 10 digits".to_owned(),
        ));
    }
    let row = load(&state, &claims, id, "otp_sent").await?;
    count_attempt(&state, &claims, id).await?;

    let abdm = connect(&state, claims.tenant_id).await?;
    let enrolled = abdm
        .client
        .enrol_by_aadhaar(
            &abdm.session,
            &EnrolByAadhaarRequest {
                auth_data: EnrolAuthData {
                    auth_methods: vec!["otp".to_owned()],
                    otp: EnrolOtp {
                        txn_id: row.abdm_txn_id,
                        otp_value: abdm.encrypt(&otp)?,
                        mobile: Some(mobile.clone()),
                    },
                },
                consent: EnrolConsent {
                    code: ENROL_CONSENT_CODE.to_owned(),
                    version: ENROL_CONSENT_VERSION.to_owned(),
                },
            },
        )
        .await
        .map_err(map_abdm_error)?;
    let x_token = enrolled
        .tokens
        .map(|t| t.token)
        .ok_or_else(|| AppError::ServiceUnavailable("ABDM did not return a session".to_owned()))?;
    keep_token(id, &x_token);
    let txn = enrolled.txn_id.unwrap_or_default();

    if !enrolled.is_new {
        // They already had an ABHA; ABDM handed that one back.
        return finish(&state, &claims, id, &abdm, false).await;
    }
    let mobile_needs_otp = enrolled.abha_profile.mobile.is_none();
    update(&state, &claims, id, |q| {
        q.push("abdm_txn_id = ").push_bind(txn.clone());
        q.push(", abha_mobile = ").push_bind(mobile.clone());
    })
    .await?;
    if mobile_needs_otp {
        return send_mobile_otp(&state, &claims, id, &abdm, &txn, &mobile).await;
    }
    offer_addresses(&state, &claims, id, &abdm, &txn).await
}

async fn send_mobile_otp(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    txn: &str,
    mobile: &str,
) -> Result<Json<VerificationStep>, AppError> {
    let sent = abdm
        .client
        .enrol_request_otp(&abdm.session, &mobile_otp_request(abdm, txn, mobile)?)
        .await
        .map_err(map_abdm_error)?;
    // A new OTP: its own pause and its own two resends.
    update(state, claims, id, |q| {
        q.push("stage = 'mobile_otp_sent', otp_attempts = 0, otp_sent_at = now(), ")
            .push("resend_count = 0, abdm_txn_id = ")
            .push_bind(sent.txn_id);
    })
    .await?;
    Ok(Json(step(id, "mobile_otp_sent", sent.message)))
}

async fn offer_addresses(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    txn: &str,
) -> Result<Json<VerificationStep>, AppError> {
    let suggested = abdm
        .client
        .address_suggestions(&abdm.session, txn)
        .await
        .map_err(map_abdm_error)?;
    update(state, claims, id, |q| {
        q.push("stage = 'choose_address'");
    })
    .await?;
    Ok(Json(VerificationStep {
        suggestions: suggested.abha_address_list,
        ..step(id, "choose_address", None)
    }))
}

#[derive(sqlx::FromRow)]
struct Waiting {
    stage: String,
    abdm_txn_id: String,
    abha_mobile: Option<String>,
    resend_ready: bool,
    resend_count: i32,
}

/// `POST /api/abdm/abha/enrolments/{id}/resend` — the waiting OTP, again.
///
/// # Errors
/// 429 inside the 60-second pause or after two resends; 400 when no OTP is
/// waiting, or the Aadhaar number is missing for the Aadhaar OTP.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn resend(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResendEnrolmentOtp>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Waiting>(
        "SELECT stage, abdm_txn_id, abha_mobile, resend_count, \
                (now() - otp_sent_at) >= make_interval(secs => $4::float8) AS resend_ready \
           FROM abha_verifications \
          WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND method = 'aadhaar_enrol' \
            AND expires_at > now() AND linked_patient_id IS NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(RESEND_AFTER_SECONDS)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("this ABHA creation has expired — start again".to_owned()))?;
    tx.commit().await?;
    check_resend(row.resend_ready, row.resend_count)?;
    let abdm = connect(&state, claims.tenant_id).await?;
    let request = match (row.stage.as_str(), &row.abha_mobile) {
        ("otp_sent", _) => {
            let aadhaar = body.aadhaar.as_deref().ok_or_else(|| {
                AppError::BadRequest("type the Aadhaar number again to resend its OTP".to_owned())
            })?;
            aadhaar_otp_request(&abdm, &aadhaar_digits(aadhaar)?)?
        }
        ("mobile_otp_sent", Some(mobile)) => mobile_otp_request(&abdm, &row.abdm_txn_id, mobile)?,
        _ => return Err(AppError::BadRequest("no OTP is waiting — continue below".to_owned())),
    };
    let sent = abdm
        .client
        .enrol_request_otp(&abdm.session, &request)
        .await
        .map_err(map_abdm_error)?;
    update(&state, &claims, id, |q| {
        q.push("otp_sent_at = now(), otp_attempts = 0, resend_count = resend_count + 1, ")
            .push("abdm_txn_id = ")
            .push_bind(sent.txn_id);
    })
    .await?;
    let waiting = if row.stage == "otp_sent" { "otp_sent" } else { "mobile_otp_sent" };
    Ok(Json(step(id, waiting, sent.message).resent(row.resend_count + 1)))
}

/// `POST /api/abdm/abha/enrolments/{id}/mobile-otp` — the OTP sent to the
/// mobile chosen for the ABHA.
///
/// # Errors
/// 400 for a wrong OTP.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit_mobile_otp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MobileOtpInput>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let otp = six_digits(&body.otp)?;
    let row = load(&state, &claims, id, "mobile_otp_sent").await?;
    count_attempt(&state, &claims, id).await?;
    let abdm = connect(&state, claims.tenant_id).await?;
    abdm.client
        .enrol_verify_mobile(
            &abdm.session,
            &EnrolMobileVerifyRequest {
                scope: vec![ABHA_ENROL_SCOPE.to_owned(), MOBILE_VERIFY_SCOPE.to_owned()],
                auth_data: EnrolAuthData {
                    auth_methods: vec!["otp".to_owned()],
                    otp: EnrolOtp {
                        txn_id: row.abdm_txn_id.clone(),
                        otp_value: abdm.encrypt(&otp)?,
                        mobile: None,
                    },
                },
            },
        )
        .await
        .map_err(map_abdm_error)?;
    offer_addresses(&state, &claims, id, &abdm, &row.abdm_txn_id).await
}

/// `POST /api/abdm/abha/enrolments/{id}/address` — create the chosen ABHA
/// address and finish.
///
/// # Errors
/// 400 when ABDM refuses the address (taken, or not allowed).
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn choose_address(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChooseAddress>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let address = body
        .abha_address
        .trim()
        .trim_end_matches("@sbx")
        .trim_end_matches("@abdm");
    if address.is_empty() {
        return Err(AppError::BadRequest(
            "choose or type an ABHA address".to_owned(),
        ));
    }
    let row = load(&state, &claims, id, "choose_address").await?;
    let abdm = connect(&state, claims.tenant_id).await?;
    abdm.client
        .create_address(
            &abdm.session,
            &CreateAddressRequest {
                txn_id: row.abdm_txn_id,
                abha_address: address.to_owned(),
                preferred: 1,
            },
        )
        .await
        .map_err(map_abdm_error)?;
    finish(&state, &claims, id, &abdm, true).await
}

/// Fetch the finished profile with the person's X-token and record it.
async fn finish(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    created_here: bool,
) -> Result<Json<VerificationStep>, AppError> {
    let x_token = peek_token(id).ok_or_else(|| {
        AppError::BadRequest("that took too long — start the ABHA creation again".to_owned())
    })?;
    let raw = abdm
        .client
        .profile(&abdm.session, &x_token)
        .await
        .map_err(map_abdm_error)?;
    let profile = to_profile(raw)?;
    if created_here {
        update(state, claims, id, |q| {
            q.push("created_here = true");
        })
        .await?;
    }
    let mut finished = record_verified(state, claims, id, profile).await?;
    if !created_here {
        finished.message = Some("This patient already had an ABHA — ABDM returned it.".to_owned());
    }
    Ok(finished)
}

#[cfg(test)]
mod tests {
    use super::six_digits;

    #[test]
    fn an_otp_is_six_digits_whatever_the_spacing() {
        assert_eq!(six_digits("123 456").ok().as_deref(), Some("123456"));
        assert!(six_digits("12345").is_err());
    }
}
