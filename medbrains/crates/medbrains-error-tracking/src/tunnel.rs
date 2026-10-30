//! The browser's error reports come here first, not to Rustrak.
//!
//! The web SDK's `tunnel` option posts its envelopes to this server, which
//! scrubs them with the same code as its own reports and forwards them to the
//! one Rustrak project in `SENTRY_DSN`. So the browser never needs to reach the
//! error tracker, the content-security policy names no new host, and patient
//! data that a page put into an error is removed by the scrubber the server
//! already trusts rather than by a second copy in TypeScript.
//!
//! Whatever DSN the browser's envelope names is ignored: it can only ever be
//! forwarded to ours, so this is not a relay to arbitrary hosts.

use std::time::Duration;

use axum::body::Bytes;
use axum::http::StatusCode;

use crate::browser::scrub_browser_envelope;
use crate::config::{Settings, settings};
use crate::http_client;

/// A browser envelope with an error, its breadcrumbs and a session update is a
/// few tens of kilobytes; anything near this is not one.
pub(crate) const MAX_ENVELOPE_BYTES: usize = 512 * 1024;
const FORWARD_TIMEOUT: Duration = Duration::from_secs(5);

/// `POST /api/public/error-tracking/envelope`.
pub(crate) async fn post_envelope(body: Bytes) -> StatusCode {
    let Some(settings) = settings() else {
        return StatusCode::NOT_FOUND;
    };
    let Some(scrubbed) = scrub_browser_envelope(&body) else {
        return StatusCode::BAD_REQUEST;
    };
    if scrubbed.is_empty() {
        // Nothing in it we keep (a span, a client report): accepted, not sent.
        return StatusCode::OK;
    }
    match forward(settings, scrubbed).await {
        Ok(()) => StatusCode::OK,
        Err(why) => {
            tracing::warn!(%why, "could not forward a browser error report");
            StatusCode::BAD_GATEWAY
        }
    }
}

async fn forward(settings: &Settings, envelope: Vec<u8>) -> Result<(), String> {
    let auth = settings.dsn.to_auth(Some("medbrains-tunnel/1")).to_string();
    let response = http_client()?
        .post(settings.dsn.envelope_api_url().as_str())
        .timeout(FORWARD_TIMEOUT)
        .header("X-Sentry-Auth", auth)
        .header("Content-Type", "application/x-sentry-envelope")
        .body(envelope)
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Rustrak answered {}", response.status()))
    }
}
