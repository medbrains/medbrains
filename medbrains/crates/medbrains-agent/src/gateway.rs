//! The main machine's side: lets machines ask to join, carries admitted ones to the local front
//! end, and closes them the moment they stop being admitted.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex, PoisonError, RwLock};
use std::time::Duration;

use anyhow::{Context, bail};
use iroh::Endpoint;
use iroh::endpoint::Connection;
use medbrains_core::peer_sync::PeerRosterDoc;
use medbrains_edge::iroh_transport::{PeerGatekeeper, close_when_refused};
use medbrains_edge::peer_admission::{Admission, RefusalReason, refusal_message};
use medbrains_edge::peer_roster::PeerRoster;
use tokio::io::BufReader;
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::{Semaphore, watch};
use uuid::Uuid;

use crate::code::{commitment, join_code, new_nonce};
use crate::hospital::{Filing, Hospital};
use crate::wire::{
    Hello, JOIN_ALPN, JoinState, NonceFrame, StatusFrame, TUNNEL_ALPN, read_frame, write_frame,
};

/// How often the agent asks the server who may be connected, which bounds how long a removed
/// machine keeps an open session. On loopback, so this costs next to nothing.
const SYNC_EVERY: Duration = Duration::from_secs(2);
/// How often a waiting machine hears about its request.
const STATUS_EVERY: Duration = Duration::from_secs(2);
/// A machine that opens a connection and says nothing is dropped after this.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
/// Join conversations at once, so a flood of keys cannot hold every task on the machine.
const MAX_JOINING: usize = 32;
/// Connections to the front end, per machine: a screen opens a handful.
const MAX_STREAMS: usize = 64;
const MAX_LABEL: usize = 60;
/// A "who are you?" must be this long and the answer may not be longer, so nobody can use the
/// port to send a larger packet at somebody else.
pub(crate) const WHOAMI_SIZE: usize = 256;
const CLOSE_REFUSED: u32 = 1;

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
    live: Mutex<HashMap<String, Connection>>,
    name: RwLock<String>,
    joining: Semaphore,
}

impl Gateway {
    /// A gateway that has not heard from the server yet, so it admits nobody.
    pub(crate) fn new(
        endpoint: Endpoint,
        hospital: Arc<dyn Hospital>,
        certificate: String,
        front: SocketAddr,
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
        })
    }

    /// Reports who is connected and takes in who may be; any open session no longer admitted
    /// is then closed by its own watcher.
    async fn sync(&self) -> anyhow::Result<()> {
        let connected: Vec<String> = {
            let mut live = self.live.lock().unwrap_or_else(PoisonError::into_inner);
            live.retain(|_, conn| conn.close_reason().is_none());
            live.keys().cloned().collect()
        };
        let synced = self.hospital.sync(&connected).await?;
        self.gate.replace(&synced.roster);
        self.endpoint.set_user_data_for_address_lookup(synced.hospital.clone().try_into().ok());
        *self.name.write().unwrap_or_else(PoisonError::into_inner) = synced.hospital;
        self.changes.send_replace(());
        Ok(())
    }

    /// Keeps the roster current for as long as the agent runs. If the server stops answering,
    /// the roster stays until it goes stale, and a stale roster admits nobody.
    pub(crate) async fn sync_forever(self: Arc<Self>) {
        loop {
            if let Err(error) = self.sync().await {
                tracing::warn!(%error, "could not sync machines with the server");
            }
            tokio::time::sleep(SYNC_EVERY).await;
        }
    }

    /// Accepts connections for as long as the agent runs.
    pub(crate) async fn accept_forever(self: Arc<Self>) {
        while let Some(incoming) = self.endpoint.accept().await {
            let this = Arc::clone(&self);
            tokio::spawn(async move {
                let result = async {
                    let conn = incoming.await.context("handshake")?;
                    if conn.alpn() == JOIN_ALPN {
                        this.serve_join(&conn).await
                    } else if conn.alpn() == TUNNEL_ALPN {
                        this.serve_tunnel(conn).await
                    } else {
                        bail!("an unknown protocol")
                    }
                };
                if let Err(error) = result.await {
                    tracing::info!(%error, "connection ended");
                }
            });
        }
    }

    /// One join conversation, from the node's commitment until its request is decided.
    async fn serve_join(&self, conn: &Connection) -> anyhow::Result<()> {
        let _slot = self.joining.try_acquire().context("too many machines joining")?;
        let (mut send, recv) =
            tokio::time::timeout(HANDSHAKE_TIMEOUT, conn.accept_bi()).await.context("silent")??;
        let mut reader = BufReader::new(recv);
        let hello: Hello =
            tokio::time::timeout(HANDSHAKE_TIMEOUT, read_frame(&mut reader)).await.context("silent")??;
        let label = clean_label(&hello.name).context("no usable name")?;
        let main_nonce = new_nonce()?;
        write_frame(&mut send, &NonceFrame { nonce: hex::encode(main_nonce) }).await?;
        let reveal: NonceFrame =
            tokio::time::timeout(HANDSHAKE_TIMEOUT, read_frame(&mut reader)).await.context("silent")??;
        let node_nonce = decode_32(&reveal.nonce)?;
        if hex::encode(commitment(&node_nonce)) != hello.commitment {
            bail!("the nonce does not match its commitment");
        }
        let node = conn.remote_id();
        let code = join_code(self.endpoint.id().as_bytes(), node.as_bytes(), &main_nonce, &node_nonce);
        let node_id = node.to_string();
        let filing = Filing { node_id: node_id.clone(), label, kind: hello.kind, code };
        let mut answer = self.hospital.file_join(&filing).await?;
        loop {
            write_frame(&mut send, &self.status(answer.state)).await?;
            if answer.state.is_final() {
                send.finish().context("finish")?;
                conn.closed().await;
                return Ok(());
            }
            tokio::time::sleep(STATUS_EVERY).await;
            answer = self.hospital.join_state(&node_id).await?;
        }
    }

    /// What a machine is told. The certificate goes only to an approved one.
    fn status(&self, state: JoinState) -> StatusFrame {
        let approved = state == JoinState::Approved;
        let name = self.name.read().unwrap_or_else(PoisonError::into_inner);
        StatusFrame {
            state,
            hospital: approved.then(|| name.clone()),
            certificate: approved.then(|| self.certificate.clone()),
        }
    }

    /// Whether this key may open a tunnel. A key the last roster did not know gets one fresh look,
    /// so a machine approved a second ago is not turned away.
    async fn tunnel_admission(&self, node_id: &str) -> Option<Uuid> {
        let admitted = |gate: &RosterGate| {
            let tenant = gate.tenant()?;
            match gate.admit(node_id, tenant) {
                Admission::Admit { tenant_id, .. } => Some(tenant_id),
                Admission::Refuse(reason) => {
                    tracing::warn!(%node_id, ?reason, "tunnel refused");
                    None
                }
            }
        };
        if let Some(tenant) = admitted(&self.gate) {
            return Some(tenant);
        }
        // ponytail: a loopback call per refused key; bound by the QUIC handshake it must finish first.
        drop(self.sync().await);
        admitted(&self.gate)
    }

    /// Carries an admitted machine's screen to the front end until it is closed or refused.
    async fn serve_tunnel(&self, conn: Connection) -> anyhow::Result<()> {
        let node_id = conn.remote_id().to_string();
        let Some(tenant) = self.tunnel_admission(&node_id).await else {
            conn.close(CLOSE_REFUSED.into(), refusal_message().as_bytes());
            return Ok(());
        };
        self.live
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(node_id.clone(), conn.clone());
        let gate: Arc<dyn PeerGatekeeper> = Arc::<RosterGate>::clone(&self.gate);
        let watcher = tokio::spawn(close_when_refused(
            gate,
            conn.clone(),
            node_id,
            tenant,
            self.changes.subscribe(),
        ));
        let limit = Arc::new(Semaphore::new(MAX_STREAMS));
        while let Ok((mut send, mut recv)) = conn.accept_bi().await {
            let Ok(permit) = Arc::clone(&limit).try_acquire_owned() else {
                continue;
            };
            let front = self.front;
            tokio::spawn(async move {
                let _permit = permit;
                let Ok(mut upstream) = TcpStream::connect(front).await else {
                    return;
                };
                let mut stream = tokio::io::join(&mut recv, &mut send);
                drop(tokio::io::copy_bidirectional(&mut stream, &mut upstream).await);
            });
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

/// A name fit for a list on an administrator's screen, or `None`.
fn clean_label(name: &str) -> Option<String> {
    let cleaned: String = name.chars().filter(|c| !c.is_control()).take(MAX_LABEL).collect();
    let cleaned = cleaned.trim();
    (!cleaned.is_empty()).then(|| cleaned.to_owned())
}

/// A 32-byte value from hex.
pub(crate) fn decode_32(value: &str) -> anyhow::Result<[u8; 32]> {
    hex::decode(value)?.try_into().map_err(|_| anyhow::anyhow!("not 32 bytes"))
}

#[cfg(test)]
mod tests;
