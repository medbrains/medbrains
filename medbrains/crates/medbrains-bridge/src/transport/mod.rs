//! Bridge transport — how the on-prem bridge agent reaches cloud.
//!
//! Two real impls + one no-op:
//! - `HeadscaleTransport` — the `tailscale` BSD-3 client is already up
//!   (cloud-init ran `tailscale up --login-server=...` at boot). The
//!   bridge daemon just verifies the tunnel is healthy via
//!   `tailscale status` and uses the cloud event bus URL via tailnet
//!   magic-DNS.
//! - `WssTransport` — fallback for hospitals whose firewall blocks
//!   even WireGuard's DERP TCP-443 path. Bridge opens an HTTPS+WSS
//!   connection to the `bridge-ingress` ALB and tunnels through it.
//!   v1 ships only the health-check path; the tunnel-multiplexer is
//!   future work.
//! - `NoneTransport` — legacy mode (no tunnel; talks to `api_base`
//!   directly over the public internet). For dev + early SaaS
//!   deployments where the bridge runs on a host with public network
//!   access.

pub mod headscale;
pub mod wss;

use crate::config::{BridgeConfig, TunnelProvider};
use anyhow::{Context, Result};
use async_trait::async_trait;
use std::fmt;

#[async_trait]
pub trait Transport: Send + Sync + fmt::Debug {
    fn name(&self) -> &'static str;

    /// Confirm the tunnel is up. Called at startup and periodically
    /// from the heartbeat loop. Returns Err if the operator needs to
    /// intervene (tunnel down, ACL mismatch, no route).
    async fn verify_health(&self) -> Result<()>;

    /// Resolve `api_base` for this transport. Headscale rewrites the
    /// hostname to the magic-DNS form so traffic flows through the
    /// tunnel; WSS prepends the bridge-ingress URL for proxying;
    /// None passes through unchanged.
    fn cloud_url(&self, api_base: &str) -> String;
}

pub use headscale::HeadscaleTransport;
pub use wss::WssTransport;

/// No-op transport (legacy / dev). Always healthy, passes URLs through.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoneTransport;

#[async_trait]
impl Transport for NoneTransport {
    fn name(&self) -> &'static str {
        "none"
    }

    async fn verify_health(&self) -> Result<()> {
        Ok(())
    }

    fn cloud_url(&self, api_base: &str) -> String {
        api_base.to_owned()
    }
}

/// Build the right Transport from BridgeConfig. Used at startup.
pub fn build(cfg: &BridgeConfig) -> Result<Box<dyn Transport>> {
    let Some(tunnel) = cfg.tunnel.as_ref() else {
        return Ok(Box::new(NoneTransport));
    };
    match tunnel.provider {
        TunnelProvider::None => Ok(Box::new(NoneTransport)),
        TunnelProvider::Headscale => {
            let login_server = tunnel
                .login_server
                .clone()
                .context("tunnel.login_server is required when provider=headscale")?;
            Ok(Box::new(HeadscaleTransport::new(
                login_server,
                tunnel.cloud_event_bus_hostname.clone(),
            )))
        }
        TunnelProvider::Wss => {
            let bridge_ingress_url = tunnel
                .bridge_ingress_url
                .clone()
                .context("tunnel.bridge_ingress_url is required when provider=wss")?;
            Ok(Box::new(WssTransport::new(bridge_ingress_url)))
        }
    }
}
