//! r8r — a workflow automation engine.

use r8r_cli::config::Config;
use r8r_cli::logging::{self, LogFormat};
use r8r_cli::{build_state_reporting_key, scheduling, server};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    logging::install(LogFormat::from_env());
    let config = Config::from_env();
    let (state, key_source) = build_state_reporting_key(config.clone())?;

    // The scheduler owns its own clock: it wakes once a second and fires any
    // cron trigger whose time has come.
    // Says this worker is alive. Without it, another worker would presume it
    // dead within the minute and recover the runs it is in the middle of.
    tokio::spawn(state.worker.clone().beat(state.db.clone()));
    tokio::spawn(scheduling::run(state.clone()));

    let listener = tokio::net::TcpListener::bind(config.bind_address()).await?;
    let address = listener.local_addr()?;
    println!("r8r listening on http://{address}");
    println!("  editor   http://{address}/");
    println!("  webhooks http://{address}/webhook/<path>");
    println!(
        "  {} node types, {} credential types",
        state.registry.len(),
        state.credential_types.len()
    );
    println!("  database {}", config.database_path);
    println!("  key      {key_source}");

    axum::serve(listener, server::router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Stop accepting connections on Ctrl-C so in-flight executions can finish.
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    println!("\nshutting down");
}
