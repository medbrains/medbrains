//! Webhook subscriptions (#224): which events the hospital sends to which
//! partner URL, the secret that signs them, and what happened to each send.
//!
//! The secret is shown once, when it is created or rotated, like an API key.
//! The URL must be public HTTPS (`is_allowed_target`), checked here and again
//! at delivery.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::clinical_events::ClinicalEventName;
use medbrains_core::permissions;
use medbrains_outbox::handlers::webhook::is_allowed_target;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const COLUMNS: &str = "id, name, url, event_types, is_active, created_at, updated_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct WebhookSubscription {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) url: String,
    pub(crate) event_types: Vec<String>,
    pub(crate) is_active: bool,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

/// The only response that carries the signing secret.
#[derive(Debug, Serialize)]
pub(crate) struct WebhookWithSecret {
    #[serde(flatten)]
    pub(crate) subscription: WebhookSubscription,
    pub(crate) signing_secret: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct WebhookInput {
    pub(crate) name: String,
    pub(crate) url: String,
    pub(crate) event_types: Vec<String>,
    pub(crate) is_active: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct WebhookDelivery {
    pub(crate) id: Uuid,
    pub(crate) outbox_event_id: Uuid,
    pub(crate) event_type: String,
    pub(crate) attempt: i32,
    pub(crate) status: String,
    pub(crate) response_status: Option<i32>,
    pub(crate) error: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
}

fn new_secret() -> Result<String, AppError> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| AppError::Internal(format!("secret: {e}")))?;
    Ok(format!("whsec_{}", hex::encode(bytes)))
}

/// What is wrong with an input, in words the administrator can act on.
fn check(input: &WebhookInput) -> Result<(), AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Name the partner this goes to".to_owned(),
        ));
    }
    if !is_allowed_target(input.url.trim()) {
        return Err(AppError::BadRequest(
            "The URL must be public HTTPS — not http, localhost or an address inside the hospital"
                .to_owned(),
        ));
    }
    if input.event_types.is_empty() {
        return Err(AppError::BadRequest("Pick at least one event".to_owned()));
    }
    if let Some(bad) = input
        .event_types
        .iter()
        .find(|e| e.parse::<ClinicalEventName>().is_err())
    {
        return Err(AppError::BadRequest(format!(
            "'{bad}' is not an event this system sends"
        )));
    }
    Ok(())
}

async fn begin(
    state: &AppState,
    claims: &Claims,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

pub(crate) async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<WebhookSubscription>>, AppError> {
    require_permission(&claims, permissions::admin::webhooks::LIST)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, WebhookSubscription>(&format!(
        "SELECT {COLUMNS} FROM webhook_subscriptions \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub(crate) async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<WebhookInput>,
) -> Result<Json<WebhookWithSecret>, AppError> {
    require_permission(&claims, permissions::admin::webhooks::MANAGE)?;
    check(&body)?;
    let secret = new_secret()?;
    let mut tx = begin(&state, &claims).await?;
    let subscription = sqlx::query_as::<_, WebhookSubscription>(&format!(
        "INSERT INTO webhook_subscriptions \
           (tenant_id, name, url, signing_secret, event_types, is_active, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.url.trim())
    .bind(&secret)
    .bind(&body.event_types)
    .bind(body.is_active.unwrap_or(true))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(WebhookWithSecret {
        subscription,
        signing_secret: secret,
    }))
}

pub(crate) async fn update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<WebhookInput>,
) -> Result<Json<WebhookSubscription>, AppError> {
    require_permission(&claims, permissions::admin::webhooks::MANAGE)?;
    check(&body)?;
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, WebhookSubscription>(&format!(
        "UPDATE webhook_subscriptions SET name = $1, url = $2, event_types = $3, \
                is_active = COALESCE($4, is_active) \
          WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(body.name.trim())
    .bind(body.url.trim())
    .bind(&body.event_types)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// A new secret, shown once; the old one stops verifying immediately.
pub(crate) async fn rotate_secret(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookWithSecret>, AppError> {
    require_permission(&claims, permissions::admin::webhooks::MANAGE)?;
    let secret = new_secret()?;
    let mut tx = begin(&state, &claims).await?;
    let subscription = sqlx::query_as::<_, WebhookSubscription>(&format!(
        "UPDATE webhook_subscriptions SET signing_secret = $1 \
          WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(&secret)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(WebhookWithSecret {
        subscription,
        signing_secret: secret,
    }))
}

pub(crate) async fn deliveries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WebhookDelivery>>, AppError> {
    require_permission(&claims, permissions::admin::webhooks::LIST)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, WebhookDelivery>(
        "SELECT id, outbox_event_id, event_type, attempt, status, response_status, error, created_at \
           FROM webhook_deliveries WHERE tenant_id = $1 AND subscription_id = $2 \
          ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
