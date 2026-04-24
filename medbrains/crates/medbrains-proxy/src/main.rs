//! MedBrains Proxy — Pingora with per-domain TLS

use async_trait::async_trait;
use pingora::prelude::*;
use pingora_http::ResponseHeader;
use pingora_proxy::{ProxyHttp, Session};
use std::collections::HashMap;

mod config;
use config::ProxyConfig;

struct MedBrainsProxy {
    routes: HashMap<String, String>,
    default_upstream: String,
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
        let host = session
            .req_header()
            .headers
            .get("host")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .split(':')
            .next()
            .unwrap_or("");

        let upstream = self.routes.get(host).unwrap_or(&self.default_upstream);
        let addr: std::net::SocketAddr = upstream
            .parse()
            .map_err(|_| pingora::Error::new(pingora::ErrorType::InternalError))?;

        Ok(Box::new(HttpPeer::new(addr, false, String::new())))
    }

    async fn upstream_request_filter(
        &self,
        session: &mut Session,
        req: &mut RequestHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()> {
        let ip = session.client_addr().map(|a| a.to_string()).unwrap_or_default();
        req.insert_header("X-Real-IP", &ip)?;
        req.insert_header("X-Forwarded-For", &ip)?;
        req.insert_header("X-Forwarded-Proto", "https")?;
        Ok(())
    }

    async fn response_filter(
        &self,
        _session: &mut Session,
        resp: &mut ResponseHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        resp.insert_header("X-Content-Type-Options", "nosniff")?;
        resp.insert_header("X-Frame-Options", "SAMEORIGIN")?;
        resp.insert_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")?;
        Ok(())
    }
}

fn main() {
    // Install rustls crypto provider (required by rustls 0.23+)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_proxy=info,pingora=warn".into()),
        )
        .init();

    let config_path = std::env::args().nth(2).unwrap_or_else(|| "proxy.toml".to_owned());
    let cfg = ProxyConfig::load(&config_path).expect("Failed to load config");

    let mut routes = HashMap::new();
    let mut default_upstream = "127.0.0.1:3000".to_owned();

    for (i, r) in cfg.routes.iter().enumerate() {
        tracing::info!(domain = %r.domain, upstream = %r.upstream, "route");
        routes.insert(r.domain.clone(), r.upstream.clone());
        if i == 0 { default_upstream = r.upstream.clone(); }
    }

    let proxy = MedBrainsProxy { routes, default_upstream };

    let mut server = Server::new(None).unwrap();
    server.bootstrap();

    let mut svc = http_proxy_service(&server.configuration, proxy);

    // HTTP listener
    let http_port = cfg.http_port.unwrap_or(80);
    svc.add_tcp(&format!("0.0.0.0:{http_port}"));

    // HTTPS — use first route's cert (SNI not supported in rustls backend)
    // All domains share one cert. For per-domain certs, use wildcard or SAN cert.
    let https_port = cfg.https_port.unwrap_or(443);
    let first_tls = cfg.routes.iter().find(|r| r.cert_path.is_some());

    if let Some(r) = first_tls {
        let cert = r.cert_path.as_ref().unwrap();
        let key = r.key_path.as_ref().unwrap();
        let tls = pingora::listeners::tls::TlsSettings::intermediate(cert, key)
            .expect("TLS init failed");

        svc.add_tls_with_settings(&format!("0.0.0.0:{https_port}"), None, tls);
        tracing::info!(https = https_port, cert = %cert, "HTTPS ready");
    }

    server.add_service(svc);
    tracing::info!(http = http_port, domains = cfg.routes.len(), "proxy listening");
    server.run_forever();
}
