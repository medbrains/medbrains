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
use axum::routing::{get,post,delete};

pub mod device_code;
use chrono::{DateTime, Duration, Utc};
use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::{Claims, encode_jwt};
use medbrains_server_core::state::AppState;

const TOKEN_TTL_MINUTES: i64 = 5;
pub(crate) const DEVICE_JWT_DAYS: i64 = 30;

pub(crate) fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
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
    /// Location axis — which instance of the surface this device serves.
    pub department_id: Option<Uuid>,
    pub location_label: Option<String>,
    pub location_scope: Option<serde_json::Value>,
    /// First-class station this device sits at (nurse station, OPD counter, kiosk point).
    pub station_id: Option<Uuid>,
}

/// A valid surface code: a legacy coarse variant, or `<Factor>` / `<Factor>-<Name>` where Factor is
/// one of the known form-factors. Fine surfaces (TV-Ward, Mobile-Doctor, Desktop-Kiosk) are the
/// 34-surface catalog; validated by shape here, not a fixed DB enum.
fn is_valid_app_variant(v: &str) -> bool {
    matches!(v, "staff" | "tv" | "vendor" | "Web")
        || v
            .split_once('-')
            .is_some_and(|(f, rest)| matches!(f, "TV" | "Mobile" | "Desktop" | "Kiosk") && !rest.is_empty())
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
    if !is_valid_app_variant(&body.intended_app_variant) {
        return Err(AppError::BadRequest(format!(
            "invalid intended_app_variant '{}'",
            body.intended_app_variant
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let token = generate_token();
    let expires_at = Utc::now() + Duration::minutes(TOKEN_TTL_MINUTES);
    let location_scope = body.location_scope.clone().unwrap_or_else(|| serde_json::json!({}));

    let row = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        "INSERT INTO device_pairing_tokens (\
            tenant_id, token, expires_at, issued_by_user_id, \
            intended_device_label, intended_app_variant, intended_user_id, notes, \
            department_id, location_label, location_scope, station_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
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
    .bind(body.department_id)
    .bind(body.location_label.as_deref())
    .bind(&location_scope)
    .bind(body.station_id)
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
    type PairingTokenRow = (
        Uuid,
        Uuid,
        String,
        String,
        Option<Uuid>,
        Uuid,
        DateTime<Utc>,
        Option<DateTime<Utc>>,
        Option<Uuid>,
        Option<String>,
        serde_json::Value,
        Option<Uuid>,
    );
    let token_row: Option<PairingTokenRow> = sqlx::query_as(
        "SELECT id, tenant_id, intended_device_label, intended_app_variant, \
                intended_user_id, issued_by_user_id, expires_at, used_at, \
                department_id, location_label, location_scope, station_id \
         FROM device_pairing_tokens WHERE token = $1",
    )
    .bind(&body.token)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((
        token_id,
        tenant_id,
        _label,
        app_variant,
        intended_user,
        issued_by,
        expires_at,
        used_at,
        department_id,
        location_label,
        location_scope,
        station_id,
    )) = token_row
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
            "intended_user_id no longer exists".into(),
        ));
    };

    // The same resolver login uses, so a paired device carries exactly the
    // permissions its user would get by signing in — including the bypass-role
    // convention of an empty set.
    let permissions =
        medbrains_server_core::permissions::resolve_permissions(&state.db, tenant_id, user_id, &role)
            .await?;

    let cert_pem = body.public_key_pem.trim().to_owned();

    // Insert the paired device row.
    let paired_id: Uuid = sqlx::query_scalar(
        "INSERT INTO paired_devices (\
            tenant_id, label, app_variant, cert_fingerprint, cert_pem, \
            issued_to_user_id, paired_via_token_id, \
            department_id, location_label, location_scope, station_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&body.label)
    .bind(&app_variant)
    .bind(&cert_fingerprint)
    .bind(&cert_pem)
    .bind(user_id)
    .bind(token_id)
    .bind(department_id)
    .bind(location_label.as_deref())
    .bind(&location_scope)
    .bind(station_id)
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
    //
    // It names the device, not just the user who paired it. That is what makes
    // revoking the device mean something: this token lives for weeks on
    // hardware that gets lost, and every request re-checks the named device is
    // still admitted. Without the claim, revocation would change a row and the
    // tablet would keep working until the token expired on its own.
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        tenant_id,
        role,
        permissions,
        department_ids,
        perm_version,
        paired_device_id: Some(paired_id),
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
    pub department_id: Option<Uuid>,
    pub location_label: Option<String>,
    pub station_id: Option<Uuid>,
    pub station_name: Option<String>,
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
        "SELECT pd.id, pd.label, pd.app_variant, pd.cert_fingerprint, pd.issued_to_user_id, \
                pd.department_id, pd.location_label, pd.station_id, s.name AS station_name, \
                pd.paired_at, pd.last_seen_at, pd.revoked_at \
         FROM paired_devices pd \
         LEFT JOIN stations s ON s.id = pd.station_id \
         WHERE pd.tenant_id = $1 \
         ORDER BY pd.paired_at DESC LIMIT 5000",
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

    // Revoking a device revokes the key it syncs by, in the same transaction.
    // Otherwise a device recorded as revoked keeps a live key sitting in the
    // roster that offline nodes admit from, and it goes on being accepted out
    // in the field long after somebody believed they had cut it off.
    sqlx::query(
        "UPDATE device_node_keys SET revoked_at = now(), revoked_by = $2 \
         WHERE paired_device_id = $1 AND tenant_id = $3 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

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

pub(crate) fn sha256_hex(input: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input);
    hex::encode(hasher.finalize())
}

/// device_pairing routes.
/// The one pairing route a device can reach before it has credentials.
///
/// Gated by the short-lived one-time pairing token in the body, not by a JWT —
/// a device presenting itself for the first time has nothing else to present.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new().route("/api/device-pairing/pair", post(pair_device))
}

/// Device administration, all of which requires an authenticated operator.
///
/// Every handler here extracts `Claims` and checks a `devices::pairing`
/// permission. Merged into the public router they never receive that
/// extension, so Axum rejects with a 500 before the permission check runs and
/// the whole device estate becomes unmanageable.
pub fn admin_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/device-pairing/paired/{id}/node-key",
            get(get_device_node_key)
                .post(register_device_node_key)
                .delete(revoke_device_node_key),
        )
        .route("/api/device-pairing/peer-roster", get(get_peer_roster))
        .route(
            "/api/admin/device-pairing-tokens",
            post(mint_pairing_token),
        )
        .route(
            "/api/admin/paired-devices",
            get(list_paired_devices),
        )
        .route(
            "/api/admin/paired-devices/{id}",
            delete(revoke_paired_device),
        )
}

/// Device-code pairing routes. The first two are unauthenticated by design —
/// a display has no credentials yet, which is what it is asking for.
pub fn device_code_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/device-pairing/device-code",
            post(device_code::request_device_code),
        )
        .route(
            "/api/device-pairing/device-token",
            post(device_code::poll_device_token),
        )
}

/// Approval routes, which do require an authenticated administrator.
pub fn device_code_admin_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/admin/device-pairing/requests",
            get(device_code::list_pairing_requests),
        )
        .route(
            "/api/admin/device-pairing/approve",
            post(device_code::approve_pairing_request),
        )
}

// ══════════════════════════════════════════════════════════
//  Peer node keys — see medbrains_edge::peer_admission
// ══════════════════════════════════════════════════════════

#[derive(Debug, serde::Deserialize)]
pub struct RegisterNodeKeyRequest {
    pub node_id: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct DeviceNodeKey {
    pub id: Uuid,
    pub paired_device_id: Uuid,
    pub node_id: String,
    pub revoked_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// `POST /api/device-pairing/paired/{id}/node-key`
///
/// Binds a peer-to-peer node key to a device that has already been paired.
///
/// Enrolment is a privileged act, not something a device does for itself. The
/// device presents its public key; an operator with device-management rights
/// decides it belongs to a machine this hospital admitted. A device that could
/// self-enrol would make the binding worthless — anyone able to reach the
/// endpoint could mint an admitted peer.
///
/// Re-registering replaces the live key rather than adding a second, so a
/// device that rotates its key does not leave a usable old one behind.
pub async fn register_device_node_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RegisterNodeKeyRequest>,
) -> Result<Json<DeviceNodeKey>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;

    let node_id = body.node_id.trim();
    if node_id.is_empty() {
        return Err(AppError::BadRequest("node_id is required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The device must exist in this tenant. Without this the FK would still
    // hold, but a key could be bound to another tenant's device.
    let owns_device: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM paired_devices WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !owns_device {
        return Err(AppError::NotFound);
    }

    // Retire whatever this device had. Revoked rows are kept: an audit asking
    // which device held a key at a point in time needs the history.
    sqlx::query(
        "UPDATE device_node_keys SET revoked_at = now(), revoked_by = $2 \
         WHERE paired_device_id = $1 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, DeviceNodeKey>(
        "INSERT INTO device_node_keys (tenant_id, paired_device_id, node_id, created_by) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, paired_device_id, node_id, revoked_at, last_seen_at, created_at",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(node_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        // The unique index is global: a key already claimed elsewhere must not
        // be silently rebound, and the answer says nothing about who holds it.
        if matches!(&e, sqlx::Error::Database(db) if db.is_unique_violation()) {
            AppError::Conflict("that node key is already registered".into())
        } else {
            AppError::from(e)
        }
    })?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/device-pairing/paired/{id}/node-key`
///
/// Revokes without deleting. This is the emergency stop for a lost tablet, and
/// it is expected to be used long before anyone gets round to changing the
/// device's status.
pub async fn revoke_device_node_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let revoked = sqlx::query(
        "UPDATE device_node_keys SET revoked_at = now(), revoked_by = $2 \
         WHERE paired_device_id = $1 AND tenant_id = $3 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "revoked": revoked })))
}

/// `GET /api/device-pairing/paired/{id}/node-key`
///
/// The live key for a device, if it has one. Revoked keys are not returned —
/// the history exists for audit, not for an operator screen to confuse.
pub async fn get_device_node_key(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<DeviceNodeKey>>, AppError> {
    require_permission(&claims, permissions::devices::pairing::PAIRED_LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DeviceNodeKey>(
        "SELECT id, paired_device_id, node_id, revoked_at, last_seen_at, created_at \
         FROM device_node_keys \
         WHERE paired_device_id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/device-pairing/peer-roster`
///
/// The list an edge appliance or a phone uses to admit peers while it cannot
/// reach this server.
///
/// Neither of those carries a database, so without this they can only admit
/// nobody — which is safe, and useless. This hands them the same facts the
/// database holds and lets the shared admission rule decide, rather than
/// shipping pre-computed verdicts that would put a second copy of that rule on
/// every device.
///
/// Revoked keys are omitted rather than sent as revoked: a key absent from the
/// roster is refused for the same reason and with the same message, so there is
/// nothing to gain by listing retirements to every device in the hospital.
///
/// Devices that are paired but out of service ARE listed, with their real
/// status. The rule refuses them; sending the status keeps that decision in one
/// place instead of splitting it between the query and the device.
pub async fn get_peer_roster(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PeerRosterDoc>, AppError> {
    // Either right opens this. `ROSTER_READ` exists so an appliance can hold
    // *only* this — it polls unattended and keeps its credential on disk for
    // months, and a leaked token that also lists every paired device is a map
    // of the estate. `PAIRED_LIST` is accepted too because an operator holding
    // it can already see this data on the devices screen; requiring the new
    // right as well would have logged them out of a page that worked yesterday.
    if require_permission(&claims, permissions::devices::pairing::ROSTER_READ).is_err() {
        require_permission(&claims, permissions::devices::pairing::PAIRED_LIST)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PeerRosterRow>(
        "SELECT k.node_id, k.paired_device_id, d.app_variant \
         FROM device_node_keys k \
         JOIN paired_devices d ON d.id = k.paired_device_id \
         WHERE k.tenant_id = $1 AND k.revoked_at IS NULL AND d.revoked_at IS NULL \
         ORDER BY k.node_id",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let peers = rows
        .into_iter()
        .map(|r| PeerRosterEntry {
            node_id: r.node_id,
            binding: PeerBinding {
                paired_device_id: r.paired_device_id,
                tenant_id: claims.tenant_id,
                app_variant: r.app_variant,
                // Both the key and the device are filtered to live rows above,
                // so anything reaching here is a device that may still sync.
                revoked: false,
            },
        })
        .collect();

    Ok(Json(PeerRosterDoc {
        tenant_id: claims.tenant_id,
        issued_at: Utc::now().timestamp(),
        peers,
    }))
}

/// The roster query's row shape. Kept separate from the wire type so the SQL
/// can change without moving what devices parse.
#[derive(sqlx::FromRow)]
struct PeerRosterRow {
    node_id: String,
    paired_device_id: Uuid,
    app_variant: String,
}
