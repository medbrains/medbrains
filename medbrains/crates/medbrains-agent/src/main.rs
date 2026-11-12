//! `medbrains-agent`: a machine's identity on the hospital's network (OS-SETUP-AND-TRUST §4, §8).
//!
//! On a node it finds the main machine, asks to join, and gives the screen a loopback path there
//! over iroh. With `--main` it is the other end: it takes join requests to the server, and carries
//! admitted machines to the local front end. No public relay either way.

mod code;
mod control;
mod gateway;
mod hospital;
mod keys;
mod limits;
mod mdns;
mod node;
mod time;
mod wire;

use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;

use medbrains_edge::iroh_transport::build_lan_endpoint;
use tokio::net::UdpSocket;

use crate::gateway::Gateway;
use crate::hospital::Server;
use crate::node::Node;
use crate::wire::{IROH_PORT, JOIN_ALPN, TIME_ALPN, TUNNEL_ALPN, WHOAMI_PORT};

const STATE_DIR: &str = "/var/lib/medbrains-agent";
const KEY_FILE: &str = "machine.key";
/// Written at first boot on a main machine; the server holds the same value.
const SERVER_TOKEN_FILE: &str = "server-token";
/// The public certificate of the main machine's local front end.
const FRONT_CERTIFICATE_FILE: &str = "local-front.pem";
const CONTROL_SOCKET: &str = "/run/medbrains-agent/control.sock";
/// The local front end, on the main machine; and on a node, the same address, reached through
/// this agent. So the screen and its certificate check do not change between the two.
const FRONT: SocketAddr =
    SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), 8443);

/// Runs the main machine's side.
async fn run_main(state: &Path) -> anyhow::Result<()> {
    let secret = keys::load_or_create(&state.join(KEY_FILE))?;
    let token = tokio::fs::read_to_string(state.join(SERVER_TOKEN_FILE)).await?;
    let certificate = tokio::fs::read_to_string(state.join(FRONT_CERTIFICATE_FILE)).await?;
    let alpns = vec![JOIN_ALPN.to_vec(), TUNNEL_ALPN.to_vec(), TIME_ALPN.to_vec()];
    let endpoint = build_lan_endpoint(secret, alpns, Some(IROH_PORT)).await?;
    tokio::spawn(mdns::follow(endpoint.clone(), true, |_| {}));
    let hospital = Arc::new(Server::new(token.trim().to_owned())?);
    let gateway = Gateway::new(endpoint, hospital, certificate, FRONT);
    let socket = UdpSocket::bind(SocketAddr::from(([0, 0, 0, 0], WHOAMI_PORT))).await?;
    tokio::spawn(Arc::clone(&gateway).sync_forever());
    tokio::spawn(Arc::clone(&gateway).whoami_forever(socket));
    gateway.accept_forever().await;
    Ok(())
}

/// Runs a node's side.
async fn run_node(state: &Path) -> anyhow::Result<()> {
    let secret = keys::load_or_create(&state.join(KEY_FILE))?;
    let endpoint = build_lan_endpoint(secret, Vec::new(), None).await?;
    let clock = SocketAddr::new(FRONT.ip(), time::NODE_TIME_PORT);
    let node = Node::start(endpoint.clone(), state, FRONT, clock).await?;
    let listener = Arc::clone(&node);
    tokio::spawn(mdns::follow(endpoint, false, move |event| {
        listener.heard(event);
    }));
    control::serve_forever(node, Path::new(CONTROL_SOCKET)).await
}

/// Starts the agent, in the mode its unit asked for.
#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_ansi(false)
        .without_time()
        .init();
    let state = Path::new(STATE_DIR);
    if std::env::args().any(|argument| argument == "--main") {
        run_main(state).await
    } else {
        run_node(state).await
    }
}
