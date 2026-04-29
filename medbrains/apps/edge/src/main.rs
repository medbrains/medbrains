//! medbrains-edge appliance — opens a WSS sync server, registers
//! itself via mDNS, and exposes a Loro-CRDT-backed doc store for
//! every device on the hospital LAN.
//!
//! Usage:
//!   medbrains-edge --config /etc/medbrains-edge/config.toml

use anyhow::{Context, Result};
use clap::Parser;
use futures::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use medbrains_edge::{DocStore, MerkleAudit, SyncServer};
use medbrains_edge::sync::Frame;
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Parser, Debug)]
#[command(name = "medbrains-edge", about = "MedBrains LAN Sync Edge Appliance")]
struct Cli {
    #[arg(short, long, default_value = "/etc/medbrains-edge/config.toml")]
    config: PathBuf,
}

#[derive(Debug, Deserialize)]
struct Config {
    /// e.g. "0.0.0.0:7811"
    listen: String,
    /// Hostname to advertise via mDNS (must end with `.local.`)
    mdns_hostname: String,
    /// Friendly service name shown in tools like `dns-sd -B`
    service_name: String,
    docs_path: PathBuf,
    chain_path: PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_edge=info,medbrains_edge_app=info".into()),
        )
        .init();

    let cli = Cli::parse();
    let cfg_bytes = std::fs::read_to_string(&cli.config)
        .with_context(|| format!("read {:?}", cli.config))?;
    let cfg: Config = toml::from_str(&cfg_bytes)?;

    let docs = DocStore::new(cfg.docs_path);
    let audit = MerkleAudit::new(cfg.chain_path);
    let server = Arc::new(SyncServer::new(docs, audit));

    let listen: SocketAddr = cfg.listen.parse()?;
    let listener = TcpListener::bind(listen).await?;
    info!(%listen, "WSS sync server listening");

    // mDNS — let devices on the LAN find us by service type
    // `_medbrains-sync._tcp.local.`
    let mdns = ServiceDaemon::new()?;
    let port = listen.port();
    let info = ServiceInfo::new(
        "_medbrains-sync._tcp.local.",
        &cfg.service_name,
        &cfg.mdns_hostname,
        "",
        port,
        None,
    )?;
    mdns.register(info).context("mDNS register")?;
    info!(service = %cfg.service_name, hostname = %cfg.mdns_hostname, port, "mDNS service announced");

    loop {
        let (stream, peer) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => {
                error!(error = %e, "accept failed");
                continue;
            }
        };
        let server = Arc::clone(&server);
        tokio::spawn(async move {
            if let Err(e) = handle_conn(server, stream, peer).await {
                warn!(%peer, error = %e, "client disconnected with error");
            }
        });
    }
}

async fn handle_conn(
    server: Arc<SyncServer>,
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
) -> Result<()> {
    let ws = accept_async(stream).await.context("ws handshake")?;
    info!(%peer, "client connected");
    let (mut tx, mut rx) = ws.split();

    let mut session_tenant: Option<Uuid> = None;

    while let Some(msg) = rx.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                warn!(%peer, error = %e, "ws read error");
                break;
            }
        };
        let text = match msg {
            Message::Text(t) => t,
            Message::Binary(_) => {
                warn!(%peer, "binary frames not supported in this protocol");
                continue;
            }
            Message::Close(_) => break,
            _ => continue,
        };

        let frame: Frame = match serde_json::from_str(&text) {
            Ok(f) => f,
            Err(e) => {
                let err = Frame::Error {
                    message: format!("frame parse: {e}"),
                };
                send_frame(&mut tx, &err).await?;
                continue;
            }
        };

        let response: Frame = match (frame, session_tenant) {
            (Frame::Hello { protocol, tenant_id, .. }, _) => {
                if protocol != medbrains_edge::PROTOCOL_VERSION {
                    Frame::Error {
                        message: format!(
                            "protocol mismatch: server={}, client={}",
                            medbrains_edge::PROTOCOL_VERSION,
                            protocol
                        ),
                    }
                } else {
                    session_tenant = Some(tenant_id);
                    Frame::Ack {
                        doc_id: String::new(),
                        chain_tip: String::new(),
                    }
                }
            }
            (Frame::Push { doc_id, update_b64 }, Some(t)) => {
                match server.handle_push(t, &doc_id, &update_b64).await {
                    Ok(f) => f,
                    Err(e) => Frame::Error {
                        message: format!("push: {e}"),
                    },
                }
            }
            (Frame::PullSince { doc_id, vv_b64 }, Some(t)) => {
                match server.handle_pull(t, &doc_id, &vv_b64).await {
                    Ok(f) => f,
                    Err(e) => Frame::Error {
                        message: format!("pull: {e}"),
                    },
                }
            }
            (_, None) => Frame::Error {
                message: "send Hello first".to_owned(),
            },
            (other, _) => Frame::Error {
                message: format!("unexpected frame: {other:?}"),
            },
        };
        send_frame(&mut tx, &response).await?;
    }
    info!(%peer, "client disconnected");
    Ok(())
}

async fn send_frame<S>(tx: &mut S, frame: &Frame) -> Result<()>
where
    S: SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let s = serde_json::to_string(frame)?;
    tx.send(Message::Text(s.into()))
        .await
        .context("ws write")?;
    Ok(())
}
