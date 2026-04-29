//! WSS transport — fallback for hospitals whose firewall blocks even
//! WireGuard's DERP TCP-443 path.
//!
//! v1 ships only the **health-check + URL rewrite** side: the bridge
//! verifies it can reach the bridge-ingress ALB over HTTPS at
//! `<bridge_ingress_url>/bridge/health`, then rewrites every cloud
//! API call to flow through the ingress as a reverse proxy. The
//! actual tunnel multiplexer (multiple logical streams over a single
//! WS frame) is future work — until then the existing reqwest HTTPS
//! flow keeps working through the ingress proxy.

use super::Transport;
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use std::time::Duration;
use tracing::{debug, info};

#[derive(Debug, Clone)]
pub struct WssTransport {
    bridge_ingress_url: String,
    client: reqwest::Client,
}

impl WssTransport {
    pub fn new(bridge_ingress_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            bridge_ingress_url,
            client,
        }
    }
}

#[async_trait]
impl Transport for WssTransport {
    fn name(&self) -> &'static str {
        "wss"
    }

    async fn verify_health(&self) -> Result<()> {
        let url = format!(
            "{}/bridge/health",
            self.bridge_ingress_url.trim_end_matches('/')
        );
        debug!(%url, "checking bridge-ingress health");

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("could not reach bridge-ingress at {url}"))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(anyhow!(
                "bridge-ingress health returned HTTP {} (expected 200)",
                status.as_u16()
            ));
        }

        info!(%url, "wss transport healthy");
        Ok(())
    }

    fn cloud_url(&self, api_base: &str) -> String {
        // Route every API call through the ingress proxy. The proxy
        // forwards to the cloud's internal API on the encrypted side
        // of the ALB. We keep the path + query from `api_base`.
        let trimmed = self.bridge_ingress_url.trim_end_matches('/');
        match url::Url::parse(api_base) {
            Ok(url) => {
                let path_and_query = match url.query() {
                    Some(q) => format!("{}?{q}", url.path()),
                    None => url.path().to_owned(),
                };
                format!("{trimmed}{path_and_query}")
            }
            Err(_) => format!("{trimmed}/"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_url_proxies_through_ingress() {
        let t = WssTransport::new("https://bridge-prod.medbrains.cloud".into());
        assert_eq!(
            t.cloud_url("https://api.medbrains.cloud/v1/events?tenant=A"),
            "https://bridge-prod.medbrains.cloud/v1/events?tenant=A"
        );
    }

    #[test]
    fn cloud_url_handles_trailing_slash_in_ingress() {
        let t = WssTransport::new("https://bridge-prod.medbrains.cloud/".into());
        assert_eq!(
            t.cloud_url("https://api.medbrains.cloud/v1/events"),
            "https://bridge-prod.medbrains.cloud/v1/events"
        );
    }

    #[tokio::test]
    async fn unreachable_ingress_returns_err() {
        // Use a non-routable IP so the connection fails fast (timeout
        // is 10s but DNS/connect failure is quick on most systems).
        let t = WssTransport::new("https://127.0.0.1:1".into());
        let err = t.verify_health().await.unwrap_err();
        let msg = format!("{err:?}");
        assert!(msg.contains("bridge-ingress") || msg.contains("could not reach"));
    }
}
