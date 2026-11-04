//! A node's side: finds main machines, asks to join, and once approved carries its screen to the
//! main machine over iroh. Opens nothing to the network: its endpoint has no protocols to answer,
//! and the screen's way in is loopback.

use std::collections::BTreeMap;
use std::net::{IpAddr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use anyhow::{Context, bail};
use iroh::endpoint::Connection;
use iroh::{Endpoint, EndpointAddr, EndpointId};
use iroh_mdns_address_lookup::{DiscoveryEvent, MdnsAddressLookup};
use n0_future::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::io::BufReader;
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::Semaphore;

use crate::code::{commitment, join_code, new_nonce};
use crate::gateway::{WHOAMI_SIZE, decode_32};
use crate::wire::{
    Hello, IROH_PORT, JOIN_ALPN, JoinState, Kind, NonceFrame, StatusFrame, TUNNEL_ALPN, WHOAMI_PORT,
    read_frame, write_frame,
};

/// Where the agent records what it joined. The setup service reads it to finish setup.
const JOINED_FILE: &str = "joined.json";
const DIAL_TIMEOUT: Duration = Duration::from_secs(10);
const WHOAMI_TRIES: usize = 3;
const WHOAMI_WAIT: Duration = Duration::from_secs(1);
/// How many main machines one list shows, however many a network claims to have.
const MAX_FOUND: usize = 32;
/// Connections from the screen at once. WebKit opens a handful.
const MAX_STREAMS: usize = 64;

/// A main machine on the network.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Found {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) addresses: Vec<SocketAddr>,
}

/// What this machine joined, kept across restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct Joined {
    pub(crate) main_id: String,
    pub(crate) addresses: Vec<SocketAddr>,
    pub(crate) kind: Kind,
    pub(crate) hospital: String,
    pub(crate) certificate: String,
}

/// How a join stands, as the screen shows it.
#[derive(Debug, Clone, Default, Serialize)]
pub(crate) struct Standing {
    /// `idle`, `connecting`, `unreachable`, or a [`JoinState`] in words.
    pub(crate) state: String,
    pub(crate) code: Option<String>,
}

/// Everything a node's agent holds.
pub(crate) struct Node {
    endpoint: Endpoint,
    state_dir: PathBuf,
    /// Where the screen connects.
    screen_port: SocketAddr,
    found: Mutex<BTreeMap<String, Found>>,
    standing: Mutex<Standing>,
    tunnel_open: AtomicBool,
}

impl Node {
    /// A node. If it has already joined, its tunnel opens straight away.
    pub(crate) async fn start(
        endpoint: Endpoint,
        state_dir: &Path,
        screen_port: SocketAddr,
    ) -> anyhow::Result<Arc<Self>> {
        let node = Arc::new(Self {
            endpoint,
            state_dir: state_dir.to_owned(),
            screen_port,
            found: Mutex::default(),
            standing: Mutex::new(Standing { state: "idle".to_owned(), code: None }),
            tunnel_open: AtomicBool::new(false),
        });
        if let Some(joined) = node.joined() {
            node.open_tunnel(joined).await?;
        }
        Ok(node)
    }

    /// What this machine joined, if anything.
    pub(crate) fn joined(&self) -> Option<Joined> {
        let raw = std::fs::read(self.state_dir.join(JOINED_FILE)).ok()?;
        serde_json::from_slice(&raw).ok()
    }

    /// The main machines seen so far.
    pub(crate) fn found(&self) -> Vec<Found> {
        self.found.lock().unwrap_or_else(PoisonError::into_inner).values().cloned().collect()
    }

    /// Adds to the list, bounded so a noisy network cannot grow it for ever.
    fn remember(&self, found: Found) {
        let mut list = self.found.lock().unwrap_or_else(PoisonError::into_inner);
        if list.len() < MAX_FOUND || list.contains_key(&found.id) {
            list.insert(found.id.clone(), found);
        }
    }

    /// Puts a main machine on the list directly, as discovery would.
    #[cfg(test)]
    pub(crate) fn test_remember(&self, id: String, name: &str, addresses: Vec<SocketAddr>) {
        self.remember(Found { id, name: name.to_owned(), addresses });
    }

    /// Dials the tunnel with this node's own key, ignoring whether it has joined.
    #[cfg(test)]
    pub(crate) async fn test_dial_tunnel(&self, addr: EndpointAddr) -> anyhow::Result<Connection> {
        Ok(self.endpoint.connect(addr, TUNNEL_ALPN).await?)
    }

    /// Keeps the list current from mDNS.
    pub(crate) async fn watch_network(self: Arc<Self>, mdns: MdnsAddressLookup) {
        let mut events = mdns.subscribe().await;
        while let Some(event) = events.next().await {
            match event {
                DiscoveryEvent::Discovered { endpoint_info, .. } => {
                    let name = endpoint_info.data.user_data().map(ToString::to_string);
                    self.remember(Found {
                        id: endpoint_info.endpoint_id.to_string(),
                        name: name.unwrap_or_else(|| "Main machine".to_owned()),
                        addresses: endpoint_info.data.ip_addrs().copied().collect(),
                    });
                }
                DiscoveryEvent::Expired { endpoint_id } => {
                    let mut list = self.found.lock().unwrap_or_else(PoisonError::into_inner);
                    list.remove(&endpoint_id.to_string());
                }
                _ => {}
            }
        }
    }

    /// Asks a typed address who it is, and adds the answer to the list. Unauthenticated: a liar
    /// is caught when the codes do not match.
    pub(crate) async fn find_address(&self, address: IpAddr) -> anyhow::Result<Found> {
        self.find_at(address, WHOAMI_PORT, IROH_PORT).await
    }

    /// `find_address`, with the ports spelled out.
    pub(crate) async fn find_at(&self, address: IpAddr, whoami: u16, iroh: u16) -> anyhow::Result<Found> {
        let any: SocketAddr = if address.is_ipv4() { ([0, 0, 0, 0], 0).into() } else { ([0_u16; 8], 0).into() };
        let socket = UdpSocket::bind(any).await?;
        socket.connect((address, whoami)).await?;
        let mut buffer = [0_u8; WHOAMI_SIZE];
        for _ in 0..WHOAMI_TRIES {
            socket.send(&[0_u8; WHOAMI_SIZE]).await?;
            if let Ok(Ok(read)) = tokio::time::timeout(WHOAMI_WAIT, socket.recv(&mut buffer)).await {
                let answer: serde_json::Value = serde_json::from_slice(&buffer[..read])?;
                let id = answer["id"].as_str().context("no key in the answer")?;
                id.parse::<EndpointId>().context("not a key")?;
                let found = Found {
                    id: id.to_owned(),
                    name: answer["name"].as_str().unwrap_or("Main machine").to_owned(),
                    addresses: vec![(address, iroh).into()],
                };
                self.remember(found.clone());
                return Ok(found);
            }
        }
        bail!("nothing answered at {address}")
    }

    /// How the join stands.
    pub(crate) fn standing(&self) -> Standing {
        self.standing.lock().unwrap_or_else(PoisonError::into_inner).clone()
    }

    /// Records how the join stands.
    fn set_standing(&self, state: &str, code: Option<String>) {
        *self.standing.lock().unwrap_or_else(PoisonError::into_inner) =
            Standing { state: state.to_owned(), code };
    }

    /// Starts asking to join a main machine on the list. The answer arrives through `standing`.
    pub(crate) fn start_join(self: &Arc<Self>, main_id: &str, name: String, kind: Kind) -> anyhow::Result<()> {
        if self.joined().is_some() {
            bail!("This machine has already joined.");
        }
        let target = self.found.lock().unwrap_or_else(PoisonError::into_inner).get(main_id).cloned();
        let target = target.context("That main machine is not on the list.")?;
        self.set_standing("connecting", None);
        let this = Arc::clone(self);
        tokio::spawn(async move {
            if let Err(error) = this.join(&target, name, kind).await {
                tracing::warn!(%error, "join failed");
                this.set_standing("unreachable", None);
            }
        });
        Ok(())
    }

    /// The whole conversation: commit, exchange nonces, show the code, wait for the decision.
    async fn join(self: &Arc<Self>, target: &Found, name: String, kind: Kind) -> anyhow::Result<()> {
        let main_id: EndpointId = target.id.parse()?;
        let conn = self.dial(main_id, &target.addresses, JOIN_ALPN).await?;
        let (mut send, recv) = conn.open_bi().await?;
        let mut reader = BufReader::new(recv);
        let node_nonce = new_nonce()?;
        let commitment = hex::encode(commitment(&node_nonce));
        write_frame(&mut send, &Hello { name, kind, commitment }).await?;
        let theirs: NonceFrame = read_frame(&mut reader).await?;
        let main_nonce = decode_32(&theirs.nonce)?;
        write_frame(&mut send, &NonceFrame { nonce: hex::encode(node_nonce) }).await?;
        let code = join_code(main_id.as_bytes(), self.endpoint.id().as_bytes(), &main_nonce, &node_nonce);
        self.set_standing("connecting", Some(code.clone()));
        loop {
            let status: StatusFrame = read_frame(&mut reader).await?;
            match status.state {
                JoinState::Pending => self.set_standing("pending", Some(code.clone())),
                JoinState::Approved => {
                    let joined = Joined {
                        main_id: target.id.clone(),
                        addresses: target.addresses.clone(),
                        kind,
                        hospital: status.hospital.unwrap_or_default(),
                        certificate: status.certificate.context("approved with no certificate")?,
                    };
                    self.write_joined(&joined)?;
                    self.open_tunnel(joined).await?;
                    self.set_standing("approved", Some(code));
                    return Ok(());
                }
                refused => {
                    self.set_standing(&format!("{refused:?}").to_lowercase(), Some(code));
                    return Ok(());
                }
            }
        }
    }

    /// Writes what this machine joined in one step, so a power cut leaves all of it or none.
    fn write_joined(&self, joined: &Joined) -> anyhow::Result<()> {
        let path = self.state_dir.join(JOINED_FILE);
        let temporary = path.with_extension("new");
        std::fs::write(&temporary, serde_json::to_vec(joined)?)?;
        std::fs::rename(&temporary, &path)?;
        Ok(())
    }

    /// Connects to the main machine by its key; nothing else can answer.
    async fn dial(&self, id: EndpointId, addresses: &[SocketAddr], alpn: &[u8]) -> anyhow::Result<Connection> {
        let mut addr = EndpointAddr::new(id);
        for address in addresses {
            addr = addr.with_ip_addr(*address);
        }
        let dialled = tokio::time::timeout(DIAL_TIMEOUT, self.endpoint.connect(addr, alpn));
        Ok(dialled.await.context("timed out")??)
    }

    /// Opens the screen's loopback path to the main machine. Only ever once.
    async fn open_tunnel(self: &Arc<Self>, joined: Joined) -> anyhow::Result<()> {
        if self.tunnel_open.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let listener = TcpListener::bind(self.screen_port).await.context("the screen's port")?;
        let this = Arc::clone(self);
        tokio::spawn(async move { this.carry_forever(listener, joined).await });
        Ok(())
    }

    /// Carries each connection from the screen over one iroh connection, which is dialled again
    /// when it has dropped. Knows nothing about what it carries: TLS ends at the main machine.
    async fn carry_forever(self: Arc<Self>, listener: TcpListener, joined: Joined) {
        let conn: Arc<tokio::sync::Mutex<Option<Connection>>> = Arc::default();
        let limit = Arc::new(Semaphore::new(MAX_STREAMS));
        loop {
            let Ok((screen, _)) = listener.accept().await else {
                continue;
            };
            let Ok(permit) = Arc::clone(&limit).try_acquire_owned() else {
                continue;
            };
            let (this, conn, joined) = (Arc::clone(&self), Arc::clone(&conn), joined.clone());
            tokio::spawn(async move {
                let _permit = permit;
                if let Err(error) = this.carry(screen, &conn, &joined).await {
                    tracing::warn!(%error, "could not reach the main machine");
                }
            });
        }
    }

    /// One connection from the screen.
    async fn carry(
        &self,
        mut screen: TcpStream,
        conn: &tokio::sync::Mutex<Option<Connection>>,
        joined: &Joined,
    ) -> anyhow::Result<()> {
        let tunnel = {
            let mut held = conn.lock().await;
            match held.as_ref().filter(|c| c.close_reason().is_none()) {
                Some(open) => open.clone(),
                None => {
                    let id = joined.main_id.parse()?;
                    let dialled = self.dial(id, &joined.addresses, TUNNEL_ALPN).await?;
                    *held = Some(dialled.clone());
                    dialled
                }
            }
        };
        let (mut send, mut recv) = tunnel.open_bi().await?;
        let mut stream = tokio::io::join(&mut recv, &mut send);
        tokio::io::copy_bidirectional(&mut stream, &mut screen).await?;
        Ok(())
    }
}
