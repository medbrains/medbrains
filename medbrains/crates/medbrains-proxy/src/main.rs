//! MedBrains Edge Gateway — Pingora reverse proxy.

use async_trait::async_trait;
use bytes::Bytes;
use pingora::ErrorSource;
use pingora::prelude::*;
use pingora_http::{RequestHeader, ResponseHeader, StatusCode};
use pingora_proxy::{FailToProxy, ProxyHttp, Session, http_proxy_service};
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

mod config;
use config::{EdgePolicyConfig, ProxyConfig, RouteConfig};

#[derive(Clone)]
struct RuntimeRoute {
    upstream: String,
}

#[derive(Clone)]
struct MedBrainsProxy {
    routes: HashMap<String, RuntimeRoute>,
    default_route: RuntimeRoute,
    edge_policies: Vec<EdgePolicy>,
    default_policy: EdgePolicy,
    block_source_maps: bool,
    downstream_read_timeout: Duration,
    downstream_write_timeout: Duration,
    upstream_connect_timeout: Duration,
    upstream_total_timeout: Duration,
    upstream_read_timeout: Duration,
    upstream_idle_timeout: Duration,
    drain_timeout: Duration,
}

struct RequestContext {
    started_at: Instant,
    request_id: String,
    edge_policy: EdgePolicy,
}

struct RedirectProxy {
    default_domain: String,
    allowed_domains: Vec<String>,
}

#[derive(Clone)]
struct EdgePolicy {
    prefix: String,
    class: String,
    upstream: Option<String>,
    body_limit_bytes: u64,
    upstream_total_timeout: Option<Duration>,
    upstream_read_timeout: Option<Duration>,
    require_idempotency_key: bool,
    retry_after_seconds: Option<u64>,
    cache_control: Option<String>,
    block: bool,
    allowed_methods: Vec<String>,
}

impl RequestContext {
    fn new() -> Self {
        Self {
            started_at: Instant::now(),
            request_id: String::new(),
            edge_policy: EdgePolicy::default_api(),
        }
    }
}

impl MedBrainsProxy {
    fn from_config(cfg: &ProxyConfig) -> anyhow::Result<Self> {
        let mut routes = HashMap::new();
        let mut default_route = None;

        for route in &cfg.routes {
            let runtime = RuntimeRoute {
                upstream: route.upstream.clone(),
            };
            routes.insert(route.domain.clone(), runtime.clone());
            if default_route.is_none() {
                default_route = Some(runtime);
            }
        }

        let default_route =
            default_route.ok_or_else(|| anyhow::anyhow!("proxy config requires a route"))?;
        let edge_policies = build_edge_policies(cfg);

        Ok(Self {
            routes,
            default_route,
            edge_policies,
            default_policy: EdgePolicy::default_api(),
            block_source_maps: cfg.block_source_maps(),
            downstream_read_timeout: Duration::from_millis(cfg.downstream_read_timeout_ms()),
            downstream_write_timeout: Duration::from_millis(cfg.downstream_write_timeout_ms()),
            upstream_connect_timeout: Duration::from_millis(cfg.upstream_connect_timeout_ms()),
            upstream_total_timeout: Duration::from_millis(cfg.upstream_total_timeout_ms()),
            upstream_read_timeout: Duration::from_millis(cfg.upstream_read_timeout_ms()),
            upstream_idle_timeout: Duration::from_millis(cfg.upstream_idle_timeout_ms()),
            drain_timeout: Duration::from_millis(cfg.drain_timeout_ms()),
        })
    }

    fn edge_policy_for(&self, path: &str) -> EdgePolicy {
        self.edge_policies
            .iter()
            .find(|policy| path.starts_with(&policy.prefix))
            .cloned()
            .unwrap_or_else(|| self.default_policy.clone())
    }

    fn known_host(&self, session: &Session) -> bool {
        host_without_port(session).is_some_and(|host| self.routes.contains_key(host))
    }
}

impl EdgePolicy {
    fn default_api() -> Self {
        Self {
            prefix: "/api/".to_owned(),
            class: "api".to_owned(),
            upstream: None,
            body_limit_bytes: 25 * 1024 * 1024,
            upstream_total_timeout: None,
            upstream_read_timeout: None,
            require_idempotency_key: false,
            retry_after_seconds: Some(5),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
        }
    }

    fn from_config(config: &EdgePolicyConfig, default_body_limit: u64) -> Self {
        let class = config
            .class
            .clone()
            .unwrap_or_else(|| infer_class(&config.prefix));
        let defaults = class_defaults(&config.prefix, &class, default_body_limit);

        Self {
            prefix: config.prefix.clone(),
            class,
            upstream: config.upstream.clone(),
            body_limit_bytes: config.body_limit_bytes.unwrap_or(defaults.body_limit_bytes),
            upstream_total_timeout: config
                .upstream_total_timeout_ms
                .map(Duration::from_millis)
                .or(defaults.upstream_total_timeout),
            upstream_read_timeout: config
                .upstream_read_timeout_ms
                .map(Duration::from_millis)
                .or(defaults.upstream_read_timeout),
            require_idempotency_key: config
                .require_idempotency_key
                .unwrap_or(defaults.require_idempotency_key),
            retry_after_seconds: config.retry_after_seconds.or(defaults.retry_after_seconds),
            cache_control: config.cache_control.clone().or(defaults.cache_control),
            block: config.block.unwrap_or(defaults.block),
            allowed_methods: config
                .allowed_methods
                .as_ref()
                .map(|values| values.iter().map(|value| value.to_uppercase()).collect())
                .unwrap_or(defaults.allowed_methods),
        }
    }
}

fn build_edge_policies(cfg: &ProxyConfig) -> Vec<EdgePolicy> {
    let default_body_limit = cfg.body_limit_bytes();
    let mut policies = if cfg.edge_policies.is_empty() {
        default_edge_policy_configs()
    } else {
        let mut values = cfg.edge_policies.clone();
        for policy in default_edge_policy_configs() {
            if !values
                .iter()
                .any(|existing| existing.prefix == policy.prefix)
            {
                values.push(policy);
            }
        }
        values
    }
    .iter()
    .map(|policy| EdgePolicy::from_config(policy, default_body_limit))
    .collect::<Vec<_>>();

    policies.sort_by(|left, right| right.prefix.len().cmp(&left.prefix.len()));
    policies
}

fn default_edge_policy_configs() -> Vec<EdgePolicyConfig> {
    vec![
        edge_policy("/api/sync/", "outbox"),
        edge_policy("/api/outbox/", "outbox"),
        edge_policy("/api/client-errors", "telemetry"),
        edge_policy("/api/auth/", "api"),
        edge_policy("/api/", "api"),
        edge_policy("/ws", "websocket"),
        edge_policy("/assets/", "assets"),
        edge_policy("/", "spa"),
    ]
}

fn edge_policy(prefix: &str, class: &str) -> EdgePolicyConfig {
    EdgePolicyConfig {
        prefix: prefix.to_owned(),
        class: Some(class.to_owned()),
        upstream: None,
        body_limit_bytes: None,
        upstream_total_timeout_ms: None,
        upstream_read_timeout_ms: None,
        require_idempotency_key: None,
        retry_after_seconds: None,
        cache_control: None,
        block: None,
        allowed_methods: None,
    }
}

fn infer_class(prefix: &str) -> String {
    if prefix.starts_with("/assets/") {
        "assets"
    } else if prefix.starts_with("/api/sync/") || prefix.starts_with("/api/outbox/") {
        "outbox"
    } else if prefix.starts_with("/api/") {
        "api"
    } else if prefix.starts_with("/ws") {
        "websocket"
    } else {
        "spa"
    }
    .to_owned()
}

fn class_defaults(prefix: &str, class: &str, default_body_limit: u64) -> EdgePolicy {
    match class {
        "assets" => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: 1024 * 1024,
            upstream_total_timeout: Some(Duration::from_millis(10_000)),
            upstream_read_timeout: Some(Duration::from_millis(30_000)),
            require_idempotency_key: false,
            retry_after_seconds: None,
            cache_control: Some("public, max-age=31536000, immutable".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "HEAD", "OPTIONS"]),
        },
        "outbox" => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: 50 * 1024 * 1024,
            upstream_total_timeout: Some(Duration::from_millis(120_000)),
            upstream_read_timeout: Some(Duration::from_millis(120_000)),
            require_idempotency_key: true,
            retry_after_seconds: Some(10),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "POST", "PUT", "PATCH", "OPTIONS"]),
        },
        "telemetry" => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: 2 * 1024 * 1024,
            upstream_total_timeout: Some(Duration::from_millis(15_000)),
            upstream_read_timeout: Some(Duration::from_millis(30_000)),
            require_idempotency_key: false,
            retry_after_seconds: Some(30),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["POST", "OPTIONS"]),
        },
        "websocket" => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: 1024 * 1024,
            upstream_total_timeout: Some(Duration::from_millis(3_600_000)),
            upstream_read_timeout: Some(Duration::from_millis(3_600_000)),
            require_idempotency_key: false,
            retry_after_seconds: Some(5),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "OPTIONS"]),
        },
        "spa" => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: 1024 * 1024,
            upstream_total_timeout: Some(Duration::from_millis(15_000)),
            upstream_read_timeout: Some(Duration::from_millis(30_000)),
            require_idempotency_key: false,
            retry_after_seconds: Some(5),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "HEAD", "OPTIONS"]),
        },
        _ => EdgePolicy {
            prefix: prefix.to_owned(),
            class: class.to_owned(),
            upstream: None,
            body_limit_bytes: default_body_limit,
            upstream_total_timeout: None,
            upstream_read_timeout: None,
            require_idempotency_key: false,
            retry_after_seconds: Some(5),
            cache_control: Some("no-store".to_owned()),
            block: false,
            allowed_methods: methods(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
        },
    }
}

fn methods<const N: usize>(values: [&str; N]) -> Vec<String> {
    values.into_iter().map(str::to_owned).collect()
}

#[async_trait]
impl ProxyHttp for MedBrainsProxy {
    type CTX = RequestContext;

    fn new_ctx(&self) -> Self::CTX {
        RequestContext::new()
    }

    async fn request_filter(&self, session: &mut Session, ctx: &mut Self::CTX) -> Result<bool>
    where
        Self::CTX: Send + Sync,
    {
        session.set_read_timeout(Some(self.downstream_read_timeout));
        session.set_write_timeout(Some(self.downstream_write_timeout));
        session.set_total_drain_timeout(Some(self.drain_timeout));

        ctx.request_id = request_id(session);
        ctx.edge_policy = self.edge_policy_for(session.req_header().uri.path());

        if session.req_header().uri.path() == "/proxy-health" {
            text_response(session, 200, "ok\n").await?;
            return Ok(true);
        }

        if !self.known_host(session) {
            tracing::warn!(
                request_id = %ctx.request_id,
                host = host_header(session).unwrap_or(""),
                "rejected unknown host"
            );
            session.set_keepalive(None);
            text_response(
                session,
                421,
                "This MedBrains service is not configured for that host.\n",
            )
            .await?;
            return Ok(true);
        }

        if self.block_source_maps && is_source_map_request(session) {
            tracing::info!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                path = %session.req_header().uri.path(),
                "blocked public source map request"
            );
            text_response(session, 404, "Not found\n").await?;
            return Ok(true);
        }

        if is_wasm_request(session) && !is_allowed_wasm_request(session) {
            tracing::warn!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                path = %session.req_header().uri.path(),
                "blocked non-CRDT wasm request"
            );
            text_response(session, 404, "Not found\n").await?;
            return Ok(true);
        }

        if ctx.edge_policy.block {
            tracing::info!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                path = %session.req_header().uri.path(),
                "blocked by edge policy"
            );
            text_response(session, 404, "Not found\n").await?;
            return Ok(true);
        }

        if has_ambiguous_http_framing(session.req_header())
            || has_invalid_content_length(session.req_header())
        {
            tracing::warn!(request_id = %ctx.request_id, "rejected ambiguous HTTP framing");
            session.set_keepalive(None);
            text_response(session, 400, "Bad request.\n").await?;
            return Ok(true);
        }

        let body_limit = ctx.edge_policy.body_limit_bytes;
        if content_length(session.req_header()).is_some_and(|len| len > body_limit) {
            tracing::warn!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                limit = body_limit,
                "rejected oversized request"
            );
            session.set_keepalive(None);
            text_response(session, 413, "Request body is too large.\n").await?;
            return Ok(true);
        }

        if !method_allowed(session, &ctx.edge_policy) {
            session.set_keepalive(None);
            text_response(session, 405, "Method not allowed.\n").await?;
            return Ok(true);
        }

        if mutation_method(session.req_header())
            && ctx.edge_policy.require_idempotency_key
            && !has_idempotency_key(session.req_header())
        {
            tracing::warn!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                path = %session.req_header().uri.path(),
                "rejected mutation without idempotency key"
            );
            text_response(
                session,
                428,
                "This sync request needs an Idempotency-Key so retries stay safe.\n",
            )
            .await?;
            return Ok(true);
        }

        Ok(false)
    }

    async fn upstream_peer(
        &self,
        session: &mut Session,
        ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        let route = host_without_port(session)
            .and_then(|host| self.routes.get(host))
            .unwrap_or(&self.default_route);

        let upstream = ctx
            .edge_policy
            .upstream
            .as_deref()
            .unwrap_or(&route.upstream);
        let mut peer = HttpPeer::new(upstream, false, String::new());
        peer.options.connection_timeout = Some(self.upstream_connect_timeout);
        peer.options.total_connection_timeout = ctx
            .edge_policy
            .upstream_total_timeout
            .or(Some(self.upstream_total_timeout));
        peer.options.read_timeout = ctx
            .edge_policy
            .upstream_read_timeout
            .or(Some(self.upstream_read_timeout));
        peer.options.idle_timeout = Some(self.upstream_idle_timeout);

        Ok(Box::new(peer))
    }

    async fn upstream_request_filter(
        &self,
        session: &mut Session,
        req: &mut RequestHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        let ip = session
            .client_addr()
            .map(|addr| addr.to_string())
            .unwrap_or_default();

        strip_untrusted_proxy_headers(req);
        req.insert_header("X-Real-IP", &ip)?;
        req.insert_header("X-Forwarded-For", &ip)?;
        req.insert_header("X-Forwarded-Proto", "https")?;
        if let Some(host) = host_header(session) {
            req.insert_header("X-Forwarded-Host", host)?;
        }
        req.insert_header("X-Request-Id", ctx.request_id.as_str())?;
        req.insert_header("X-MedBrains-Edge-Class", ctx.edge_policy.class.as_str())?;

        Ok(())
    }

    async fn response_filter(
        &self,
        session: &mut Session,
        resp: &mut ResponseHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        if should_normalize_spa_fallback(session, resp) {
            resp.set_status(StatusCode::OK)?;
        }
        apply_cost_headers(session, resp, &ctx.edge_policy)?;
        resp.insert_header("Server", "MedBrains")?;
        resp.insert_header("X-Request-Id", ctx.request_id.as_str())?;
        resp.insert_header("X-MedBrains-Edge-Class", ctx.edge_policy.class.as_str())?;
        resp.remove_header("content-security-policy");
        resp.insert_header("X-Content-Type-Options", "nosniff")?;
        resp.insert_header("X-Frame-Options", "SAMEORIGIN")?;
        resp.insert_header("Referrer-Policy", "strict-origin-when-cross-origin")?;
        resp.insert_header("X-Permitted-Cross-Domain-Policies", "none")?;
        resp.insert_header(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'wasm-unsafe-eval'; script-src-elem 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src 'self'; form-action 'self'; upgrade-insecure-requests",
        )?;
        resp.insert_header(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )?;
        Ok(())
    }

    async fn fail_to_proxy(
        &self,
        session: &mut Session,
        error: &pingora::Error,
        ctx: &mut Self::CTX,
    ) -> FailToProxy
    where
        Self::CTX: Send + Sync,
    {
        let status = match error.esource() {
            ErrorSource::Upstream => 503,
            ErrorSource::Downstream => 0,
            ErrorSource::Internal | ErrorSource::Unset => 500,
        };

        if status > 0 {
            let message = match status {
                503 => {
                    "MedBrains is refreshing the connection.\n\nYour work is important, and we are bringing the service back online. Please try again in a minute.\n"
                }
                _ => {
                    "MedBrains needs a moment to complete this request.\n\nPlease try again shortly. If this keeps happening, the hospital IT team can help.\n"
                }
            };
            if let Err(write_error) = edge_error_response(
                session,
                status,
                message,
                ctx.edge_policy.retry_after_seconds,
            )
            .await
            {
                tracing::warn!(error = %write_error, "failed to write friendly proxy error");
            }
        }

        FailToProxy {
            error_code: status,
            can_reuse_downstream: false,
        }
    }

    async fn logging(
        &self,
        session: &mut Session,
        error: Option<&pingora::Error>,
        ctx: &mut Self::CTX,
    ) {
        let status = session
            .response_written()
            .map_or(0, |resp| resp.status.as_u16());
        let elapsed_ms = ctx.started_at.elapsed().as_millis();
        let req = session.req_header();

        if let Some(error) = error {
            tracing::warn!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                method = %req.method,
                path = %req.uri.path(),
                status,
                elapsed_ms,
                error = %error,
                "proxy request failed"
            );
        } else {
            tracing::info!(
                request_id = %ctx.request_id,
                class = %ctx.edge_policy.class,
                method = %req.method,
                path = %req.uri.path(),
                status,
                elapsed_ms,
                "proxy request complete"
            );
        }
    }
}

#[async_trait]
impl ProxyHttp for RedirectProxy {
    type CTX = ();

    fn new_ctx(&self) -> Self::CTX {}

    async fn request_filter(&self, session: &mut Session, _ctx: &mut Self::CTX) -> Result<bool>
    where
        Self::CTX: Send + Sync,
    {
        let host = host_without_port(session)
            .filter(|host| self.allowed_domains.iter().any(|domain| domain == host))
            .unwrap_or(self.default_domain.as_str());
        let location = format!("https://{host}{}", session.req_header().uri);
        let mut resp = ResponseHeader::build(308, Some(4))?;
        resp.insert_header("Location", location)?;
        resp.insert_header("Cache-Control", "no-store")?;
        session.set_keepalive(None);
        session.write_response_header(Box::new(resp), true).await?;
        Ok(true)
    }

    async fn upstream_peer(
        &self,
        _session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        Err(pingora::Error::new(pingora::ErrorType::InternalError))
    }
}

fn host_header(session: &Session) -> Option<&str> {
    session
        .req_header()
        .headers
        .get("host")
        .and_then(|value| value.to_str().ok())
}

fn host_without_port(session: &Session) -> Option<&str> {
    host_header(session)
        .and_then(|host| host.split(':').next())
        .filter(|host| !host.is_empty())
}

fn has_ambiguous_http_framing(req: &RequestHeader) -> bool {
    let content_length_count = req.headers.get_all("content-length").iter().count();
    content_length_count > 1
        || (content_length_count == 1 && req.headers.contains_key("transfer-encoding"))
}

fn has_invalid_content_length(req: &RequestHeader) -> bool {
    req.headers.get_all("content-length").iter().any(|value| {
        value
            .to_str()
            .map_or(true, |raw| raw.parse::<u64>().is_err())
    })
}

fn content_length(req: &RequestHeader) -> Option<u64> {
    req.headers
        .get("content-length")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn is_source_map_request(session: &Session) -> bool {
    session.req_header().uri.path().ends_with(".map")
}

fn is_wasm_request(session: &Session) -> bool {
    session.req_header().uri.path().ends_with(".wasm")
}

fn is_allowed_wasm_request(session: &Session) -> bool {
    const LORO_WASM_PREFIX: &str = "/assets/loro_wasm_bg-";
    const WASM_SUFFIX: &str = ".wasm";

    let path = session.req_header().uri.path();
    let Some(asset_id) = path
        .strip_prefix(LORO_WASM_PREFIX)
        .and_then(|value| value.strip_suffix(WASM_SUFFIX))
    else {
        return false;
    };

    !asset_id.is_empty() && !asset_id.contains('/')
}

fn method_allowed(session: &Session, policy: &EdgePolicy) -> bool {
    let method = session.req_header().method.as_str();
    !method.eq_ignore_ascii_case("TRACE")
        && (policy.allowed_methods.is_empty()
            || policy
                .allowed_methods
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(method)))
}

fn mutation_method(req: &RequestHeader) -> bool {
    matches!(req.method.as_str(), "POST" | "PUT" | "PATCH" | "DELETE")
}

fn has_idempotency_key(req: &RequestHeader) -> bool {
    req.headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| !value.trim().is_empty())
}

fn strip_untrusted_proxy_headers(req: &mut RequestHeader) {
    for header in [
        "forwarded",
        "proxy",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-real-ip",
    ] {
        req.remove_header(header);
    }
}

fn apply_cost_headers(
    _session: &Session,
    resp: &mut ResponseHeader,
    policy: &EdgePolicy,
) -> Result<()> {
    if let Some(cache_control) = &policy.cache_control {
        if policy.class == "assets" {
            if resp.status.is_success() || resp.status.is_redirection() {
                resp.insert_header("Cache-Control", cache_control.as_str())?;
                resp.insert_header("Vary", "Accept-Encoding")?;
                resp.insert_header("X-MedBrains-Cache-Policy", "browser-immutable")?;
            }
        } else {
            resp.insert_header("Cache-Control", cache_control.as_str())?;
        }
    }
    Ok(())
}

fn should_normalize_spa_fallback(session: &Session, resp: &ResponseHeader) -> bool {
    if resp.status != StatusCode::NOT_FOUND {
        return false;
    }

    let method = session.req_header().method.as_str();
    if !method.eq_ignore_ascii_case("GET") && !method.eq_ignore_ascii_case("HEAD") {
        return false;
    }

    let path = session.req_header().uri.path();
    if path.starts_with("/api/")
        || path.starts_with("/ws")
        || path.starts_with("/assets/")
        || path == "/proxy-health"
        || path == "/favicon.ico"
        || path == "/manifest.json"
        || path
            .rsplit('/')
            .next()
            .is_some_and(|segment| segment.contains('.'))
    {
        return false;
    }

    resp.headers
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/html"))
}

fn request_id(session: &Session) -> String {
    if let Some(existing) = session
        .req_header()
        .headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
    {
        return existing.to_owned();
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    format!("mbx-{}-{nanos}", std::process::id())
}

async fn text_response(session: &mut Session, status: u16, body: &str) -> Result<()> {
    let body = Bytes::copy_from_slice(body.as_bytes());
    let mut resp = ResponseHeader::build(status, Some(4))?;
    resp.insert_header("Content-Type", "text/plain; charset=utf-8")?;
    resp.insert_header("Cache-Control", "no-store")?;
    resp.insert_header("Server", "MedBrains")?;
    resp.set_content_length(body.len())?;
    session.write_response_header(Box::new(resp), false).await?;
    session.write_response_body(Some(body), true).await
}

async fn edge_error_response(
    session: &mut Session,
    status: u16,
    body: &str,
    retry_after_seconds: Option<u64>,
) -> Result<()> {
    let body = Bytes::copy_from_slice(body.as_bytes());
    let mut resp = ResponseHeader::build(status, Some(6))?;
    resp.insert_header("Content-Type", "text/plain; charset=utf-8")?;
    resp.insert_header("Cache-Control", "no-store")?;
    resp.insert_header("Server", "MedBrains")?;
    if let Some(seconds) = retry_after_seconds {
        resp.insert_header("Retry-After", seconds.to_string())?;
    }
    resp.set_content_length(body.len())?;
    session.set_keepalive(None);
    session.write_response_header(Box::new(resp), false).await?;
    session.write_response_body(Some(body), true).await
}

fn first_tls_route(cfg: &ProxyConfig) -> anyhow::Result<&RouteConfig> {
    cfg.routes
        .iter()
        .find(|route| route.cert_path.is_some())
        .ok_or_else(|| anyhow::anyhow!("at least one route must configure cert_path/key_path"))
}

fn config_path() -> String {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    match args.as_slice() {
        [flag, path] if flag == "--config" || flag == "-c" => path.clone(),
        [path] => path.clone(),
        _ => "proxy.toml".to_owned(),
    }
}

fn main() -> anyhow::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow::anyhow!("failed to install rustls crypto provider"))?;

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_proxy=info,pingora=warn".into()),
        )
        .init();

    let cfg = ProxyConfig::load(&config_path())?;
    let default_domain = cfg
        .routes
        .first()
        .map(|route| route.domain.clone())
        .ok_or_else(|| anyhow::anyhow!("proxy config requires a route"))?;
    let allowed_domains = cfg
        .routes
        .iter()
        .map(|route| route.domain.clone())
        .collect::<Vec<_>>();

    let mut server = Server::new(None)?;
    server.bootstrap();

    let mut redirect_service = http_proxy_service(
        &server.configuration,
        RedirectProxy {
            default_domain,
            allowed_domains,
        },
    );
    redirect_service.add_tcp(&format!("0.0.0.0:{}", cfg.http_port()));

    let proxy = MedBrainsProxy::from_config(&cfg)?;
    let mut https_service = http_proxy_service(&server.configuration, proxy);
    let tls_route = first_tls_route(&cfg)?;
    let cert = tls_route
        .cert_path
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("TLS route missing cert_path"))?;
    let key = tls_route
        .key_path
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("TLS route missing key_path"))?;
    let tls = pingora::listeners::tls::TlsSettings::intermediate(cert, key)
        .map_err(|e| anyhow::anyhow!("failed to initialize TLS: {e}"))?;
    https_service.add_tls_with_settings(&format!("0.0.0.0:{}", cfg.https_port()), None, tls);

    server.add_service(redirect_service);
    server.add_service(https_service);
    tracing::info!(
        http = cfg.http_port(),
        https = cfg.https_port(),
        routes = cfg.routes.len(),
        "medbrains pingora edge listening"
    );
    server.run_forever();
}
