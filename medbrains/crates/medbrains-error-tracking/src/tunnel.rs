//! The browser's error reports come here first, not to Rustrak.
//!
//! The web SDK's `tunnel` option posts its envelopes to this server, which
//! scrubs them with the same code as its own reports and forwards them to the
//! project the browser was given, `SENTRY_WEB_DSN` or else `SENTRY_DSN`. The
//! phone and desktop apps post here too, through a DSN that names this server
//! (`ClientConfig::tunnel_dsn_path`), and go to their own project. So the browser never needs to reach the
//! error tracker, the content-security policy names no new host, and patient
//! data that a page put into an error is removed by the scrubber the server
//! already trusts rather than by a second copy in TypeScript.
//!
//! Whatever DSN an envelope names is ignored: it can only ever be forwarded to
//! the project configured for its app, so this is not a relay to arbitrary hosts.

use std::time::Duration;

use axum::body::Bytes;
use axum::extract::Path;
use axum::http::StatusCode;
use sentry::types::Dsn;

use crate::browser::scrub_browser_envelope;
use crate::config::{ClientApp, Settings, settings};
use crate::http_client;

/// A browser envelope with an error, its breadcrumbs and a session update is a
/// few tens of kilobytes; anything near this is not one.
pub(crate) const MAX_ENVELOPE_BYTES: usize = 512 * 1024;
const FORWARD_TIMEOUT: Duration = Duration::from_secs(5);

/// `POST /api/public/error-tracking/envelope`, the browser's.
pub(crate) async fn post_envelope(body: Bytes) -> StatusCode {
    tunnel(settings(), ClientApp::Web, &body).await
}

/// `POST /api/public/error-tracking/{app}/api/{project}/envelope/`, a native
/// app's. The project in the path is a placeholder and ignored.
pub(crate) async fn post_app_envelope(
    Path((app, _project)): Path<(ClientApp, String)>,
    body: Bytes,
) -> StatusCode {
    tunnel(settings(), app, &body).await
}

/// Scrub `body` and forward it to `app`'s project; 404 while tracking is off.
async fn tunnel(settings: Option<&Settings>, app: ClientApp, body: &[u8]) -> StatusCode {
    let Some(settings) = settings else {
        return StatusCode::NOT_FOUND;
    };
    let Some(scrubbed) = scrub_browser_envelope(body) else {
        return StatusCode::BAD_REQUEST;
    };
    if scrubbed.is_empty() {
        // Nothing in it we keep (a span, a client report): accepted, not sent.
        return StatusCode::OK;
    }
    match forward(settings.client_dsn(app), scrubbed).await {
        Ok(()) => StatusCode::OK,
        Err(why) => {
            tracing::warn!(%why, app = app.as_str(), "could not forward an app error report");
            StatusCode::BAD_GATEWAY
        }
    }
}

/// Post a scrubbed envelope to `dsn`'s project with the server's own auth.
async fn forward(dsn: &Dsn, envelope: Vec<u8>) -> Result<(), String> {
    let auth = dsn.to_auth(Some("medbrains-tunnel/1")).to_string();
    let response = http_client()?
        .post(dsn.envelope_api_url().as_str())
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

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::tunnel;
    use crate::config::{ClientApp, Settings};

    type TestResult = Result<(), Box<dyn std::error::Error>>;

    const ENVELOPE: &str = "{}\n{\"type\":\"event\"}\n{\"level\":\"error\",\"message\":\"boom\"}\n";

    /// A one-request project that answers 200 and returns the request line.
    async fn project() -> Result<(u16, tokio::task::JoinHandle<String>), std::io::Error> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();
        let handle = tokio::spawn(async move {
            let Ok((mut socket, _)) = listener.accept().await else {
                return String::new();
            };
            let mut buf = vec![0u8; 8192];
            let read = socket.read(&mut buf).await.unwrap_or_default();
            let _ = socket
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\n\r\n")
                .await;
            String::from_utf8_lossy(buf.get(..read).unwrap_or_default())
                .lines()
                .next()
                .unwrap_or_default()
                .to_owned()
        });
        Ok((port, handle))
    }

    fn settings(server_port: u16, web_port: u16) -> Result<Settings, String> {
        let lookup = move |key: &str| match key {
            "SENTRY_DSN" => Some(format!("http://s@127.0.0.1:{server_port}/7")),
            "SENTRY_WEB_DSN" => Some(format!("http://w@127.0.0.1:{web_port}/8")),
            _ => None,
        };
        Settings::from_lookup(lookup)?.ok_or_else(|| "expected settings".to_owned())
    }

    #[tokio::test]
    async fn the_browser_report_goes_to_the_web_project_and_an_app_report_to_its_own() -> TestResult
    {
        let (server_port, server) = project().await?;
        let (web_port, web) = project().await?;
        let settings = settings(server_port, web_port)?;

        let status = tunnel(Some(&settings), ClientApp::Web, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(web.await?, "POST /api/8/envelope/ HTTP/1.1");

        // No SENTRY_ANDROID_DSN: the phone reports to the server's project.
        let status = tunnel(Some(&settings), ClientApp::Android, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(server.await?, "POST /api/7/envelope/ HTTP/1.1");
        Ok(())
    }

    #[tokio::test]
    async fn the_tunnel_is_closed_while_tracking_is_off() {
        let status = tunnel(None, ClientApp::Web, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
}
