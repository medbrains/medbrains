//! Step-up re-authentication (auth-revamp Pillar 3).
//!
//! The caller re-proves identity (password now; MFA later) for a short 5-minute
//! window before a high-risk action (controlled-drug dispense, prescription sign,
//! admin privilege change, clinical break-glass). The proof is a purpose-scoped,
//! short-lived Ed25519 token in the `step_up` cookie, checked by `require_step_up`
//! at the top of a sensitive handler — it returns `StepUpRequired` (403
//! `step_up_required`) so the client can prompt for re-auth and retry.

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{Extension, Json, extract::State};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::cookies::build_step_up_cookie,
    state::AppState,
};

const STEP_UP_PURPOSE: &str = "step_up";
const STEP_UP_TTL_SECS: i64 = 300; // 5 minutes

#[derive(Serialize, Deserialize)]
struct StepUpClaims {
    sub: Uuid,
    tenant_id: Uuid,
    #[serde(default)]
    purpose: String,
    exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct StepUpRequest {
    pub password: String,
}

fn mint_step_up(claims: &Claims, key: &jsonwebtoken::EncodingKey) -> Result<String, AppError> {
    let payload = StepUpClaims {
        sub: claims.sub,
        tenant_id: claims.tenant_id,
        purpose: STEP_UP_PURPOSE.to_owned(),
        exp: (Utc::now().timestamp() + STEP_UP_TTL_SECS) as usize,
    };
    let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::EdDSA);
    jsonwebtoken::encode(&header, &payload, key)
        .map_err(|e| AppError::Internal(format!("step-up encode: {e}")))
}

/// POST /api/auth/step-up — verify the caller's password, set a 5-min step-up cookie.
pub async fn step_up(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: CookieJar,
    Json(req): Json<StepUpRequest>,
) -> Result<(CookieJar, Json<serde_json::Value>), AppError> {
    // SSO-only users have no password_hash — password step-up isn't available to
    // them (MFA/passkey step-up is a follow-up); treat as unauthorized here.
    // Scoped: `users` is row-level secured, and a read that finds nothing here
    // is refused rather than let through — so unscoped this would lock every
    // caller out of step-up rather than let anybody past it. Broken in the
    // safe direction, and still broken.
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let hash = sqlx::query_scalar::<_, Option<String>>(
        "SELECT password_hash FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .flatten()
    .ok_or(AppError::Unauthorized)?;
    let parsed = PasswordHash::new(&hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let token = mint_step_up(&claims, &state.jwt_encoding_key)?;
    let jar = jar.add(build_step_up_cookie(&token, &state.cookie_config));
    Ok((jar, Json(serde_json::json!({ "status": "ok" }))))
}

/// Guard for high-risk handlers: require a fresh, valid step-up proof for the
/// current user. Returns `StepUpRequired` when absent, stale, or a different user.
pub fn require_step_up(state: &AppState, jar: &CookieJar, claims: &Claims) -> Result<(), AppError> {
    let token = jar
        .get("step_up")
        .map(|c| c.value().to_owned())
        .ok_or(AppError::StepUpRequired)?;
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::EdDSA);
    validation.validate_aud = false;
    let data = jsonwebtoken::decode::<StepUpClaims>(&token, &state.jwt_decoding_key, &validation)
        .map_err(|_| AppError::StepUpRequired)?;
    if data.claims.purpose != STEP_UP_PURPOSE || data.claims.sub != claims.sub {
        return Err(AppError::StepUpRequired);
    }
    Ok(())
}

/// What a second person's password check came to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PasswordCheck {
    /// Their own password: the failure count is cleared.
    Right,
    /// Not their password: counted against their account, which may now lock.
    Wrong,
    /// Their account is locked; the password was not even tried.
    Locked,
}

/// Checks `password` against this user's own, under the shared lockout.
///
/// For a second person who confirms an action at the first person's screen:
/// the witness to a controlled-drug dispense types their own password. It is
/// the sign-in counter (`lockout`): a locked account is refused before the
/// password is tried, a wrong password counts towards the lock and is audited
/// as `action`, a right one clears the count. A user with no password (SSO
/// only), or of another hospital, is `Wrong`.
pub async fn check_user_password(
    state: &AppState,
    (user_id, tenant_id): (Uuid, Uuid),
    password: &str,
    action: &str,
) -> Result<PasswordCheck, AppError> {
    let account = (user_id, tenant_id);
    if crate::lockout::is_locked(state, account).await? {
        return Ok(PasswordCheck::Locked);
    }
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let hash = sqlx::query_scalar::<_, Option<String>>(
        "SELECT password_hash FROM users \
          WHERE id = $1 AND tenant_id = $2 AND is_active AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .flatten();
    drop(conn);
    let right = hash.as_deref().is_some_and(|hash| {
        PasswordHash::new(hash).is_ok_and(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
    });
    if right {
        crate::lockout::clear_failed_passwords(state, account).await?;
        return Ok(PasswordCheck::Right);
    }
    // An account that is not there has no counter to add to.
    if hash.is_some() {
        crate::lockout::record_failed_password(state, account, None, action).await?;
    }
    Ok(PasswordCheck::Wrong)
}
