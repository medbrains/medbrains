//! Hospital binding — a signed QR that binds a staff or patient app to this
//! hospital's server, so nobody types a hospital code or a server address.
//!
//!   1. Admin → `POST /api/admin/device-binding-codes` — label, lifetime and
//!      uses; answers the QR text (see [`crate::binding_token`]).
//!   2. App → `POST /api/device-binding/redeem` (no auth) — the token, a fresh
//!      device public key and a random challenge. The server checks the
//!      signature, the expiry and the nonce's remaining uses (counted
//!      atomically), records the device in `paired_devices`, and signs the
//!      challenge so the app knows the server it reached over the pinned TLS
//!      key holds the QR's key.
//!   3. Admin → list and revoke codes. A revoked code binds nothing more;
//!      devices it bound are revoked from Paired devices.

use axum::extract::rejection::JsonRejection;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::SigningKey;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::binding_token::{self as token, BindingClaims};

/// Base64 32-byte Ed25519 seed of the binding key (see binding_token).
const SIGNING_KEY_SECRET: &str = "MEDBRAINS_BINDING_SIGNING_KEY";
/// Where apps reach this server, e.g. `https://hims.example.org`.
const PUBLIC_BASE_URL_SECRET: &str = "MEDBRAINS_PUBLIC_BASE_URL";
/// Base64 SHA-256 of the TLS certificate's SubjectPublicKeyInfo.
const SPKI_PIN_SECRET: &str = "MEDBRAINS_TLS_SPKI_SHA256";
const MAX_LIFETIME_HOURS: i64 = 24 * 30;
const MAX_USES: i32 = 500;
const MAX_LABEL_CHARS: usize = 120;
const MAX_PUBLIC_KEY_PEM_BYTES: usize = 4096;
const CHALLENGE_BYTES: usize = 32;
const LIST_LIMIT: i64 = 500;

async fn secret(state: &AppState, key: &str) -> Option<String> {
    let value = state.secret_resolver.get(key).await.ok()?;
    let value = value.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

pub(crate) async fn binding_key(state: &AppState) -> Result<SigningKey, AppError> {
    let seed = secret(state, SIGNING_KEY_SECRET).await.ok_or_else(|| {
        AppError::ServiceUnavailable(format!(
            "{SIGNING_KEY_SECRET} is not set, so this server cannot sign binding codes"
        ))
    })?;
    token::signing_key(&seed)
        .map_err(|e| AppError::ServiceUnavailable(format!("{SIGNING_KEY_SECRET}: {e}")))
}

/// The base URL apps are sent to and its TLS pin. An https server without a
/// pin is refused: an unpinned binding is exactly what this feature replaces.
async fn public_endpoint(state: &AppState) -> Result<(String, Option<String>), AppError> {
    let base = secret(state, PUBLIC_BASE_URL_SECRET)
        .await
        .filter(|b| b.starts_with("https://") || b.starts_with("http://"))
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!(
                "{PUBLIC_BASE_URL_SECRET} is not set, so apps would not know where to go"
            ))
        })?;
    let base = base.trim_end_matches('/').to_owned();
    if !base.starts_with("https://") {
        return Ok((base, None));
    }
    let pin = secret(state, SPKI_PIN_SECRET)
        .await
        .filter(|p| token::is_spki_pin(p))
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!(
                "{SPKI_PIN_SECRET} is not set to the TLS key's base64 SHA-256"
            ))
        })?;
    Ok((base, Some(pin)))
}

fn check_label(label: &str) -> Result<String, AppError> {
    let label = label.trim();
    if label.is_empty() || label.chars().count() > MAX_LABEL_CHARS {
        return Err(AppError::BadRequest(format!(
            "label must be 1 to {MAX_LABEL_CHARS} characters"
        )));
    }
    Ok(label.to_owned())
}

// ── Issue ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct IssueRequest {
    pub label: String,
    pub expires_in_hours: i64,
    pub max_uses: i32,
}

#[derive(Debug, Serialize)]
pub struct IssueResponse {
    pub id: Uuid,
    pub label: String,
    pub max_uses: i32,
    pub expires_at: DateTime<Utc>,
    /// The hospital the QR names, for the printed sheet.
    pub tenant_name: String,
    /// The QR's text: `medbrains://bind?t=<signed token>`.
    pub qr: String,
}

pub async fn issue_binding_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<IssueRequest>, JsonRejection>,
) -> Result<Json<IssueResponse>, AppError> {
    require_permission(&claims, permissions::devices::binding::ISSUE)?;
    let Json(body) = body?;
    let label = check_label(&body.label)?;
    if !(1..=MAX_LIFETIME_HOURS).contains(&body.expires_in_hours) {
        return Err(AppError::BadRequest(format!(
            "expires_in_hours must be 1 to {MAX_LIFETIME_HOURS}"
        )));
    }
    if !(1..=MAX_USES).contains(&body.max_uses) {
        return Err(AppError::BadRequest(format!(
            "max_uses must be 1 to {MAX_USES}"
        )));
    }
    let key = binding_key(&state).await?;
    let (api_base, spki) = public_endpoint(&state).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (tenant, tenant_name): (String, String) =
        sqlx::query_as("SELECT code, name FROM tenants WHERE id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;
    let now = Utc::now();
    let expires_at = now + Duration::hours(body.expires_in_hours);
    let jti = token::new_nonce();
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO device_binding_codes \
            (tenant_id, jti, label, max_uses, expires_at, issued_by) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&jti)
    .bind(&label)
    .bind(body.max_uses)
    .bind(expires_at)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let signed = token::sign(
        &key,
        &BindingClaims {
            v: token::VERSION,
            iss: api_base.clone(),
            aud: token::AUDIENCE.to_owned(),
            tenant,
            tenant_name: tenant_name.clone(),
            api_base,
            spki,
            ik: token::issuer_key(&key),
            jti,
            iat: now.timestamp(),
            exp: expires_at.timestamp(),
        },
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.commit().await?;

    Ok(Json(IssueResponse {
        id,
        label,
        max_uses: body.max_uses,
        expires_at,
        tenant_name,
        qr: format!("{}{signed}", token::QR_PREFIX),
    }))
}

// ── List / revoke ─────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BindingCodeRow {
    pub id: Uuid,
    pub label: String,
    pub max_uses: i32,
    pub use_count: i32,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    pub issued_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

const CODE_SELECT: &str = "SELECT c.id, c.label, c.max_uses, c.use_count, c.expires_at, \
        c.revoked_at, c.revoke_reason, u.full_name AS issued_by_name, c.created_at \
     FROM device_binding_codes c LEFT JOIN users u ON u.id = c.issued_by";

pub async fn list_binding_codes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BindingCodeRow>>, AppError> {
    require_permission(&claims, permissions::devices::binding::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BindingCodeRow>(&format!(
        "{CODE_SELECT} WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
         ORDER BY c.created_at DESC LIMIT {LIST_LIMIT}"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub reason: Option<String>,
}

pub async fn revoke_binding_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Result<Json<RevokeRequest>, JsonRejection>,
) -> Result<Json<BindingCodeRow>, AppError> {
    require_permission(&claims, permissions::devices::binding::REVOKE)?;
    let Json(body) = body?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let revoked: Option<Uuid> = sqlx::query_scalar(
        "UPDATE device_binding_codes \
            SET revoked_at = now(), revoked_by = $1, revoke_reason = $2 \
          WHERE id = $3 AND tenant_id = $4 AND revoked_at IS NULL AND deleted_at IS NULL \
          RETURNING id",
    )
    .bind(claims.sub)
    .bind(
        body.reason
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty()),
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(id) = revoked else {
        return Err(AppError::NotFound);
    };
    let row = sqlx::query_as::<_, BindingCodeRow>(&format!("{CODE_SELECT} WHERE c.id = $1"))
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// A challenge is 32 random bytes, base64url without padding.
pub(crate) fn check_challenge(challenge: &str) -> Result<(), AppError> {
    let ok = URL_SAFE_NO_PAD
        .decode(challenge)
        .is_ok_and(|b| b.len() == CHALLENGE_BYTES);
    ok.then_some(())
        .ok_or_else(|| AppError::BadRequest("challenge must be 32 bytes, base64url".into()))
}

pub(crate) fn check_device(label: &str, public_key_pem: &str) -> Result<String, AppError> {
    let pem = public_key_pem.trim();
    if !pem.starts_with("-----BEGIN PUBLIC KEY-----") || pem.len() > MAX_PUBLIC_KEY_PEM_BYTES {
        return Err(AppError::BadRequest(
            "public_key_pem must be a PEM public key".into(),
        ));
    }
    check_label(label)
}
