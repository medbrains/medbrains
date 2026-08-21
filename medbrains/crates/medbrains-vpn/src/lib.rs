//! VPN enrollment API (RFC-VPN-PLATFORM, Phase 1b).
//!
//! Mints per-device Headscale pre-auth keys for authenticated users, records the
//! device, and revokes it. Headscale is the on-prem control plane; MedBrains owns
//! identity + audit. The data plane is WireGuard peer-to-peer — never through here.
//! Requires the `vpn.enroll` permission; Headscale URL + API key come from the
//! secret resolver (VPN is unconfigured → a clear 400, since it's opt-in).

use axum::routing::{get, post};
use axum::{
    Json,
    extract::{Path, State},
};
use axum::Extension;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const HEADSCALE_URL_KEY: &str = "MEDBRAINS_HEADSCALE_URL";
const HEADSCALE_API_KEY: &str = "MEDBRAINS_HEADSCALE_API_KEY";
/// The Headscale user (namespace) devices join under; ACL tags scope per tenant.
const HEADSCALE_USER: &str = "medbrains";

#[derive(Deserialize)]
pub struct EnrollRequest {
    pub device_name: String,
}

#[derive(Serialize)]
pub struct EnrollResponse {
    pub device_id: Uuid,
    /// The Headscale login server the client points `tailscale up` at.
    pub login_server: String,
    /// Single-use pre-auth key — client runs `tailscale up --authkey <key>`.
    pub auth_key: String,
    pub expires_at: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct VpnDevice {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<Utc>,
    pub last_seen_at: Option<chrono::DateTime<Utc>>,
    pub revoked_at: Option<chrono::DateTime<Utc>>,
}

/// Resolve the Headscale endpoint + API key (opt-in: absent → clear 400).
async fn headscale_config(state: &AppState) -> Result<(String, String), AppError> {
    let url = state
        .secret_resolver
        .get(HEADSCALE_URL_KEY)
        .await
        .map_err(|_| AppError::BadRequest("VPN is not configured (Headscale URL)".to_owned()))?;
    let key = state
        .secret_resolver
        .get(HEADSCALE_API_KEY)
        .await
        .map_err(|_| AppError::BadRequest("VPN is not configured (Headscale API key)".to_owned()))?;
    Ok((url.trim_end_matches('/').to_owned(), key))
}

/// Mint a single-use, 24h pre-auth key via the Headscale API, tagged per tenant.
async fn mint_preauth_key(
    url: &str,
    api_key: &str,
    tenant_id: Uuid,
) -> Result<(String, String), AppError> {
    let expiry = (Utc::now() + Duration::hours(24)).to_rfc3339();
    let body = serde_json::json!({
        "user": HEADSCALE_USER,
        "reusable": false,
        "ephemeral": false,
        "expiration": expiry,
        "aclTags": [format!("tag:tenant-{tenant_id}")],
    });
    let resp = reqwest::Client::new()
        .post(format!("{url}/api/v1/preauthkey"))
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("headscale request failed: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "headscale preauthkey failed: {}",
            resp.status()
        )));
    }
    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("headscale response parse failed: {e}")))?;
    let key = v
        .get("preAuthKey")
        .and_then(|k| k.get("key"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| AppError::Internal("headscale: no key in response".to_owned()))?;
    Ok((key.to_owned(), expiry))
}

/// POST /api/vpn/enroll — mint a device pre-auth key + record the device.
pub async fn enroll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: axum_extra::extract::CookieJar,
    Json(req): Json<EnrollRequest>,
) -> Result<Json<EnrollResponse>, AppError> {
    require_permission(&claims, permissions::vpn::ENROLL)?;
    // Enrolling a device grants it network access to the HIMS — high-risk, so
    // require a fresh re-auth (the client prompts + retries automatically).
    medbrains_server_core::step_up::require_step_up(&state, &jar, &claims)?;
    let (url, api_key) = headscale_config(&state).await?;
    let (auth_key, expires_at) = mint_preauth_key(&url, &api_key, claims.tenant_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let device_id: Uuid = sqlx::query_scalar(
        "INSERT INTO vpn_devices (tenant_id, user_id, name) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&req.device_name)
    .fetch_one(&mut *tx)
    .await?;
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "vpn_enrolled",
            entity_type: "vpn_device",
            entity_id: Some(device_id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;
    tx.commit().await?;

    Ok(Json(EnrollResponse { device_id, login_server: url, auth_key, expires_at }))
}

/// GET /api/vpn/status — the caller's enrolled devices.
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<VpnDevice>>, AppError> {
    require_permission(&claims, permissions::vpn::ENROLL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let devices = sqlx::query_as::<_, VpnDevice>(
        "SELECT id, name, created_at, last_seen_at, revoked_at FROM vpn_devices \
         WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(devices))
}

/// POST /api/vpn/devices/{id}/revoke — deprovision a device (best-effort expire in Headscale).
pub async fn revoke(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(device_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::vpn::ENROLL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let node_id = sqlx::query_scalar::<_, Option<String>>(
        "UPDATE vpn_devices SET revoked_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND revoked_at IS NULL \
         RETURNING headscale_node_id",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    if node_id.is_none() {
        return Err(AppError::NotFound);
    }
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "vpn_revoked",
            entity_type: "vpn_device",
            entity_id: Some(device_id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;
    tx.commit().await?;

    // Best-effort: expire the node in Headscale so its key can't reconnect.
    if let Some(Some(nid)) = node_id {
        if let Ok((url, api_key)) = headscale_config(&state).await {
            let _ = reqwest::Client::new()
                .post(format!("{url}/api/v1/node/{nid}/expire"))
                .bearer_auth(api_key)
                .send()
                .await;
        }
    }
    Ok(Json(serde_json::json!({ "status": "revoked" })))
}

/// Revoke ALL of a user's VPN devices — called on logout-all / force-logout /
/// deprovision so a session cut-off severs every access channel, not just the
/// web/app session. Marks them revoked (own tx, under RLS) and best-effort
/// expires each node in Headscale so no key can reconnect.
pub async fn revoke_user_devices(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let node_ids = sqlx::query_scalar::<_, Option<String>>(
        "UPDATE vpn_devices SET revoked_at = now() \
         WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL \
         RETURNING headscale_node_id",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    if node_ids.iter().any(Option::is_some) {
        if let Ok((url, api_key)) = headscale_config(state).await {
            for nid in node_ids.into_iter().flatten() {
                let _ = reqwest::Client::new()
                    .post(format!("{url}/api/v1/node/{nid}/expire"))
                    .bearer_auth(&api_key)
                    .send()
                    .await;
            }
        }
    }
    Ok(())
}

/// VPN platform (device enroll/status/revoke) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/vpn/enroll", post(enroll))
        .route("/api/vpn/status", get(status))
        .route("/api/vpn/devices/{id}/revoke", post(revoke))
}
