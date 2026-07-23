use std::collections::HashMap;

use argon2::{
    Argon2, PasswordHash, PasswordVerifier,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use axum::http::HeaderMap;
use axum::{Extension, Json, extract::State, response::IntoResponse};
use axum::routing::{get, post};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::{Claims, encode_jwt},
        cookies::{build_access_cookie, build_csrf_cookie, build_refresh_cookie, clear_cookie},
        field_access,
    },
    state::AppState,
};

// ── Login ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    /// TOTP or recovery code — required on resubmit when the first
    /// attempt answers `mfa_required`.
    pub mfa_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub must_change_password: bool,
    pub email_verified: bool,
}

const MAX_FAILED_LOGINS: i32 = 5;
const LOCKOUT_MINUTES: i32 = 15;

/// Increment the per-account failure counter; lock the account once the
/// threshold is reached and write an audit entry for the lockout.
async fn record_failed_login(
    state: &AppState,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let now_locked: bool = sqlx::query_scalar(
        "UPDATE users SET \
           failed_login_attempts = failed_login_attempts + 1, \
           locked_until = CASE \
             WHEN failed_login_attempts + 1 >= $2 \
             THEN now() + make_interval(mins => $3) \
             ELSE locked_until END \
         WHERE id = $1 \
         RETURNING failed_login_attempts >= $2",
    )
    .bind(user_id)
    .bind(MAX_FAILED_LOGINS)
    .bind(LOCKOUT_MINUTES)
    .fetch_one(&state.db)
    .await?;

    if now_locked {
        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id,
                user_id: Some(user_id),
                action: "account_locked",
                entity_type: "user",
                entity_id: Some(user_id),
                old_values: None,
                new_values: None,
                ip_address: None,
            },
        )
        .await
        .map_err(AppError::from)?;
        tx.commit().await?;
        tracing::warn!(%user_id, "account locked after repeated failed logins");
    }

    Ok(())
}

/// Runtime query (no .sqlx metadata) — column added in 0144.
async fn fetch_must_change_password(db: &PgPool, user_id: Uuid) -> Result<bool, AppError> {
    Ok(
        sqlx::query_scalar::<_, bool>("SELECT must_change_password FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(db)
            .await?
            .unwrap_or(false),
    )
}

async fn fetch_email_verified(db: &PgPool, user_id: Uuid) -> Result<bool, AppError> {
    Ok(
        sqlx::query_scalar::<_, bool>("SELECT email_verified FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(db)
            .await?
            .unwrap_or(false),
    )
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    pub user: UserInfo,
    pub csrf_token: String,
    pub permissions: Vec<String>,
    pub department_ids: Vec<Uuid>,
    pub field_access: HashMap<String, String>,
}

/// Generate a cryptographically random CSRF token (32 bytes → 64 hex chars).
fn generate_csrf_token() -> Result<String, AppError> {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("CSRF token generation failed: {e}")))?;
    Ok(hex::encode(buf))
}

fn field_access_to_wire(
    field_access_map: HashMap<String, medbrains_core::form::FieldAccessLevel>,
) -> HashMap<String, String> {
    field_access_map
        .into_iter()
        .map(|(k, v)| {
            let s = match v {
                medbrains_core::form::FieldAccessLevel::Edit => "edit",
                medbrains_core::form::FieldAccessLevel::View => "view",
                medbrains_core::form::FieldAccessLevel::Mask => "mask",
                medbrains_core::form::FieldAccessLevel::Hidden => "hidden",
            };
            (k, s.to_owned())
        })
        .collect()
}

fn wants_native_token_response(headers: &HeaderMap) -> bool {
    matches!(
        headers
            .get("x-medbrains-client")
            .and_then(|value| value.to_str().ok()),
        Some(value)
            if value.starts_with("mobile-")
                || value == "mobile"
                || value.starts_with("desktop-")
                || value == "desktop"
    )
}

/// SSO-first tenant policy: when `tenant_settings(auth, password_login_disabled)`
/// is true, password login is refused for everyone except the break-glass admin
/// named in `tenant_settings(auth, break_glass_username)`. Returns true if this
/// password attempt must be rejected. Absent settings = passwords allowed (default).
async fn password_login_blocked(
    db: &PgPool,
    tenant_id: Uuid,
    username: &str,
) -> Result<bool, AppError> {
    let disabled: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'auth' AND key = 'password_login_disabled'",
    )
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;
    let is_disabled =
        disabled.is_some_and(|v| v.as_bool() == Some(true) || v.as_str() == Some("true"));
    if !is_disabled {
        return Ok(false);
    }
    // Passwords disabled — allow only the break-glass admin through.
    let break_glass: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'auth' AND key = 'break_glass_username'",
    )
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;
    let break_glass = break_glass.and_then(|v| v.as_str().map(str::to_owned));
    Ok(break_glass.as_deref() != Some(username))
}

#[allow(clippy::too_many_lines)]
pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<axum::response::Response, AppError> {
    // Find user by username (across all tenants — login does not require tenant context)
    let row = sqlx::query!(
        "SELECT id, tenant_id, username, email, password_hash, full_name, \
         role::text AS \"role!\", is_active, perm_version \
         FROM users WHERE username = $1",
        body.username
    )
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::Unauthorized);
    };

    if !row.is_active {
        return Err(AppError::Unauthorized);
    }

    // SSO-first policy: when the tenant disables password login, only the
    // designated break-glass admin may still use a password — everyone else
    // must sign in via SSO (so an IdP outage can't lock the hospital out).
    if password_login_blocked(&state.db, row.tenant_id, &body.username).await? {
        return Err(AppError::BadRequest(
            "This organization requires single sign-on. Please sign in with SSO.".to_owned(),
        ));
    }

    // Per-account lockout — independent of the per-IP rate limit so a
    // distributed credential-stuffing run still locks the account.
    let locked: bool = sqlx::query_scalar(
        "SELECT locked_until IS NOT NULL AND locked_until > now() FROM users WHERE id = $1",
    )
    .bind(row.id)
    .fetch_one(&state.db)
    .await?;
    if locked {
        return Err(AppError::BadRequest(
            "Account temporarily locked after repeated failed logins. Try again later.".to_owned(),
        ));
    }

    // Verify password. An account provisioned through SSO carries no local
    // hash (0200_sso_foundation dropped the NOT NULL), and password login is
    // simply not a route it has.
    let Some(ref password_hash) = row.password_hash else {
        return Err(AppError::BadRequest(
            "This account signs in with single sign-on. Please use SSO.".to_owned(),
        ));
    };
    let parsed_hash = PasswordHash::new(password_hash).map_err(|_| AppError::Unauthorized)?;
    if Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        record_failed_login(&state, row.id, row.tenant_id).await?;
        return Err(AppError::Unauthorized);
    }

    // MFA gate — when enabled, credentials alone never open a session.
    // The client resubmits the same credentials with mfa_code.
    let mfa_enabled: bool = sqlx::query_scalar("SELECT mfa_enabled FROM users WHERE id = $1")
        .bind(row.id)
        .fetch_one(&state.db)
        .await?;
    if mfa_enabled {
        match body
            .mfa_code
            .as_deref()
            .map(str::trim)
            .filter(|code| !code.is_empty())
        {
            None => {
                return Ok(Json(serde_json::json!({ "mfa_required": true })).into_response());
            }
            Some(code) => {
                if !medbrains_mfa::verify_mfa_code(&state.db, row.id, code).await? {
                    record_failed_login(&state, row.id, row.tenant_id).await?;
                    return Err(AppError::Unauthorized);
                }
            }
        }
    }

    // Successful login clears the failure counter.
    sqlx::query(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL \
         WHERE id = $1 AND (failed_login_attempts > 0 OR locked_until IS NOT NULL)",
    )
    .bind(row.id)
    .execute(&state.db)
    .await?;

    // Resolve effective permissions from role
    let permissions = resolve_permissions(&state.db, row.tenant_id, row.id, &row.role).await?;

    // Resolve department_ids for scoping
    let department_ids =
        resolve_department_ids(&state.db, row.tenant_id, row.id, &row.role).await?;
    let include_native_tokens = wants_native_token_response(&headers);

    let field_access = field_access_to_wire(
        field_access::resolve_restricted_fields(&state.db, row.tenant_id, row.id, &row.role)
            .await?,
    );

    // Issue access token (15 min)
    let now = Utc::now();
    let access_claims = Claims {
        sub: row.id,
        tenant_id: row.tenant_id,
        role: row.role.clone(),
        // permissions are resolved per-request by middleware, not embedded.
        permissions: Vec::new(),
        department_ids: department_ids.clone(),
        perm_version: row.perm_version,
        exp: (now + chrono::Duration::minutes(15)).timestamp() as usize,
    };
    let access_token = encode_jwt(&access_claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))?;

    // Issue refresh token (7 days)
    let refresh_raw = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_raw.as_bytes());
    let refresh_hash = hex::encode(hasher.finalize());

    let expires_at = now + chrono::Duration::days(7);

    // Store refresh token — set tenant context for RLS
    let device_fp = extract_device_fingerprint(&headers);
    let client_ip = extract_client_ip(&headers);
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;

    // Enforce concurrent session limit: max 5 active tokens per user
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true \
         WHERE user_id = $1 AND revoked = false AND id NOT IN \
         (SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked = false \
          ORDER BY created_at DESC LIMIT 4)",
        row.id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "INSERT INTO refresh_tokens \
         (tenant_id, user_id, token_hash, expires_at, device_fingerprint, ip_address, user_agent) \
         VALUES ($1, $2, $3, $4, $5, NULLIF($6::text, '')::inet, $7)",
        row.tenant_id,
        row.id,
        refresh_hash,
        expires_at,
        device_fp,
        client_ip.as_deref(),
        user_agent.as_deref()
    )
    .execute(&mut *tx)
    .await?;

    // Audit log
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: row.tenant_id,
            user_id: Some(row.id),
            action: "login",
            entity_type: "user",
            entity_id: Some(row.id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    // Generate CSRF token
    let csrf_token = generate_csrf_token()?;

    // Build cookie-based response
    let cfg = &state.cookie_config;
    let jar = CookieJar::new()
        .add(build_access_cookie(&access_token, cfg))
        .add(build_refresh_cookie(&refresh_raw, cfg))
        .add(build_csrf_cookie(&csrf_token, cfg));

    let must_change_password = fetch_must_change_password(&state.db, row.id).await?;
    let email_verified = fetch_email_verified(&state.db, row.id).await?;

    let body = LoginResponse {
        token: include_native_tokens.then(|| access_token.clone()),
        refresh_token: include_native_tokens.then(|| refresh_raw.clone()),
        user: UserInfo {
            id: row.id,
            tenant_id: row.tenant_id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            role: row.role,
            must_change_password,
            email_verified,
        },
        csrf_token,
        permissions,
        department_ids,
        field_access,
    };

    Ok((jar, Json(body)).into_response())
}

// ── Refresh Token ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RefreshRequestBody {
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub token: Option<String>,
    pub refresh_token: Option<String>,
    pub user: UserInfo,
    pub csrf_token: String,
    pub permissions: Vec<String>,
    pub field_access: HashMap<String, String>,
}

#[allow(clippy::too_many_lines)]
pub async fn refresh_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    body: Option<Json<RefreshRequestBody>>,
) -> Result<impl IntoResponse, AppError> {
    let include_native_tokens = wants_native_token_response(&headers);

    // Try cookie first, fall back to JSON body (for mobile)
    let refresh_raw = jar
        .get("refresh_token")
        .map(|c| c.value().to_owned())
        .or_else(|| body.and_then(|b| b.refresh_token.clone()))
        .ok_or(AppError::Unauthorized)?;

    let mut hasher = Sha256::new();
    hasher.update(refresh_raw.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    // Look up the refresh token with device info for rotation
    let row = sqlx::query!(
        "SELECT rt.id, rt.user_id, rt.tenant_id, u.role::text AS \"role!\", \
         u.username, u.email, u.full_name, rt.revoked, u.perm_version, \
         rt.family_id, rt.device_fingerprint \
         FROM refresh_tokens rt \
         JOIN users u ON u.id = rt.user_id \
         WHERE rt.token_hash = $1 AND rt.expires_at > now()",
        token_hash
    )
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::Unauthorized);
    };

    // ── Reuse Detection ──
    // If token is already revoked, it means someone is trying to reuse a rotated token.
    // This signals potential token theft — revoke ALL tokens in this family.
    if row.revoked {
        if let Some(fid) = row.family_id {
            let mut tx = state.db.begin().await?;
            medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;

            sqlx::query!(
                "UPDATE refresh_tokens SET revoked = true WHERE family_id = $1 AND revoked = false",
                fid
            )
            .execute(&mut *tx)
            .await?;

            // Audit: potential token theft detected
            let reuse_vals = serde_json::json!({ "family_id": fid });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: row.tenant_id,
                    user_id: Some(row.user_id),
                    action: "token_reuse_detected",
                    entity_type: "refresh_token",
                    entity_id: Some(row.id),
                    old_values: None,
                    new_values: Some(&reuse_vals),
                    ip_address: None,
                },
            )
            .await
            .map_err(AppError::from)?;

            tx.commit().await?;
        }
        return Err(AppError::Unauthorized);
    }

    // ── Device Fingerprint Validation ──
    let current_fp = extract_device_fingerprint(&headers);
    if let Some(ref stored_fp) = row.device_fingerprint {
        if *stored_fp != current_fp {
            // Fingerprint mismatch — possible stolen cookie used in different browser
            let mut tx = state.db.begin().await?;
            medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;

            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: row.tenant_id,
                    user_id: Some(row.user_id),
                    action: "device_fingerprint_mismatch",
                    entity_type: "refresh_token",
                    entity_id: Some(row.id),
                    old_values: None,
                    new_values: None,
                    ip_address: None,
                },
            )
            .await
            .map_err(AppError::from)?;

            // Revoke this token
            sqlx::query!(
                "UPDATE refresh_tokens SET revoked = true WHERE id = $1",
                row.id
            )
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            return Err(AppError::Unauthorized);
        }
    }

    // ── Token Rotation ──
    // Revoke current token and issue a new one with the same family_id
    let new_refresh_raw = Uuid::new_v4().to_string();
    let mut new_hasher = Sha256::new();
    new_hasher.update(new_refresh_raw.as_bytes());
    let new_refresh_hash = hex::encode(new_hasher.finalize());
    let new_expires = Utc::now() + chrono::Duration::days(7);

    let client_ip = extract_client_ip(&headers);
    let user_agent_val = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;

    // Mark old token as used + revoked
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true, used_at = now() WHERE id = $1",
        row.id
    )
    .execute(&mut *tx)
    .await?;

    // Insert new rotated token with same family_id
    let new_token_id = sqlx::query_scalar!(
        "INSERT INTO refresh_tokens \
         (tenant_id, user_id, token_hash, expires_at, family_id, device_fingerprint, ip_address, user_agent) \
         VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7::text, '')::inet, $8) RETURNING id",
        row.tenant_id,
        row.user_id,
        new_refresh_hash,
        new_expires,
        row.family_id,
        current_fp,
        client_ip.as_deref(),
        user_agent_val.as_deref()
    )
    .fetch_one(&mut *tx)
    .await?;

    // Link old token → new token
    sqlx::query!(
        "UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2",
        new_token_id,
        row.id
    )
    .execute(&mut *tx)
    .await?;

    // Log IP change if different from stored
    let stored_ip = sqlx::query_scalar!(
        "SELECT host(ip_address) FROM refresh_tokens WHERE id = $1",
        row.id
    )
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    if let (Some(stored), Some(current)) = (&stored_ip, &client_ip) {
        if stored != current {
            let old_vals = serde_json::json!({ "ip": stored });
            let new_vals = serde_json::json!({ "ip": current });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: row.tenant_id,
                    user_id: Some(row.user_id),
                    action: "ip_change_on_refresh",
                    entity_type: "refresh_token",
                    entity_id: Some(row.id),
                    old_values: Some(&old_vals),
                    new_values: Some(&new_vals),
                    ip_address: None,
                },
            )
            .await
            .map_err(AppError::from)?;
        }
    }

    tx.commit().await?;

    // Resolve effective permissions
    let permissions = resolve_permissions(&state.db, row.tenant_id, row.user_id, &row.role).await?;

    // Resolve department_ids for scoping
    let department_ids =
        resolve_department_ids(&state.db, row.tenant_id, row.user_id, &row.role).await?;

    let field_access = field_access_to_wire(
        field_access::resolve_restricted_fields(&state.db, row.tenant_id, row.user_id, &row.role)
            .await?,
    );

    // Issue new access token
    let access_claims = Claims {
        sub: row.user_id,
        tenant_id: row.tenant_id,
        role: row.role.clone(),
        // permissions are resolved per-request by middleware, not embedded.
        permissions: Vec::new(),
        department_ids,
        perm_version: row.perm_version,
        exp: (Utc::now() + chrono::Duration::minutes(15)).timestamp() as usize,
    };

    let access_token = encode_jwt(&access_claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))?;

    // Generate new CSRF token
    let csrf_token = generate_csrf_token()?;

    // Return new refresh token cookie (rotated)
    let cfg = &state.cookie_config;
    let response_jar = CookieJar::new()
        .add(build_access_cookie(&access_token, cfg))
        .add(build_refresh_cookie(&new_refresh_raw, cfg))
        .add(build_csrf_cookie(&csrf_token, cfg));

    let must_change_password = fetch_must_change_password(&state.db, row.user_id).await?;
    let email_verified = fetch_email_verified(&state.db, row.user_id).await?;

    let resp_body = RefreshResponse {
        token: include_native_tokens.then(|| access_token.clone()),
        refresh_token: include_native_tokens.then(|| new_refresh_raw.clone()),
        user: UserInfo {
            id: row.user_id,
            tenant_id: row.tenant_id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            role: row.role,
            must_change_password,
            email_verified,
        },
        csrf_token,
        permissions,
        field_access,
    };

    Ok((response_jar, Json(resp_body)))
}

// ── Logout ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LogoutRequestBody {
    pub refresh_token: Option<String>,
}

pub async fn logout(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: CookieJar,
    body: Option<Json<LogoutRequestBody>>,
) -> Result<impl IntoResponse, AppError> {
    // Try cookie first, fall back to JSON body
    let refresh_raw = jar
        .get("refresh_token")
        .map(|c| c.value().to_owned())
        .or_else(|| body.and_then(|b| b.refresh_token.clone()));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    if let Some(ref raw) = refresh_raw {
        let mut hasher = Sha256::new();
        hasher.update(raw.as_bytes());
        let token_hash = hex::encode(hasher.finalize());

        sqlx::query!(
            "UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 AND user_id = $2",
            token_hash,
            claims.sub
        )
        .execute(&mut *tx)
        .await?;
    }

    // Bump perm_version so any outstanding access JWT (incl. one held by an
    // attacker who exfiltrated the cookie) is rejected on the next request.
    sqlx::query!(
        "UPDATE users SET perm_version = perm_version + 1 WHERE id = $1",
        claims.sub
    )
    .execute(&mut *tx)
    .await?;

    // Audit the session end (parity with login + logout_all).
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "logout",
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

    // Clear all cookies
    let cfg = &state.cookie_config;
    let response_jar = CookieJar::new()
        .add(clear_cookie("access_token", "/api", cfg))
        .add(clear_cookie("refresh_token", "/api/auth", cfg))
        .add(clear_cookie("csrf_token", "/", cfg));

    Ok((response_jar, Json(serde_json::json!({ "status": "ok" }))))
}

// ── Logout-all (every device) ───────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LogoutAllRequest {
    /// Optional target user. If omitted, logs out the caller.
    /// Setting `user_id` requires `admin.users.force_logout`.
    pub user_id: Option<Uuid>,
}

pub async fn logout_all(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: CookieJar,
    body: Option<Json<LogoutAllRequest>>,
) -> Result<impl IntoResponse, AppError> {
    let target_user = body.as_ref().and_then(|b| b.user_id).unwrap_or(claims.sub);

    // Admin path: force-logout someone else.
    if target_user != claims.sub {
        let perms =
            resolve_permissions(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
        let is_bypass = claims.role == "super_admin" || claims.role == "hospital_admin";
        if !is_bypass && !perms.iter().any(|p| p == "admin.users.force_logout") {
            return Err(AppError::Forbidden);
        }
        // Force-logging out another user is high-risk → require fresh re-auth.
        medbrains_server_core::step_up::require_step_up(&state, &jar, &claims)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true \
         WHERE user_id = $1 AND revoked = false",
        target_user
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "UPDATE users SET perm_version = perm_version + 1 WHERE id = $1",
        target_user
    )
    .execute(&mut *tx)
    .await?;

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "logout_all",
            entity_type: "user",
            entity_id: Some(target_user),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    // A full session cut-off must sever every channel: revoke the target's VPN
    // devices too (best-effort — a VPN/Headscale hiccup must not fail logout).
    if let Err(e) =
        medbrains_vpn::revoke_user_devices(&state, claims.tenant_id, target_user).await
    {
        tracing::warn!(error = %e, user = %target_user, "logout-all: VPN device revoke failed");
    }

    // Clear cookies on the calling response only when self-logout.
    let cfg = &state.cookie_config;
    let response_jar = if target_user == claims.sub {
        CookieJar::new()
            .add(clear_cookie("access_token", "/api", cfg))
            .add(clear_cookie("refresh_token", "/api/auth", cfg))
            .add(clear_cookie("csrf_token", "/", cfg))
    } else {
        CookieJar::new()
    };

    Ok((response_jar, Json(serde_json::json!({ "status": "ok" }))))
}

// ── Me ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct MeResponse {
    #[serde(flatten)]
    pub user: UserInfo,
    pub permissions: Vec<String>,
    pub field_access: HashMap<String, String>,
    pub mfa_enabled: bool,
    /// Tenant policy mandates MFA for this role and it isn't set up yet
    /// — the frontend blocks the app until enrollment completes.
    pub mfa_enrollment_required: bool,
    /// Module codes the tenant's edition has switched OFF (status disabled/coming_soon).
    /// The frontend hides these modules' nav + routes. Absent code = enabled (default on).
    pub disabled_modules: Vec<String>,
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MeResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query!(
        "SELECT id, tenant_id, username, email, full_name, role::text AS \"role!\" \
         FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&mut *tx)
    .await?;

    // Edition entitlement: the modules this tenant has switched off (drives nav/route hiding).
    let disabled_modules: Vec<String> = sqlx::query_scalar(
        "SELECT code FROM module_config \
         WHERE tenant_id = $1 AND status::text IN ('disabled', 'coming_soon')",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    let permissions = resolve_permissions(&state.db, row.tenant_id, row.id, &row.role).await?;

    let field_access = field_access_to_wire(
        field_access::resolve_restricted_fields(&state.db, row.tenant_id, row.id, &row.role)
            .await?,
    );

    let must_change_password = fetch_must_change_password(&state.db, row.id).await?;

    let mfa_enabled: bool = sqlx::query_scalar("SELECT mfa_enabled FROM users WHERE id = $1")
        .bind(row.id)
        .fetch_one(&state.db)
        .await?;
    let email_verified: bool =
        sqlx::query_scalar("SELECT email_verified FROM users WHERE id = $1")
            .bind(row.id)
            .fetch_one(&state.db)
            .await?;
    let mfa_enrollment_required = !mfa_enabled
        && medbrains_mfa::mfa_required_for_role(&state.db, row.tenant_id, &row.role).await?;

    Ok(Json(MeResponse {
        user: UserInfo {
            id: row.id,
            tenant_id: row.tenant_id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            role: row.role,
            must_change_password,
            email_verified,
        },
        permissions,
        field_access,
        mfa_enabled,
        mfa_enrollment_required,
        disabled_modules,
    }))
}

// ── Change Password ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut errors = medbrains_server_core::validation::ValidationErrors::new();
    medbrains_server_core::validation::validate_password(&mut errors, "new_password", &body.new_password);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Get current hash
    let current_hash =
        sqlx::query_scalar!("SELECT password_hash FROM users WHERE id = $1", claims.sub)
            .fetch_optional(&mut *tx)
            .await?;

    let Some(current_hash) = current_hash else {
        return Err(AppError::NotFound);
    };
    // Nullable since 0200_sso_foundation: an SSO account has no local password
    // to change, which is a different answer from "no such user".
    let Some(ref current_hash) = current_hash else {
        return Err(AppError::BadRequest(
            "This account signs in with single sign-on and has no password to change."
                .to_owned(),
        ));
    };

    // Verify current password
    let parsed_hash = PasswordHash::new(current_hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(body.current_password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::BadRequest("Current password is incorrect".to_owned()))?;

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(body.new_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
        .to_string();

    sqlx::query!(
        "UPDATE users SET password_hash = $1, perm_version = perm_version + 1 WHERE id = $2",
        new_hash,
        claims.sub
    )
    .execute(&mut *tx)
    .await?;

    // Runtime query: column not in .sqlx offline metadata yet (0144).
    sqlx::query("UPDATE users SET must_change_password = false WHERE id = $1")
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;

    // Revoke every active refresh token for this user — a password change
    // implies any token previously issued is potentially compromised.
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true \
         WHERE user_id = $1 AND revoked = false",
        claims.sub
    )
    .execute(&mut *tx)
    .await?;

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "change_password",
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

// ── Password Reset (self-service via SMS OTP) ───────────────

const RESET_OTP_TTL_MINUTES: i32 = 10;
const RESET_OTP_MAX_ATTEMPTS: i32 = 5;

fn hash_otp(otp: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(otp.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Deserialize)]
pub struct PasswordResetRequestBody {
    pub username: String,
}

/// Public, rate-limited. Always returns the same 200 body so account
/// names cannot be enumerated. Delivery rides the outbox → Twilio
/// handler (retry + DLQ for free); without a configured SMS connector
/// the request is a silent no-op.
pub async fn request_password_reset(
    State(state): State<AppState>,
    Json(body): Json<PasswordResetRequestBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ack = Json(serde_json::json!({
        "status": "ok",
        "message": "If the account exists and has a phone on file, an OTP has been sent."
    }));

    let Some((user_id, tenant_id, phone)) = sqlx::query_as::<_, (Uuid, Uuid, Option<String>)>(
        "SELECT id, tenant_id, phone FROM users WHERE username = $1 AND is_active = true",
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?
    else {
        return Ok(ack);
    };

    let Some(phone) = phone.filter(|p| !p.trim().is_empty()) else {
        tracing::info!(%user_id, "password reset requested but no phone on file");
        return Ok(ack);
    };

    let mut buf = [0u8; 4];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("otp generation failed: {e}")))?;
    let otp = format!("{:06}", u32::from_le_bytes(buf) % 1_000_000);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    sqlx::query(
        "UPDATE password_reset_otps SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO password_reset_otps (tenant_id, user_id, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(hash_otp(&otp))
    .bind(RESET_OTP_TTL_MINUTES)
    .execute(&mut *tx)
    .await?;

    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "user",
            aggregate_id: Some(user_id),
            event_type: "sms.password_reset_otp",
            payload: serde_json::json!({
                "to": phone,
                "body": format!(
                    "Your MedBrains password reset code is {otp}. \
                     Valid for {RESET_OTP_TTL_MINUTES} minutes."
                ),
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue reset OTP: {e}")))?;

    tx.commit().await?;
    Ok(ack)
}

#[derive(Debug, Deserialize)]
pub struct PasswordResetConfirmBody {
    pub username: String,
    pub otp: String,
    pub new_password: String,
}

pub async fn confirm_password_reset(
    State(state): State<AppState>,
    Json(body): Json<PasswordResetConfirmBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "New password must be at least 8 characters".to_owned(),
        ));
    }

    let Some((user_id, tenant_id)) = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT id, tenant_id FROM users WHERE username = $1 AND is_active = true",
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?
    else {
        return Err(AppError::Unauthorized);
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let row: Option<(Uuid, bool, bool, i32)> = sqlx::query_as(
        "SELECT id, expires_at > now(), otp_hash = $2, attempts \
         FROM password_reset_otps \
         WHERE user_id = $1 AND used_at IS NULL \
         ORDER BY created_at DESC LIMIT 1 \
         FOR UPDATE",
    )
    .bind(user_id)
    .bind(hash_otp(&body.otp))
    .fetch_optional(&mut *tx)
    .await?;

    let Some((otp_id, in_window, otp_matches, attempts)) = row else {
        return Err(AppError::Unauthorized);
    };

    if !in_window || attempts >= RESET_OTP_MAX_ATTEMPTS {
        sqlx::query("UPDATE password_reset_otps SET used_at = now() WHERE id = $1")
            .bind(otp_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(AppError::BadRequest(
            "Reset code expired — request a new one".to_owned(),
        ));
    }

    if !otp_matches {
        sqlx::query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1")
            .bind(otp_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(AppError::Unauthorized);
    }

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(body.new_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
        .to_string();

    sqlx::query("UPDATE password_reset_otps SET used_at = now() WHERE id = $1")
        .bind(otp_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "UPDATE users SET password_hash = $1, must_change_password = false, \
         failed_login_attempts = 0, locked_until = NULL, \
         perm_version = perm_version + 1 WHERE id = $2",
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: Some(user_id),
            action: "password_reset",
            entity_type: "user",
            entity_id: Some(user_id),
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

// ── Permission Resolution ───────────────────────────────────

// `resolve_permissions` moved to `medbrains_server_core::permissions` so the auth
// middleware can resolve without importing the routes layer. Re-exported below.
pub use medbrains_server_core::permissions::resolve_permissions;

/// Compute a device fingerprint from request headers (SHA-256 of User-Agent + Accept-Language).
/// Used for token theft detection — if the fingerprint changes on refresh, the token may be stolen.
fn extract_device_fingerprint(headers: &HeaderMap) -> String {
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let lang = headers
        .get("accept-language")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let mut hasher = Sha256::new();
    hasher.update(format!("{ua}|{lang}"));
    hex::encode(hasher.finalize())
}

/// Extract client IP from request headers (X-Forwarded-For, X-Real-IP, or fallback).
/// Strips port if present (e.g., "1.2.3.4:12345" → "1.2.3.4").
fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    let raw = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_owned())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.trim().to_owned())
        });

    // Strip port suffix (inet type only accepts IP, not IP:port)
    raw.map(|ip| {
        if let Some(colon_pos) = ip.rfind(':') {
            // Only strip if the part after colon is numeric (port)
            // and it's not an IPv6 address
            if !ip.contains('[') && ip[colon_pos + 1..].chars().all(|c| c.is_ascii_digit()) {
                return ip[..colon_pos].to_owned();
            }
        }
        ip
    })
}

/// Resolve `department_ids` for a user from the database.
/// Bypass roles get an empty list (they can access everything).
async fn resolve_department_ids(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<Vec<Uuid>, AppError> {
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(Vec::new());
    }

    let dept_ids = sqlx::query_scalar!(
        "SELECT department_ids FROM users WHERE id = $1 AND tenant_id = $2",
        user_id,
        tenant_id
    )
    .fetch_optional(db)
    .await?;

    Ok(dept_ids.unwrap_or_default())
}

// ── Phase A.1: revocations endpoint for offline devices ────────────
//
// Devices (mobile, TV, edge) periodically pull this to know which
// users have been deactivated. Each entry tells the device "every
// JWT for user_id with iat < deactivated_at is revoked".
//
// Cursor model: caller passes `?since=<rfc3339>`. Server returns
// rows where deactivated_at > since, sorted ascending. Caller
// records the max deactivated_at it saw and uses that as next
// `since`. Page size capped at 500; an honest device pulling every
// 15 min stays well under that.

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RevocationRow {
    pub user_id: Uuid,
    pub deactivated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RevocationsResponse {
    pub revocations: Vec<RevocationRow>,
    /// Echo back the cursor the caller should use next time. Equal
    /// to the max `deactivated_at` in the result set, or the input
    /// `since` if nothing changed.
    pub next_since: DateTime<Utc>,
    /// True if more rows exist past the cap; caller should pull
    /// again immediately.
    pub has_more: bool,
}

#[derive(Debug, Deserialize)]
pub struct RevocationsQuery {
    /// RFC3339 timestamp. Server returns rows with
    /// `deactivated_at > since`. Default = epoch (full backfill).
    pub since: Option<DateTime<Utc>>,
}

const REVOCATIONS_PAGE_SIZE: i64 = 500;

pub async fn list_revocations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Query(q): axum::extract::Query<RevocationsQuery>,
) -> Result<Json<RevocationsResponse>, AppError> {
    let since = q
        .since
        .unwrap_or_else(|| DateTime::<Utc>::from_timestamp(0, 0).unwrap_or_default());

    let rows: Vec<RevocationRow> = sqlx::query_as(
        "SELECT id AS user_id, deactivated_at \
         FROM users \
         WHERE tenant_id = $1 \
           AND is_active = FALSE \
           AND deactivated_at IS NOT NULL \
           AND deactivated_at > $2 \
         ORDER BY deactivated_at ASC \
         LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(since)
    .bind(REVOCATIONS_PAGE_SIZE + 1)
    .fetch_all(&state.db)
    .await?;

    let has_more = rows.len() as i64 > REVOCATIONS_PAGE_SIZE;
    let trimmed: Vec<RevocationRow> = rows
        .into_iter()
        .take(REVOCATIONS_PAGE_SIZE as usize)
        .collect();
    let next_since = trimmed.last().map(|r| r.deactivated_at).unwrap_or(since);

    Ok(Json(RevocationsResponse {
        revocations: trimmed,
        next_since,
        has_more,
    }))
}

/// auth routes.
/// Public auth routes — no JWT/Claims required (mounted OUTSIDE the auth layer).
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/auth/login", post(login))
        .route(
            "/api/auth/password-reset/request",
            post(request_password_reset),
        )
        .route(
            "/api/auth/password-reset/confirm",
            post(confirm_password_reset),
        )
        .route("/api/auth/refresh", post(refresh_token))
}

/// Protected auth routes — require `Extension<Claims>` from `auth_middleware`,
/// so they MUST be mounted inside the authenticated router.
pub fn protected_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/auth/me", get(me))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/logout-all", post(logout_all))
        .route("/api/auth/change-password", post(change_password))
        .route("/api/auth/revocations", get(list_revocations))
}
