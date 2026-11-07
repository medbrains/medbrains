//! The HTTP rules: one `ProxyHttp` for a site with a back end, one for the plain HTTP redirect.
//!
//! Syntax and framing were already checked by `head.rs`. What is here is what needs the meaning of
//! a request: who it is from, where it goes, and how long it may take.

use crate::config::SiteConfig;
use crate::limits::RateLimiter;
use crate::names::{Names, canonical_ip, normalize_path};
use async_trait::async_trait;
use bytes::Bytes;
use pingora_core::protocols::tls::CaType;
use pingora_core::upstreams::peer::HttpPeer;
use pingora_error::{Error, ErrorSource, ErrorType, Result};
use pingora_http::{RequestHeader, ResponseHeader, StatusCode};
use pingora_proxy::{FailToProxy, ProxyHttp, Session};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Headers only this proxy may set; a client's copy never reaches the server.
const FORWARDING_HEADERS: [&str; 11] = [
    "forwarded",
    "proxy",
    "x-client-ip",
    "x-cluster-client-ip",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-forwarded-server",
    "x-original-forwarded-for",
    "x-real-ip",
];
/// Longest wait for one read from a client's body.
const CLIENT_READ: Duration = Duration::from_secs(30);
/// Longest wait for a client to accept one write. A stalled reader cannot hold a response open.
const CLIENT_WRITE: Duration = Duration::from_secs(30);
const UPSTREAM_CONNECT: Duration = Duration::from_secs(5);
/// A report may take this long to start answering. It is also the back end's silence allowed on an
/// open WebSocket: Pingora fixes a back end's timeout when it connects, before any 101, and asking for
/// an upgrade must not buy an hour against a slow route. The web app reconnects a quiet socket.
const UPSTREAM_READ: Duration = Duration::from_secs(300);
/// The client's silence allowed on an open WebSocket. Long, because silence is normal; bounded,
/// because every wait is.
const WEBSOCKET_IDLE: Duration = Duration::from_secs(3600);
/// A client reading slower than this loses the response, however small each write is: a stalled
/// reader at one chunk per `CLIENT_WRITE` would otherwise hold a large response for days.
const CLIENT_MIN_BYTES_PER_SEC: usize = 2048;
const UPSTREAM_WRITE: Duration = Duration::from_secs(30);
/// How long a connection to the back end is kept for reuse.
const UPSTREAM_IDLE: Duration = Duration::from_secs(60);
/// A body may start slowly, then must keep up this rate, or a trickle could hold a place for hours.
const BODY_GRACE: Duration = Duration::from_secs(20);
const BODY_MIN_BYTES_PER_SEC: f64 = 1024.0;

/// One path prefix under a limit.
#[derive(Debug)]
struct PathLimit {
    path: String,
    limiter: RateLimiter,
}

/// A site's rules, shared by every connection on its ports.
#[derive(Debug)]
pub(crate) struct Site {
    upstream: SocketAddr,
    upstream_tls: Option<(Arc<CaType>, String)>,
    error_page: Bytes,
    only_hosts: Vec<String>,
    block_paths: Vec<String>,
    /// When not empty, all the LAN may reach.
    lan_paths: Vec<String>,
    max_body_bytes: u64,
    limits: Vec<PathLimit>,
    names: Names,
}

/// What one request has done so far.
#[derive(Debug)]
pub(crate) struct RequestState {
    body_started: Option<Instant>,
    body_bytes: u64,
    /// The back end agreed. Only now do the limits for a normal request stop applying.
    is_upgraded: bool,
}

/// An answer that does not need the back end.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Refused {
    status: u16,
    sentence: &'static str,
    retry_after: Option<u64>,
}

impl Refused {
    /// A refusal with no `Retry-After`.
    const fn new(status: u16, sentence: &'static str) -> Self {
        Self {
            status,
            sentence,
            retry_after: None,
        }
    }
}

impl Site {
    /// The rules from the configuration, with the back end's certificate authority loaded.
    pub(crate) fn new(config: &SiteConfig, names: Names) -> anyhow::Result<Self> {
        let upstream_tls = match &config.upstream_tls {
            Some(tls) => {
                let list = crate::tls::load_ca(&tls.ca)?;
                Some((Arc::<CaType>::from(list), tls.server_name.clone()))
            }
            None => None,
        };
        let limits = config.limits.iter().map(|limit| PathLimit {
            path: limit.path.to_ascii_lowercase(),
            limiter: RateLimiter::new(limit.burst, limit.per_minute),
        });
        Ok(Self {
            upstream: config.upstream,
            upstream_tls,
            error_page: Bytes::from(format!("{}\n", config.error_page.trim())),
            only_hosts: config.only_hosts.clone(),
            block_paths: config
                .block_paths
                .iter()
                .map(|p| p.to_ascii_lowercase())
                .collect(),
            lan_paths: config
                .lan_paths
                .iter()
                .map(|p| p.to_ascii_lowercase())
                .collect(),
            max_body_bytes: config.max_body_bytes,
            limits: limits.collect(),
            names,
        })
    }

    /// The Host the back end gets. A site with `only_hosts` already refused every other name, and
    /// its back end may check its own; otherwise a name outside the machine's set becomes one in it.
    /// On loopback, the screen's `127.0.0.1:8443` would end up in links the server mails to people
    /// on other machines, so it gets the machine's own name instead.
    fn upstream_host(&self, req: &RequestHeader, on_loopback: bool) -> String {
        let header = host_header(req);
        match header {
            Some(host) if !self.only_hosts.is_empty() => host.to_owned(),
            _ if on_loopback => self.names.trusted_host(None).to_owned(),
            _ => self.names.trusted_host(header).to_owned(),
        }
    }

    /// What this site answers instead of proxying: a status and a sentence, or nothing.
    fn refusal(&self, req: &RequestHeader, client: IpAddr, now: Instant) -> Option<Refused> {
        let host = host_header(req).and_then(crate::names::parse_host);
        let host_ok = self.only_hosts.is_empty()
            || host.is_some_and(|h| self.only_hosts.iter().any(|o| o.eq_ignore_ascii_case(h)));
        if !host_ok {
            return Some(Refused::new(
                421,
                "This service is not available at that name.",
            ));
        }
        let Some(path) = normalize_path(req.uri.path()) else {
            return Some(Refused::new(400, "Bad request."));
        };
        if self
            .block_paths
            .iter()
            .any(|block| path.starts_with(block.as_str()))
        {
            return Some(Refused::new(404, "Not found."));
        }
        if !self.lan_paths.is_empty()
            && !canonical_ip(client).is_loopback()
            && !self
                .lan_paths
                .iter()
                .any(|allowed| path.starts_with(allowed.as_str()))
        {
            return Some(Refused::new(404, "Not found."));
        }
        if content_length(req).is_some_and(|length| length > self.max_body_bytes) {
            return Some(Refused::new(413, "That upload is too large."));
        }
        let limit = self
            .limits
            .iter()
            .find(|limit| path.starts_with(limit.path.as_str()));
        match limit {
            Some(limit) if !limit.limiter.allow(client, now) => Some(Refused {
                status: 429,
                sentence: "Too many attempts. Wait a moment, then try again.",
                retry_after: Some(limit.limiter.retry_after_secs()),
            }),
            _ => None,
        }
    }
}

/// The raw Host header.
fn host_header(req: &RequestHeader) -> Option<&str> {
    req.headers
        .get("host")
        .and_then(|value| value.to_str().ok())
}

/// The declared body length; `head.rs` already refused any value but digits.
fn content_length(req: &RequestHeader) -> Option<u64> {
    req.headers
        .get("content-length")?
        .to_str()
        .ok()?
        .parse()
        .ok()
}

/// The client's address, as it connected.
fn client_ip(session: &Session) -> Option<IpAddr> {
    let inet = session.client_addr()?.as_inet()?;
    Some(canonical_ip(inet.ip()))
}

/// True when the connection arrived on a loopback address: the screen, or a node's tunnel.
fn arrived_on_loopback(session: &Session) -> bool {
    session
        .server_addr()
        .and_then(|addr| addr.as_inet())
        .is_some_and(|addr| canonical_ip(addr.ip()).is_loopback())
}

/// Sets every forwarding header from what this proxy knows, removing whatever the client sent.
///
/// `X-Forwarded-For` holds one address: the server walks it from the right and stops at the first
/// address it does not trust, so a chain would only give a client more to forge.
pub(crate) fn set_forwarding(req: &mut RequestHeader, client: IpAddr, host: &str) -> Result<()> {
    for header in FORWARDING_HEADERS {
        req.remove_header(header);
    }
    let address = client.to_string();
    req.insert_header("X-Forwarded-For", &address)?;
    req.insert_header("X-Real-IP", &address)?;
    req.insert_header("X-Forwarded-Proto", "https")?;
    req.insert_header("X-Forwarded-Host", host)?;
    req.insert_header("Host", host)?;
    Ok(())
}

/// True once a body has run long enough to be judged and is below the minimum rate.
fn body_too_slow(bytes: u64, elapsed: Duration) -> bool {
    let judged = elapsed.saturating_sub(BODY_GRACE).as_secs_f64();
    let needed = judged * BODY_MIN_BYTES_PER_SEC;
    judged > 0.0 && needed > 0.0 && (bytes as f64) < needed
}

/// Writes a short plain-text answer and closes the connection after it.
async fn answer(session: &mut Session, status: u16, body: Bytes, retry: Option<u64>) -> Result<()> {
    let mut resp = ResponseHeader::build(status, Some(4))?;
    resp.insert_header("Content-Type", "text/plain; charset=utf-8")?;
    resp.insert_header("Cache-Control", "no-store")?;
    if let Some(seconds) = retry {
        resp.insert_header("Retry-After", seconds.to_string())?;
    }
    resp.set_content_length(body.len())?;
    session.set_keepalive(None);
    session.write_response_header(Box::new(resp), false).await?;
    session.write_response_body(Some(body), true).await
}

/// The status an error ends with; 0 when the client is gone and hearing nothing is right.
fn error_status(error: &Error) -> u16 {
    match error.etype() {
        ErrorType::HTTPStatus(code) => *code,
        _ => match error.esource() {
            ErrorSource::Upstream => 502,
            ErrorSource::Downstream => match error.etype() {
                ErrorType::WriteError | ErrorType::ReadError | ErrorType::ConnectionClosed => 0,
                ErrorType::ReadTimedout | ErrorType::WriteTimedout => 408,
                _ => 400,
            },
            ErrorSource::Internal | ErrorSource::Unset => 500,
        },
    }
}

#[async_trait]
impl ProxyHttp for Site {
    type CTX = RequestState;

    /// A request that has read nothing yet.
    fn new_ctx(&self) -> Self::CTX {
        RequestState {
            body_started: None,
            body_bytes: 0,
            is_upgraded: false,
        }
    }

    /// Applies timeouts, then every rule that can refuse a request before the back end sees it.
    async fn request_filter(&self, session: &mut Session, _ctx: &mut Self::CTX) -> Result<bool> {
        session.set_read_timeout(Some(CLIENT_READ));
        session.set_write_timeout(Some(CLIENT_WRITE));
        session.set_min_send_rate(Some(CLIENT_MIN_BYTES_PER_SEC));
        if session.req_header().uri.path() == "/proxy-health" {
            answer(session, 200, Bytes::from_static(b"ok\n"), None).await?;
            return Ok(true);
        }
        let Some(client) = client_ip(session) else {
            return Error::e_explain(ErrorType::InternalError, "no client address");
        };
        let refused = self.refusal(session.req_header(), client, Instant::now());
        if let Some(refused) = refused {
            let body = Bytes::from(format!("{}\n", refused.sentence));
            answer(session, refused.status, body, refused.retry_after).await?;
            return Ok(true);
        }
        Ok(false)
    }

    /// Counts a body as it streams, so a chunked upload meets the same limits as a declared one.
    async fn request_body_filter(
        &self,
        _session: &mut Session,
        body: &mut Option<Bytes>,
        _end_of_stream: bool,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        // Frames on an open WebSocket are not an upload.
        if ctx.is_upgraded {
            return Ok(());
        }
        let started = *ctx.body_started.get_or_insert_with(Instant::now);
        ctx.body_bytes += body.as_ref().map_or(0, |bytes| bytes.len() as u64);
        if ctx.body_bytes > self.max_body_bytes {
            return Error::e_explain(ErrorType::HTTPStatus(413), "body over the limit");
        }
        if body_too_slow(ctx.body_bytes, started.elapsed()) {
            return Error::e_explain(ErrorType::HTTPStatus(408), "body below the minimum rate");
        }
        Ok(())
    }

    /// The back end, with its timeouts. Reused connections stay on, so a page load stays cheap.
    async fn upstream_peer(
        &self,
        _session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        let name = self.upstream_tls.as_ref().map(|(_, name)| name.as_str());
        let tls = name.is_some();
        let mut peer = HttpPeer::new(self.upstream, tls, name.unwrap_or_default().to_owned());
        peer.options.connection_timeout = Some(UPSTREAM_CONNECT);
        peer.options.total_connection_timeout = Some(UPSTREAM_CONNECT * 2);
        peer.options.read_timeout = Some(UPSTREAM_READ);
        peer.options.write_timeout = Some(UPSTREAM_WRITE);
        peer.options.idle_timeout = Some(UPSTREAM_IDLE);
        if let Some((ca, _)) = &self.upstream_tls {
            peer.options.ca = Some(Arc::clone(ca));
        }
        Ok(Box::new(peer))
    }

    /// Replaces whatever the client said about where it came from.
    async fn upstream_request_filter(
        &self,
        session: &mut Session,
        req: &mut RequestHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()> {
        let Some(client) = client_ip(session) else {
            return Error::e_explain(ErrorType::InternalError, "no client address");
        };
        let host = self.upstream_host(req, arrived_on_loopback(session));
        set_forwarding(req, client, &host)
    }

    /// Relaxes the limits for a normal request once, and only once, the back end opens a WebSocket.
    async fn response_filter(
        &self,
        session: &mut Session,
        resp: &mut ResponseHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        if resp.status == StatusCode::SWITCHING_PROTOCOLS {
            ctx.is_upgraded = true;
            session.set_read_timeout(Some(WEBSOCKET_IDLE));
            session.set_min_send_rate(None);
        }
        Ok(())
    }

    /// Never a blank page: the configured sentence when the back end fails, once nothing else has
    /// been sent. Past that point the connection closes, which a browser reports as a failed load.
    async fn fail_to_proxy(
        &self,
        session: &mut Session,
        error: &Error,
        _ctx: &mut Self::CTX,
    ) -> FailToProxy {
        let status = error_status(error);
        // Only what is wrong on this machine: a client's mistakes would let it fill the log. An error
        // names the connection and what went wrong, never a path or a header.
        if status >= 500 {
            tracing::warn!(status, kind = error.etype().as_str(), "request failed");
        }
        if status > 0 && session.response_written().is_none() {
            let body = if status >= 500 {
                self.error_page.clone()
            } else {
                Bytes::from_static(b"This request could not be completed.\n")
            };
            if let Err(write_error) = answer(session, status, body, None).await {
                tracing::debug!(error = %write_error, "client left before the error page");
            }
        }
        FailToProxy {
            error_code: status,
            can_reuse_downstream: false,
        }
    }
}

/// Plain HTTP does one thing: send the client to HTTPS on a name of this machine.
#[derive(Debug)]
pub(crate) struct Redirect {
    pub(crate) names: Names,
}

#[async_trait]
impl ProxyHttp for Redirect {
    type CTX = ();

    /// Nothing to remember.
    fn new_ctx(&self) -> Self::CTX {}

    /// Answers every request with a redirect, without looking at the body.
    async fn request_filter(&self, session: &mut Session, _ctx: &mut ()) -> Result<bool> {
        session.set_write_timeout(Some(CLIENT_WRITE));
        let local = session
            .server_addr()
            .and_then(|addr| addr.as_inet())
            .map(|addr| canonical_ip(addr.ip()));
        let req = session.req_header();
        let target = req.uri.path_and_query().map_or("/", |value| value.as_str());
        let location = self
            .names
            .redirect_location(host_header(req), local, target);
        let mut resp = ResponseHeader::build(301, Some(3))?;
        resp.insert_header("Location", location)?;
        resp.insert_header("Content-Length", "0")?;
        resp.insert_header("Cache-Control", "no-store")?;
        session.set_keepalive(None);
        session.write_response_header(Box::new(resp), true).await?;
        Ok(true)
    }

    /// Never reached: every request was answered above.
    async fn upstream_peer(&self, _session: &mut Session, _ctx: &mut ()) -> Result<Box<HttpPeer>> {
        Error::e_explain(ErrorType::InternalError, "the redirect has no back end")
    }
}

#[cfg(test)]
#[path = "site_tests.rs"]
mod tests;
