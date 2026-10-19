//! Changing the patient's own ABHA during a live verification (SOP §7.1–7.2).
//!
//! - `POST …/verifications/{id}/mobile`        — OTP to the new mobile
//! - `POST …/verifications/{id}/mobile/verify` — that OTP; the ABHA's mobile changes
//! - `POST …/verifications/{id}/email`         — ABDM emails a verification link
//!
//! Only for verifications by ABHA number or mobile: the ABHA-address (PHR)
//! token does not open these APIs. The OTP transaction lives with the token,
//! in memory, for the minutes it is valid.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
};

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_abdm::{
    LoginHint, MOBILE_VERIFY_SCOPE, OtpSystem, RequestOtpRequest, VerifyOtpAuthData,
    VerifyOtpPayload, VerifyOtpRequest, account::ABHA_PROFILE_SCOPE,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::abha::{connect, map_abdm_error};
use super::abha_address::is_address;
use super::abha_common::{digits, peek_token};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Bound on pending mobile-change transactions held at once.
const MAX_PENDING: usize = 2_000;

/// verification id → ABDM transaction id of the pending mobile change.
static PENDING: LazyLock<Mutex<HashMap<Uuid, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Deserialize)]
pub struct NewMobile {
    pub mobile: String,
}

#[derive(Debug, Deserialize)]
pub struct MobileOtp {
    pub otp: String,
}

#[derive(Debug, Deserialize)]
pub struct NewEmail {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct AccountChange {
    /// ABDM's own words — where the OTP or the link went.
    pub message: Option<String>,
}

/// The caller's live ABHA-number verification and its token.
async fn live_token(state: &AppState, claims: &Claims, id: Uuid) -> Result<String, AppError> {
    require_permission(claims, permissions::abdm::abha::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let method: Option<String> = sqlx::query_scalar(
        "SELECT method FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND stage = 'verified' \
           AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let method = method.ok_or_else(|| {
        AppError::BadRequest("verify the ABHA first, then change its details".to_owned())
    })?;
    if is_address(&method) {
        return Err(AppError::BadRequest(
            "verify by ABHA number or mobile to change the ABHA's mobile or email".to_owned(),
        ));
    }
    peek_token(id).ok_or_else(|| {
        AppError::BadRequest("ABDM's session for this patient has ended — verify again".to_owned())
    })
}

/// `POST /api/abdm/abha/verifications/{id}/mobile`
///
/// # Errors
/// 400 for a malformed mobile or an ended session; 403 without `abdm.abha.manage`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_mobile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NewMobile>,
) -> Result<Json<AccountChange>, AppError> {
    let token = live_token(&state, &claims, id).await?;
    let mobile = digits(&body.mobile);
    if mobile.len() != 10 {
        return Err(AppError::BadRequest(
            "a mobile number has 10 digits".to_owned(),
        ));
    }
    let abdm = connect(&state, claims.tenant_id).await?;
    let sent = abdm
        .client
        .account_request(
            &abdm.session,
            &token,
            &RequestOtpRequest {
                scope: vec![
                    ABHA_PROFILE_SCOPE.to_owned(),
                    MOBILE_VERIFY_SCOPE.to_owned(),
                ],
                login_hint: LoginHint::Mobile,
                login_id: abdm.encrypt(&mobile)?,
                otp_system: OtpSystem::Abdm,
            },
            false,
        )
        .await
        .map_err(map_abdm_error)?;
    let mut pending = PENDING.lock().unwrap_or_else(PoisonError::into_inner);
    if pending.len() >= MAX_PENDING {
        // ponytail: forget everything when full; a desk mid-change asks for a new OTP.
        pending.clear();
    }
    pending.insert(id, sent.txn_id);
    Ok(Json(AccountChange {
        message: sent.message,
    }))
}

/// `POST /api/abdm/abha/verifications/{id}/mobile/verify`
///
/// # Errors
/// 400 for a wrong OTP (ABDM's words) or no pending change.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn verify_mobile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MobileOtp>,
) -> Result<Json<AccountChange>, AppError> {
    let token = live_token(&state, &claims, id).await?;
    let otp = digits(&body.otp);
    if otp.len() != 6 {
        return Err(AppError::BadRequest("the OTP has 6 digits".to_owned()));
    }
    let txn = PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(&id)
        .cloned()
        .ok_or_else(|| AppError::BadRequest("send the OTP to the new mobile first".to_owned()))?;
    let abdm = connect(&state, claims.tenant_id).await?;
    let done = abdm
        .client
        .account_verify(
            &abdm.session,
            &token,
            &VerifyOtpRequest {
                scope: vec![
                    ABHA_PROFILE_SCOPE.to_owned(),
                    MOBILE_VERIFY_SCOPE.to_owned(),
                ],
                auth_data: VerifyOtpAuthData {
                    auth_methods: vec!["otp".to_owned()],
                    otp: VerifyOtpPayload {
                        txn_id: txn,
                        otp_value: abdm.encrypt(&otp)?,
                    },
                },
            },
        )
        .await
        .map_err(map_abdm_error)?;
    PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .remove(&id);
    Ok(Json(AccountChange {
        message: done.message,
    }))
}

/// `POST /api/abdm/abha/verifications/{id}/email` — ABDM emails a link the
/// patient opens to confirm the address.
///
/// # Errors
/// 400 for a malformed email or an ended session.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_email(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NewEmail>,
) -> Result<Json<AccountChange>, AppError> {
    let token = live_token(&state, &claims, id).await?;
    let email = body.email.trim();
    if !email.contains('@') || email.len() > 254 {
        return Err(AppError::BadRequest(
            "enter a valid email address".to_owned(),
        ));
    }
    let abdm = connect(&state, claims.tenant_id).await?;
    let sent = abdm
        .client
        .account_request(
            &abdm.session,
            &token,
            &RequestOtpRequest {
                scope: vec![
                    ABHA_PROFILE_SCOPE.to_owned(),
                    "email-link-verify".to_owned(),
                ],
                login_hint: LoginHint::Email,
                login_id: abdm.encrypt(email)?,
                otp_system: OtpSystem::Abdm,
            },
            true,
        )
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(AccountChange {
        message: sent.message,
    }))
}
