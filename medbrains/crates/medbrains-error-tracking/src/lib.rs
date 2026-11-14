//! Error tracking: the Sentry SDK in the server and the browser, reporting to a
//! self-hosted Rustrak on the hospital's own machine.
//!
//! Patient data never goes in a report. The server's own envelopes are scrubbed
//! by [`envelope::scrub_envelope`] in its transport; the browser's reach Rustrak
//! through [`tunnel`] and are scrubbed item by item in [`browser`] — both with
//! the same `scrub_event`. Off unless `SENTRY_DSN` is set; a DSN off this host
//! (the project's own servers on sentry.io) also needs `SENTRY_ALLOW_EXTERNAL=1`.

// `unreachable_pub` is denied workspace-wide, so items shared between this
// crate's private modules are `pub(crate)`, which this nursery lint dislikes.
#![allow(clippy::redundant_pub_crate)]

mod browser;
mod config;
mod envelope;
mod scrub;
mod sdk;
mod summary;
mod tunnel;

#[cfg(test)]
mod phi_tests;

use std::sync::OnceLock;

use axum::extract::{DefaultBodyLimit, Query};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use medbrains_core::permissions;
use medbrains_kernel::{Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};

pub use config::{ALLOW_EXTERNAL, ClientApp, Settings, settings};
pub use sdk::{HttpLayer, dsn_host_is_own, http_layer, init, tag_scope, tracing_layer};
pub use sentry::types::Dsn;
pub use summary::ErrorTrackingSummary;

/// Where the browser SDK sends its envelopes.
pub const TUNNEL_PATH: &str = "/api/public/error-tracking/envelope";

/// The tunnel for the native SDKs, which have no `tunnel` option. They are given
/// a DSN on this server, `https://medbrains@<server><tunnel_dsn_path>`, and post
/// to `<tunnel_dsn_path minus the project>/api/<project>/envelope/`, which is this.
const APP_TUNNEL_ROUTE: &str = "/api/public/error-tracking/{app}/api/{project}/envelope/";

/// What an app needs to start its SDK. Its release is its own build's commit
/// or version, so it is not sent from here.
#[derive(Debug, Serialize)]
pub struct ClientConfig {
    pub enabled: bool,
    /// The app's project, `SENTRY_<APP>_DSN` or else `SENTRY_DSN`.
    pub dsn: Option<String>,
    pub environment: Option<String>,
    /// The browser SDK's `tunnel`.
    pub tunnel: &'static str,
    /// For a native app: the path of the DSN it starts its SDK with, so that
    /// its reports come through this server too. `None` for the web.
    pub tunnel_dsn_path: Option<String>,
}

/// `?app=android`; the web when absent.
#[derive(Debug, Default, Deserialize)]
struct ConfigQuery {
    #[serde(default)]
    app: ClientApp,
}

/// Answers before sign-in: errors on the sign-in page count too.
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/api/public/error-tracking/config", get(get_client_config))
        .route(
            TUNNEL_PATH,
            post(tunnel::post_envelope).layer(DefaultBodyLimit::max(tunnel::MAX_ENVELOPE_BYTES)),
        )
        .route(
            APP_TUNNEL_ROUTE,
            post(tunnel::post_app_envelope)
                .layer(DefaultBodyLimit::max(tunnel::MAX_ENVELOPE_BYTES)),
        )
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/error-tracking/summary", get(get_summary))
}

/// `GET /api/public/error-tracking/config?app=…`, before sign-in.
async fn get_client_config(Query(query): Query<ConfigQuery>) -> Json<ClientConfig> {
    Json(client_config(settings(), query.app))
}

/// Off without settings; otherwise the app's own project and its tunnel.
fn client_config(current: Option<&Settings>, app: ClientApp) -> ClientConfig {
    ClientConfig {
        enabled: current.is_some(),
        dsn: current.map(|s| s.client_dsn(app).to_string()),
        environment: current.map(|s| s.environment.clone()),
        tunnel: TUNNEL_PATH,
        tunnel_dsn_path: (app != ClientApp::Web)
            .then(|| format!("/api/public/error-tracking/{}/1", app.as_str())),
    }
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

#[cfg(test)]
mod tests {
    use super::{ClientApp, Settings, TUNNEL_PATH, client_config};

    fn settings() -> Result<Settings, String> {
        let lookup = |key: &str| match key {
            "SENTRY_DSN" => Some("http://s@127.0.0.1:8180/1".to_owned()),
            "SENTRY_WEB_DSN" => Some("http://w@127.0.0.1:8180/2".to_owned()),
            _ => None,
        };
        Settings::from_lookup(lookup)?.ok_or_else(|| "expected settings".to_owned())
    }

    #[test]
    fn off_without_settings_for_every_app() {
        for app in [
            ClientApp::Web,
            ClientApp::Android,
            ClientApp::Ios,
            ClientApp::Desktop,
        ] {
            let config = client_config(None, app);
            assert!(!config.enabled);
            assert!(config.dsn.is_none());
        }
    }

    #[test]
    fn the_browser_is_given_the_web_dsn_and_no_dsn_path() -> Result<(), String> {
        let config = client_config(Some(&settings()?), ClientApp::Web);
        assert_eq!(config.dsn.as_deref(), Some("http://w:@127.0.0.1:8180/2"));
        assert_eq!(config.tunnel, TUNNEL_PATH);
        assert!(config.tunnel_dsn_path.is_none());
        Ok(())
    }

    #[test]
    fn a_phone_is_given_a_dsn_path_on_this_server() -> Result<(), String> {
        let config = client_config(Some(&settings()?), ClientApp::Android);
        assert_eq!(config.dsn.as_deref(), Some("http://s:@127.0.0.1:8180/1"));
        assert_eq!(
            config.tunnel_dsn_path.as_deref(),
            Some("/api/public/error-tracking/android/1")
        );
        Ok(())
    }
}
