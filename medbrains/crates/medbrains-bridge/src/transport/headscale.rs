//! Headscale transport — assumes the host's `tailscale` BSD-3 client
//! is already up (cloud-init ran `tailscale up --login-server=…` at
//! boot). The bridge daemon verifies the tunnel via
//! `tailscale status --json` and uses tailnet magic-DNS to reach the
//! cloud event bus.

use super::Transport;
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use serde::Deserialize;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, info, warn};

#[derive(Debug, Clone)]
pub struct HeadscaleTransport {
    login_server: String,
    cloud_hostname_override: Option<String>,
    /// Path to the tailscale CLI binary. Override in tests.
    tailscale_bin: String,
}

impl HeadscaleTransport {
    pub fn new(login_server: String, cloud_hostname_override: Option<String>) -> Self {
        Self {
            login_server,
            cloud_hostname_override,
            tailscale_bin: "tailscale".to_owned(),
        }
    }

    #[cfg(test)]
    pub fn with_tailscale_bin(mut self, bin: impl Into<String>) -> Self {
        self.tailscale_bin = bin.into();
        self
    }
}

#[async_trait]
impl Transport for HeadscaleTransport {
    fn name(&self) -> &'static str {
        "headscale"
    }

    async fn verify_health(&self) -> Result<()> {
        debug!(login_server = %self.login_server, "checking tailscale status");

        let out = Command::new(&self.tailscale_bin)
            .arg("status")
            .arg("--json")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .with_context(|| {
                format!(
                    "failed to spawn `{} status --json` — is the tailscale BSD client installed and in PATH?",
                    self.tailscale_bin
                )
            })?;

        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(anyhow!(
                "tailscale status failed with exit code {:?}: {}",
                out.status.code(),
                stderr.trim()
            ));
        }

        let parsed: TailscaleStatus = serde_json::from_slice(&out.stdout)
            .context("tailscale status returned non-JSON output")?;

        if parsed.backend_state != "Running" {
            return Err(anyhow!(
                "tailnet backend state is `{}` (expected `Running`); is the daemon up?",
                parsed.backend_state
            ));
        }

        if let Some(self_node) = parsed.self_status.as_ref() {
            if !self_node.online {
                warn!(node = %self_node.host_name, "self node reports offline; tailnet may be degraded");
            }
            info!(
                node = %self_node.host_name,
                tags = ?self_node.tags,
                "headscale tunnel healthy"
            );
        }

        Ok(())
    }

    fn cloud_url(&self, api_base: &str) -> String {
        if let Some(host) = self.cloud_hostname_override.as_ref() {
            // Replace the hostname in api_base with the magic-DNS form.
            // Naive but predictable: scheme + host override + path.
            if let Ok(url) = url::Url::parse(api_base) {
                let scheme = url.scheme();
                let path_and_query = match url.query() {
                    Some(q) => format!("{}?{q}", url.path()),
                    None => url.path().to_owned(),
                };
                return format!("{scheme}://{host}{path_and_query}");
            }
            return format!("https://{host}");
        }
        api_base.to_owned()
    }
}

/// Subset of `tailscale status --json` we care about.
#[derive(Debug, Deserialize)]
struct TailscaleStatus {
    #[serde(rename = "BackendState", default)]
    backend_state: String,
    #[serde(rename = "Self", default)]
    self_status: Option<TailscaleNode>,
}

#[derive(Debug, Deserialize)]
struct TailscaleNode {
    #[serde(rename = "HostName", default)]
    host_name: String,
    #[serde(rename = "Online", default)]
    online: bool,
    #[serde(rename = "Tags", default)]
    tags: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn missing_tailscale_binary_fails_helpfully() {
        let t = HeadscaleTransport::new("https://example.invalid".into(), None)
            .with_tailscale_bin("/no/such/binary");
        let err = t.verify_health().await.unwrap_err();
        assert!(format!("{err:?}").contains("failed to spawn"));
    }

    #[test]
    fn cloud_url_passthrough_without_override() {
        let t = HeadscaleTransport::new("https://hs".into(), None);
        assert_eq!(
            t.cloud_url("https://api.medbrains.cloud/v1/events"),
            "https://api.medbrains.cloud/v1/events"
        );
    }

    #[test]
    fn cloud_url_rewrites_host_with_override() {
        let t = HeadscaleTransport::new(
            "https://hs".into(),
            Some("cloud-bridge.medbrains.internal".into()),
        );
        assert_eq!(
            t.cloud_url("https://api.medbrains.cloud/v1/events"),
            "https://cloud-bridge.medbrains.internal/v1/events"
        );
    }
}
