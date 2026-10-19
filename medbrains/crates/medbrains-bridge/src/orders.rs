//! Orders out to an HL7 analyzer (#227).
//!
//! Every few seconds the bridge asks MedBrains for its analyzer's worklist —
//! samples collected and not yet delivered — sends each as an ORM^O01 over
//! MLLP to the analyzer's address, and reports what the analyzer
//! acknowledged. An unreachable analyzer reports nothing, so the orders are
//! simply offered again next time; a refusal is recorded against the order.

use anyhow::{Context, Result};
use medbrains_adapter_sdk::hl7;
use serde::Deserialize;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{info, warn};

use crate::config::BridgeConfig;
use crate::ingest::authed;

const IO_TIMEOUT: Duration = Duration::from_secs(10);
/// An ACK is a few hundred bytes.
const MAX_ACK: usize = 16 * 1024;

#[derive(Debug, Deserialize)]
pub struct Analyzer {
    pub name: String,
    pub host: Option<String>,
    pub port: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct Order {
    pub order_id: String,
    pub sample_barcode: String,
    pub sample_type: Option<String>,
    pub is_stat: bool,
    pub collected_at: chrono::DateTime<chrono::Utc>,
    pub test_code: String,
    pub test_name: String,
    pub uhid: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Worklist {
    analyzer: Analyzer,
    orders: Vec<Order>,
}

/// HL7 escapes for text placed inside a field.
fn esc(value: &str) -> String {
    value
        .replace('\\', "\\E\\")
        .replace('|', "\\F\\")
        .replace('^', "\\S\\")
        .replace('~', "\\R\\")
        .replace('&', "\\T\\")
}

/// The ORM^O01 for one order, under message control id `control_id`.
pub fn build_orm(order: &Order, analyzer: &str, control_id: &str, now: &str) -> String {
    let sex = match order.gender.as_deref() {
        Some("male") => "M",
        Some("female") => "F",
        Some("other") => "O",
        _ => "U",
    };
    let dob = order
        .date_of_birth
        .map(|d| d.format("%Y%m%d").to_string())
        .unwrap_or_default();
    let name = format!(
        "{}^{}",
        esc(order.last_name.as_deref().unwrap_or_default()),
        esc(&order.first_name)
    );
    let (placer, barcode) = (esc(&order.order_id), esc(&order.sample_barcode));
    let mut obr = vec![String::new(); 16];
    obr[0] = "OBR".into();
    obr[1] = "1".into();
    obr[2] = placer.clone();
    obr[3] = barcode.clone();
    obr[4] = format!("{}^{}", esc(&order.test_code), esc(&order.test_name));
    obr[5] = if order.is_stat { "S" } else { "R" }.into();
    obr[7] = order.collected_at.format("%Y%m%d%H%M%S").to_string();
    obr[15] = esc(order.sample_type.as_deref().unwrap_or_default());
    let analyzer = esc(analyzer);
    format!(
        "MSH|^~\\&|MEDBRAINS|LAB|{analyzer}|{analyzer}|{now}||ORM^O01|{control_id}|P|2.3.1\r\
         PID|1||{uhid}||{name}||{dob}|{sex}\r\
         ORC|NW|{placer}|{barcode}\r\
         {obr}\r",
        uhid = esc(&order.uhid),
        obr = obr.join("|"),
    )
}

/// Whether the analyzer's reply accepts the message, and why not if it doesn't.
fn accepted(reply: &str) -> (bool, Option<String>) {
    let segments = hl7::parse_segments(reply);
    let code = hl7::get_field(&segments, "MSA.1").unwrap_or_default();
    if matches!(code.as_str(), "AA" | "CA") {
        (true, None)
    } else {
        let why = hl7::get_field(&segments, "MSA.3").filter(|t| !t.is_empty());
        (
            false,
            Some(why.unwrap_or_else(|| format!("analyzer answered {code:?}"))),
        )
    }
}

/// Send one framed message and read the analyzer's framed reply.
async fn exchange(stream: &mut TcpStream, message: &str) -> Result<String> {
    tokio::time::timeout(IO_TIMEOUT, stream.write_all(&hl7::mllp_wrap(message)))
        .await
        .context("send timed out")??;
    let mut reply = Vec::new();
    let mut read = [0u8; 1024];
    while !reply.windows(2).any(|w| w == [0x1C, 0x0D]) {
        let n = tokio::time::timeout(IO_TIMEOUT, stream.read(&mut read))
            .await
            .context("no ACK from analyzer")??;
        anyhow::ensure!(n > 0, "analyzer closed the connection");
        reply.extend_from_slice(&read[..n]);
        anyhow::ensure!(reply.len() <= MAX_ACK, "ACK too long");
    }
    hl7::mllp_unwrap(&reply).context("invalid MLLP reply")
}

/// One poll: fetch, send, report. Returns how many the analyzer accepted.
pub async fn send_pending(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    device_id: &str,
) -> Result<usize> {
    let base = format!(
        "{}/api/devices/instances/{device_id}/analyzer-orders",
        cfg.api_base
    );
    let list: Worklist = authed(client.get(&base), cfg)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if list.orders.is_empty() {
        return Ok(0);
    }
    let (Some(host), Some(port)) = (list.analyzer.host.as_deref(), list.analyzer.port) else {
        warn!(analyzer = %list.analyzer.name, "orders waiting but the analyzer has no host and port in MedBrains");
        return Ok(0);
    };
    let mut stream =
        tokio::time::timeout(IO_TIMEOUT, TcpStream::connect((host, u16::try_from(port)?)))
            .await
            .context("analyzer connect timed out")??;
    let now = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let mut sent = Vec::new();
    for order in &list.orders {
        let control_id = uuid::Uuid::new_v4().simple().to_string()[..20].to_owned();
        let message = build_orm(order, &list.analyzer.name, &control_id, &now);
        let (delivered, error) = match exchange(&mut stream, &message).await {
            Ok(reply) => accepted(&reply),
            // The link broke mid-batch: stop, and let the rest come again.
            Err(e) => {
                warn!(error = %e, "analyzer link failed");
                break;
            }
        };
        sent.push(serde_json::json!({
            "order_id": order.order_id, "control_id": control_id,
            "delivered": delivered, "error": error,
        }));
    }
    let accepted_count = sent.iter().filter(|s| s["delivered"] == true).count();
    if !sent.is_empty() {
        authed(client.post(format!("{base}/sent")), cfg)
            .json(&serde_json::json!({ "sent": sent }))
            .send()
            .await?
            .error_for_status()?;
    }
    Ok(accepted_count)
}

pub async fn poll_loop(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    device_id: &str,
    every: Duration,
) {
    loop {
        match send_pending(client, cfg, device_id).await {
            Ok(0) => {}
            Ok(n) => info!(orders = n, "orders loaded onto the analyzer"),
            Err(e) => warn!(error = %e, "order send failed — will retry"),
        }
        tokio::time::sleep(every).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn order() -> Order {
        Order {
            order_id: "6f1c".into(),
            sample_barcode: "SB240001".into(),
            sample_type: Some("EDTA blood".into()),
            is_stat: true,
            collected_at: chrono::DateTime::from_timestamp(1_792_230_000, 0).unwrap_or_default(),
            test_code: "CBC".into(),
            test_name: "Complete blood count".into(),
            uhid: "UH-1001".into(),
            first_name: "Lakshmi".into(),
            last_name: Some("Devi|Rao".into()),
            date_of_birth: chrono::NaiveDate::from_ymd_opt(1980, 3, 9),
            gender: Some("female".into()),
        }
    }

    #[test]
    fn the_orm_carries_patient_sample_and_test_where_analyzers_read_them() {
        let msg = build_orm(&order(), "XN-550", "C1", "20261017101500");
        let segs = hl7::parse_segments(&msg);
        let f = |p: &str| hl7::get_field(&segs, p).unwrap_or_default();
        assert_eq!(f("MSH.9"), "ORM^O01");
        assert_eq!(f("MSH.10"), "C1");
        assert_eq!(f("PID.3"), "UH-1001");
        assert_eq!(
            f("PID.5"),
            "Devi\\F\\Rao^Lakshmi",
            "a | in a name cannot split the field"
        );
        assert_eq!(f("PID.7"), "19800309");
        assert_eq!(f("PID.8"), "F");
        assert_eq!(f("ORC.1"), "NW");
        assert_eq!(
            f("OBR.3"),
            "SB240001",
            "the barcode, where results come back on"
        );
        assert_eq!(f("OBR.4"), "CBC^Complete blood count");
        assert_eq!(f("OBR.5"), "S");
        assert_eq!(f("OBR.15"), "EDTA blood");
    }

    #[test]
    fn only_aa_or_ca_counts_as_accepted() {
        assert_eq!(accepted("MSH|^~\\&|A|B\rMSA|AA|C1\r"), (true, None));
        assert_eq!(
            accepted("MSH|^~\\&|A|B\rMSA|AE|C1|Unknown test CBC\r"),
            (false, Some("Unknown test CBC".into()))
        );
    }

    #[tokio::test]
    async fn an_order_goes_over_mllp_and_the_ack_comes_back() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let analyzer = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let mut got = Vec::new();
            let mut buf = [0u8; 512];
            while !got.windows(2).any(|w| w == [0x1C, 0x0D]) {
                let n = s.read(&mut buf).await.unwrap();
                got.extend_from_slice(&buf[..n]);
            }
            s.write_all(&hl7::mllp_wrap("MSH|^~\\&|XN|LAB\rMSA|AA|C1\r"))
                .await
                .unwrap();
            hl7::mllp_unwrap(&got).unwrap()
        });
        let mut stream = TcpStream::connect(addr).await.unwrap();
        let reply = exchange(&mut stream, &build_orm(&order(), "XN", "C1", "20261017"))
            .await
            .unwrap();
        assert_eq!(accepted(&reply), (true, None));
        assert!(analyzer.await.unwrap().contains("OBR|1|6f1c|SB240001|CBC"));
    }
}
