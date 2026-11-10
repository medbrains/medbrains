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

/// What the bridge sends MedBrains for one received message.
#[derive(Debug)]
struct Delivery {
    module: &'static str,
    parsed: serde_json::Value,
    mapped: serde_json::Value,
}

/// The message's control id (MSH-10) and one delivery per order group.
///
/// Results go one OBR group at a time, like ASTM samples, each carrying all
/// of its OBX in order. A result message with nothing parseable is still sent
/// (with no results) so the server holds it for review: nothing an analyser
/// sends is dropped here.
fn deliveries(raw: &str) -> Option<(String, Vec<Delivery>)> {
    let msg = hl7::parse(raw)?;
    let msh = msg.first("MSH")?;
    let message_type = msg.text(msh, 9);
    let control_id = msg.component(msh, 10, 1);
    let parsed = serde_json::json!({
        "message_type": message_type,
        "message_id": control_id,
        "raw": raw,
    });
    if !message_type.starts_with("ORU") {
        let mapped = serde_json::json!({ "message_type": message_type });
        return Some((
            control_id,
            vec![Delivery {
                module: "generic",
                parsed,
                mapped,
            }],
        ));
    }
    let mut groups = hl7::oru::observation_groups(&msg);
    if groups.is_empty() {
        groups.push(hl7::oru::ObservationGroup::default());
    }
    let out = groups
        .into_iter()
        .map(|g| Delivery {
            module: "lab",
            parsed: parsed.clone(),
            mapped: serde_json::json!({
                "identifiers": {
                    "patient_id": g.patient_id,
                    "sample_barcode": g.sample_barcode,
                    "placer_order": g.placer_order,
                },
                "service_code": g.service_code,
                "results": g.results,
            }),
        })
        .collect();
    Some((control_id, out))
}

/// Process a single HL7 MLLP frame.
async fn process_hl7_message(
    frame: &[u8],
    buffer: &MessageBuffer,
    client: &reqwest::Client,
    cfg: &BridgeConfig,
) -> Result<Vec<u8>> {
    let start = Instant::now();
    let raw_message =
        hl7::mllp_unwrap(frame).ok_or_else(|| anyhow::anyhow!("invalid MLLP framing"))?;
    let (message_id, items) =
        deliveries(&raw_message).ok_or_else(|| anyhow::anyhow!("not an HL7 v2 message"))?;
    info!(message_id = %message_id, groups = items.len(), "HL7 message received");

    let duration_ms = i32::try_from(start.elapsed().as_millis()).unwrap_or(i32::MAX);
    let device_id = cfg.device_instance_id.as_deref().unwrap_or("unknown");
    for d in items {
        // Try direct delivery, fall back to the local buffer.
        if let Err(e) = ingest::deliver(
            client,
            cfg,
            device_id,
            d.module,
            "hl7_v2",
            &d.parsed,
            &d.mapped,
            duration_ms,
        )
        .await
        {
            warn!(error = %e, "API delivery failed — buffering locally");
            buffer.enqueue(
                device_id,
                d.module,
                "hl7_v2",
                &d.parsed,
                &d.mapped,
                Some(duration_ms),
            )?;
        }
    }
    Ok(hl7::mllp_wrap(&hl7::generate_ack(&message_id, "AA")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::deliveries;

    #[test]
    fn a_cbc_is_delivered_with_every_result() {
        let raw = "MSH|^~\\&|XN|HAEM|MB|LAB|20261026||ORU^R01|C9|P|2.5\rPID|||UH-1\r\
                   OBR|1|ord-1|SB1^XN||CBC\rOBX|1|NM|WBC||12.4|10*3/uL|4-11|H|||F\r\
                   OBX|2|NM|HGB||13.1|g/dL|13-17|N|||F\rOBX|3|NM|PLT||250|10*3/uL|150-450||||F";
        let (id, items) = deliveries(raw).expect("hl7");
        assert_eq!(id, "C9");
        assert_eq!(items.len(), 1);
        let m = &items[0].mapped;
        assert_eq!(items[0].module, "lab");
        assert_eq!(m["identifiers"]["sample_barcode"], "SB1");
        assert_eq!(m["identifiers"]["placer_order"], "ord-1");
        assert_eq!(m["identifiers"]["patient_id"], "UH-1");
        let results = m["results"].as_array().expect("results");
        assert_eq!(results.len(), 3);
        assert_eq!(results[0]["abnormal_flag"], "H");
        assert_eq!(results[2]["test_code"], "PLT");
        assert_eq!(results[2]["status"], "F");
        assert_eq!(
            items[0].parsed["raw"], raw,
            "the raw message is kept for review"
        );
    }

    #[test]
    fn a_result_message_with_nothing_in_it_is_still_delivered_for_review() {
        let (_, items) = deliveries("MSH|^~\\&|XN||||||ORU^R01|C1").expect("hl7");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].module, "lab");
        assert_eq!(items[0].mapped["results"].as_array().map(Vec::len), Some(0));
        assert!(items[0].mapped["identifiers"]["sample_barcode"].is_null());
    }

    #[test]
    fn non_result_messages_are_not_sent_to_the_lab() {
        let (_, items) = deliveries("MSH|^~\\&|X||||||ADT^A01|C2\rPID|||U").expect("hl7");
        assert_eq!(items[0].module, "generic");
        let (_, items) = deliveries("MSH|^~\\&|X||||||ORM^O01|C3").expect("hl7");
        assert_eq!(items[0].module, "generic");
    }

    #[test]
    fn garbage_is_refused_so_the_sender_gets_a_nak() {
        assert!(deliveries("not hl7").is_none());
    }
}
