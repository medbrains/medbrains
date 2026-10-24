//! "Verify ABHA" at the registration desk (ABHA V3 SOP §6, §8).
//!
//! 1. `POST /api/abdm/abha/verifications` — find by ABHA number, mobile,
//!    ABHA address or Aadhaar number; ABDM sends an OTP to the person. "Find
//!    by mobile" lists the ABHAs on the mobile first (`abha_find`).
//! 2. `POST …/{id}/otp` — the OTP the person reads out. An ABHA-number login
//!    is then verified; a mobile login lists the ABHAs on that number.
//! 3. `POST …/{id}/account` — after a mobile login, the ABHA chosen.
//! 4. `POST …/{id}/link` — link the verified ABHA to an existing patient.
//!    New registrations link by sending the verification id with the form.
//!
//! ABDM's person tokens live only in server memory, for the minutes they are
//! valid; the browser never sees them. Each verification belongs to the
//! member of staff who started it.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_abdm::{
    AbhaAccountSummary, OtpSystem, RequestOtpRequest, VerifyOtpAuthData, VerifyOtpPayload,
    VerifyOtpRequest, VerifyUserRequest,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use super::abha::{Abdm, connect, map_abdm_error};
use super::abha_address::{full_address, hint, otp_system, request_otp, scope, verify_and_finish};
use super::abha_common::{
    AccountChoice, RESEND_AFTER_SECONDS, VerificationStep, abha_number_display, check_resend,
    digits, env_name, gender_name, keep_token, record_verified, take_token, to_profile, update,
};
use super::abha_enrol::aadhaar_digits;
use super::abha_find::{found_otp_request, pick_found, search, unreachable_method};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// How long a verification can be used to register or link the patient.
const VERIFICATION_LIFETIME_MINUTES: i32 = 30;
/// Wrong OTPs allowed before the verification must start again.
const MAX_OTP_ATTEMPTS: i32 = 5;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VerifyMethod {
    AbhaNumber,
    Mobile,
    /// `name@abdm` — verified through the PHR APIs.
    AbhaAddress,
    /// The Aadhaar number: the OTP goes to the Aadhaar-linked mobile and
    /// ABDM lists the ABHAs on that Aadhaar (SOP §7.2, VRFY_ABHA_401–405).
    Aadhaar,
    /// Search the ABHAs on a mobile, pick one, then its OTP (SOP §7.6.1,
    /// VRFY_ABHA_301–305).
    FindMobile,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OtpVia {
    /// The mobile linked to the person's Aadhaar.
    Aadhaar,
    /// The mobile registered on the ABHA.
    Abdm,
}

#[derive(Debug, Deserialize)]
pub struct StartVerification {
    pub method: VerifyMethod,
    pub value: String,
    pub otp_via: Option<OtpVia>,
}

/// A resend for an Aadhaar login: the number again, never stored.
#[derive(Debug, Default, Deserialize)]
pub struct ResendOtp {
    pub value: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitOtp {
    pub otp: String,
}

#[derive(Debug, Deserialize)]
pub struct ChooseAccount {
    pub abha_number: String,
}

const fn method_name(method: VerifyMethod) -> &'static str {
    match method {
        VerifyMethod::AbhaNumber => "abha_number",
        VerifyMethod::Mobile => "mobile",
        VerifyMethod::AbhaAddress => "abha_address",
        VerifyMethod::Aadhaar => "aadhaar",
        VerifyMethod::FindMobile => "find_mobile",
    }
}

/// `POST /api/abdm/abha/verifications` — send the person an OTP.
///
/// # Errors
/// 403 without `abdm.abha.manage`; 400 for a malformed number; 503 when ABDM
/// is not set up or not answering.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn start(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<StartVerification>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let abdm = connect(&state, claims.tenant_id).await?;
    if body.method == VerifyMethod::FindMobile {
        return search(&state, &claims, &abdm, &body.value).await.map(Json);
    }
    let (login_id, via) = match body.method {
        VerifyMethod::AbhaNumber => {
            let number = abha_number_display(&body.value)
                .ok_or_else(|| AppError::BadRequest("an ABHA number has 14 digits".to_owned()))?;
            (number, otp_system(body.otp_via))
        }
        VerifyMethod::Mobile => {
            let mobile = digits(&body.value);
            if mobile.len() != 10 {
                return Err(AppError::BadRequest(
                    "a mobile number has 10 digits".to_owned(),
                ));
            }
            (mobile, OtpSystem::Abdm)
        }
        VerifyMethod::AbhaAddress => {
            let address = full_address(&body.value, abdm.environment)
                .ok_or_else(|| AppError::BadRequest("enter the ABHA address".to_owned()))?;
            (address, otp_system(body.otp_via.or(Some(OtpVia::Abdm))))
        }
        VerifyMethod::Aadhaar => (aadhaar_digits(&body.value)?, OtpSystem::Aadhaar),
        VerifyMethod::FindMobile => unreachable_method()?,
    };
    let cipher = abdm.encrypt(&login_id)?;
    let sent = request_otp(
        &abdm,
        &RequestOtpRequest {
            scope: scope(body.method, via),
            login_hint: hint(body.method),
            login_id: cipher.clone(),
            otp_system: via,
            txn_id: None,
        },
    )
    .await?;
    // The Aadhaar number is never kept, not even encrypted: a resend asks for it.
    let kept = if body.method == VerifyMethod::Aadhaar {
        String::new()
    } else {
        cipher
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO abha_verifications \
           (tenant_id, created_by, method, otp_system, environment, login_id_cipher, abdm_txn_id, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8)) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(method_name(body.method))
    .bind(if via == OtpSystem::Aadhaar { "aadhaar" } else { "abdm" })
    .bind(env_name(&abdm))
    .bind(&kept)
    .bind(&sent.txn_id)
    .bind(VERIFICATION_LIFETIME_MINUTES)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(VerificationStep::otp_sent(id, sent.message)))
}

#[derive(sqlx::FromRow)]
pub(crate) struct Row {
    method: String,
    otp_system: String,
    login_id_cipher: String,
    pub(crate) abdm_txn_id: String,
    pub(crate) stage: String,
    otp_attempts: i32,
    resend_ready: bool,
    resend_count: i32,
    pub(crate) accounts: Option<serde_json::Value>,
    pub(crate) search_txn_id: Option<String>,
}

/// The caller's own, unexpired verification.
pub(crate) async fn load(state: &AppState, claims: &Claims, id: Uuid) -> Result<Row, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Row>(
        "SELECT method, otp_system, login_id_cipher, abdm_txn_id, stage, otp_attempts, \
                (now() - otp_sent_at) >= make_interval(secs => $4::float8) AS resend_ready, \
                resend_count, accounts, search_txn_id \
         FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 \
           AND expires_at > now() AND linked_patient_id IS NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(RESEND_AFTER_SECONDS)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    row.ok_or_else(|| {
        AppError::BadRequest("this verification has expired — start again".to_owned())
    })
}

/// `POST /api/abdm/abha/verifications/{id}/resend` — another OTP, after a pause.
///
/// # Errors
/// 429 inside the resend pause or after two resends; 400 when the
/// verification is not waiting for an OTP.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn resend(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: axum::body::Bytes,
) -> Result<Json<VerificationStep>, AppError> {
    // An empty body is the usual resend; only an Aadhaar login carries one.
    let body: ResendOtp = serde_json::from_slice(&body).unwrap_or_default();
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let row = load(&state, &claims, id).await?;
    if row.stage != "otp_sent" {
        return Err(AppError::BadRequest(
            "the OTP was already accepted".to_owned(),
        ));
    }
    check_resend(row.resend_ready, row.resend_count)?;
    let (method, via) = parse_row_method(&row);
    let abdm = connect(&state, claims.tenant_id).await?;
    let login_id = if method == VerifyMethod::Aadhaar {
        let typed = body.value.ok_or_else(|| {
            AppError::BadRequest("type the Aadhaar number again to resend its OTP".to_owned())
        })?;
        abdm.encrypt(&aadhaar_digits(&typed)?)?
    } else {
        row.login_id_cipher
    };
    let request = if method == VerifyMethod::FindMobile {
        found_otp_request(login_id, row.search_txn_id.unwrap_or_default())
    } else {
        RequestOtpRequest {
            scope: scope(method, via),
            login_hint: hint(method),
            login_id,
            otp_system: via,
            txn_id: None,
        }
    };
    let sent = request_otp(&abdm, &request).await?;
    update(&state, &claims, id, |q| {
        q.push("abdm_txn_id = ").push_bind(sent.txn_id.clone());
        q.push(", otp_sent_at = now(), otp_attempts = 0, resend_count = resend_count + 1");
    })
    .await?;
    Ok(Json(
        VerificationStep::otp_sent(id, sent.message).resent(row.resend_count + 1),
    ))
}

fn parse_row_method(row: &Row) -> (VerifyMethod, OtpSystem) {
    let method = match row.method.as_str() {
        "mobile" => VerifyMethod::Mobile,
        "abha_address" => VerifyMethod::AbhaAddress,
        "aadhaar" => VerifyMethod::Aadhaar,
        "find_mobile" => VerifyMethod::FindMobile,
        _ => VerifyMethod::AbhaNumber,
    };
    let via = if row.otp_system == "aadhaar" {
        OtpSystem::Aadhaar
    } else {
        OtpSystem::Abdm
    };
    (method, via)
}

/// `POST /api/abdm/abha/verifications/{id}/otp` — check the person's OTP.
///
/// # Errors
/// 400 for a wrong or expired OTP (ABDM's words), or after too many attempts.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit_otp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitOtp>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let otp = digits(&body.otp);
    if otp.len() != 6 {
        return Err(AppError::BadRequest("the OTP has 6 digits".to_owned()));
    }
    let row = load(&state, &claims, id).await?;
    if row.stage != "otp_sent" {
        return Err(AppError::BadRequest(
            "the OTP was already accepted".to_owned(),
        ));
    }
    if row.otp_attempts >= MAX_OTP_ATTEMPTS {
        return Err(AppError::BadRequest(
            "too many wrong OTPs — start the verification again".to_owned(),
        ));
    }
    // Count the attempt before asking ABDM, so a failure cannot be retried for free.
    update(&state, &claims, id, |q| {
        q.push("otp_attempts = otp_attempts + 1");
    })
    .await?;

    let (method, via) = parse_row_method(&row);
    let abdm = connect(&state, claims.tenant_id).await?;
    let request = VerifyOtpRequest {
        scope: scope(method, via),
        auth_data: VerifyOtpAuthData {
            auth_methods: vec!["otp".to_owned()],
            otp: VerifyOtpPayload {
                txn_id: row.abdm_txn_id.clone(),
                otp_value: abdm.encrypt(&otp)?,
            },
        },
    };
    if method == VerifyMethod::AbhaAddress {
        return verify_and_finish(&state, &claims, id, &abdm, &request).await;
    }
    let verified = abdm
        .client
        .verify_login_otp(&abdm.session, &request)
        .await
        .map_err(map_abdm_error)?;
    let token = verified
        .token
        .ok_or_else(|| AppError::ServiceUnavailable("ABDM did not return a session".to_owned()))?;

    // An ABHA-number login answers with the X-token itself; the others with
    // a T-token and the accounts it may open (SOP §7.2, §7.4, §7.6.1.3).
    if method == VerifyMethod::AbhaNumber {
        return finish(&state, &claims, id, &abdm, &token).await;
    }
    let txn = verified.txn_id.unwrap_or(row.abdm_txn_id);
    if method != VerifyMethod::Mobile
        && let [only] = verified.accounts.as_slice()
    {
        // One ABHA (the one picked from a search, or the only one on the
        // Aadhaar): nothing to choose.
        let user = abdm
            .client
            .verify_user(
                &abdm.session,
                &token,
                &VerifyUserRequest {
                    abha_number: abdm.encrypt(&only.abha_number)?,
                    txn_id: txn,
                },
            )
            .await
            .map_err(map_abdm_error)?;
        return finish(&state, &claims, id, &abdm, &user.token).await;
    }
    offer_accounts(
        &state,
        &claims,
        (id, method),
        &token,
        Some(txn),
        verified.accounts,
    )
    .await
}

async fn offer_accounts(
    state: &AppState,
    claims: &Claims,
    (id, method): (Uuid, VerifyMethod),
    t_token: &str,
    txn_id: Option<String>,
    accounts: Vec<AbhaAccountSummary>,
) -> Result<Json<VerificationStep>, AppError> {
    if accounts.is_empty() {
        // VRFY_ABHA_403: say so plainly, and what to do instead.
        return Err(AppError::BadRequest(if method == VerifyMethod::Aadhaar {
            "no ABHA is linked to this Aadhaar number — create one with Create ABHA".to_owned()
        } else {
            "no ABHA is registered on this mobile number — try the Aadhaar number, or create an ABHA"
                .to_owned()
        }));
    }
    keep_token(id, t_token);
    let stored = serde_json::to_value(&accounts)
        .map_err(|e| AppError::Internal(format!("accounts json: {e}")))?;
    update(state, claims, id, |q| {
        q.push("stage = 'choose_account', accounts = ")
            .push_bind(stored);
        if let Some(txn) = txn_id {
            q.push(", abdm_txn_id = ").push_bind(txn);
        }
    })
    .await?;
    let choices = accounts
        .into_iter()
        .map(|a| AccountChoice {
            abha_number: a.abha_number,
            abha_address: a.preferred_abha_address,
            name: a.name,
            gender: a.gender.as_deref().map(gender_name).map(str::to_owned),
            year_of_birth: a
                .dob
                .as_deref()
                .and_then(|d| d.rsplit('-').next())
                .map(str::to_owned),
        })
        .collect();
    Ok(Json(VerificationStep {
        id,
        stage: "choose_account",
        message: None,
        resend_after_seconds: None,
        resends_left: None,
        accounts: choices,
        profile: None,
        already_linked: None,
        suggestions: Vec::new(),
    }))
}

/// `POST /api/abdm/abha/verifications/{id}/account` — the ABHA chosen after a
/// mobile login.
///
/// # Errors
/// 400 when the number is not one ABDM offered, or the session lapsed.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn choose_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChooseAccount>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let row = load(&state, &claims, id).await?;
    if row.stage == "search_results" {
        return pick_found(&state, &claims, id, row, &body.abha_number)
            .await
            .map(Json);
    }
    let offered: Vec<AbhaAccountSummary> = row
        .accounts
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let chosen = offered
        .iter()
        .find(|a| digits(&a.abha_number) == digits(&body.abha_number))
        .ok_or_else(|| AppError::BadRequest("choose one of the ABHAs ABDM listed".to_owned()))?;
    if row.stage != "choose_account" {
        return Err(AppError::BadRequest(
            "this verification is not choosing an ABHA".to_owned(),
        ));
    }
    let t_token = take_token(id).ok_or_else(|| {
        AppError::BadRequest("that took too long — verify the mobile again".to_owned())
    })?;
    let abdm = connect(&state, claims.tenant_id).await?;
    let user = abdm
        .client
        .verify_user(
            &abdm.session,
            &t_token,
            &VerifyUserRequest {
                abha_number: abdm.encrypt(&chosen.abha_number)?,
                txn_id: row.abdm_txn_id,
            },
        )
        .await
        .map_err(map_abdm_error)?;
    finish(&state, &claims, id, &abdm, &user.token).await
}

/// Fetch the profile with the person's X-token and record the verification.
async fn finish(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    x_token: &str,
) -> Result<Json<VerificationStep>, AppError> {
    let raw = abdm
        .client
        .profile(&abdm.session, x_token)
        .await
        .map_err(map_abdm_error)?;
    let profile = to_profile(raw)?;
    // Kept for printing the ABHA card while ABDM's token lasts.
    keep_token(id, x_token);
    record_verified(state, claims, id, profile).await
}
