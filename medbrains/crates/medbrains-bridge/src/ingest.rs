use anyhow::Result;
use tracing::{error, info};

use crate::buffer::MessageBuffer;
use crate::config::BridgeConfig;

/// Deliver a message directly to MedBrains API.
pub async fn deliver(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    device_instance_id: &str,
    module: &str,
    protocol: &str,
    parsed_payload: &serde_json::Value,
    mapped_data: &serde_json::Value,
    processing_duration_ms: i32,
) -> Result<()> {
    let url = format!("{}/api/device-ingest/{module}", cfg.api_base);

    let body = serde_json::json!({
        "device_instance_id": device_instance_id,
        "protocol": protocol,
        "parsed_payload": parsed_payload,
        "mapped_data": mapped_data,
        "processing_duration_ms": processing_duration_ms,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(anyhow::anyhow!("API returned {status}: {text}"))
    }
}

/// Background loop that drains the SQLite buffer — retries failed messages.
pub async fn drain_loop(buffer: MessageBuffer, client: &reqwest::Client, cfg: &BridgeConfig) {
    let interval = tokio::time::Duration::from_secs(cfg.drain_interval_secs);

    loop {
        tokio::time::sleep(interval).await;

        let messages = match buffer.pending(20) {
            Ok(m) => m,
            Err(e) => {
                error!(error = %e, "buffer read error");
                continue;
            }
        };

        if messages.is_empty() {
            continue;
        }

        info!(count = messages.len(), "draining buffered messages");

        for msg in messages {
            let parsed: serde_json::Value = match serde_json::from_str(&msg.parsed_payload) {
                Ok(v) => v,
                Err(e) => {
                    error!(id = msg.id, error = %e, "invalid buffered payload");
                    let _ = buffer.mark_retry(msg.id, &format!("parse error: {e}"));
                    continue;
                }
            };

            let mapped: serde_json::Value = match serde_json::from_str(&msg.mapped_data) {
                Ok(v) => v,
                Err(e) => {
                    error!(id = msg.id, error = %e, "invalid buffered mapped data");
                    let _ = buffer.mark_retry(msg.id, &format!("parse error: {e}"));
                    continue;
                }
            };

            match deliver(
                client,
                cfg,
                &msg.device_instance_id,
                &msg.module,
                &msg.protocol,
                &parsed,
                &mapped,
                msg.processing_duration_ms.unwrap_or(0),
            )
            .await
            {
                Ok(()) => {
                    info!(id = msg.id, "buffered message delivered");
                    let _ = buffer.remove(msg.id);
                }
                Err(e) => {
                    let _ = buffer.mark_retry(msg.id, &e.to_string());
                }
            }
        }
    }
}
