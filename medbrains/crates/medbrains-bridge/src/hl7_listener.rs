use anyhow::Result;
use medbrains_adapter_sdk::hl7;
use std::time::Instant;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tracing::{error, info, warn};

use crate::buffer::MessageBuffer;
use crate::config::BridgeConfig;
use crate::ingest;

/// Listen for HL7 v2 messages over MLLP (TCP with start/end framing).
pub async fn listen(
    addr: &str,
    buffer: MessageBuffer,
    client: &reqwest::Client,
    cfg: &BridgeConfig,
) -> Result<()> {
    let listener = TcpListener::bind(addr).await?;
    info!(addr = %addr, "HL7 MLLP listener started");

    loop {
        let (mut socket, peer) = listener.accept().await?;
        info!(peer = %peer, "HL7 connection accepted");

        let buf = buffer.clone();
        let cli = client.clone();
        let config = cfg.clone();

        tokio::spawn(async move {
            let mut data = Vec::new();
            let mut read_buf = [0u8; 4096];

            loop {
                match socket.read(&mut read_buf).await {
                    Ok(0) => {
                        info!(peer = %peer, "HL7 connection closed");
                        break;
                    }
                    Ok(n) => {
                        data.extend_from_slice(&read_buf[..n]);

                        // Check for MLLP end marker (0x1C 0x0D)
                        while let Some(end_pos) = find_mllp_end(&data) {
                            let frame = data[..end_pos + 2].to_vec();
                            data = data[end_pos + 2..].to_vec();

                            match process_hl7_message(&frame, &buf, &cli, &config).await {
                                Ok(ack) => {
                                    if let Err(e) = socket.write_all(&ack).await {
                                        error!(error = %e, "failed to send ACK");
                                    }
                                }
                                Err(e) => {
                                    error!(error = %e, "failed to process HL7 message");
                                    // Send NAK
                                    let nak = hl7::mllp_wrap(&hl7::generate_ack("ERR", "AE"));
                                    let _ = socket.write_all(&nak).await;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!(peer = %peer, error = %e, "HL7 read error");
                        break;
                    }
                }
            }
        });
    }
}

/// Find the end of an MLLP frame (0x1C 0x0D).
fn find_mllp_end(data: &[u8]) -> Option<usize> {
    data.windows(2).position(|w| w[0] == 0x1C && w[1] == 0x0D)
}

/// Process a single HL7 MLLP frame.
async fn process_hl7_message(
    frame: &[u8],
    buffer: &MessageBuffer,
    client: &reqwest::Client,
    cfg: &BridgeConfig,
) -> Result<Vec<u8>> {
    let start = Instant::now();

    // Unwrap MLLP framing
    let raw_message =
        hl7::mllp_unwrap(frame).ok_or_else(|| anyhow::anyhow!("invalid MLLP framing"))?;

    // Parse HL7 segments
    let segments = hl7::parse_segments(&raw_message);
    let fields = hl7::flatten_fields(&segments);

    // Extract key identifiers
    let message_type = hl7::get_field(&segments, "MSH.9").unwrap_or_default();
    let message_id = hl7::get_field(&segments, "MSH.10").unwrap_or_default();
    let patient_id = hl7::get_field(&segments, "PID.3");
    let order_id = hl7::get_field(&segments, "OBR.3");

    info!(
        message_type = %message_type,
        message_id = %message_id,
        patient_id = ?patient_id,
        order_id = ?order_id,
        "HL7 message received"
    );

    // Build parsed payload
    let parsed = serde_json::json!({
        "message_type": message_type,
        "message_id": message_id,
        "fields": fields,
        "segments": segments.iter().map(|s| serde_json::json!({
            "segment_type": s.segment_type,
            "fields": s.fields,
        })).collect::<Vec<_>>(),
    });

    // Build mapped data (basic — routing rules on server side will refine)
    let mapped = serde_json::json!({
        "identifiers": {
            "patient_id": patient_id,
            "order_id": order_id,
            "sample_barcode": hl7::get_field(&segments, "OBR.3"),
        },
        "fields": fields,
    });

    let duration_ms = start.elapsed().as_millis() as i32;
    let device_id = cfg.device_instance_id.as_deref().unwrap_or("unknown");

    // Determine target module from message type
    let module = match message_type.as_str() {
        t if t.starts_with("ORU") => "lab",     // Observation result
        t if t.starts_with("ADT") => "generic", // Admit/discharge/transfer
        t if t.starts_with("ORM") => "lab",     // Order message
        _ => "generic",
    };

    // Try direct delivery, fall back to buffer
    match ingest::deliver(
        client,
        cfg,
        device_id,
        module,
        "hl7_v2",
        &parsed,
        &mapped,
        duration_ms,
    )
    .await
    {
        Ok(_) => {
            info!(message_id = %message_id, module = %module, "delivered to MedBrains");
        }
        Err(e) => {
            warn!(error = %e, "API delivery failed — buffering locally");
            buffer.enqueue(
                device_id,
                module,
                "hl7_v2",
                &parsed,
                &mapped,
                Some(duration_ms),
            )?;
        }
    }

    // Generate ACK
    let ack = hl7::generate_ack(&message_id, "AA");
    Ok(hl7::mllp_wrap(&ack))
}
