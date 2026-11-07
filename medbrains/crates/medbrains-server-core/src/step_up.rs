//! Step-up re-authentication (auth-revamp Pillar 3).
//!
//! The caller re-proves identity (password now; MFA later) for a short 5-minute
//! window before a high-risk action (controlled-drug dispense, prescription sign,
//! admin privilege change, clinical break-glass). The proof is a purpose-scoped,
//! short-lived Ed25519 token, checked by `require_step_up` at the top of a
//! sensitive handler — it returns `StepUpRequired` (403 `step_up_required`) so
//! the client can prompt for re-auth and retry.
//!
//! Two carriers, one token:
//! - **Browser** (cookie session): the token rides in the `step_up` cookie.
//! - **Native app** (bearer session): Android refuses a `Secure` cookie over
//!   plain HTTP, so the token comes back in the body and the app sends it in
//!   the `X-Step-Up-Token` header. That token is bound to the bearer session it
//!   was minted under (a hash of the access token), so it cannot be replayed
//!   from another sign-in, another device, or after the session is refreshed.

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    Extension, Json,
    extract::{FromRequestParts, State},
    http::request::Parts,
};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::{AuthMethod, Claims},
    middleware::cookies::build_step_up_cookie,
    state::AppState,
};

const STEP_UP_PURPOSE: &str = "step_up";
const STEP_UP_TTL_SECS: i64 = 300; // 5 minutes
/// The header a native app sends its step-up token in.
pub const STEP_UP_HEADER: &str = "x-step-up-token";

#[derive(Serialize, Deserialize)]
struct StepUpClaims {
    sub: Uuid,
    tenant_id: Uuid,
    #[serde(default)]
    purpose: String,
    /// The bearer session this proof belongs to; absent on a browser's cookie.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sid: Option<String>,
    exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct StepUpRequest {
    pub password: String,
}

/// What a request carries that could prove a recent step-up.
///
/// An extractor, so a handler takes it in place of a `CookieJar` and
/// `require_step_up` sees both carriers and the session they must match.
#[derive(Debug, Default)]
pub struct StepUpProof {
    cookie: Option<String>,
    header: Option<String>,
    /// Hash of the bearer access token this request was made with.
    session: Option<String>,
}

impl<S: Send + Sync> FromRequestParts<S> for StepUpProof {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jar = CookieJar::from_request_parts(parts, state).await?;
        let header = |name: &str| {
            parts
                .headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned)
        };
        Ok(Self {
            cookie: jar.get("step_up").map(|c| c.value().to_owned()),
            header: header(STEP_UP_HEADER),
            session: header("authorization")
                .as_deref()
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(session_id),
        })
    }
}

/// A short, one-way name for a bearer session: the token itself never leaves
/// the request, and a stolen step-up token names no usable credential.
fn session_id(bearer: &str) -> String {
    Sha256::digest(bearer.as_bytes()).iter().take(16).fold(
        String::with_capacity(32),
        |mut acc, b| {
            use std::fmt::Write as _;
            let _ = write!(acc, "{b:02x}");
            acc
        },
    )
}

/// Sign a step-up proof for `claims`, bound to `sid` when it is a bearer session.
fn mint_step_up(
    claims: &Claims,
    sid: Option<String>,
    key: &jsonwebtoken::EncodingKey,
) -> Result<String, AppError> {
    let payload = StepUpClaims {
        sub: claims.sub,
        tenant_id: claims.tenant_id,
        purpose: STEP_UP_PURPOSE.to_owned(),
        sid,
        exp: (Utc::now().timestamp() + STEP_UP_TTL_SECS) as usize,
    };
    let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::EdDSA);
    jsonwebtoken::encode(&header, &payload, key)
        .map_err(|e| AppError::Internal(format!("step-up encode: {e}")))
}

/// POST /api/auth/step-up — verify the caller's password, then hand back the
/// 5-minute proof: a `step_up` cookie to a browser, or `step_up_token` in the
/// body, bound to this bearer session, to a native app.
pub async fn step_up(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    method: Option<Extension<AuthMethod>>,
    proof: StepUpProof,
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
    .ok_or_else(|| {
        AppError::ForbiddenReason("This account signs in without a password.".to_owned())
    })?;
    // A wrong password is a refused step-up, not a dead session: 403, never
    // 401. A 401 here made the web client clear its CSRF token and the native
    // apps sign the doctor out, for a typo.
    let wrong = || AppError::ForbiddenReason("That password is not right.".to_owned());
    let parsed = PasswordHash::new(&hash).map_err(|_| wrong())?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .map_err(|_| wrong())?;

    let bearer = matches!(method.map(|Extension(m)| m), Some(AuthMethod::Bearer));
    if let (true, Some(sid)) = (bearer, proof.session) {
        let token = mint_step_up(&claims, Some(sid), &state.jwt_encoding_key)?;
        let body = serde_json::json!({ "status": "ok", "step_up_token": token });
        return Ok((jar, Json(body)));
    }
    let token = mint_step_up(&claims, None, &state.jwt_encoding_key)?;
    let jar = jar.add(build_step_up_cookie(&token, &state.cookie_config));
    Ok((jar, Json(serde_json::json!({ "status": "ok" }))))
}

/// Guard for high-risk handlers: a fresh step-up by this user.
///
/// Returns `StepUpRequired` when the proof is absent, stale, for another
/// user, for another purpose, or (a header token) for another session.
pub fn require_step_up(
    state: &AppState,
    proof: &StepUpProof,
    claims: &Claims,
) -> Result<(), AppError> {
    if let Some(token) = &proof.header {
        let data = decode(state, token)?;
        // A header token is only ever minted for a bearer session; one
        // without a session, or for another, is not this caller's.
        if data.sid.is_none() || data.sid != proof.session {
            return Err(AppError::StepUpRequired);
        }
        return check_subject(&data, claims);
    }
    let token = proof.cookie.as_deref().ok_or(AppError::StepUpRequired)?;
    let data = decode(state, token)?;
    if data.sid.is_some() {
        return Err(AppError::StepUpRequired);
    }
    check_subject(&data, claims)
}

/// Verify a step-up token's signature and expiry.
fn decode(state: &AppState, token: &str) -> Result<StepUpClaims, AppError> {
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::EdDSA);
    validation.validate_aud = false;
    validation.leeway = 0;
    jsonwebtoken::decode::<StepUpClaims>(token, &state.jwt_decoding_key, &validation)
        .map(|d| d.claims)
        .map_err(|_| AppError::StepUpRequired)
}

/// The proof must be a step-up, for this user, in this hospital.
fn check_subject(data: &StepUpClaims, claims: &Claims) -> Result<(), AppError> {
    if data.purpose != STEP_UP_PURPOSE
        || data.sub != claims.sub
        || data.tenant_id != claims.tenant_id
    {
        return Err(AppError::StepUpRequired);
    }
    Ok(())
}
