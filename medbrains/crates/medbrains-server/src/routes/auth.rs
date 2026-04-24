use std::collections::HashMap;

use argon2::{
    Argon2, PasswordHash, PasswordVerifier,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use axum::{Extension, Json, extract::State, response::IntoResponse};
use axum::http::HeaderMap;
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{
        auth::{Claims, encode_jwt},
        cookies::{
            build_access_cookie, build_csrf_cookie, build_refresh_cookie, clear_cookie,
        },
    },
    state::AppState,
};

// ── Login ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: UserInfo,
    pub csrf_token: String,
    pub permissions: Vec<String>,
    pub field_access: HashMap<String, String>,
}

/// Generate a cryptographically random CSRF token (32 bytes → 64 hex chars).
fn generate_csrf_token() -> Result<String, AppError> {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("CSRF token generation failed: {e}")))?;
    Ok(hex::encode(buf))
}

#[allow(clippy::too_many_lines)]
pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Find user by username (across all tenants — login does not require tenant context)
    let row = sqlx::query_as::<_, (Uuid, Uuid, String, String, String, String, String, bool, i32)>(
        "SELECT id, tenant_id, username, email, password_hash, full_name, role::text, is_active, \
         perm_version FROM users WHERE username = $1",
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?;

    let Some((user_id, tenant_id, username, email, password_hash, full_name, role, is_active, perm_version)) =
        row
    else {
        return Err(AppError::Unauthorized);
    };

    if !is_active {
        return Err(AppError::Unauthorized);
    }

    // Verify password
    let parsed_hash =
        PasswordHash::new(&password_hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Resolve effective permissions from role
    let permissions = resolve_permissions(&state.db, tenant_id, user_id, &role).await?;

    // Resolve department_ids for scoping
    let department_ids =
        resolve_department_ids(&state.db, tenant_id, user_id, &role).await?;

    // Resolve field access levels
    let field_access_map =
        super::forms::resolve_field_access(&state.db, tenant_id, user_id, &role).await?;
    let field_access: HashMap<String, String> = field_access_map
        .into_iter()
        .map(|(k, v)| {
            let s = match v {
                medbrains_core::form::FieldAccessLevel::Edit => "edit",
                medbrains_core::form::FieldAccessLevel::View => "view",
                medbrains_core::form::FieldAccessLevel::Hidden => "hidden",
            };
            (k, s.to_owned())
        })
        .collect();

    // Issue access token (15 min)
    let now = Utc::now();
    let access_claims = Claims {
        sub: user_id,
        tenant_id,
        role: role.clone(),
        permissions: permissions.clone(),
        department_ids,
        perm_version,
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
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Enforce concurrent session limit: max 5 active tokens per user
    sqlx::query(
        "UPDATE refresh_tokens SET revoked = true \
         WHERE user_id = $1 AND revoked = false AND id NOT IN \
         (SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked = false \
          ORDER BY created_at DESC LIMIT 4)",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO refresh_tokens \
         (tenant_id, user_id, token_hash, expires_at, device_fingerprint, ip_address, user_agent) \
         VALUES ($1, $2, $3, $4, $5, $6::inet, $7)",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(&refresh_hash)
    .bind(expires_at)
    .bind(&device_fp)
    .bind(&client_ip)
    .bind(&user_agent)
    .execute(&mut *tx)
    .await?;

    // Audit log
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: Some(user_id),
            action: "login",
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

    // Generate CSRF token
    let csrf_token = generate_csrf_token()?;

    // Build cookie-based response
    let cfg = &state.cookie_config;
    let jar = CookieJar::new()
        .add(build_access_cookie(&access_token, cfg))
        .add(build_refresh_cookie(&refresh_raw, cfg))
        .add(build_csrf_cookie(&csrf_token, cfg));

    let body = LoginResponse {
        user: UserInfo {
            id: user_id,
            tenant_id,
            username,
            email,
            full_name,
            role,
        },
        csrf_token,
        permissions,
        field_access,
    };

    Ok((jar, Json(body)))
}

// ── Refresh Token ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RefreshRequestBody {
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
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
    let row = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String, String, String, bool, i32, Option<Uuid>, Option<String>)>(
        "SELECT rt.id, rt.user_id, rt.tenant_id, u.role::text, u.username, u.email, u.full_name, \
         rt.revoked, u.perm_version, rt.family_id, rt.device_fingerprint \
         FROM refresh_tokens rt \
         JOIN users u ON u.id = rt.user_id \
         WHERE rt.token_hash = $1 AND rt.expires_at > now()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let Some((token_id, user_id, tenant_id, role, username, email, full_name, revoked, perm_version, family_id, stored_fingerprint)) = row else {
        return Err(AppError::Unauthorized);
    };

    // ── Reuse Detection ──
    // If token is already revoked, it means someone is trying to reuse a rotated token.
    // This signals potential token theft — revoke ALL tokens in this family.
    if revoked {
        if let Some(fid) = family_id {
            let mut tx = state.db.begin().await?;
            medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

            sqlx::query(
                "UPDATE refresh_tokens SET revoked = true WHERE family_id = $1 AND revoked = false",
            )
            .bind(fid)
            .execute(&mut *tx)
            .await?;

            // Audit: potential token theft detected
            let reuse_vals = serde_json::json!({ "family_id": fid });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id,
                    user_id: Some(user_id),
                    action: "token_reuse_detected",
                    entity_type: "refresh_token",
                    entity_id: Some(token_id),
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
    if let Some(ref stored_fp) = stored_fingerprint {
        if *stored_fp != current_fp {
            // Fingerprint mismatch — possible stolen cookie used in different browser
            let mut tx = state.db.begin().await?;
            medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id,
                    user_id: Some(user_id),
                    action: "device_fingerprint_mismatch",
                    entity_type: "refresh_token",
                    entity_id: Some(token_id),
                    old_values: None,
                    new_values: None,
                    ip_address: None,
                },
            )
            .await
            .map_err(AppError::from)?;

            // Revoke this token
            sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE id = $1")
                .bind(token_id)
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
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Mark old token as used + revoked
    sqlx::query(
        "UPDATE refresh_tokens SET revoked = true, used_at = now() WHERE id = $1",
    )
    .bind(token_id)
    .execute(&mut *tx)
    .await?;

    // Insert new rotated token with same family_id
    let new_token_id: Uuid = sqlx::query_scalar(
        "INSERT INTO refresh_tokens \
         (tenant_id, user_id, token_hash, expires_at, family_id, device_fingerprint, ip_address, user_agent) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8) RETURNING id",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(&new_refresh_hash)
    .bind(new_expires)
    .bind(family_id)
    .bind(&current_fp)
    .bind(&client_ip)
    .bind(&user_agent_val)
    .fetch_one(&mut *tx)
    .await?;

    // Link old token → new token
    sqlx::query("UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2")
        .bind(new_token_id)
        .bind(token_id)
        .execute(&mut *tx)
        .await?;

    // Log IP change if different from stored
    let stored_ip: Option<String> = sqlx::query_scalar(
        "SELECT host(ip_address) FROM refresh_tokens WHERE id = $1",
    )
    .bind(token_id)
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
                    tenant_id,
                    user_id: Some(user_id),
                    action: "ip_change_on_refresh",
                    entity_type: "refresh_token",
                    entity_id: Some(token_id),
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
    let permissions = resolve_permissions(&state.db, tenant_id, user_id, &role).await?;

    // Resolve department_ids for scoping
    let department_ids =
        resolve_department_ids(&state.db, tenant_id, user_id, &role).await?;

    // Resolve field access levels
    let field_access_map =
        super::forms::resolve_field_access(&state.db, tenant_id, user_id, &role).await?;
    let field_access: HashMap<String, String> = field_access_map
        .into_iter()
        .map(|(k, v)| {
            let s = match v {
                medbrains_core::form::FieldAccessLevel::Edit => "edit",
                medbrains_core::form::FieldAccessLevel::View => "view",
                medbrains_core::form::FieldAccessLevel::Hidden => "hidden",
            };
            (k, s.to_owned())
        })
        .collect();

    // Issue new access token
    let access_claims = Claims {
        sub: user_id,
        tenant_id,
        role: role.clone(),
        permissions: permissions.clone(),
        department_ids,
        perm_version,
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

    let resp_body = RefreshResponse {
        user: UserInfo {
            id: user_id,
            tenant_id,
            username,
            email,
            full_name,
            role,
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

    if let Some(ref raw) = refresh_raw {
        let mut hasher = Sha256::new();
        hasher.update(raw.as_bytes());
        let token_hash = hex::encode(hasher.finalize());

        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

        sqlx::query(
            "UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 AND user_id = $2",
        )
        .bind(&token_hash)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
    }

    // Clear all cookies
    let cfg = &state.cookie_config;
    let response_jar = CookieJar::new()
        .add(clear_cookie("access_token", "/api", cfg))
        .add(clear_cookie("refresh_token", "/api/auth", cfg))
        .add(clear_cookie("csrf_token", "/", cfg));

    Ok((response_jar, Json(serde_json::json!({ "status": "ok" }))))
}

// ── Me ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct MeResponse {
    #[serde(flatten)]
    pub user: UserInfo,
    pub permissions: Vec<String>,
    pub field_access: HashMap<String, String>,
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MeResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, (Uuid, Uuid, String, String, String, String)>(
        "SELECT id, tenant_id, username, email, full_name, role::text FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let Some((id, tenant_id, username, email, full_name, role)) = row else {
        return Err(AppError::NotFound);
    };

    let permissions = resolve_permissions(&state.db, tenant_id, id, &role).await?;

    // Resolve field access levels
    let field_access_map =
        super::forms::resolve_field_access(&state.db, tenant_id, id, &role).await?;
    let field_access: HashMap<String, String> = field_access_map
        .into_iter()
        .map(|(k, v)| {
            let s = match v {
                medbrains_core::form::FieldAccessLevel::Edit => "edit",
                medbrains_core::form::FieldAccessLevel::View => "view",
                medbrains_core::form::FieldAccessLevel::Hidden => "hidden",
            };
            (k, s.to_owned())
        })
        .collect();

    Ok(Json(MeResponse {
        user: UserInfo {
            id,
            tenant_id,
            username,
            email,
            full_name,
            role,
        },
        permissions,
        field_access,
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
    let mut errors = crate::validation::ValidationErrors::new();
    crate::validation::validate_password(&mut errors, "new_password", &body.new_password);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get current hash
    let current_hash: Option<String> =
        sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&mut *tx)
            .await?;

    let Some(current_hash) = current_hash else {
        return Err(AppError::NotFound);
    };

    // Verify current password
    let parsed_hash =
        PasswordHash::new(&current_hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(body.current_password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::BadRequest("Current password is incorrect".to_owned()))?;

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(body.new_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
        .to_string();

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(claims.sub)
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

// ── Permission Resolution ───────────────────────────────────

/// Resolve effective permissions for a user:
/// 1. Start with the role's `permissions` JSONB array
/// 2. Apply user `access_matrix` overrides: `{ extra: [...], denied: [...] }`
/// 3. effective = (`role_perms` ∪ extra) - denied
///
/// `super_admin` and `hospital_admin` get an empty list (they bypass checks).
async fn resolve_permissions(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<Vec<String>, AppError> {
    // Bypass roles don't need permissions in the token
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(Vec::new());
    }

    // Get role permissions from roles table
    let role_perms_json: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT permissions FROM roles WHERE tenant_id = $1 AND code = $2 AND is_active = true",
    )
    .bind(tenant_id)
    .bind(role)
    .fetch_optional(db)
    .await?;

    let mut perms: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Parse role permissions (stored as JSON array of strings)
    if let Some(serde_json::Value::Array(arr)) = role_perms_json {
        for val in arr {
            if let serde_json::Value::String(s) = val {
                perms.insert(s);
            }
        }
    }

    // Get user access_matrix overrides
    let access_matrix: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;

    if let Some(serde_json::Value::Object(matrix)) = access_matrix {
        // Add extra permissions
        if let Some(serde_json::Value::Array(extra)) = matrix.get("extra") {
            for val in extra {
                if let serde_json::Value::String(s) = val {
                    perms.insert(s.clone());
                }
            }
        }
        // Remove denied permissions
        if let Some(serde_json::Value::Array(denied)) = matrix.get("denied") {
            for val in denied {
                if let serde_json::Value::String(s) = val {
                    perms.remove(s);
                }
            }
        }
    }

    let mut result: Vec<String> = perms.into_iter().collect();
    result.sort();
    Ok(result)
}

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

    let dept_ids: Option<Vec<Uuid>> = sqlx::query_scalar(
        "SELECT department_ids FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;

    Ok(dept_ids.unwrap_or_default())
}
