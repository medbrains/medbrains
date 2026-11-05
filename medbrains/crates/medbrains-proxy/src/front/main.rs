//! The MedBrains OS front: the only thing on the machine a stranger on the LAN can reach without
//! signing in. TLS, the HTTP redirect, limits, the error page, and a reverse proxy to the server,
//! built on Pingora. Class A code under `docs/OS-PRINCIPLES.md` section 7.
//!
//!     medbrains-front --config /usr/lib/medbrains/front.toml
//!
//! Certificates come from `/usr/lib/medbrains/front-certs`, which runs as root before this starts.
//! This process runs as its own user, holds only leaf keys, and can bind low ports and nothing more.
#![forbid(unsafe_code)]
#![deny(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::todo,
    clippy::unimplemented,
    clippy::dbg_macro,
    clippy::print_stdout,
    clippy::print_stderr,
    clippy::wildcard_imports
)]

mod config;
mod head;
mod limits;
mod listen;
mod names;
mod site;
mod systemd;
#[cfg(test)]
mod test_rng;
mod tls;

use anyhow::Context;
use config::{Config, ListenerConfig};
use limits::ConnectionGate;
use listen::{Listener, accept_loop, bind};
use names::Names;
use pingora_core::apps::HttpServerApp;
use pingora_core::server::configuration::ServerConf;
use pingora_proxy::http_proxy;
use site::{Redirect, Site};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::signal::unix::{SignalKind, signal};
use tokio::sync::watch;
use tokio::task::JoinSet;

/// Two workers: this is a proxy on a small machine, and it waits on the network, not on the CPU.
const WORKERS: usize = 2;
/// Back-end connections kept for reuse.
const UPSTREAM_POOL: usize = 64;
/// How long a stop waits for requests in progress. Under systemd's own `TimeoutStopSec`.
const DRAIN: Duration = Duration::from_secs(5);
const DRAIN_POLL: Duration = Duration::from_millis(100);

/// The path after `--config`.
fn config_path() -> anyhow::Result<PathBuf> {
    let mut args = std::env::args_os().skip(1);
    match (args.next(), args.next(), args.next()) {
        (Some(flag), Some(path), None) if flag == "--config" => Ok(path.into()),
        _ => anyhow::bail!("usage: medbrains-front --config <file>"),
    }
}

/// Binds one configured port with its certificate. Any failure stops the service: it must never
/// come up without the TLS its configuration asks for.
fn open_listener(config: &ListenerConfig) -> anyhow::Result<Listener> {
    let tls = match (&config.cert, &config.key) {
        (Some(cert), Some(key)) => Some(tls::acceptor(cert, key)?),
        _ => None,
    };
    Ok(Listener {
        socket: bind(config.addr).with_context(|| format!("cannot bind {}", config.addr))?,
        tls,
        gate: ConnectionGate::new(config.max_connections, config.max_per_address),
    })
}

/// The running service's tasks and the gates of its ports.
struct Ports {
    tasks: JoinSet<()>,
    gates: Vec<Arc<ConnectionGate>>,
    shutdown: watch::Receiver<bool>,
}

impl Ports {
    /// Starts accepting on every port in `configs`, all served by `app`.
    fn open<A>(&mut self, configs: &[ListenerConfig], app: &Arc<A>) -> anyhow::Result<()>
    where
        A: HttpServerApp + Send + Sync + 'static,
    {
        for config in configs {
            let listener = open_listener(config)?;
            self.gates.push(Arc::clone(&listener.gate));
            let accepting = accept_loop(listener, Arc::clone(app), self.shutdown.clone());
            self.tasks.spawn(accepting);
        }
        Ok(())
    }

    /// Waits for open requests to finish after a stop, up to the limit.
    async fn drain(&self) {
        let started = Instant::now();
        while started.elapsed() < DRAIN && self.gates.iter().any(|gate| gate.open() > 0) {
            tokio::time::sleep(DRAIN_POLL).await;
        }
    }
}

/// Runs until systemd asks it to stop.
async fn serve(config: Config) -> anyhow::Result<()> {
    let text = std::fs::read_to_string(&config.names_file)
        .with_context(|| format!("cannot read {}", config.names_file.display()))?;
    let names = Names::parse(&text).context("the names file holds no valid name")?;
    let conf = Arc::new(ServerConf {
        upstream_keepalive_pool_size: UPSTREAM_POOL,
        ..ServerConf::default()
    });
    let (stop, shutdown) = watch::channel(false);
    let mut ports = Ports {
        tasks: JoinSet::new(),
        gates: Vec::new(),
        shutdown: shutdown.clone(),
    };
    let redirect = Redirect {
        names: names.clone(),
    };
    ports.open(
        &config.redirect_listen,
        &Arc::new(http_proxy(&conf, redirect)),
    )?;
    for site_config in &config.sites {
        let site = Site::new(site_config, names.clone())?;
        ports.open(&site_config.listen, &Arc::new(http_proxy(&conf, site)))?;
    }
    ports
        .tasks
        .spawn(systemd::watchdog_loop(ports.gates.clone(), shutdown));
    systemd::notify("READY=1");
    tracing::info!(ports = ports.gates.len(), "the front is listening");
    let mut terminate = signal(SignalKind::terminate())?;
    let mut interrupt = signal(SignalKind::interrupt())?;
    tokio::select! {
        _ = terminate.recv() => {}
        _ = interrupt.recv() => {}
        finished = ports.tasks.join_next() => anyhow::bail!("a listener stopped: {finished:?}"),
    }
    systemd::notify("STOPPING=1");
    stop.send_replace(true);
    ports.drain().await;
    Ok(())
}

/// Sets up logging and the runtime, then serves.
fn main() -> anyhow::Result<()> {
    // Pingora's own logs can quote a request, and a path or query can hold a patient's identifiers,
    // so its logs stay off. Nothing logged here carries either.
    let filter = tracing_subscriber::EnvFilter::new("medbrains_front=info,pingora=off");
    tracing_subscriber::fmt().with_env_filter(filter).init();
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow::anyhow!("the TLS provider was already set"))?;
    let config = Config::load(&config_path()?)?;
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(WORKERS)
        .enable_all()
        .build()?;
    let result = runtime.block_on(serve(config));
    if let Err(error) = &result {
        tracing::error!("{error:#}");
    }
    // Connections still open after the drain must not hold the process.
    runtime.shutdown_timeout(Duration::ZERO);
    result
}
