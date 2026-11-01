//! Connected apps: vendor apps and extensions a hospital lets in
//! (RFC-HOSPITAL-OS §6 C1, §8g, §8j).
//!
//! An app is registered from its manifest, approved by a person who sees the
//! manifest's privacy label, and then signs in with OAuth 2.0 client
//! credentials ([`token`]). Every call it makes afterwards is an ordinary
//! machine-credential request: the token is an `api_keys` row carrying exactly
//! the manifest's permissions and acting as the app's own service identity, so
//! the same verification, rate limit, usage log, permission checks, per-record
//! access checks and audit apply as for every other caller. Revoking the app
//! revokes its tokens in the same transaction; the next call fails.
//!
//! Every route here goes through the kernel (`medbrains-kernel`): one unit of
//! work per request, the tenant and actor set by the kernel, audit through the
//! kernel's chain.

mod lifecycle;
pub mod manifest;
mod token;

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, AppError, Claims, Tx, audit, require_permission};
use medbrains_server_core::middleware::connected_app::{new_client_id, new_client_secret};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use token::public_router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/connected-apps", get(list).post(register))
        .route(
            "/api/admin/connected-apps/{id}/approve",
            post(lifecycle::approve),
        )
        .route(
            "/api/admin/connected-apps/{id}/revoke",
            post(lifecycle::revoke),
        )
        .route(
            "/api/admin/connected-apps/{id}/rotate-secret",
            post(lifecycle::rotate_secret),
        )
        .route("/api/admin/connected-apps/{id}/deliveries", get(deliveries))
}

#[derive(Debug, Serialize)]
pub struct AppSummary {
    pub id: Uuid,
    pub client_id: String,
    pub secret_prefix: String,
    pub name: String,
    pub publisher: String,
    pub purpose: String,
    pub version: String,
    pub manifest: serde_json::Value,
    pub permissions: serde_json::Value,
    pub status: String,
    pub has_webhook: bool,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by_name: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    pub secret_rotated_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Credentials, shown once. Nothing can recover them afterwards.
#[derive(Debug, Serialize)]
pub struct IssuedCredentials {
    pub id: Uuid,
    pub client_id: String,
    pub client_secret: String,
    /// Present when the manifest asks for events.
    pub webhook_signing_secret: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub manifest: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Delivery {
    pub id: Uuid,
    pub event_type: String,
    pub attempt: i32,
    pub status: String,
    pub response_status: Option<i32>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
}

async fn record(
    tx: &mut Tx,
    action: &str,
    app: Uuid,
    values: &serde_json::Value,
) -> Result<(), AppError> {
    let actor = tx.actor();
    audit(
        tx,
        &AuditEntry {
            tenant_id: actor.tenant_id,
            user_id: Some(actor.user_id),
            action,
            entity_type: "connected_app",
            entity_id: Some(app),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await
}

async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AppSummary>>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::VIEW)?;
    let tenant = claims.tenant_id;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        // The secret hash is never selected: a console has no use for it.
        let rows = sqlx::query_as!(
            AppSummary,
            r#"SELECT a.id, a.client_id, a.secret_prefix, a.name, a.publisher, a.purpose,
                      a.version, a.manifest, a.permissions, a.status,
                      a.webhook_subscription_id IS NOT NULL AS "has_webhook!",
                      a.approved_at, ap.full_name AS "approved_by_name?",
                      a.revoked_at, a.revoke_reason, a.secret_rotated_at,
                      (SELECT max(k.last_used_at) FROM api_keys k
                        WHERE k.connected_app_id = a.id) AS last_used_at,
                      a.created_at
                 FROM connected_apps a LEFT JOIN users ap ON ap.id = a.approved_by
                WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
                ORDER BY a.created_at DESC LIMIT 200"#,
            tenant,
        )
        .fetch_all(&mut **tx)
        .await?;
        Ok(Json(rows))
    })
    .await
}

fn new_webhook_secret() -> Result<String, AppError> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| AppError::Internal(format!("entropy: {e}")))?;
    Ok(format!("whsec_{}", hex::encode(bytes)))
}

async fn register(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<RegisterRequest>, JsonRejection>,
) -> Result<Json<IssuedCredentials>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::MANAGE)?;
    let Json(body) = body?;
    let m = manifest::validate(&body.manifest).map_err(|errors| {
        AppError::BadRequest(format!("The manifest is not valid: {}", errors.join("; ")))
    })?;
    if m.kind == "wasm-block" {
        return Err(AppError::BadRequest(
            "WASM blocks are installed through the store (phase K4), not connected as apps"
                .to_owned(),
        ));
    }
    if let Some(url) = m.webhook_url.as_deref()
        && !medbrains_outbox::handlers::webhook::is_allowed_target(url)
    {
        return Err(AppError::BadRequest(
            "webhookUrl must be public HTTPS — not localhost or an address inside the hospital"
                .to_owned(),
        ));
    }

    let id = Uuid::new_v4();
    let client_id = new_client_id()?;
    let secret = new_client_secret()?;
    let webhook_secret = m
        .webhook_url
        .as_ref()
        .map(|_| new_webhook_secret())
        .transpose()?;
    let username = format!("svc_app_{}", &id.simple().to_string()[..12]);
    let tenant = claims.tenant_id;
    let admin = claims.sub;

    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let service_user: Uuid = sqlx::query_scalar!(
            "INSERT INTO users (tenant_id, username, email, full_name, role, is_service_account, \
             is_active, email_verified) \
             VALUES ($1, $2, $3, $4, 'service_account', true, true, false) RETURNING id",
            tenant,
            &username,
            format!("{username}@service.invalid"),
            &m.name,
        )
        .fetch_one(&mut **tx)
        .await?;

        // Switched on only at approval: a pending app is told nothing.
        let subscription = match (m.webhook_url.as_deref(), webhook_secret.as_deref()) {
            (Some(url), Some(signing)) => Some(
                sqlx::query_scalar!(
                    "INSERT INTO webhook_subscriptions \
                       (tenant_id, name, url, signing_secret, event_types, is_active, created_by) \
                     VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING id",
                    tenant,
                    format!("App: {}", m.name),
                    url,
                    signing,
                    &m.events,
                    admin,
                )
                .fetch_one(&mut **tx)
                .await?,
            ),
            _ => None,
        };

        sqlx::query!(
            "INSERT INTO connected_apps (id, tenant_id, client_id, client_secret_hash, secret_prefix, \
               name, publisher, purpose, version, manifest, permissions, service_user_id, \
               webhook_subscription_id, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
            id,
            tenant,
            &client_id,
            &secret.hash,
            &secret.prefix,
            m.name.trim(),
            m.publisher.name.trim(),
            m.purpose.trim(),
            &m.version,
            &body.manifest,
            serde_json::json!(m.permissions),
            service_user,
            subscription,
            admin,
        )
        .execute(&mut **tx)
        .await?;

        let values = serde_json::json!({ "name": m.name, "client_id": client_id, "permissions": m.permissions });
        record(tx, "connected_app_registered", id, &values).await
    })
    .await?;

    Ok(Json(IssuedCredentials {
        id,
        client_id,
        client_secret: secret.secret,
        webhook_signing_secret: webhook_secret,
    }))
}

async fn deliveries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Delivery>>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::VIEW)?;
    let tenant = claims.tenant_id;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let rows = sqlx::query_as!(
            Delivery,
            "SELECT d.id, d.event_type, d.attempt, d.status, d.response_status, d.error, d.created_at \
               FROM webhook_deliveries d \
               JOIN connected_apps a ON a.webhook_subscription_id = d.subscription_id \
              WHERE a.id = $1 AND a.tenant_id = $2 AND d.tenant_id = $2 \
              ORDER BY d.created_at DESC LIMIT 100",
            id,
            tenant,
        )
        .fetch_all(&mut **tx)
        .await?;
        Ok(Json(rows))
    })
    .await
}
