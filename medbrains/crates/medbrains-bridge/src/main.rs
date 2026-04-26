mod buffer;
mod config;
mod heartbeat;
mod hl7_listener;
mod ingest;

use anyhow::Result;
use clap::Parser;
use tracing::info;

#[derive(Parser)]
#[command(name = "medbrains-bridge", about = "MedBrains Device Bridge Agent")]
struct Cli {
    /// Path to config file
    #[arg(short, long, default_value = "bridge.toml")]
    config: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_bridge=info".into()),
        )
        .init();

    let cli = Cli::parse();
    let cfg = config::BridgeConfig::load(&cli.config)?;

    info!(
        name = %cfg.agent_name,
        api_base = %cfg.api_base,
        "starting MedBrains bridge agent"
    );

    // Initialize SQLite buffer
    let db = buffer::MessageBuffer::open(&cfg.buffer_path)?;
    info!(path = %cfg.buffer_path, "message buffer ready");

    // Register with MedBrains API
    let client = reqwest::Client::new();
    let agent_id = heartbeat::register(&client, &cfg).await?;
    info!(%agent_id, "registered with MedBrains");

    // Start heartbeat loop
    let hb_client = client.clone();
    let hb_cfg = cfg.clone();
    let hb_agent_id = agent_id;
    tokio::spawn(async move {
        heartbeat::heartbeat_loop(&hb_client, &hb_cfg, hb_agent_id).await;
    });

    // Start HL7 MLLP listener (if configured)
    if let Some(ref hl7) = cfg.hl7_listen {
        let listener_db = db.clone();
        let listener_client = client.clone();
        let listener_cfg = cfg.clone();
        let addr = hl7.clone();
        info!(listen = %addr, "starting HL7 MLLP listener");
        tokio::spawn(async move {
            if let Err(e) =
                hl7_listener::listen(&addr, listener_db, &listener_client, &listener_cfg).await
            {
                tracing::error!(error = %e, "HL7 listener failed");
            }
        });
    }

    // Start buffer drain loop (retry failed deliveries)
    let drain_db = db.clone();
    let drain_client = client.clone();
    let drain_cfg = cfg.clone();
    tokio::spawn(async move {
        ingest::drain_loop(drain_db, &drain_client, &drain_cfg).await;
    });

    info!("bridge agent running — press Ctrl+C to stop");
    tokio::signal::ctrl_c().await?;
    info!("shutting down");

    Ok(())
}
