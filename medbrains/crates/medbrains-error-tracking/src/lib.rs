//! Error tracking: the Sentry SDK in the server and the browser, reporting to a
//! self-hosted Rustrak on the hospital's own machine.
//!
//! Patient data never goes in a report. Every envelope — the server's own and
//! the browser's, which reach Rustrak through [`tunnel`] — is scrubbed by
//! [`envelope::scrub_envelope`] before it leaves this process. Off unless
//! `SENTRY_DSN` is set.

// `unreachable_pub` is denied workspace-wide, so items shared between this
// crate's private modules are `pub(crate)`, which this nursery lint dislikes.
#![allow(clippy::redundant_pub_crate)]

mod config;
mod envelope;
mod scrub;
mod sdk;
mod summary;
mod tunnel;

#[cfg(test)]
mod phi_tests;

use std::sync::OnceLock;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;

pub use config::{Settings, settings};
pub use sdk::{HttpLayer, dsn_host_is_own, http_layer, init, tag_scope, tracing_layer};
pub use sentry::types::Dsn;
pub use summary::ErrorTrackingSummary;

/// Where the browser SDK sends its envelopes.
pub const TUNNEL_PATH: &str = "/api/public/error-tracking/envelope";

/// What the browser needs to start its SDK. Its release is its own build's
/// commit, so it is not sent from here.
#[derive(Debug, Serialize)]
pub struct ClientConfig {
    pub enabled: bool,
    pub dsn: Option<String>,
    pub environment: Option<String>,
    pub traces_sample_rate: f32,
    pub tunnel: &'static str,
}

/// Answers before sign-in: errors on the sign-in page count too.
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/api/public/error-tracking/config", get(get_client_config))
        .route(
            TUNNEL_PATH,
            post(tunnel::post_envelope).layer(DefaultBodyLimit::max(tunnel::MAX_ENVELOPE_BYTES)),
        )
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/error-tracking/summary", get(get_summary))
}

async fn get_client_config() -> Json<ClientConfig> {
    let current = settings();
    Json(ClientConfig {
        enabled: current.is_some(),
        dsn: current.map(|s| s.dsn.to_string()),
        environment: current.map(|s| s.environment.clone()),
        traces_sample_rate: current.map_or(0.0, |s| s.traces_sample_rate),
        tunnel: TUNNEL_PATH,
    })
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
async fn get_summary(
    Extension(claims): Extension<Claims>,
) -> Result<Json<ErrorTrackingSummary>, AppError> {
    require_permission(&claims, permissions::admin::error_tracking::VIEW)?;
    Ok(Json(summary::summarise(settings()).await))
}

/// One client for every call to Rustrak; each request sets its own timeout.
fn http_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .build()
                .map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)
}
