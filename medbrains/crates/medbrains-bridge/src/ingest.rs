use anyhow::Result;
use tracing::{error, info};

use crate::buffer::MessageBuffer;
use crate::config::BridgeConfig;

/// Attach the bridge's API key, when configured.
pub(crate) fn authed(
    request: reqwest::RequestBuilder,
    cfg: &BridgeConfig,
) -> reqwest::RequestBuilder {
    match cfg.api_key.as_deref() {
        Some(key) => request.bearer_auth(key),
        None => request,
    }
}

/// One device message bound for `POST /api/device-ingest/{module}`.
#[derive(Debug)]
pub(crate) struct Delivery<'a> {
    pub device_instance_id: &'a str,
    pub module: &'a str,
    pub protocol: &'a str,
    pub parsed_payload: &'a serde_json::Value,
    pub mapped_data: &'a serde_json::Value,
    pub processing_duration_ms: i32,
}

/// Deliver a message directly to MedBrains API.
pub(crate) async fn deliver(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    msg: &Delivery<'_>,
) -> Result<()> {
    let url = format!("{}/api/device-ingest/{}", cfg.api_base, msg.module);

    let body = serde_json::json!({
        "device_instance_id": msg.device_instance_id,
        "protocol": msg.protocol,
        "parsed_payload": msg.parsed_payload,
        "mapped_data": msg.mapped_data,
        "processing_duration_ms": msg.processing_duration_ms,
    });

    let resp = authed(client.post(&url), cfg).json(&body).send().await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(anyhow::anyhow!("API returned {status}: {text}"))
    }
}

/// Background loop that drains the SQLite buffer — retries failed messages.
pub(crate) async fn drain_loop(
    buffer: MessageBuffer,
    client: &reqwest::Client,
    cfg: &BridgeConfig,
) {
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

            let delivery = Delivery {
                device_instance_id: &msg.device_instance_id,
                module: &msg.module,
                protocol: &msg.protocol,
                parsed_payload: &parsed,
                mapped_data: &mapped,
                processing_duration_ms: msg.processing_duration_ms.unwrap_or(0),
            };
            match deliver(client, cfg, &delivery).await {
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
