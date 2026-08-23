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
