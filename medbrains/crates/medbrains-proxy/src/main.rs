//! MedBrains Proxy — Pingora-based reverse proxy
//!
//! Replaces Caddy. Handles TLS termination + routing for all domains:
//! - medbrains.alagappahospital.com → MedBrains (backend + static)
//! - email.alagappa.org → Stalwart mail (8080)
//! - charts.alagappa.org → Superset (8088)
//! - wiki.alagappa.org → Wiki (3333)
//!
//! Config: proxy.toml
//! Usage: medbrains-proxy -c proxy.toml

use async_trait::async_trait;
use pingora::prelude::*;
use pingora_http::ResponseHeader;
use pingora_proxy::{ProxyHttp, Session};
use std::sync::Arc;

mod config;

use config::ProxyConfig;

/// Route entry — maps a domain to an upstream
struct Route {
    domain: String,
    upstream: String,
    static_root: Option<String>,
    gzip: bool,
}

/// The proxy service
struct MedBrainsProxy {
    routes: Vec<Route>,
}

#[async_trait]
impl ProxyHttp for MedBrainsProxy {
    type CTX = ();

    fn new_ctx(&self) {}

    async fn upstream_peer(
        &self,
        session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        // Get the Host header
        let host = session
            .req_header()
            .headers
            .get("host")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .split(':')
            .next()
            .unwrap_or("");

        // Find matching route
        let route = self
            .routes
            .iter()
            .find(|r| r.domain == host);

        let upstream = match route {
            Some(r) => &r.upstream,
            None => {
                // Default: return 404 or first route
                if let Some(first) = self.routes.first() {
                    &first.upstream
                } else {
                    return Err(pingora::Error::new(pingora::ErrorType::ConnectNoRoute));
                }
            }
        };

        // Parse upstream address
        let addr: std::net::SocketAddr = upstream
            .parse()
            .map_err(|_| pingora::Error::new(pingora::ErrorType::InternalError))?;

        let peer = Box::new(HttpPeer::new(addr, false, String::new()));
        Ok(peer)
    }

    async fn upstream_request_filter(
        &self,
        session: &mut Session,
        upstream_request: &mut RequestHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()> {
        // Add X-Forwarded headers
        let client_ip = session.client_addr().map(|a| a.to_string()).unwrap_or_default();

        upstream_request.insert_header("X-Real-IP", &client_ip)?;
        upstream_request.insert_header("X-Forwarded-For", &client_ip)?;
        upstream_request.insert_header("X-Forwarded-Proto", "https")?;

        Ok(())
    }

    async fn response_filter(
        &self,
        _session: &mut Session,
        upstream_response: &mut ResponseHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        // Security headers on all responses
        upstream_response.insert_header("X-Content-Type-Options", "nosniff")?;
        upstream_response.insert_header("X-Frame-Options", "SAMEORIGIN")?;
        upstream_response.insert_header("X-XSS-Protection", "1; mode=block")?;
        upstream_response.insert_header(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )?;

        Ok(())
    }
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_proxy=info,pingora=warn".into()),
        )
        .init();

    // Load config
    let config_path = std::env::args()
        .nth(2)
        .unwrap_or_else(|| "proxy.toml".to_owned());

    let proxy_config = ProxyConfig::load(&config_path).expect("Failed to load proxy config");

    tracing::info!(
        domains = proxy_config.routes.len(),
        "starting MedBrains proxy"
    );

    // Build routes
    let routes: Vec<Route> = proxy_config
        .routes
        .iter()
        .map(|r| {
            tracing::info!(domain = %r.domain, upstream = %r.upstream, "route registered");
            Route {
                domain: r.domain.clone(),
                upstream: r.upstream.clone(),
                static_root: r.static_root.clone(),
                gzip: r.gzip.unwrap_or(true),
            }
        })
        .collect();

    let proxy = MedBrainsProxy { routes };

    // Create Pingora server
    let mut server = Server::new(None).unwrap();
    server.bootstrap();

    let mut proxy_service = http_proxy_service(&server.configuration, proxy);

    // Listen on HTTP (80) and HTTPS (443)
    proxy_service.add_tcp(&format!("0.0.0.0:{}", proxy_config.http_port.unwrap_or(80)));

    if let Some(ref tls) = proxy_config.tls {
        proxy_service.add_tls(
            &format!("0.0.0.0:{}", proxy_config.https_port.unwrap_or(443)),
            &tls.cert_path,
            &tls.key_path,
        );
    }

    server.add_service(proxy_service);

    tracing::info!(
        http = proxy_config.http_port.unwrap_or(80),
        https = proxy_config.https_port.unwrap_or(443),
        "proxy listening"
    );

    server.run_forever();
}
