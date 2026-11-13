//! Device-code pairing for screens that cannot scan a QR.
//!
//! The flow in the parent module is admin-first: an administrator mints a
//! token and the device redeems it. That works when the device has a camera to
//! read the administrator's QR with. A TV does not, so the direction reverses:
//!
//!   1. Screen → `POST /api/device-pairing/device-code`
//!      Names its hospital by code and asks for a pairing code. Returns a
//!      short `user_code` to put on screen and a long secret `device_code` to
//!      poll with. The request belongs to that hospital from the start.
//!
//!   2. Administrator → `POST /api/admin/device-pairing/approve`
//!      Picks the waiting screen from the list (which never shows the code)
//!      and types the code the screen shows. A wrong code counts; the fifth
//!      refuses the request.
//!
//!   3. Screen → `POST /api/device-pairing/device-token`
//!      Polls with `device_code`. Once approved this issues a display token —
//!      the hospital's display account, `display.board.read` and nothing else.
//!
//! Only screens pair this way. A phone or tablet acts as a person, so it pairs
//! through the admin-minted token or the hospital binding QR, where the
//! administrator chooses who it acts as before anything is issued.
//!
//! Approving deliberately does not mint the JWT. It is issued to whoever polls
//! holding `device_code`, which is never displayed.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::{Claims, encode_jwt, is_display_variant};
use medbrains_server_core::state::AppState;

use crate::{DEVICE_JWT_DAYS, sha256_hex};
use medbrains_server_core::middleware::authorization::require_permission;

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

/// The one app variant that pairs by code: a screen, which acts as the
/// hospital's display account and never as a person.
const SCREEN_VARIANT: &str = "tv";

/// Screens one hospital may have waiting at once. A ward fitting out a floor
/// stays well under it; a flood of requests stops here instead of filling the
/// administrator's list and the table.
const MAX_WAITING_PER_HOSPITAL: i64 = 50;

/// The longest name a screen may give itself, as the binding flow allows.
const MAX_LABEL_CHARS: usize = 120;
/// A public key PEM is a few hundred bytes; anything far larger is not one.
const MAX_PUBLIC_KEY_PEM_BYTES: usize = 4096;

// ──────────────────────────────────────────────────────────────────
//  POST /api/device-pairing/device-code   (no auth — this is the start)
// ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DeviceCodeRequest {
    /// The hospital's code (`tenants.code`), from the address the screen was
    /// opened at or typed on it. The request belongs to this hospital only.
    pub hospital_code: String,
    pub app_variant: String,
    pub label: String,
    /// Bound to the pairing when supplied, so the JWT is tied to this device.
    pub public_key_pem: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceCodeResponse {
    /// Shown on the display. Formatted `XXXX-XXXX` for reading aloud.
    pub user_code: String,
    /// Shown on the display and on the administrator's list, so a person can
    /// tell which row is which screen. Not secret, and not enough to approve.
    pub reference: String,
    /// Secret. Never displayed; the only thing that can claim the approval.
    pub device_code: String,
    pub expires_at: DateTime<Utc>,
    pub poll_interval_seconds: i64,
}

/// Refuses what a screen may not ask for: anything but a screen, an empty or
/// overlong name, or a key too large to be one. Returns the trimmed label.
fn check_request(body: &DeviceCodeRequest) -> Result<&str, AppError> {
    if body.app_variant != SCREEN_VARIANT {
        return Err(AppError::BadRequest(
            "Only a screen pairs with a code. A phone or tablet pairs by scanning the \
             hospital's QR on Admin → Paired devices."
                .to_owned(),
        ));
    }
    let label = body.label.trim();
    if label.is_empty() || label.chars().count() > MAX_LABEL_CHARS {
        return Err(AppError::BadRequest(format!(
            "label is required and at most {MAX_LABEL_CHARS} characters"
        )));
    }
    if body
        .public_key_pem
        .as_ref()
        .is_some_and(|pem| pem.len() > MAX_PUBLIC_KEY_PEM_BYTES)
    {
        return Err(AppError::BadRequest(
            "public_key_pem is too large".to_owned(),
        ));
    }
    Ok(label)
}

/// The active hospital a screen named, by its code. An unknown code is a 400
/// the screen shows, so whoever set it up can correct the address.
async fn hospital_by_code(state: &AppState, code: &str) -> Result<Uuid, AppError> {
    sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active")
        .bind(code.trim().to_ascii_uppercase())
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest(
                "No hospital has that code. Check the address on Admin → Paired devices."
                    .to_owned(),
            )
        })
}

/// `POST /api/device-pairing/device-code`: a screen asks to be paired with
/// one hospital. Opens the request under that hospital's context, so only its
/// administrators ever see it, and refuses once too many are waiting.
pub async fn request_device_code(
    State(state): State<AppState>,
    Json(body): Json<DeviceCodeRequest>,
) -> Result<Json<DeviceCodeResponse>, AppError> {
    let label = check_request(&body)?;
    let tenant_id = hospital_by_code(&state, &body.hospital_code).await?;
    let user_code = generate_user_code();
    let device_code = sha256_hex(Uuid::new_v4().as_bytes());
    let expires_at = Utc::now() + Duration::minutes(REQUEST_TTL_MINUTES);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // ponytail: two requests racing past the count can exceed the cap by one
    // each; the per-IP limit bounds that, so no lock.
    let waiting: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM device_pairing_requests \
          WHERE tenant_id = $1 AND node_id IS NULL AND status = 'pending' AND expires_at > now()",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if waiting >= MAX_WAITING_PER_HOSPITAL {
        return Err(AppError::TooManyRequests(
            "Too many screens are waiting to be paired. Approve or refuse them on Admin → \
             Paired devices, then try again."
                .to_owned(),
        ));
    }
    let reference: String = sqlx::query_scalar(
        "INSERT INTO device_pairing_requests \
           (tenant_id, device_code, user_code, app_variant, requested_label, public_key_pem, \
            expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING upper(left(id::text, 6))",
    )
    .bind(tenant_id)
    .bind(&device_code)
    .bind(&user_code)
    .bind(SCREEN_VARIANT)
    .bind(label)
    .bind(body.public_key_pem.as_deref().map(str::trim))
    .bind(expires_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(DeviceCodeResponse {
        user_code: format_user_code(&user_code),
        reference,
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

    // Counts the poll and locks the row until this transaction ends, through
    // `app_poll_device_pairing_request` (migration 1206): a pending request
    // has no tenant yet, and the device code is how its tenant is found.
    let row: Option<RequestRow> = sqlx::query_as(
        "SELECT id, tenant_id, status, app_variant, public_key_pem, \
                approved_for_user_id, expires_at, poll_count \
         FROM app_poll_device_pairing_request($1)",
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
    // Only a screen acting as the display account is ever issued a token here.
    // Approval already guarantees both; this is the last line, so a row that
    // got past it some other way issues nothing.
    if !is_display_variant(&app_variant) || role != "service_account" {
        return Err(AppError::Forbidden);
    }
    // A screen reads boards and nothing else, whoever its account is.
    let permissions = vec![permissions::display::board::READ.to_owned()];

    // A display that sent no key still pairs; the fingerprint then identifies
    // the pairing rather than the hardware.
    let cert_pem = public_key_pem.unwrap_or_else(|| format!("device-code:{id}"));
    let cert_fingerprint = sha256_hex(cert_pem.as_bytes());

    let paired_id: Uuid = sqlx::query_scalar(
        "INSERT INTO paired_devices \
           (tenant_id, label, app_variant, cert_fingerprint, cert_pem, issued_to_user_id, \
            paired_via_token_id, department_id, board_module, station_id) \
         SELECT $1, r.requested_label, $2, $3, $4, $5, NULL, r.department_id, r.board_module, \
                r.station_id \
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
        // The other pairing flow. Same reasoning as `pair_device`: without the
        // claim, revoking a device paired by code would not stop it.
        paired_device_id: Some(paired_id),
        act: None,
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

/// A screen waiting to be paired, as an administrator sees it. Deliberately
/// without its code: the code is what proves the person approving can see the
/// screen, so the server never hands it out.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingRequest {
    pub id: Uuid,
    /// The short reference the screen shows beside its code (see
    /// [`DeviceCodeResponse::reference`]).
    pub reference: String,
    pub app_variant: String,
    pub requested_label: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/admin/device-pairing/requests`: the screens waiting to be paired
/// with this hospital, newest first.
pub async fn list_pairing_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingRequest>>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PendingRequest>(
        "SELECT id, upper(left(id::text, 6)) AS reference, app_variant, requested_label, \
                expires_at, created_at \
         FROM device_pairing_requests \
         WHERE tenant_id = $1 AND status = 'pending' AND expires_at > now() \
           AND node_id IS NULL \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *conn)
    .await?;
    Ok(Json(rows))
}

// ──────────────────────────────────────────────────────────────────
//  Codes
// ──────────────────────────────────────────────────────────────────

pub(crate) fn generate_user_code() -> String {
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
pub(crate) fn format_user_code(code: &str) -> String {
    if code.len() != USER_CODE_LEN || code.contains('-') {
        return code.to_owned();
    }
    let (head, tail) = code.split_at(USER_CODE_LEN / 2);
    format!("{head}-{tail}")
}

/// Accepts what someone actually types: lower case, spaces, the dash we added.
pub(crate) fn normalize_user_code(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

/// The board a paired screen shows.
#[derive(Debug, Serialize)]
pub struct DeviceBoard {
    pub label: String,
    /// `None` for a screen paired before boards were bound — it asks to be
    /// re-paired rather than guessing a department.
    pub module: Option<String>,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
}

/// `GET /api/device/board` — which board this paired screen shows, so a TV
/// nobody touches opens on its own department without a keyboard.
pub async fn device_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DeviceBoard>, AppError> {
    medbrains_server_core::middleware::authorization::require_board_read(&claims)?;
    let device = claims.paired_device_id.ok_or(AppError::NotFound)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let board = sqlx::query_as!(
        DeviceBoard,
        r#"SELECT p.label AS "label!", p.board_module AS module, p.department_id,
                  d.name AS "department_name?"
             FROM paired_devices p LEFT JOIN departments d ON d.id = p.department_id
            WHERE p.id = $1 AND p.revoked_at IS NULL AND p.deleted_at IS NULL"#,
        device,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(board))
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
    fn only_a_screen_may_ask_for_a_code() {
        let ask = |variant: &str| DeviceCodeRequest {
            hospital_code: "DEFAULT".to_owned(),
            app_variant: variant.to_owned(),
            label: "Hall".to_owned(),
            public_key_pem: None,
        };
        assert!(check_request(&ask("tv")).is_ok());
        for variant in ["staff", "vendor", "Mobile-Doctor", "TV-Ward", ""] {
            assert!(
                check_request(&ask(variant)).is_err(),
                "{variant} was let in"
            );
        }
    }

    #[test]
    fn codes_do_not_repeat() {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..500 {
            assert!(
                seen.insert(generate_user_code()),
                "generated a duplicate code"
            );
        }
    }
}
