//! OAuth connect routes — the admin-facing side of the common token module.
//! Authorize → consent → exchange → stored connection; list + disconnect.

pub mod oauth;
pub use oauth::{KNOWN_OAUTH_PROVIDERS, OAuthConnection, oauth_provider_spec};

use axum::routing::{delete,get,post};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct OAuthProviderInfo {
    pub provider: String,
    pub label: String,
    pub scopes: String,
    pub connected: bool,
    pub external_account_id: Option<String>,
    pub status: Option<String>,
}

/// GET /api/oauth/providers — known providers + per-tenant connection status.
pub async fn list_oauth_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OAuthProviderInfo>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let conns = sqlx::query_as!(
        OAuthConnection,
        "SELECT * FROM oauth_connections WHERE tenant_id = $1",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let infos = KNOWN_OAUTH_PROVIDERS
        .iter()
        .map(|spec| {
            let conn = conns.iter().find(|c| c.provider == spec.code);
            OAuthProviderInfo {
                provider: spec.code.to_owned(),
                label: spec.label.to_owned(),
                scopes: spec.default_scopes.to_owned(),
                connected: conn.is_some_and(|c| c.status == "connected"),
                external_account_id: conn.and_then(|c| c.external_account_id.clone()),
                status: conn.map(|c| c.status.clone()),
            }
        })
        .collect();
    Ok(Json(infos))
}

#[derive(Debug, Deserialize)]
pub struct AuthorizeQuery {
    pub redirect_uri: String,
}

#[derive(Debug, Serialize)]
pub struct AuthorizeResponse {
    pub authorize_url: String,
    pub state: String,
}

/// GET /api/oauth/{provider}/authorize?redirect_uri= — the consent URL to
/// redirect the admin's browser to.
pub async fn oauth_authorize(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(provider): Path<String>,
    Query(q): Query<AuthorizeQuery>,
) -> Result<Json<AuthorizeResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    if oauth_provider_spec(&provider).is_none() {
        return Err(AppError::BadRequest(format!("Unknown OAuth provider '{provider}'")));
    }

    // CSRF state — the frontend echoes it back on exchange.
    let state_token = Uuid::new_v4().to_string();
    let url = oauth::authorize_url(&state, &claims.tenant_id, &provider, &q.redirect_uri, &state_token)
        .await?;
    Ok(Json(AuthorizeResponse {
        authorize_url: url,
        state: state_token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ExchangeRequest {
    pub code: String,
    pub redirect_uri: String,
}

/// POST /api/oauth/{provider}/exchange — swap the auth code for tokens.
pub async fn oauth_exchange(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(provider): Path<String>,
    Json(body): Json<ExchangeRequest>,
) -> Result<Json<OAuthConnection>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let conn = oauth::exchange_code(
        &state,
        &claims.tenant_id,
        &provider,
        &body.code,
        &body.redirect_uri,
        claims.sub,
    )
    .await?;
    Ok(Json(conn))
}

/// DELETE /api/oauth/connections/{provider} — disconnect.
pub async fn oauth_disconnect(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(provider): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let deleted = sqlx::query!(
        "DELETE FROM oauth_connections WHERE tenant_id = $1 AND provider = $2",
        claims.tenant_id,
        &provider,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;

    if deleted == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "status": "disconnected" })))
}

/// oauth routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/oauth/providers", get(list_oauth_providers))
        .route(
            "/api/oauth/{provider}/authorize",
            get(oauth_authorize),
        )
        .route("/api/oauth/{provider}/exchange", post(oauth_exchange))
        .route(
            "/api/oauth/connections/{provider}",
            delete(oauth_disconnect),
        )
}
