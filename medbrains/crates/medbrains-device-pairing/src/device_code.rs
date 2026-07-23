//! Device-code pairing for surfaces that cannot scan a QR.
//!
//! The flow in the parent module is admin-first: an administrator mints a
//! token and the device redeems it. That works when the device has a camera to
//! read the administrator's QR with. A TV does not, so the direction reverses:
//!
//!   1. Display → `POST /api/device-pairing/device-code`
//!      Asks for a code. Returns a short `user_code` to put on screen and a
//!      long secret `device_code` to poll with.
//!
//!   2. Administrator → `POST /api/admin/device-pairing/approve`
//!      Reads the code off the screen and approves it, choosing which user the
//!      display will act as.
//!
//!   3. Display → `POST /api/device-pairing/device-token`
//!      Polls with `device_code`. Once approved this issues the JWT and records
//!      the device, exactly as `pair_device` does for the QR flow.
//!
//! Approving deliberately does not mint the JWT. It is issued to whoever polls
//! holding `device_code`, which is never displayed — so a `user_code` read off
//! a screen by a passer-by is not enough to take the session.

use axum::{
    Extension, Json,
    extract::State,
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::{Claims, encode_jwt};
use medbrains_server_core::state::AppState;

use crate::{DEVICE_JWT_DAYS, require_permission, sha256_hex};

/// Long enough that an unattended display is not stranded mid-shift, short
/// enough that an unclaimed code on a screen stops being useful.
const REQUEST_TTL_MINUTES: i64 = 15;

/// How often the display should poll, in seconds. Returned so the client does
/// not have to guess, and so the interval can change without shipping an app.
const POLL_INTERVAL_SECONDS: i64 = 5;

/// A display that never gets approved must not poll forever.
const MAX_POLLS: i32 = 400;

/// Digits and consonants only. No vowels, so the codes cannot spell anything;
/// no 0/O, 1/I/L or 5/S, the trios people misread off a screen across a ward. Someone has to read this aloud or retype it correctly the first time.
const CODE_ALPHABET: &[u8] = b"2346789BCDFGHJKMNPQRTVWXYZ";
const USER_CODE_LEN: usize = 8;

// ──────────────────────────────────────────────────────────────────
//  POST /api/device-pairing/device-code   (no auth — this is the start)
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DeviceCodeRequest {
    pub app_variant: String,
    pub label: String,
    /// Bound to the pairing when supplied, so the JWT is tied to this device.
    pub public_key_pem: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceCodeResponse {
    /// Shown on the display. Formatted `XXXX-XXXX` for reading aloud.
    pub user_code: String,
    /// Secret. Never displayed; the only thing that can claim the approval.
    pub device_code: String,
    pub expires_at: DateTime<Utc>,
    pub poll_interval_seconds: i64,
}

pub async fn request_device_code(
    State(state): State<AppState>,
    Json(body): Json<DeviceCodeRequest>,
) -> Result<Json<DeviceCodeResponse>, AppError> {
    if !matches!(body.app_variant.as_str(), "staff" | "tv" | "vendor") {
        return Err(AppError::BadRequest(
            "app_variant must be staff, tv or vendor".to_owned(),
        ));
    }
    if body.label.trim().is_empty() {
        return Err(AppError::BadRequest("label is required".to_owned()));
    }

    let user_code = generate_user_code();
    let device_code = sha256_hex(Uuid::new_v4().as_bytes());
    let expires_at = Utc::now() + Duration::minutes(REQUEST_TTL_MINUTES);

    // No tenant context: the display does not know its tenant yet, which is
    // exactly what it is asking to be told.
    sqlx::query(
        "INSERT INTO device_pairing_requests \
           (device_code, user_code, app_variant, requested_label, public_key_pem, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&device_code)
    .bind(&user_code)
    .bind(&body.app_variant)
    .bind(body.label.trim())
    .bind(body.public_key_pem.as_deref().map(str::trim))
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(Json(DeviceCodeResponse {
        user_code: format_user_code(&user_code),
        device_code,
        expires_at,
        poll_interval_seconds: POLL_INTERVAL_SECONDS,
    }))
}

// ──────────────────────────────────────────────────────────────────
//  POST /api/device-pairing/device-token   (no auth — gated by device_code)
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DeviceTokenRequest {
    pub device_code: String,
}

#[derive(Debug, Serialize)]
pub struct DeviceTokenResponse {
    /// `pending` | `approved` | `denied` | `expired`
    pub status: String,
    pub jwt: Option<String>,
    pub paired_device_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

fn still_waiting(status: &str) -> Json<DeviceTokenResponse> {
    Json(DeviceTokenResponse {
        status: status.to_owned(),
        jwt: None,
        paired_device_id: None,
        tenant_id: None,
        user_id: None,
    })
}

type RequestRow = (
    Uuid,
    Option<Uuid>,
    String,
    String,
    Option<String>,
    Option<Uuid>,
    DateTime<Utc>,
    i32,
);

pub async fn poll_device_token(
    State(state): State<AppState>,
    Json(body): Json<DeviceTokenRequest>,
) -> Result<Json<DeviceTokenResponse>, AppError> {
    let mut tx = state.db.begin().await?;

    let row: Option<RequestRow> = sqlx::query_as(
        "SELECT id, tenant_id, status, app_variant, public_key_pem, \
                approved_for_user_id, expires_at, poll_count \
         FROM device_pairing_requests WHERE device_code = $1 FOR UPDATE",
    )
    .bind(&body.device_code)
    .fetch_optional(&mut *tx)
    .await?;

    // An unknown code and an expired one are the same answer: ask for a new
    // one. Distinguishing them would let a caller probe which codes exist.
    let Some((id, tenant_id, status, app_variant, public_key_pem, approved_for, expires_at, polls)) =
        row
    else {
        return Ok(still_waiting("expired"));
    };

    if expires_at < Utc::now() || polls >= MAX_POLLS {
        return Ok(still_waiting("expired"));
    }

    sqlx::query(
        "UPDATE device_pairing_requests \
         SET poll_count = poll_count + 1, last_polled_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    match status.as_str() {
        "pending" => {
            tx.commit().await?;
            return Ok(still_waiting("pending"));
        }
        "denied" => {
            tx.commit().await?;
            return Ok(still_waiting("denied"));
        }
        // Already claimed: the JWT was handed out once and is not reissued.
        "claimed" => {
            tx.commit().await?;
            return Ok(still_waiting("expired"));
        }
        _ => {}
    }

    let (Some(tenant_id), Some(user_id)) = (tenant_id, approved_for) else {
        return Err(AppError::Internal(
            "approved pairing request is missing its tenant or user".to_owned(),
        ));
    };

    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Departments live on `users.department_ids`; there is no user_departments
    // table, so the previous join silently could not have worked.
    let user_row: Option<(String, i32, Vec<Uuid>)> = sqlx::query_as(
        // `users.role` is the `user_role` enum; decoding it as TEXT needs the cast.
        "SELECT u.role::text, u.perm_version, COALESCE(u.department_ids, ARRAY[]::uuid[]) \
         FROM users u WHERE u.id = $1 AND u.tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((role, perm_version, department_ids)) = user_row else {
        return Err(AppError::BadRequest(
            "the approved user no longer exists".to_owned(),
        ));
    };

    // The same resolver login uses, so a paired device carries exactly the
    // permissions its user would get by signing in — including the bypass-role
    // convention of an empty set.
    let permissions =
        medbrains_server_core::permissions::resolve_permissions(&state.db, tenant_id, user_id, &role)
            .await?;

    // A display that sent no key still pairs; the fingerprint then identifies
    // the pairing rather than the hardware.
    let cert_pem = public_key_pem.unwrap_or_else(|| format!("device-code:{id}"));
    let cert_fingerprint = sha256_hex(cert_pem.as_bytes());

    let paired_id: Uuid = sqlx::query_scalar(
        "INSERT INTO paired_devices \
           (tenant_id, label, app_variant, cert_fingerprint, cert_pem, issued_to_user_id, \
            paired_via_token_id) \
         SELECT $1, r.requested_label, $2, $3, $4, $5, NULL \
         FROM device_pairing_requests r WHERE r.id = $6 \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&app_variant)
    .bind(&cert_fingerprint)
    .bind(&cert_pem)
    .bind(user_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE device_pairing_requests \
         SET status = 'claimed', claimed_at = now(), paired_device_id = $1 WHERE id = $2",
    )
    .bind(paired_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let claims = Claims {
        sub: user_id,
        tenant_id,
        role,
        permissions,
        department_ids,
        perm_version,
        exp: (Utc::now() + Duration::days(DEVICE_JWT_DAYS)).timestamp() as usize,
    };
    let jwt = encode_jwt(&claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))?;

    Ok(Json(DeviceTokenResponse {
        status: "approved".to_owned(),
        jwt: Some(jwt),
        paired_device_id: Some(paired_id),
        tenant_id: Some(tenant_id),
        user_id: Some(user_id),
    }))
}

// ──────────────────────────────────────────────────────────────────
//  GET /api/admin/device-pairing/requests
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingRequest {
    pub id: Uuid,
    pub user_code: String,
    pub app_variant: String,
    pub requested_label: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_pairing_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingRequest>>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;

    // Pending requests carry no tenant yet, so this is deliberately global —
    // it is the queue of displays asking to be claimed by someone. Only the
    // code is shown; approving is what binds one to this tenant.
    let rows = sqlx::query_as::<_, PendingRequest>(
        "SELECT id, user_code, app_variant, requested_label, expires_at, created_at \
         FROM device_pairing_requests \
         WHERE status = 'pending' AND expires_at > now() \
         ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|mut row| {
                row.user_code = format_user_code(&row.user_code);
                row
            })
            .collect(),
    ))
}

// ──────────────────────────────────────────────────────────────────
//  POST /api/admin/device-pairing/approve
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ApproveRequest {
    pub user_code: String,
    /// Who the display acts as. Defaults to the approving administrator, which
    /// is rarely what you want for a ward board — pass a service account.
    pub approved_for_user_id: Option<Uuid>,
    #[serde(default)]
    pub deny: bool,
}

pub async fn approve_pairing_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ApproveRequest>,
) -> Result<Json<PendingRequest>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;

    let normalized = normalize_user_code(&body.user_code);
    let approved_for = body.approved_for_user_id.unwrap_or(claims.sub);
    let status = if body.deny { "denied" } else { "approved" };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if !body.deny {
        // The display will act as this user, so it has to be one of ours.
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active)",
        )
        .bind(approved_for)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !exists {
            return Err(AppError::BadRequest(
                "approved_for_user_id is not an active user in this tenant".to_owned(),
            ));
        }
    }

    let row = sqlx::query_as::<_, PendingRequest>(
        "UPDATE device_pairing_requests SET \
           status = $1, tenant_id = $2, approved_by_user_id = $3, \
           approved_for_user_id = $4, approved_at = now() \
         WHERE user_code = $5 AND status = 'pending' AND expires_at > now() \
         RETURNING id, user_code, app_variant, requested_label, expires_at, created_at",
    )
    .bind(status)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(if body.deny { None } else { Some(approved_for) })
    .bind(&normalized)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ──────────────────────────────────────────────────────────────────
//  Codes
// ──────────────────────────────────────────────────────────────────

fn generate_user_code() -> String {
    let mut out = String::with_capacity(USER_CODE_LEN);
    // Uuid is a CSPRNG source here and avoids taking a `rand` dependency that
    // conflicts with ed25519-dalek's.
    while out.len() < USER_CODE_LEN {
        for byte in Uuid::new_v4().as_bytes() {
            if out.len() == USER_CODE_LEN {
                break;
            }
            let index = usize::from(*byte) % CODE_ALPHABET.len();
            out.push(char::from(CODE_ALPHABET[index]));
        }
    }
    out
}

/// `ABCD-EFGH` — grouped for reading aloud across a ward.
fn format_user_code(code: &str) -> String {
    if code.len() != USER_CODE_LEN || code.contains('-') {
        return code.to_owned();
    }
    let (head, tail) = code.split_at(USER_CODE_LEN / 2);
    format!("{head}-{tail}")
}

/// Accepts what someone actually types: lower case, spaces, the dash we added.
fn normalize_user_code(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_codes_avoid_characters_that_are_misread() {
        for _ in 0..200 {
            let code = generate_user_code();
            assert_eq!(code.len(), USER_CODE_LEN);
            for c in code.chars() {
                assert!(
                    !"01OIL5SAEU".contains(c),
                    "generated {code}, which contains an easily misread or vowel character"
                );
            }
        }
    }

    #[test]
    fn formatting_round_trips_through_what_a_person_types() {
        let code = generate_user_code();
        let shown = format_user_code(&code);
        assert!(shown.contains('-'));
        assert_eq!(normalize_user_code(&shown), code);
        assert_eq!(normalize_user_code(&shown.to_lowercase()), code);
        assert_eq!(normalize_user_code(&format!(" {shown} ")), code);
    }

    #[test]
    fn codes_do_not_repeat() {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..500 {
            assert!(seen.insert(generate_user_code()), "generated a duplicate code");
        }
    }
}
