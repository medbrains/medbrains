//! The patient's own ABHA, while their verification is live (ABHA V3 SOP
//! §8; M1 test cases PROF_ABHA_602, 604, 605):
//!
//! - `POST …/verifications/{id}/re-kyc` (+ `/verify`) — refresh the ABHA's
//!   KYC from Aadhaar, by an OTP to the Aadhaar-linked mobile;
//! - `POST …/verifications/{id}/photo` — a new photo on the ABHA;
//! - `POST …/verifications/{id}/close` (+ `/verify`) — delete or deactivate
//!   the ABHA at ABDM, by OTP; the hospital then stops using it
//!   (`abha_optout`).
//!
//! Each runs on the person's X-token, held in server memory with the
//! verification (`abha_common`); the browser never sees it.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
};

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use medbrains_abdm::{
    LoginHint, OtpSystem, RequestOtpRequest, VerifyOtpAuthData, VerifyOtpPayload, VerifyOtpRequest,
    account::{ABHA_PROFILE_SCOPE, DEACTIVATE_SCOPE, DELETE_SCOPE, RE_KYC_SCOPE},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::abha::{connect, map_abdm_error};
use super::abha_account::{AccountChange, live_token};
use super::abha_common::{LinkedPatient, VerificationStep, digits, take_token, to_profile};
use super::abha_optout::{Ending, end_link};
use super::abha_verify::OtpVia;
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Bound on pending profile transactions held at once.
const MAX_PENDING: usize = 2_000;
/// The largest photo accepted, decoded. ABDM shows it on the ABHA card.
const MAX_PHOTO_BYTES: usize = 1_000_000;
const MAX_REASON: usize = 300;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CloseAction {
    Delete,
    Deactivate,
}

impl CloseAction {
    const fn scope(self) -> &'static str {
        match self {
            Self::Delete => DELETE_SCOPE,
            Self::Deactivate => DEACTIVATE_SCOPE,
        }
    }
}

/// What a pending OTP is for.
#[derive(Clone, Debug)]
enum Pending {
    ReKyc {
        txn: String,
    },
    Close {
        txn: String,
        action: CloseAction,
        reason: String,
    },
}

/// verification id → the pending profile change.
static PENDING: LazyLock<Mutex<HashMap<Uuid, Pending>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn hold(id: Uuid, pending: Pending) {
    let mut map = PENDING.lock().unwrap_or_else(PoisonError::into_inner);
    if map.len() >= MAX_PENDING {
        // ponytail: forget everything when full; a desk mid-change asks for a new OTP.
        map.clear();
    }
    map.insert(id, pending);
}

fn take(id: Uuid) -> Option<Pending> {
    PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .remove(&id)
}

#[derive(Debug, Deserialize)]
pub struct ProfileOtp {
    pub otp: String,
}

#[derive(Debug, Deserialize)]
pub struct NewPhoto {
    /// Base64 JPEG or PNG, without a `data:` prefix.
    pub photo: String,
}

#[derive(Debug, Deserialize)]
pub struct CloseAbha {
    pub action: CloseAction,
    pub otp_via: OtpVia,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct AbhaClosed {
    pub message: Option<String>,
    /// The patient here who carried the ABHA and no longer does.
    pub unlinked: Option<LinkedPatient>,
}

/// The verified ABHA number of the caller's verification.
async fn verified_number(state: &AppState, claims: &Claims, id: Uuid) -> Result<String, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let number: Option<String> = sqlx::query_scalar(
        "SELECT abha_number FROM abha_verifications \
          WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND stage = 'verified' \
            AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    tx.commit().await?;
    number.ok_or_else(|| AppError::BadRequest("verify the ABHA first".to_owned()))
}

fn otp_digits(otp: &str) -> Result<String, AppError> {
    let otp = digits(otp);
    if otp.len() == 6 {
        Ok(otp)
    } else {
        Err(AppError::BadRequest("the OTP has 6 digits".to_owned()))
    }
}

/// Send the OTP for a profile change of `scope`, to `via`.
async fn send_profile_otp(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    (scope, via): (&str, OtpSystem),
) -> Result<(String, Option<String>), AppError> {
    let token = live_token(state, claims, id).await?;
    let number = verified_number(state, claims, id).await?;
    let abdm = connect(state, claims.tenant_id).await?;
    let sent = abdm
        .client
        .account_request(
            &abdm.session,
            &token,
            &RequestOtpRequest {
                scope: vec![ABHA_PROFILE_SCOPE.to_owned(), scope.to_owned()],
                login_hint: LoginHint::AbhaNumber,
                login_id: abdm.encrypt(&number)?,
                otp_system: via,
                txn_id: None,
            },
            false,
        )
        .await
        .map_err(map_abdm_error)?;
    Ok((sent.txn_id, sent.message))
}

/// `POST /api/abdm/abha/verifications/{id}/re-kyc` — OTP to the
/// Aadhaar-linked mobile, to refresh the ABHA's KYC.
///
/// # Errors
/// 400 when the verification is not live; 403 without `abdm.abha.manage`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_re_kyc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccountChange>, AppError> {
    let (txn, message) =
        send_profile_otp(&state, &claims, id, (RE_KYC_SCOPE, OtpSystem::Aadhaar)).await?;
    hold(id, Pending::ReKyc { txn });
    Ok(Json(AccountChange { message }))
}

/// `POST /api/abdm/abha/verifications/{id}/re-kyc/verify` — the OTP; ABDM
/// refreshes the KYC and the profile shown is read again.
///
/// # Errors
/// 400 for a wrong OTP (ABDM's words) or no pending re-KYC.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn verify_re_kyc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ProfileOtp>,
) -> Result<Json<VerificationStep>, AppError> {
    let token = live_token(&state, &claims, id).await?;
    let otp = otp_digits(&body.otp)?;
    let Some(Pending::ReKyc { txn }) = take(id) else {
        return Err(AppError::BadRequest("send the re-KYC OTP first".to_owned()));
    };
    let abdm = connect(&state, claims.tenant_id).await?;
    let request = otp_request(RE_KYC_SCOPE, txn, abdm.encrypt(&otp)?);
    let done = abdm
        .client
        .account_verify(&abdm.session, &token, &request, &[])
        .await
        .map_err(map_abdm_error)?;
    let raw = abdm
        .client
        .profile(&abdm.session, &token)
        .await
        .map_err(map_abdm_error)?;
    let profile = to_profile(raw)?;
    refresh_kyc(&state, &claims, &profile.abha_number, profile.kyc_verified).await?;
    let mut step = super::abha_common::record_verified(&state, &claims, id, profile)
        .await?
        .0;
    step.message = done.message;
    Ok(Json(step))
}

fn otp_request(scope: &str, txn: String, otp_cipher: String) -> VerifyOtpRequest {
    VerifyOtpRequest {
        scope: vec![ABHA_PROFILE_SCOPE.to_owned(), scope.to_owned()],
        auth_data: VerifyOtpAuthData {
            auth_methods: vec!["otp".to_owned()],
            otp: VerifyOtpPayload {
                txn_id: txn,
                otp_value: otp_cipher,
            },
        },
    }
}

/// The patient here who carries this ABHA gets its new KYC status.
async fn refresh_kyc(
    state: &AppState,
    claims: &Claims,
    abha_number: &str,
    kyc: bool,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE patient_abha_links SET kyc_verified = $3, kyc_status = $4, kyc_checked_at = now() \
          WHERE tenant_id = $1 AND regexp_replace(abha_number, '\\D', '', 'g') = $2 \
            AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(digits(abha_number))
    .bind(kyc)
    .bind(if kyc { "verified" } else { "not_verified" })
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `POST /api/abdm/abha/verifications/{id}/photo` — a new photo on the ABHA.
///
/// # Errors
/// 400 for something that is not a JPEG or PNG under 1 MB, or an ended session.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn update_photo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NewPhoto>,
) -> Result<Json<AccountChange>, AppError> {
    let token = live_token(&state, &claims, id).await?;
    let photo = body.photo.trim();
    let photo = photo.rsplit_once(',').map_or(photo, |(_, b64)| b64);
    if !is_photo(photo) {
        return Err(AppError::BadRequest(
            "choose a JPEG or PNG photo under 1 MB".to_owned(),
        ));
    }
    let abdm = connect(&state, claims.tenant_id).await?;
    abdm.client
        .update_photo(&abdm.session, &token, photo)
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(AccountChange {
        message: Some("The photo on the patient's ABHA is changed.".to_owned()),
    }))
}

/// A base64 JPEG or PNG within the size ABDM's card can carry.
fn is_photo(b64: &str) -> bool {
    STANDARD.decode(b64).is_ok_and(|bytes| {
        bytes.len() <= MAX_PHOTO_BYTES
            && (bytes.starts_with(&[0xFF, 0xD8, 0xFF]) || bytes.starts_with(b"\x89PNG"))
    })
}

/// `POST /api/abdm/abha/verifications/{id}/close` — the patient asks to
/// delete or deactivate their ABHA; ABDM sends the OTP that confirms it.
///
/// # Errors
/// 403 without `abdm.abha.deactivate`; 400 without a reason.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CloseAbha>,
) -> Result<Json<AccountChange>, AppError> {
    require_permission(&claims, permissions::abdm::abha::DEACTIVATE)?;
    let reason = body.reason.trim().to_owned();
    if reason.is_empty() || reason.len() > MAX_REASON {
        return Err(AppError::BadRequest(
            "say in a sentence why the patient is closing their ABHA".to_owned(),
        ));
    }
    let via = match body.otp_via {
        OtpVia::Aadhaar => OtpSystem::Aadhaar,
        OtpVia::Abdm => OtpSystem::Abdm,
    };
    let (txn, message) = send_profile_otp(&state, &claims, id, (body.action.scope(), via)).await?;
    hold(
        id,
        Pending::Close {
            txn,
            action: body.action,
            reason,
        },
    );
    Ok(Json(AccountChange { message }))
}

/// `POST /api/abdm/abha/verifications/{id}/close/verify` — the OTP. Once
/// ABDM confirms, the hospital stops using the ABHA on any patient here.
///
/// # Errors
/// 403 without `abdm.abha.deactivate`; 400 for a wrong OTP or nothing pending.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn verify_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ProfileOtp>,
) -> Result<Json<AbhaClosed>, AppError> {
    require_permission(&claims, permissions::abdm::abha::DEACTIVATE)?;
    let token = live_token(&state, &claims, id).await?;
    let otp = otp_digits(&body.otp)?;
    let Some(Pending::Close {
        txn,
        action,
        reason,
    }) = take(id)
    else {
        return Err(AppError::BadRequest(
            "ask ABDM for the OTP first".to_owned(),
        ));
    };
    let number = verified_number(&state, &claims, id).await?;
    let abdm = connect(&state, claims.tenant_id).await?;
    let request = otp_request(action.scope(), txn, abdm.encrypt(&otp)?);
    let done = abdm
        .client
        .account_verify(
            &abdm.session,
            &token,
            &request,
            std::slice::from_ref(&reason),
        )
        .await
        .map_err(map_abdm_error)?;
    // The ABHA is gone at ABDM; its token opens nothing any more.
    take_token(id);
    let unlinked = unlink_everywhere(&state, &claims, &number, action, &reason).await?;
    Ok(Json(AbhaClosed {
        message: done.message,
        unlinked,
    }))
}

/// End the link on the patient here who carries `number`, if any.
async fn unlink_everywhere(
    state: &AppState,
    claims: &Claims,
    number: &str,
    action: CloseAction,
    reason: &str,
) -> Result<Option<LinkedPatient>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let patient = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT p.id, p.uhid, concat_ws(' ', p.first_name, p.last_name) \
           FROM patient_abha_links l JOIN patients p ON p.id = l.patient_id \
          WHERE l.tenant_id = $1 AND regexp_replace(l.abha_number, '\\D', '', 'g') = $2 \
            AND l.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(digits(number))
    .fetch_optional(&mut *tx)
    .await?;
    let Some((patient_id, uhid, name)) = patient else {
        tx.commit().await?;
        return Ok(None);
    };
    let ending = match action {
        CloseAction::Delete => Ending::DeletedAtAbdm,
        CloseAction::Deactivate => Ending::DeactivatedAtAbdm,
    };
    end_link(
        &mut tx,
        (claims.tenant_id, patient_id, claims.sub),
        ending,
        reason,
    )
    .await?;
    tx.commit().await?;
    Ok(Some(LinkedPatient {
        patient_id,
        uhid,
        name,
    }))
}

#[cfg(test)]
mod tests {
    use super::is_photo;
    use base64::{Engine, engine::general_purpose::STANDARD};

    /// Only a real JPEG or PNG goes to ABDM; anything else is refused here.
    #[test]
    fn only_a_jpeg_or_png_is_a_photo() {
        assert!(is_photo(&STANDARD.encode([0xFF, 0xD8, 0xFF, 0xE0, 1, 2])));
        assert!(is_photo(&STANDARD.encode(b"\x89PNG\r\n")));
        assert!(!is_photo(&STANDARD.encode(b"%PDF-1.7")));
        assert!(!is_photo("not base64!"));
        let mut big = vec![0xFF, 0xD8, 0xFF];
        big.resize(1_000_001, 0);
        assert!(!is_photo(&STANDARD.encode(big)));
    }
}
