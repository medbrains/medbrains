use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct BridgeConfig {
    pub agent_name: String,
    pub agent_key: String,
    pub api_base: String,
    #[serde(default = "default_buffer_path")]
    pub buffer_path: String,
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,
    #[serde(default = "default_drain_interval")]
    pub drain_interval_secs: u64,
    pub hl7_listen: Option<String>,
    pub device_instance_id: Option<String>,
    #[serde(default = "default_deployment_mode")]
    pub deployment_mode: String,
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
