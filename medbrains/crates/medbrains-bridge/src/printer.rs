//! Print delivery (#221): take queued print jobs from MedBrains — already
//! rendered for their printer as PDF, ZPL or ESC/POS — write them to the
//! printer, and report each one printed or failed.
//!
//! A network printer is `host` or `host:port` (raw printing, port 9100, which
//! Zebra, receipt and most office printers accept); a printer on this
//! machine's USB is its device path, e.g. `/dev/usb/lp0`.

use anyhow::{Context, Result};
use base64::Engine;
use serde::Deserialize;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tracing::{info, warn};

use crate::config::BridgeConfig;
use crate::ingest::authed;

const RAW_PRINT_PORT: u16 = 9100;
const IO_TIMEOUT: Duration = Duration::from_secs(15);
/// Copies a job may ask for; the server caps at 10 too.
const MAX_COPIES: i32 = 10;

#[derive(Debug, Deserialize)]
pub struct Job {
    pub job_id: String,
    pub copies: i32,
    pub printer_name: String,
    pub connection_string: String,
    pub payload_base64: String,
}

/// `host:port` for a network printer, the raw-printing port when none is given.
fn address(connection: &str) -> String {
    let c = connection.trim();
    let has_port = c
        .rsplit_once(':')
        .is_some_and(|(_, p)| p.parse::<u16>().is_ok());
    if has_port {
        c.to_owned()
    } else {
        format!("{c}:{RAW_PRINT_PORT}")
    }
}

/// Write the bytes to the printer, once per copy.
pub async fn send(connection: &str, bytes: &[u8], copies: i32) -> Result<()> {
    let copies = copies.clamp(1, MAX_COPIES);
    if connection.starts_with('/') {
        let mut device = tokio::fs::OpenOptions::new()
            .write(true)
            .open(connection)
            .await
            .with_context(|| format!("cannot open {connection}"))?;
        for _ in 0..copies {
            device.write_all(bytes).await?;
        }
        device.flush().await?;
        return Ok(());
    }
    let addr = address(connection);
    let mut stream = tokio::time::timeout(IO_TIMEOUT, TcpStream::connect(&addr))
        .await
        .with_context(|| format!("{addr} did not answer"))?
        .with_context(|| format!("cannot reach {addr}"))?;
    for _ in 0..copies {
        tokio::time::timeout(IO_TIMEOUT, stream.write_all(bytes))
            .await
            .context("the printer stopped taking data")??;
    }
    stream.shutdown().await?;
    Ok(())
}

async fn report(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    job: &str,
    error: Option<String>,
) -> Result<()> {
    authed(
        client.post(format!(
            "{}/api/documents/print-jobs/{job}/result",
            cfg.api_base
        )),
        cfg,
    )
    .json(&serde_json::json!({ "error": error }))
    .send()
    .await?
    .error_for_status()?;
    Ok(())
}

/// One poll: claim, print, report. Returns how many printed.
pub async fn deliver_pending(client: &reqwest::Client, cfg: &BridgeConfig) -> Result<usize> {
    let jobs: Vec<Job> = authed(
        client.post(format!("{}/api/documents/print-jobs/claim", cfg.api_base)),
        cfg,
    )
    .json(&serde_json::json!({ "printer_ids": cfg.printer_ids }))
    .send()
    .await?
    .error_for_status()?
    .json()
    .await?;
    let mut printed = 0;
    for job in jobs {
        let outcome = match base64::engine::general_purpose::STANDARD.decode(&job.payload_base64) {
            Ok(bytes) => send(&job.connection_string, &bytes, job.copies).await,
            Err(e) => Err(anyhow::anyhow!("payload unreadable: {e}")),
        };
        let error = outcome
            .err()
            .map(|e| format!("{}: {e:#}", job.printer_name));
        if let Some(why) = &error {
            warn!(job = %job.job_id, why, "print failed");
        } else {
            printed += 1;
        }
        report(client, cfg, &job.job_id, error).await?;
    }
    Ok(printed)
}

pub async fn poll_loop(client: &reqwest::Client, cfg: &BridgeConfig, every: Duration) {
    loop {
        match deliver_pending(client, cfg).await {
            Ok(0) => {}
            Ok(n) => info!(jobs = n, "printed"),
            Err(e) => warn!(error = %e, "print poll failed — will retry"),
        }
        tokio::time::sleep(every).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;

    #[test]
    fn a_printer_without_a_port_gets_the_raw_printing_port() {
        assert_eq!(address("10.0.0.21"), "10.0.0.21:9100");
        assert_eq!(address(" zebra-ward3:6101 "), "zebra-ward3:6101");
    }

    #[tokio::test]
    async fn each_copy_reaches_the_printer() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let printer = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let mut got = Vec::new();
            s.read_to_end(&mut got).await.unwrap();
            got
        });
        send(&addr, b"^XA^XZ", 2).await.unwrap();
        assert_eq!(printer.await.unwrap(), b"^XA^XZ^XA^XZ");
    }

    #[tokio::test]
    async fn an_unreachable_printer_is_an_error_not_a_hang() {
        let closed = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = closed.local_addr().unwrap().to_string();
        drop(closed);
        assert!(send(&addr, b"x", 1).await.is_err());
    }
}
