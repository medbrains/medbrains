use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct BridgeConfig {
    pub agent_name: String,
    pub agent_key: String,
    pub api_base: String,
    /// A MedBrains API key (Admin → API keys) holding `devices.ingest`, and
    /// `devices.orders.send` when orders go out to the analyzer. Sent as a
    /// bearer token on every data call.
    pub api_key: Option<String>,
    #[serde(default = "default_buffer_path")]
    pub buffer_path: String,
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,
    #[serde(default = "default_drain_interval")]
    pub drain_interval_secs: u64,
    pub hl7_listen: Option<String>,
    /// ASTM E1381/E1394 listener (Sysmex-class analyzers), e.g. "0.0.0.0:5000".
    /// A serial analyzer reaches it through a serial-to-TCP converter.
    pub astm_listen: Option<String>,
    /// Send collected samples' orders to the analyzer as HL7 ORM, polling
    /// every this many seconds. The analyzer's address is the device's host
    /// and port in MedBrains. Off when absent.
    pub order_poll_secs: Option<u64>,
    /// Deliver queued print jobs to printers, polling every this many
    /// seconds. Off when absent. Needs `documents.print_jobs.deliver`.
    pub print_poll_secs: Option<u64>,
    /// Only these printers (MedBrains printer ids) — the ones this site can
    /// reach. Every deliverable printer when absent.
    pub printer_ids: Option<Vec<String>>,
    pub device_instance_id: Option<String>,
    #[serde(default = "default_deployment_mode")]
    pub deployment_mode: String,
    /// Optional [tunnel] section. When absent, the bridge talks to
    /// `api_base` directly over the public internet (legacy mode).
    /// When present, the bridge verifies tunnel health on startup and
    /// rewrites api_base via Transport::cloud_url before talking to
    /// the cloud.
    pub tunnel: Option<TunnelConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TunnelConfig {
    pub provider: TunnelProvider,

    /// Headscale `--login-server`, e.g. https://headscale.medbrains.cloud
    /// Used by `verify_health` for diagnostic logging; the actual
    /// `tailscale up` call happens out-of-band in cloud-init.
    pub login_server: Option<String>,

    /// Public bridge-ingress ALB URL, e.g.
    /// https://bridge-prod.medbrains.cloud
    /// Required when `provider == "wss"`.
    pub bridge_ingress_url: Option<String>,

    /// Magic-DNS hostname for the cloud event bus inside the tailnet.
    /// Optional override; default is to leave api_base unchanged.
    pub cloud_event_bus_hostname: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TunnelProvider {
    Headscale,
    Wss,
    None,
}

fn default_buffer_path() -> String {
    "bridge_buffer.db".to_owned()
}
fn default_heartbeat_interval() -> u64 {
    30
}
fn default_drain_interval() -> u64 {
    5
}
fn default_deployment_mode() -> String {
    "on_premise".to_owned()
}

impl BridgeConfig {
    pub fn load(path: &str) -> Result<Self> {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("failed to read config {path}: {e}"))?;
        let cfg: BridgeConfig = toml::from_str(&contents)?;
        Ok(cfg)
    }
}
