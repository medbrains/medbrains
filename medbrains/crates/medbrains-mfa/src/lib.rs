//! TOTP multi-factor authentication (audit P0 #5).
//!
//! Enrollment: POST /auth/mfa/enroll generates a secret (stored, not
//! yet active) and returns the otpauth URI + QR PNG; POST
//! /auth/mfa/activate verifies the first code, flips `mfa_enabled`,
//! and returns one-time recovery codes (SHA-256 hashes stored).
//! Login verification lives in auth.rs — the client resubmits
//! credentials with `mfa_code` (TOTP or an unused recovery code).
//!
//! Enforcement: tenant setting `security.mfa_required_roles` (JSON
//! array of role names). /auth/me reports `mfa_enrollment_required`
//! and the frontend blocks the app until enrollment completes.

use axum::{Extension, Json, extract::State};
use axum::routing::{post};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use totp_rs::{Algorithm, Secret, TOTP};
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

const RECOVERY_CODE_COUNT: usize = 8;

pub(crate) fn build_totp(secret_b32: &str, account: &str) -> Result<TOTP, AppError> {
    let secret = Secret::Encoded(secret_b32.to_owned())
        .to_bytes()
        .map_err(|e| AppError::Internal(format!("mfa secret decode: {e:?}")))?;
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret,
        Some("MedBrains".to_owned()),
        account.to_owned(),
    )
    .map_err(|e| AppError::Internal(format!("mfa totp build: {e}")))
}

fn hash_recovery_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify a TOTP code or consume a recovery code for `user_id`.
/// Returns Ok(false) when neither matches.
pub async fn verify_mfa_code(
    db: &sqlx::PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<bool, AppError> {
    let row: Option<(Option<String>, String, serde_json::Value)> =
        sqlx::query_as("SELECT mfa_secret, username, mfa_recovery_codes FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(db)
            .await?;
    let Some((Some(secret), username, recovery)) = row else {
        return Ok(false);
    };

    let code = code.trim();
    let totp = build_totp(&secret, &username)?;
    if totp
        .check_current(code)
        .map_err(|e| AppError::Internal(format!("mfa time error: {e}")))?
    {
        return Ok(true);
    }

    // Recovery code: single-use, removed on match.
    let code_hash = hash_recovery_code(code);
    let hashes: Vec<String> = serde_json::from_value(recovery).unwrap_or_default();
    if hashes.contains(&code_hash) {
        let remaining: Vec<&String> = hashes.iter().filter(|h| **h != code_hash).collect();
        sqlx::query("UPDATE users SET mfa_recovery_codes = $1 WHERE id = $2")
            .bind(serde_json::json!(remaining))
            .bind(user_id)
            .execute(db)
            .await?;
        tracing::warn!(%user_id, "MFA recovery code consumed");
        return Ok(true);
    }

    Ok(false)
}

/// Is MFA mandated for this role by tenant policy?
pub async fn mfa_required_for_role(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    role: &str,
) -> Result<bool, AppError> {
    let required: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'security' AND key = 'mfa_required_roles'",
    )
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;
    Ok(required
        .and_then(|v| serde_json::from_value::<Vec<String>>(v).ok())
        .is_some_and(|roles| roles.iter().any(|r| r == role)))
}

/// POST /api/auth/mfa/enroll — generate (or regenerate) a pending secret.
pub async fn enroll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await?;

    // 20 random bytes per RFC 4226 — totp-rs's gencode feature pulls in
    // rand; getrandom is already our entropy source elsewhere.
    let mut secret_bytes = [0u8; 20];
    getrandom::fill(&mut secret_bytes)
        .map_err(|e| AppError::Internal(format!("mfa secret gen: {e}")))?;
    let secret_b32 = Secret::Raw(secret_bytes.to_vec()).to_encoded().to_string();
    let totp = build_totp(&secret_b32, &username)?;
    let otpauth_url = totp.get_url();
    let qr_png_base64 = totp
        .get_qr_base64()
        .map_err(|e| AppError::Internal(format!("mfa qr: {e}")))?;

    // Pending until the first code verifies — re-enroll overwrites but
    // never silently disables an active factor.
    sqlx::query("UPDATE users SET mfa_secret = $1 WHERE id = $2 AND mfa_enabled = false")
        .bind(&secret_b32)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "secret": secret_b32,
        "otpauth_url": otpauth_url,
        "qr_png_base64": qr_png_base64,
    })))
}

#[derive(Debug, Deserialize)]
pub struct MfaCodeBody {
    pub code: String,
}

/// POST /api/auth/mfa/activate — verify the first code, enable MFA,
/// return one-time recovery codes.
pub async fn activate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MfaCodeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row: Option<(Option<String>, String, bool)> =
        sqlx::query_as("SELECT mfa_secret, username, mfa_enabled FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&state.db)
            .await?;
    let Some((Some(secret), username, enabled)) = row else {
        return Err(AppError::BadRequest("Enroll first".to_owned()));
    };
    if enabled {
        return Err(AppError::Conflict("MFA already active".to_owned()));
    }

    let totp = build_totp(&secret, &username)?;
    if !totp
        .check_current(body.code.trim())
        .map_err(|e| AppError::Internal(format!("mfa time error: {e}")))?
    {
        return Err(AppError::BadRequest("Invalid code".to_owned()));
    }

    let mut codes = Vec::with_capacity(RECOVERY_CODE_COUNT);
    let mut hashes = Vec::with_capacity(RECOVERY_CODE_COUNT);
    for _ in 0..RECOVERY_CODE_COUNT {
        let mut buf = [0u8; 5];
        getrandom::fill(&mut buf)
            .map_err(|e| AppError::Internal(format!("recovery code gen: {e}")))?;
        let code = hex::encode(buf);
        hashes.push(hash_recovery_code(&code));
        codes.push(code);
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("UPDATE users SET mfa_enabled = true, mfa_recovery_codes = $1 WHERE id = $2")
        .bind(serde_json::json!(hashes))
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "mfa_enabled",
            entity_type: "user",
            entity_id: Some(claims.sub),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "recovery_codes": codes,
    })))
}

/// POST /api/auth/mfa/disable — requires a valid current code.
pub async fn disable(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MfaCodeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !verify_mfa_code(&state.db, claims.sub, &body.code).await? {
        return Err(AppError::BadRequest("Invalid code".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE users SET mfa_enabled = false, mfa_secret = NULL, \
         mfa_recovery_codes = '[]'::jsonb WHERE id = $1",
    )
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "mfa_disabled",
            entity_type: "user",
            entity_id: Some(claims.sub),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// mfa routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/auth/mfa/enroll", post(enroll))
        .route("/api/auth/mfa/activate", post(activate))
        .route("/api/auth/mfa/disable", post(disable))
}
