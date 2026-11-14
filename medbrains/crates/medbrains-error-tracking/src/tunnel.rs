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

use std::borrow::Cow;
use std::io::Read;
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::Path;
use axum::http::header::CONTENT_ENCODING;
use axum::http::{HeaderMap, StatusCode};
use flate2::read::GzDecoder;
use sentry::types::Dsn;
use tokio::sync::Semaphore;

use crate::browser::scrub_browser_envelope;
use crate::config::{ClientApp, Settings, settings};
use crate::http_client;

/// A browser envelope with an error, its breadcrumbs and a session update is a
/// few tens of kilobytes; anything near this is not one.
pub(crate) const MAX_ENVELOPE_BYTES: usize = 512 * 1024;
const FORWARD_TIMEOUT: Duration = Duration::from_secs(5);
/// Forwards in flight at once, for the whole server. A flood past the per-IP
/// limit (many addresses) is answered 503 rather than queued, so it can hold
/// neither outbound connections nor much of the error tracker's quota.
const MAX_FORWARDS: usize = 8;
static FORWARDS: Semaphore = Semaphore::const_new(MAX_FORWARDS);

/// What a tunnel forwards with: the settings and the forward permits.
struct Tunnel<'a> {
    settings: Option<&'a Settings>,
    permits: &'a Semaphore,
}

/// The live tunnel: this process's settings and its shared permits.
fn live() -> Tunnel<'static> {
    Tunnel {
        settings: settings(),
        permits: &FORWARDS,
    }
}

/// `POST /api/public/error-tracking/envelope`, the browser's.
pub(crate) async fn post_envelope(headers: HeaderMap, body: Bytes) -> StatusCode {
    live().receive(ClientApp::Web, &headers, &body).await
}

/// `POST /api/public/error-tracking/{app}/api/{project}/envelope/`, a native
/// app's. The project in the path is a placeholder and ignored.
pub(crate) async fn post_app_envelope(
    Path((app, _project)): Path<(ClientApp, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    live().receive(app, &headers, &body).await
}

impl Tunnel<'_> {
    /// Decode the body as sent (the phone SDKs gzip it), then [`Self::send`].
    async fn receive(&self, app: ClientApp, headers: &HeaderMap, body: &[u8]) -> StatusCode {
        match decoded(headers, body) {
            Ok(envelope) => self.send(app, &envelope).await,
            Err(status) => status,
        }
    }

    /// Scrub `body` and forward it to `app`'s project; 404 while tracking is
    /// off, 503 while every forward permit is taken.
    async fn send(&self, app: ClientApp, body: &[u8]) -> StatusCode {
        let Some(settings) = self.settings else {
            return StatusCode::NOT_FOUND;
        };
        let Some(scrubbed) = scrub_browser_envelope(body) else {
            return StatusCode::BAD_REQUEST;
        };
        if scrubbed.is_empty() {
            // Nothing in it we keep (a span, a client report): accepted, not sent.
            return StatusCode::OK;
        }
        let Ok(_permit) = self.permits.try_acquire() else {
            return StatusCode::SERVICE_UNAVAILABLE;
        };
        forwarded(app, forward(settings.client_dsn(app), scrubbed).await)
    }
}

/// The body as plain envelope bytes: as sent, or gunzipped. Any other encoding
/// is refused, and so is a gzip that expands past [`MAX_ENVELOPE_BYTES`].
fn decoded<'a>(headers: &HeaderMap, body: &'a [u8]) -> Result<Cow<'a, [u8]>, StatusCode> {
    let encoding = headers
        .get(CONTENT_ENCODING)
        .map(|v| v.to_str().map(str::trim).unwrap_or_default());
    match encoding {
        None => Ok(Cow::Borrowed(body)),
        Some(e) if e.eq_ignore_ascii_case("identity") => Ok(Cow::Borrowed(body)),
        Some(e) if e.eq_ignore_ascii_case("gzip") => gunzip(body).map(Cow::Owned),
        Some(_) => Err(StatusCode::UNSUPPORTED_MEDIA_TYPE),
    }
}

/// Gunzip at most one byte past the cap, so a decompression bomb stops there.
fn gunzip(body: &[u8]) -> Result<Vec<u8>, StatusCode> {
    let cap = u64::try_from(MAX_ENVELOPE_BYTES).unwrap_or(u64::MAX);
    let mut out = Vec::new();
    GzDecoder::new(body)
        .take(cap.saturating_add(1))
        .read_to_end(&mut out)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    if out.len() > MAX_ENVELOPE_BYTES {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }
    Ok(out)
}

/// The tunnel's answer for a forward's result, logging a failure.
fn forwarded(app: ClientApp, result: Result<(), String>) -> StatusCode {
    match result {
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
    use std::io::Write;

    use axum::http::header::CONTENT_ENCODING;
    use axum::http::{HeaderMap, HeaderValue, StatusCode};
    use flate2::Compression;
    use flate2::write::GzEncoder;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use tokio::sync::Semaphore;

    use super::{MAX_ENVELOPE_BYTES, MAX_FORWARDS, Tunnel};
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

    fn gzip(bytes: &[u8]) -> Result<Vec<u8>, std::io::Error> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(bytes)?;
        encoder.finish()
    }

    fn encoded(encoding: &'static str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_ENCODING, HeaderValue::from_static(encoding));
        headers
    }

    #[tokio::test]
    async fn the_browser_report_goes_to_the_web_project_and_an_app_report_to_its_own() -> TestResult
    {
        let (server_port, server) = project().await?;
        let (web_port, web) = project().await?;
        let settings = settings(server_port, web_port)?;
        let permits = Semaphore::new(MAX_FORWARDS);
        let tunnel = Tunnel {
            settings: Some(&settings),
            permits: &permits,
        };

        let status = tunnel.send(ClientApp::Web, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(web.await?, "POST /api/8/envelope/ HTTP/1.1");

        // No SENTRY_ANDROID_DSN: the phone reports to the server's project,
        // gzipped as sentry-java and sentry-cocoa send it.
        let body = gzip(ENVELOPE.as_bytes())?;
        let status = tunnel
            .receive(ClientApp::Android, &encoded("gzip"), &body)
            .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(server.await?, "POST /api/7/envelope/ HTTP/1.1");
        Ok(())
    }

    #[tokio::test]
    async fn the_tunnel_is_closed_while_tracking_is_off() {
        let permits = Semaphore::new(MAX_FORWARDS);
        let tunnel = Tunnel {
            settings: None,
            permits: &permits,
        };
        let status = tunnel.send(ClientApp::Web, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn a_gzip_bomb_and_unknown_encodings_are_refused() -> TestResult {
        let settings = settings(9, 9)?;
        let permits = Semaphore::new(MAX_FORWARDS);
        let tunnel = Tunnel {
            settings: Some(&settings),
            permits: &permits,
        };
        // About 1 KiB on the wire, 4 MiB unpacked.
        let bomb = gzip(&vec![b'a'; MAX_ENVELOPE_BYTES * 8])?;
        assert!(bomb.len() < 16 * 1024);
        let status = tunnel
            .receive(ClientApp::Ios, &encoded("gzip"), &bomb)
            .await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        let status = tunnel.receive(ClientApp::Ios, &encoded("br"), b"x").await;
        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
        let status = tunnel
            .receive(ClientApp::Ios, &encoded("gzip"), b"not gzip")
            .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        Ok(())
    }

    #[tokio::test]
    async fn a_flood_is_turned_away_once_every_forward_is_in_flight() -> TestResult {
        let settings = settings(9, 9)?;
        let permits = Semaphore::new(1);
        let _in_flight = permits.try_acquire()?;
        let tunnel = Tunnel {
            settings: Some(&settings),
            permits: &permits,
        };
        let status = tunnel.send(ClientApp::Web, ENVELOPE.as_bytes()).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        Ok(())
    }
}
