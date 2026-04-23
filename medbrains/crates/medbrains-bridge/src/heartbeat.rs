use anyhow::Result;
use tracing::{error, info};
use uuid::Uuid;

use crate::config::BridgeConfig;

/// Register this bridge agent with MedBrains API.
pub async fn register(client: &reqwest::Client, cfg: &BridgeConfig) -> Result<Uuid> {
    let url = format!("{}/api/bridge/register", cfg.api_base);

    let body = serde_json::json!({
        "agent_key": cfg.agent_key,
        "name": cfg.agent_name,
        "version": env!("CARGO_PKG_VERSION"),
        "hostname": hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok())
            .unwrap_or_else(|| "unknown".to_owned()),
        "capabilities": ["hl7_v2"],
        "deployment_mode": cfg.deployment_mode,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    let result: serde_json::Value = resp.json().await?;
    let agent_id = result["agent_id"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("missing agent_id in register response"))?;

    Ok(Uuid::parse_str(agent_id)?)
}

/// Send heartbeats at the configured interval.
pub async fn heartbeat_loop(client: &reqwest::Client, cfg: &BridgeConfig, agent_id: Uuid) {
    let url = format!("{}/api/bridge/heartbeat", cfg.api_base);
    let interval = tokio::time::Duration::from_secs(cfg.heartbeat_interval_secs);

    loop {
        tokio::time::sleep(interval).await;

        let body = serde_json::json!({
            "agent_id": agent_id,
            "devices_connected": 1,
            "buffer_depth": 0,
        });

        match client.post(&url).json(&body).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("heartbeat OK");
                } else {
                    error!(status = %resp.status(), "heartbeat failed");
                }
            }
            Err(e) => {
                error!(error = %e, "heartbeat error — API unreachable");
            }
        }
    }
}
