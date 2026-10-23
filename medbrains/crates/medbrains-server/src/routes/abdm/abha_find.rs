//! "Find ABHA by mobile" at the desk (ABHA V3 SOP §7.6.1; M1 test cases
//! VRFY_ABHA_301–305): the person gives a mobile, ABDM lists the ABHAs on
//! it — numbers masked, no OTP yet — staff pick the patient's, and only
//! then does ABDM send an OTP, to that ABHA's mobile. From the OTP on it
//! is a verification like any other (`abha_verify`).

use medbrains_abdm::{
    ABHA_LOGIN_SCOPE, LoginHint, MOBILE_VERIFY_SCOPE, OtpSystem, RequestOtpRequest,
    account::{SEARCH_ABHA_SCOPE, SearchedAbha},
};
use uuid::Uuid;

use super::abha::{Abdm, connect, map_abdm_error};
use super::abha_address::request_otp;
use super::abha_common::{AccountChoice, VerificationStep, digits, env_name, gender_name, update};
use super::abha_verify::Row;
use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// How long a search can be used to pick an ABHA and verify it.
const SEARCH_LIFETIME_MINUTES: i32 = 30;

/// The OTP request for the account at `index_cipher`, chained to `search_txn`.
pub(super) fn found_otp_request(index_cipher: String, search_txn: String) -> RequestOtpRequest {
    RequestOtpRequest {
        scope: vec![
            ABHA_LOGIN_SCOPE.to_owned(),
            SEARCH_ABHA_SCOPE.to_owned(),
            MOBILE_VERIFY_SCOPE.to_owned(),
        ],
        login_hint: LoginHint::Index,
        login_id: index_cipher,
        otp_system: OtpSystem::Abdm,
        txn_id: Some(search_txn),
    }
}

/// "Find by mobile" never reaches the plain OTP start.
pub(super) fn unreachable_method() -> Result<(String, OtpSystem), AppError> {
    Err(AppError::Internal(
        "find-by-mobile is a search, not an OTP login".to_owned(),
    ))
}

fn choices(found: &[SearchedAbha]) -> Vec<AccountChoice> {
    found
        .iter()
        .map(|a| AccountChoice {
            abha_number: a.abha_number.clone(),
            abha_address: None,
            name: a.name.clone(),
            gender: a.gender.as_deref().map(gender_name).map(str::to_owned),
            year_of_birth: None,
        })
        .collect()
}

/// Search the mobile and keep what ABDM listed, waiting for a pick.
///
/// # Errors
/// 400 for a malformed mobile, or when no ABHA is registered on it
/// (VRFY_ABHA_303); 503 when ABDM is not answering.
pub(super) async fn search(
    state: &AppState,
    claims: &Claims,
    abdm: &Abdm,
    mobile: &str,
) -> Result<VerificationStep, AppError> {
    let mobile = digits(mobile);
    if mobile.len() != 10 {
        return Err(AppError::BadRequest(
            "a mobile number has 10 digits".to_owned(),
        ));
    }
    let cipher = abdm.encrypt(&mobile)?;
    let found = abdm
        .client
        .search_abha(&abdm.session, &cipher)
        .await
        .map_err(map_abdm_error)?;
    if found.accounts.is_empty() || found.txn_id.is_empty() {
        return Err(AppError::BadRequest(
            "no ABHA is registered on this mobile number — try the Aadhaar number, or create an ABHA"
                .to_owned(),
        ));
    }
    let stored = serde_json::to_value(&found.accounts)
        .map_err(|e| AppError::Internal(format!("search json: {e}")))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO abha_verifications \
           (tenant_id, created_by, method, otp_system, environment, login_id_cipher, abdm_txn_id, \
            search_txn_id, stage, accounts, expires_at) \
         VALUES ($1, $2, 'find_mobile', 'abdm', $3, $4, $5, $5, 'search_results', $6, \
                 now() + make_interval(mins => $7)) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(env_name(abdm))
    .bind(&cipher)
    .bind(&found.txn_id)
    .bind(stored)
    .bind(SEARCH_LIFETIME_MINUTES)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(VerificationStep {
        id,
        stage: "search_results",
        message: Some(format!(
            "{} ABHA{} on this mobile. Ask the patient which is theirs.",
            found.accounts.len(),
            if found.accounts.len() == 1 {
                " is"
            } else {
                "s are"
            }
        )),
        resend_after_seconds: None,
        resends_left: None,
        accounts: choices(&found.accounts),
        profile: None,
        already_linked: None,
        suggestions: Vec::new(),
    })
}

/// The ABHA picked from the search: ABDM sends its OTP.
///
/// # Errors
/// 400 when the pick is not one ABDM listed; ABDM's refusal as from
/// [`map_abdm_error`].
pub(super) async fn pick_found(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    row: Row,
    abha_number: &str,
) -> Result<VerificationStep, AppError> {
    let listed: Vec<SearchedAbha> = row
        .accounts
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let picked = listed
        .iter()
        .find(|a| a.abha_number == abha_number.trim())
        .ok_or_else(|| AppError::BadRequest("choose one of the ABHAs ABDM listed".to_owned()))?;
    let abdm = connect(state, claims.tenant_id).await?;
    let index_cipher = abdm.encrypt(&picked.index.to_string())?;
    let search_txn = row.search_txn_id.unwrap_or(row.abdm_txn_id);
    let sent = request_otp(&abdm, &found_otp_request(index_cipher.clone(), search_txn)).await?;
    update(state, claims, id, |q| {
        q.push("stage = 'otp_sent', otp_sent_at = now(), otp_attempts = 0, resend_count = 0, ")
            .push("accounts = NULL, abdm_txn_id = ")
            .push_bind(sent.txn_id.clone())
            .push(", login_id_cipher = ")
            .push_bind(index_cipher);
    })
    .await?;
    Ok(VerificationStep::otp_sent(id, sent.message))
}
