//! The join and tunnel rules over real iroh connections on loopback. Only the server is a stand-in.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use async_trait::async_trait;
use iroh::endpoint::Connection;
use iroh::{Endpoint, EndpointAddr, SecretKey};
use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
use medbrains_edge::iroh_transport::{LanEndpoint, PeerGatekeeper, build_lan_endpoint};
use medbrains_edge::peer_admission::{Admission, RefusalReason};
use tokio::net::{TcpListener, UdpSocket};
use uuid::Uuid;

use super::{Gateway, RosterGate, WHOAMI_SIZE, clean_label, whoami_reply};
use crate::hospital::{Answer, Filing, Hospital, Synced};
use crate::node::Node;
use crate::wire::{JOIN_ALPN, JoinState, Kind, TUNNEL_ALPN};

const CERTIFICATE: &str = "the front end's certificate";
const SERVICE: &str = "medbrains-test";

/// Stands in for the server: holds one request's state and the admitted keys.
struct FakeServer {
    tenant: Uuid,
    state: Mutex<JoinState>,
    filings: Mutex<Vec<Filing>>,
    admitted: Mutex<Vec<String>>,
}

impl FakeServer {
    fn new(tenant: Uuid, state: JoinState) -> Arc<Self> {
        Arc::new(Self {
            tenant,
            state: Mutex::new(state),
            filings: Mutex::default(),
            admitted: Mutex::default(),
        })
    }

    fn set_state(&self, state: JoinState) {
        *self.state.lock().unwrap_or_else(PoisonError::into_inner) = state;
    }

    fn set_admitted(&self, keys: &[String]) {
        *self.admitted.lock().unwrap_or_else(PoisonError::into_inner) = keys.to_vec();
    }

    fn filed_code(&self) -> Option<String> {
        let filings = self.filings.lock().unwrap_or_else(PoisonError::into_inner);
        filings.last().map(|f| f.code.clone())
    }
}

#[async_trait]
impl Hospital for FakeServer {
    async fn file_join(&self, filing: &Filing) -> anyhow::Result<Answer> {
        self.filings.lock().unwrap_or_else(PoisonError::into_inner).push(filing.clone());
        Ok(Answer { state: *self.state.lock().unwrap_or_else(PoisonError::into_inner) })
    }

    async fn join_state(&self, _node_id: &str) -> anyhow::Result<Answer> {
        Ok(Answer { state: *self.state.lock().unwrap_or_else(PoisonError::into_inner) })
    }

    async fn sync(&self, _connected: &[String]) -> anyhow::Result<Synced> {
        let admitted = self.admitted.lock().unwrap_or_else(PoisonError::into_inner).clone();
        Ok(Synced { hospital: "City Hospital".to_owned(), roster: roster(self.tenant, &admitted) })
    }
}

fn roster(tenant: Uuid, keys: &[String]) -> PeerRosterDoc {
    PeerRosterDoc {
        tenant_id: tenant,
        issued_at: chrono::Utc::now().timestamp(),
        peers: keys
            .iter()
            .map(|node_id| PeerRosterEntry {
                node_id: node_id.clone(),
                binding: PeerBinding {
                    paired_device_id: Uuid::new_v4(),
                    tenant_id: tenant,
                    app_variant: "Desktop-Workstation".to_owned(),
                    revoked: false,
                },
            })
            .collect(),
    }
}

/// An endpoint on loopback, answering `alpns`.
async fn endpoint(alpns: Vec<Vec<u8>>) -> anyhow::Result<Endpoint> {
    let options = LanEndpoint {
        alpns,
        port: None,
        advertise: false,
        service_name: SERVICE.to_owned(),
    };
    Ok(build_lan_endpoint(SecretKey::generate(), options).await?.0)
}

/// A front end that echoes, so a tunnel can be seen to work.
async fn echo_front() -> anyhow::Result<SocketAddr> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let (mut read, mut write) = stream.split();
                drop(tokio::io::copy(&mut read, &mut write).await);
            });
        }
    });
    Ok(address)
}

/// A running gateway and the address a node dials it at.
async fn gateway(server: Arc<FakeServer>) -> anyhow::Result<(Arc<Gateway>, EndpointAddr)> {
    let main = endpoint(vec![JOIN_ALPN.to_vec(), TUNNEL_ALPN.to_vec()]).await?;
    let addr = main.addr();
    let front = echo_front().await?;
    let gateway = Gateway::new(main, server, CERTIFICATE.to_owned(), front);
    gateway.sync().await?;
    tokio::spawn(Arc::clone(&gateway).accept_forever());
    Ok((gateway, addr))
}

/// Sends bytes through a tunnel and reads them back.
async fn echo_through(conn: &Connection) -> anyhow::Result<Vec<u8>> {
    let (mut send, mut recv) = conn.open_bi().await?;
    send.write_all(b"ping").await?;
    let mut back = vec![0_u8; 4];
    recv.read_exact(&mut back).await?;
    Ok(back)
}

/// Dials a node at a gateway's tunnel and tries to use it.
async fn tunnel_answer(from: &Endpoint, addr: EndpointAddr) -> anyhow::Result<Vec<u8>> {
    let conn = from.connect(addr, TUNNEL_ALPN).await?;
    tokio::time::timeout(Duration::from_secs(5), echo_through(&conn)).await?
}

#[tokio::test]
async fn an_unapproved_key_is_refused_a_tunnel() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_gateway, addr) = gateway(server).await?;
    let stranger = endpoint(Vec::new()).await?;
    assert!(
        tunnel_answer(&stranger, addr).await.is_err(),
        "a valid key nobody approved must not reach the front end"
    );
    Ok(())
}

/// A join request grants nothing: only a key on the server's roster gets through.
#[tokio::test]
async fn a_pending_request_does_not_admit_its_key() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_gateway, addr) = gateway(Arc::clone(&server)).await?;
    let (node, _dir) = node_with_main(&addr, "main").await?;
    let id = addr.id.to_string();
    node.start_join(&id, "Reception PC".to_owned(), Kind::Workstation)?;
    wait_for(&node, "pending").await?;
    assert!(node.joined().is_none());
    let conn = node.test_dial_tunnel(addr.clone()).await?;
    assert!(
        tokio::time::timeout(Duration::from_secs(5), echo_through(&conn)).await?.is_err(),
        "the same key that asked must still be refused"
    );
    Ok(())
}

#[tokio::test]
async fn an_approved_key_reaches_the_front_end_and_removal_ends_it_at_once() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (gateway, addr) = gateway(Arc::clone(&server)).await?;
    let node = endpoint(Vec::new()).await?;

    server.set_admitted(&[node.id().to_string()]);
    gateway.sync().await?;
    let conn = node.connect(addr, TUNNEL_ALPN).await?;
    assert_eq!(echo_through(&conn).await?, b"ping");

    server.set_admitted(&[]);
    gateway.sync().await?;
    tokio::time::timeout(Duration::from_secs(5), conn.closed()).await?;
    Ok(())
}

/// A key approved after the last sync must not wait for the next one.
#[tokio::test]
async fn a_key_approved_a_moment_ago_gets_through() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_gateway, addr) = gateway(Arc::clone(&server)).await?;
    let node = endpoint(Vec::new()).await?;
    server.set_admitted(&[node.id().to_string()]);
    assert_eq!(tunnel_answer(&node, addr).await?, b"ping");
    Ok(())
}

/// The tenant is what the roster says, whatever anyone claims.
#[test]
fn the_tenant_comes_from_admission_never_from_a_claim() {
    let tenant = Uuid::new_v4();
    let gate = RosterGate::default();
    gate.replace(&roster(tenant, &["node".to_owned()]));
    assert_eq!(gate.tenant(), Some(tenant));
    assert!(matches!(
        gate.admit("node", tenant),
        Admission::Admit { tenant_id, .. } if tenant_id == tenant
    ));
    assert_eq!(
        gate.admit("node", Uuid::new_v4()),
        Admission::Refuse(RefusalReason::TenantMismatch)
    );
}

/// Before the server has said anything, a gateway admits nobody, rather than everybody.
#[test]
fn a_gateway_with_no_roster_admits_nobody() {
    assert_eq!(
        RosterGate::default().admit("node", Uuid::new_v4()),
        Admission::Refuse(RefusalReason::NotPaired)
    );
}

/// A node holding a list of one main machine, and the temporary state directory it lives in.
async fn node_with_main(
    addr: &EndpointAddr,
    name: &str,
) -> anyhow::Result<(Arc<Node>, tempfile::TempDir)> {
    let dir = tempfile::tempdir()?;
    let node = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?).await?;
    node.test_remember(addr.id.to_string(), name, addr.ip_addrs().copied().collect());
    Ok((node, dir))
}

async fn free_port() -> anyhow::Result<SocketAddr> {
    Ok(TcpListener::bind("127.0.0.1:0").await?.local_addr()?)
}

async fn wait_for(node: &Node, state: &str) -> anyhow::Result<()> {
    for _ in 0..100 {
        if node.standing().state == state {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    anyhow::bail!("stuck at {:?}, wanted {state}", node.standing().state)
}

#[tokio::test]
async fn both_sides_show_the_same_code_and_approval_delivers_the_certificate() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_gateway, addr) = gateway(Arc::clone(&server)).await?;
    let (node, _dir) = node_with_main(&addr, "City Hospital").await?;
    node.start_join(&addr.id.to_string(), "Reception PC".to_owned(), Kind::Workstation)?;
    wait_for(&node, "pending").await?;
    assert_eq!(node.standing().code, server.filed_code(), "both screens must show one code");
    assert!(node.joined().is_none(), "waiting grants nothing");

    server.set_state(JoinState::Approved);
    wait_for(&node, "approved").await?;
    let joined = node.joined().ok_or_else(|| anyhow::anyhow!("nothing saved"))?;
    assert_eq!(joined.certificate, CERTIFICATE);
    assert_eq!(joined.main_id, addr.id.to_string());
    Ok(())
}

/// A power cut between approval and the end of setup: asking again just finishes.
#[tokio::test]
async fn a_machine_already_approved_finishes_without_asking_again() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Approved);
    let (_gateway, addr) = gateway(Arc::clone(&server)).await?;
    let (node, _dir) = node_with_main(&addr, "City Hospital").await?;
    node.start_join(&addr.id.to_string(), "PC".to_owned(), Kind::Workstation)?;
    wait_for(&node, "approved").await?;
    node.start_join(&addr.id.to_string(), "PC".to_owned(), Kind::Workstation)?;
    assert_eq!(node.standing().state, "approved");
    assert_eq!(server.filings.lock().unwrap_or_else(PoisonError::into_inner).len(), 1);
    Ok(())
}

/// A rejected, expired or refused request leaves a machine with nothing.
#[tokio::test]
async fn a_refused_request_leaves_nothing_behind() -> anyhow::Result<()> {
    for (state, word) in [
        (JoinState::Rejected, "rejected"),
        (JoinState::Expired, "expired"),
        (JoinState::Busy, "busy"),
    ] {
        let server = FakeServer::new(Uuid::new_v4(), state);
        let (_gateway, addr) = gateway(server).await?;
        let (node, _dir) = node_with_main(&addr, "City Hospital").await?;
        node.start_join(&addr.id.to_string(), "PC".to_owned(), Kind::Display)?;
        wait_for(&node, word).await?;
        assert!(node.joined().is_none(), "{word} must not join");
    }
    Ok(())
}

/// The typed-address fallback: the node learns the key from the address, and then the code check
/// is what proves it.
#[tokio::test]
async fn a_typed_address_finds_the_main_machine() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (gateway, addr) = gateway(server).await?;
    let socket = UdpSocket::bind("127.0.0.1:0").await?;
    let port = socket.local_addr()?.port();
    tokio::spawn(Arc::clone(&gateway).whoami_forever(socket));
    let dir = tempfile::tempdir()?;
    let node = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?).await?;
    let found = node.find_at([127, 0, 0, 1].into(), port, 7844).await?;
    assert_eq!(found.id, addr.id.to_string());
    assert_eq!(found.name, "City Hospital");
    Ok(())
}

/// The whoami port must never send more than it received, or it can be aimed at a third party.
#[test]
fn a_whoami_answer_is_never_larger_than_its_question() {
    let reply = whoami_reply("key", &"a very long hospital name ".repeat(40));
    assert!(reply.len() <= WHOAMI_SIZE);
    assert!(serde_json::from_str::<serde_json::Value>(&reply).is_ok());
}

#[test]
fn a_name_is_cleaned_before_an_administrator_reads_it() {
    assert_eq!(clean_label("  Ward\n3\u{7} PC "), Some("Ward3 PC".to_owned()));
    assert_eq!(clean_label(" \n "), None);
    assert_eq!(clean_label(&"x".repeat(500)).map(|l| l.len()), Some(60));
}
