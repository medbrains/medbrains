//! The main machine's side: lets machines ask to join, carries admitted ones to the local front
//! end, and closes them the moment they stop being admitted.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex, PoisonError, RwLock};
use std::time::{Duration, Instant};

use anyhow::{Context, bail};
use iroh::Endpoint;
use iroh::endpoint::{Connection, Incoming};
use medbrains_core::peer_sync::PeerRosterDoc;
use medbrains_edge::iroh_transport::PeerGatekeeper;
use medbrains_edge::peer_admission::{Admission, RefusalReason, refusal_message};
use medbrains_edge::peer_roster::PeerRoster;
use tokio::net::UdpSocket;
use tokio::sync::{Semaphore, watch};
use uuid::Uuid;

use crate::hospital::{GivenUpReport, Hospital, Seen};
use crate::limits::AddressLimits;
use crate::time;
use crate::wire::{JOIN_ALPN, TIME_ALPN, TUNNEL_ALPN};

/// How often the agent asks the server who may be connected, which bounds how long a removed
/// machine keeps an open session. On loopback, so this costs next to nothing.
const SYNC_EVERY: Duration = Duration::from_secs(2);
/// How often a waiting machine hears about its request.
const STATUS_EVERY: Duration = Duration::from_secs(2);
/// A machine that opens a connection and says nothing is dropped after this.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
/// Connections one address may have between arriving and being admitted or filed, and how many it
/// may start a minute. Checked before any handshake work is spent on it.
const MAX_ARRIVING_PER_ADDRESS: u32 = 16;
const MAX_ARRIVALS_PER_MINUTE: u32 = 120;
/// Connections at that stage across every address, so a flood costs a bounded amount of memory. Past
/// this they are refused at the door, and machines already connected are not touched.
const MAX_ARRIVING: usize = 128;
/// Join conversations one address may hold at once. A real machine holds one.
const MAX_JOINING_PER_ADDRESS: u32 = 3;
/// Join conversations one address may start a minute. A person retrying stays well under this.
const MAX_JOINS_PER_MINUTE: u32 = 10;
/// How long a count of handshakes given up on stays against the limit below.
const GIVEN_UP_WINDOW: Duration = Duration::from_secs(600);
/// Handshakes given up on, from anywhere, before joining pauses. Someone guessing a code tests it
/// after seeing this machine's nonce and leaves quietly on a miss, so each of these is one guess.
/// With a request living ten minutes, this keeps a guesser near six in a hundred thousand, however
/// many addresses they have. The cost is that a guesser can pause joining, which Machines says.
const MAX_GIVEN_UP: u32 = 60;
/// How often a count of given-up handshakes is reported, so a flood can't flood the audit log.
const GIVEN_UP_REPORT_EVERY: Duration = Duration::from_secs(30);
/// Connections one machine may hold: its screen, its clock, and a few left over from a bad network.
const MAX_CONNECTIONS_PER_MACHINE: usize = 8;
/// Join handshakes at once across every address. Each lasts at most `HANDSHAKE_TIMEOUT`, and a
/// conversation gives its slot back once its request is filed, because the server bounds those.
const MAX_JOINING: usize = 64;
const MAX_LABEL: usize = 60;
/// A "who are you?" must be this long and the answer may not be longer, so nobody can use the
/// port to send a larger packet at somebody else.
pub(crate) const WHOAMI_SIZE: usize = 256;
const CLOSE_REFUSED: u32 = 1;
/// A fault, not a refusal: this machine cannot say who is admitted right now.
const CLOSE_UNKNOWN: u32 = 2;
const TOO_MANY_CONNECTIONS: &str = "this machine holds too many connections";
const JOINING_PAUSED: &str = "joining is paused on this main machine";
const UNKNOWN_MESSAGE: &str = "the main machine cannot check admissions right now";
/// How long the agent keeps trusting its roster with the server not answering. Past this it cannot
/// know who has been removed, so it closes every session and admits nobody until it hears again.
const MAX_SYNC_SILENCE: Duration = Duration::from_secs(30);
/// A key the roster does not know may ask for a fresh look this often, across all keys. Strangers
/// must not be able to turn connections into database work.
const STRANGER_SYNC_EVERY: Duration = Duration::from_secs(1);

/// Admission from the roster the server last issued. Before the first one, nobody is admitted.
#[derive(Debug, Default)]
pub(crate) struct RosterGate {
    roster: RwLock<Option<PeerRoster>>,
}

impl RosterGate {
    /// Takes in what the server issued, and returns the tenant it is for.
    fn replace(&self, doc: &PeerRosterDoc) -> Uuid {
        let peers = doc.peers.iter().map(|p| (p.node_id.clone(), p.binding.clone()));
        let roster = PeerRoster::new(doc.tenant_id, doc.issued_at, peers.collect());
        *self.roster.write().unwrap_or_else(PoisonError::into_inner) = Some(roster);
        doc.tenant_id
    }

    /// Forgets the roster, because it can no longer be believed. Admits nobody until the next one.
    fn clear(&self) {
        *self.roster.write().unwrap_or_else(PoisonError::into_inner) = None;
    }

    /// The tenant this machine serves. It comes from the server, never from a peer.
    fn tenant(&self) -> Option<Uuid> {
        let held = self.roster.read().unwrap_or_else(PoisonError::into_inner);
        held.as_ref().map(PeerRoster::tenant_id)
    }
}

impl PeerGatekeeper for RosterGate {
    fn admit(&self, node_id: &str, claimed_tenant: Uuid) -> Admission {
        let held = self.roster.read().unwrap_or_else(PoisonError::into_inner);
        held.as_ref().map_or(Admission::Refuse(RefusalReason::NotPaired), |roster| {
            roster.admit_peer(node_id, claimed_tenant, chrono::Utc::now().timestamp())
        })
    }
}

/// The answer about one key. Not knowing is not "no".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Verdict {
    Admit(Uuid),
    Refuse,
    Unknown,
}

/// Everything the main machine's agent holds.
pub(crate) struct Gateway {
    pub(crate) endpoint: Endpoint,
    pub(crate) hospital: Arc<dyn Hospital>,
    /// Handed to a machine when it is approved: the one certificate its screen will trust.
    pub(crate) certificate: String,
    /// The local front end a tunnel ends at.
    pub(crate) front: SocketAddr,
    gate: Arc<RosterGate>,
    changes: watch::Sender<()>,
    /// Every open connection per machine: its screen and its clock are separate ones.
    live: Mutex<HashMap<String, Vec<Connection>>>,
    name: RwLock<String>,
    joining: Semaphore,
    limits: Arc<AddressLimits>,
    /// Per address, from a connection's arrival until it is admitted or filed.
    arrivals: Arc<AddressLimits>,
    arriving: Arc<Semaphore>,
    given_up: Mutex<GivenUp>,
    /// One sync at a time, so an old answer can never land after a newer one and bring back a key
    /// the newer one removed.
    sync_lock: tokio::sync::Mutex<()>,
    /// When the server last answered a sync.
    last_sync: Mutex<Instant>,
    /// When a stranger last caused a sync. Holding this lock is the single flight.
    stranger_sync: tokio::sync::Mutex<Option<Instant>>,
    /// Streams each machine may hold, across all its connections.
    streams: Mutex<HashMap<String, Arc<Semaphore>>>,
    max_silence: Duration,
}

impl Gateway {
    /// A gateway that has not heard from the server yet, so it admits nobody.
    pub(crate) fn new(
        endpoint: Endpoint,
        hospital: Arc<dyn Hospital>,
        certificate: String,
        front: SocketAddr,
    ) -> Arc<Self> {
        Self::with_silence(endpoint, hospital, certificate, front, MAX_SYNC_SILENCE)
    }

    /// `new`, with the time it may go without hearing from the server spelled out.
    pub(crate) fn with_silence(
        endpoint: Endpoint,
        hospital: Arc<dyn Hospital>,
        certificate: String,
        front: SocketAddr,
        max_silence: Duration,
    ) -> Arc<Self> {
        Arc::new(Self {
            endpoint,
            hospital,
            certificate,
            front,
            gate: Arc::default(),
            changes: watch::Sender::new(()),
            live: Mutex::default(),
            name: RwLock::default(),
            joining: Semaphore::new(MAX_JOINING),
            limits: AddressLimits::new(MAX_JOINING_PER_ADDRESS, MAX_JOINS_PER_MINUTE),
            arrivals: AddressLimits::new(MAX_ARRIVING_PER_ADDRESS, MAX_ARRIVALS_PER_MINUTE),
            arriving: Arc::new(Semaphore::new(MAX_ARRIVING)),
            given_up: Mutex::new(GivenUp::new(Instant::now())),
            sync_lock: tokio::sync::Mutex::new(()),
            last_sync: Mutex::new(Instant::now()),
            stranger_sync: tokio::sync::Mutex::new(None),
            streams: Mutex::default(),
            max_silence,
        })
    }

    /// Reports who is connected and takes in who may be; any open session no longer admitted
    /// is then closed by its own watcher.
    async fn sync(&self) -> anyhow::Result<()> {
        let _one_at_a_time = self.sync_lock.lock().await;
        let connected = self.connected_now();
        let report = self.given_up_report();
        let synced = self.hospital.sync(&connected, report).await?;
        *self.last_sync.lock().unwrap_or_else(PoisonError::into_inner) = Instant::now();
        self.gate.replace(&synced.roster);
        self.streams
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .retain(|node_id, _| synced.roster.peers.iter().any(|peer| peer.node_id == *node_id));
        self.endpoint.set_user_data_for_address_lookup(synced.hospital.clone().try_into().ok());
        *self.name.write().unwrap_or_else(PoisonError::into_inner) = synced.hospital;
        self.changes.send_replace(());
        Ok(())
    }

    /// The machines with an open connection, forgetting those that have gone.
    fn connected_now(&self) -> Vec<Seen> {
        let mut live = self.live.lock().unwrap_or_else(PoisonError::into_inner);
        live.retain(|_, conns| {
            conns.retain(|conn| conn.close_reason().is_none());
            !conns.is_empty()
        });
        live.iter()
            .filter_map(|(node_id, conns)| {
                let key = conns.first()?.remote_id();
                Some(Seen {
                    node_id: node_id.clone(),
                    address: machine_source(key.as_bytes()).to_string(),
                })
            })
            .collect()
    }

    /// What the server should record about handshakes given up on, if anything is due.
    fn given_up_report(&self) -> GivenUpReport {
        let now = Instant::now();
        let mut given_up = self.given_up.lock().unwrap_or_else(PoisonError::into_inner);
        GivenUpReport { count: given_up.due(now), paused: given_up.paused(now) }
    }

    /// One round of keeping the roster current. A server silent for too long means a removal could
    /// be going unheard, so every session closes, as a fault and not as a refusal.
    async fn sync_round(&self) {
        let Err(error) = self.sync().await else {
            return;
        };
        tracing::warn!(%error, "could not sync machines with the server");
        let heard = *self.last_sync.lock().unwrap_or_else(PoisonError::into_inner);
        if heard.elapsed() < self.max_silence {
            return;
        }
        self.gate.clear();
        let live = self.live.lock().unwrap_or_else(PoisonError::into_inner);
        for conn in live.values().flatten() {
            conn.close(CLOSE_UNKNOWN.into(), UNKNOWN_MESSAGE.as_bytes());
        }
        drop(live);
        self.changes.send_replace(());
    }

    /// Keeps the roster current: a loop meant never to end, each round with its own time limits.
    pub(crate) async fn sync_forever(self: Arc<Self>) {
        loop {
            self.sync_round().await;
            tokio::time::sleep(SYNC_EVERY).await;
        }
    }

    /// One accepted connection, by what it asks to speak.
    async fn serve(self: &Arc<Self>, incoming: Incoming, arrival: Arrival) -> anyhow::Result<()> {
        let address = source_address(&incoming);
        let conn = tokio::time::timeout(HANDSHAKE_TIMEOUT, incoming)
            .await
            .context("silent")?
            .context("handshake")?;
        if conn.alpn() == JOIN_ALPN {
            self.serve_join(&conn, address, arrival).await
        } else if conn.alpn() == TUNNEL_ALPN || conn.alpn() == TIME_ALPN {
            self.serve_admitted(conn, arrival).await
        } else {
            bail!("an unknown protocol")
        }
    }

    /// What the roster says about a key.
    fn verdict(&self, node_id: &str) -> Verdict {
        let Some(tenant) = self.gate.tenant() else {
            return Verdict::Unknown;
        };
        match self.gate.admit(node_id, tenant) {
            Admission::Admit { tenant_id, .. } => Verdict::Admit(tenant_id),
            Admission::Refuse(reason) => {
                tracing::warn!(%node_id, ?reason, "tunnel refused");
                Verdict::Refuse
            }
        }
    }

    /// A fresh roster for a key the last one did not know, so a machine approved a second ago is not
    /// turned away. One at a time and once a second, however many keys ask: anyone on the LAN can
    /// complete a handshake, and QUIC puts many on one flow past the firewall's limit. Returns
    /// whether it could say: `false` means the server did not answer this look.
    async fn fresh_look(&self) -> bool {
        let Ok(mut last) = self.stranger_sync.try_lock() else {
            return true;
        };
        if last.is_some_and(|at| at.elapsed() < STRANGER_SYNC_EVERY) {
            return true;
        }
        *last = Some(Instant::now());
        self.sync().await.is_ok()
    }

    /// Whether this key may open a tunnel.
    async fn tunnel_admission(&self, node_id: &str) -> Verdict {
        let first = self.verdict(node_id);
        if matches!(first, Verdict::Admit(_)) {
            return first;
        }
        if self.fresh_look().await {
            self.verdict(node_id)
        } else {
            Verdict::Unknown
        }
    }

    /// Remembers an admitted connection, or `false` if this machine already holds its share.
    fn add_live(&self, node_id: &str, conn: &Connection) -> bool {
        let mut live = self.live.lock().unwrap_or_else(PoisonError::into_inner);
        let conns = live.entry(node_id.to_owned()).or_default();
        conns.retain(|held| held.close_reason().is_none());
        if conns.len() >= MAX_CONNECTIONS_PER_MACHINE {
            return false;
        }
        conns.push(conn.clone());
        true
    }

    /// Re-checks a connection each time the roster may have changed, and closes it the first time
    /// the answer is not yes, saying which: refused, or not able to tell.
    async fn close_when_not_admitted(self: Arc<Self>, conn: Connection, node_id: String) {
        let mut changes = self.changes.subscribe();
        while changes.changed().await.is_ok() {
            match self.verdict(&node_id) {
                Verdict::Admit(_) => {}
                Verdict::Refuse => {
                    conn.close(CLOSE_REFUSED.into(), refusal_message().as_bytes());
                    return;
                }
                Verdict::Unknown => {
                    conn.close(CLOSE_UNKNOWN.into(), UNKNOWN_MESSAGE.as_bytes());
                    return;
                }
            }
        }
    }

    /// Serves an admitted machine, its screen or its clock, until it is closed or refused.
    async fn serve_admitted(self: &Arc<Self>, conn: Connection, arrival: Arrival) -> anyhow::Result<()> {
        let node_id = conn.remote_id().to_string();
        match self.tunnel_admission(&node_id).await {
            Verdict::Admit(_) => {}
            Verdict::Refuse => {
                conn.close(CLOSE_REFUSED.into(), refusal_message().as_bytes());
                return Ok(());
            }
            Verdict::Unknown => {
                conn.close(CLOSE_UNKNOWN.into(), UNKNOWN_MESSAGE.as_bytes());
                return Ok(());
            }
        }
        // Admitted: its place at the door goes back, and its own limits apply from here.
        drop(arrival);
        if !self.add_live(&node_id, &conn) {
            conn.close(CLOSE_REFUSED.into(), TOO_MANY_CONNECTIONS.as_bytes());
            return Ok(());
        }
        let watcher = tokio::spawn(Arc::clone(self).close_when_not_admitted(conn.clone(), node_id));
        if conn.alpn() == TIME_ALPN {
            time::serve_main(&conn).await;
        } else {
            self.carry_screen(&conn, &self.machine_streams(&conn)).await;
        }
        watcher.abort();
        Ok(())
    }

    /// Answers "who are you?" with this machine's key and name. Unauthenticated on purpose: a
    /// liar here gets a key whose code does not match the real main machine's.
    pub(crate) async fn whoami_forever(self: Arc<Self>, socket: UdpSocket) {
        let mut buffer = [0_u8; WHOAMI_SIZE + 1];
        loop {
            let Ok((read, from)) = socket.recv_from(&mut buffer).await else {
                continue;
            };
            if read != WHOAMI_SIZE {
                continue;
            }
            let name = self.name.read().unwrap_or_else(PoisonError::into_inner).clone();
            let reply = whoami_reply(&self.endpoint.id().to_string(), &name);
            drop(socket.send_to(reply.as_bytes(), from).await);
        }
    }
}

/// Where a connection comes from. An address the transport cannot name shares one bucket, so it can
/// never be a way round the limits.
fn source_address(incoming: &Incoming) -> IpAddr {
    match incoming.remote_addr() {
        iroh::endpoint::IncomingAddr::Ip(address) => address.ip().to_canonical(),
        _ => IpAddr::V4(Ipv4Addr::UNSPECIFIED),
    }
}

/// The answer to "who are you?", shortening the name so it is never larger than the question.
pub(crate) fn whoami_reply(id: &str, name: &str) -> String {
    let mut name = name.to_owned();
    loop {
        let reply = serde_json::json!({ "id": id, "name": name }).to_string();
        if reply.len() <= WHOAMI_SIZE {
            return reply;
        }
        name.pop();
    }
}

/// A 32-byte value from hex.
pub(crate) fn decode_32(value: &str) -> anyhow::Result<[u8; 32]> {
    hex::decode(value)?.try_into().map_err(|_| anyhow::anyhow!("not 32 bytes"))
}

mod door;
mod front;
mod join;
#[cfg(test)]
mod attack_tests;
#[cfg(test)]
mod tests;

use door::{Arrival, GivenUp};
pub(crate) use front::machine_source;
