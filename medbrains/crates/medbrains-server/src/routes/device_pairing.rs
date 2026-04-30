//! Device pairing — admin mints a one-time QR token; the mobile / TV
//! device exchanges it for a JWT scoped to a specific user, and the
//! server records the device's public key fingerprint so subsequent
//! requests can be bound to the device identity.
//!
//! The TLS-level mTLS handshake (CA cert signing, client-cert
//! validation) lives at the deployment edge — typically envoy or
//! nginx terminating client certs. This route module's contract:
//!
//!   1. Admin → POST /api/admin/device-pairing-tokens
//!      Mints a 5-minute token + intended app variant + intended
//!      user. Returns the token + QR payload + expiry.
//!
//!   2. Device → POST /api/device-pairing/pair
//!      Body: { token, label, public_key_pem }. Validates the token
//!      hasn't expired or been used; records the public-key
//!      fingerprint into `paired_devices`; issues a JWT scoped to
//!      the intended user; marks the token used.
//!
//!   3. Admin → GET /api/admin/paired-devices
//!      Lists active (non-revoked) paired devices.
//!
//!   4. Admin → DELETE /api/admin/paired-devices/{id}
//!      Revokes a paired device. Sets revoked_at; subsequent JWT
//!      verification (against the existing user_deactivation +
//!      revocation cache) terminates the device's access.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::{Claims, encode_jwt};
use crate::state::AppState;

const TOKEN_TTL_MINUTES: i64 = 5;
const DEVICE_JWT_DAYS: i64 = 30;

fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    if claims.permissions.iter().any(|p| p == perm) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

// ──────────────────────────────────────────────────────────────────
//  POST /api/admin/device-pairing-tokens
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MintTokenRequest {
    pub intended_device_label: String,
    pub intended_app_variant: String,
    pub intended_user_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MintTokenResponse {
    pub id: Uuid,
    pub token: String,
    pub qr_payload: String,
    pub expires_at: DateTime<Utc>,
    pub intended_device_label: String,
    pub intended_app_variant: String,
}

pub async fn mint_pairing_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MintTokenRequest>,
) -> Result<Json<MintTokenResponse>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;
    if !["staff", "tv", "vendor"].contains(&body.intended_app_variant.as_str()) {
        return Err(AppError::BadRequest(format!(
            "invalid intended_app_variant '{}'",
            body.intended_app_variant
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let token = generate_token();
    let expires_at = Utc::now() + Duration::minutes(TOKEN_TTL_MINUTES);

    let row = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        "INSERT INTO device_pairing_tokens (\
            tenant_id, token, expires_at, issued_by_user_id, \
            intended_device_label, intended_app_variant, intended_user_id, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, expires_at",
    )
    .bind(claims.tenant_id)
    .bind(&token)
    .bind(expires_at)
    .bind(claims.sub)
    .bind(&body.intended_device_label)
    .bind(&body.intended_app_variant)
    .bind(body.intended_user_id)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let qr_payload = format!(
        "medbrains://pair?token={}&tenant={}",
        token, claims.tenant_id
    );

    Ok(Json(MintTokenResponse {
        id: row.0,
        token,
        qr_payload,
        expires_at: row.1,
        intended_device_label: body.intended_device_label,
        intended_app_variant: body.intended_app_variant,
    }))
}

// ──────────────────────────────────────────────────────────────────
//  POST /api/device-pairing/pair  (no auth — gated by token)
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PairRequest {
    pub token: String,
    pub label: String,
    pub public_key_pem: String,
}

#[derive(Debug, Serialize)]
pub struct PairResponse {
    pub paired_device_id: Uuid,
    pub jwt: String,
    pub cert_fingerprint: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub app_variant: String,
}

pub async fn pair_device(
    State(state): State<AppState>,
    Json(body): Json<PairRequest>,
) -> Result<Json<PairResponse>, AppError> {
    if body.public_key_pem.trim().is_empty() {
        return Err(AppError::BadRequest("public_key_pem is required".into()));
    }

    let cert_fingerprint = sha256_hex(body.public_key_pem.trim().as_bytes());

    let mut tx = state.db.begin().await?;

    // Look up the token globally — no tenant_context yet because the
    // device hasn't authenticated. Once we resolve the tenant we set
    // it and proceed.
    let token_row: Option<(
        Uuid,
        Uuid,
        String,
        String,
        Option<Uuid>,
        Uuid,
        DateTime<Utc>,
        Option<DateTime<Utc>>,
    )> = sqlx::query_as(
        "SELECT id, tenant_id, intended_device_label, intended_app_variant, \
                intended_user_id, issued_by_user_id, expires_at, used_at \
         FROM device_pairing_tokens WHERE token = $1",
    )
    .bind(&body.token)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((token_id, tenant_id, _label, app_variant, intended_user, issued_by, expires_at, used_at)) =
        token_row
    else {
        return Err(AppError::NotFound);
    };

    if used_at.is_some() {
        return Err(AppError::BadRequest("pairing token already used".into()));
    }
    if expires_at < Utc::now() {
        return Err(AppError::BadRequest("pairing token expired".into()));
    }

    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let user_id = intended_user.unwrap_or(issued_by);

    // Resolve the user's role + permissions for the JWT.
    let user_row: Option<(String, i32, Vec<Uuid>)> = sqlx::query_as(
        "SELECT u.role, u.perm_version, COALESCE(\
            (SELECT array_agg(department_id) FROM user_departments WHERE user_id = u.id), \
            ARRAY[]::uuid[]) \
         FROM users u WHERE u.id = $1 AND u.tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((role, perm_version, department_ids)) = user_row else {
        return Err(AppError::BadRequest(
            "intended_user_id no longer exists".into(),
        ));
    };

    let permissions = sqlx::query_scalar::<_, String>(
        "SELECT unnest(permissions) FROM roles \
         WHERE tenant_id = $1 AND code = $2",
    )
    .bind(tenant_id)
    .bind(&role)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let cert_pem = body.public_key_pem.trim().to_owned();

    // Insert the paired device row.
    let paired_id: Uuid = sqlx::query_scalar(
        "INSERT INTO paired_devices (\
            tenant_id, label, app_variant, cert_fingerprint, cert_pem, \
            issued_to_user_id, paired_via_token_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&body.label)
    .bind(&app_variant)
    .bind(&cert_fingerprint)
    .bind(&cert_pem)
    .bind(user_id)
    .bind(token_id)
    .fetch_one(&mut *tx)
    .await?;

    // Mark token used.
    sqlx::query(
        "UPDATE device_pairing_tokens SET used_at = now(), used_by_device_id = $1 \
         WHERE id = $2",
    )
    .bind(paired_id)
    .bind(token_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Issue the device JWT.
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        tenant_id,
        role,
        permissions,
        department_ids,
        perm_version,
        exp: (now + Duration::days(DEVICE_JWT_DAYS)).timestamp() as usize,
    };
    let jwt = encode_jwt(&claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))?;

    Ok(Json(PairResponse {
        paired_device_id: paired_id,
        jwt,
        cert_fingerprint,
        user_id,
        tenant_id,
        app_variant,
    }))
}

// ──────────────────────────────────────────────────────────────────
//  GET /api/admin/paired-devices
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PairedDeviceRow {
    pub id: Uuid,
    pub label: String,
    pub app_variant: String,
    pub cert_fingerprint: String,
    pub issued_to_user_id: Option<Uuid>,
    pub paired_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

pub async fn list_paired_devices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PairedDeviceRow>>, AppError> {
    require_permission(&claims, permissions::devices::pairing::PAIRED_LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PairedDeviceRow>(
        "SELECT id, label, app_variant, cert_fingerprint, issued_to_user_id, \
                paired_at, last_seen_at, revoked_at \
         FROM paired_devices \
         WHERE tenant_id = $1 \
         ORDER BY paired_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ──────────────────────────────────────────────────────────────────
//  DELETE /api/admin/paired-devices/{id}
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RevokeBody {
    pub reason: Option<String>,
}

pub async fn revoke_paired_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeBody>,
) -> Result<Json<PairedDeviceRow>, AppError> {
    require_permission(&claims, permissions::devices::pairing::PAIRED_REVOKE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PairedDeviceRow>(
        "UPDATE paired_devices \
         SET revoked_at = now(), revoked_by_user_id = $1, revoked_reason = $2 \
         WHERE id = $3 AND tenant_id = $4 AND revoked_at IS NULL \
         RETURNING id, label, app_variant, cert_fingerprint, issued_to_user_id, \
                   paired_at, last_seen_at, revoked_at",
    )
    .bind(claims.sub)
    .bind(body.reason.as_deref())
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ──────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────

fn generate_token() -> String {
    // 24 random bytes → 32-char base32-ish (lowercase + digits, no
    // ambiguous chars). Easy to render in a QR; no /+= padding noise.
    let raw = Uuid::new_v4().simple().to_string();
    let extra = Uuid::new_v4().simple().to_string();
    format!("{}{}", &raw, &extra[..8])
}

fn sha256_hex(input: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input);
    hex::encode(hasher.finalize())
}
