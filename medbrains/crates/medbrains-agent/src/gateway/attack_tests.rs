//! What a stranger, a liar or a fake main machine can get. Real iroh on loopback; only the server is
//! a stand-in.

use std::net::SocketAddr;
use std::sync::atomic::Ordering;
use std::sync::{Arc, PoisonError};
use std::time::Duration;

use iroh::SecretKey;
use tokio::net::UdpSocket;
use uuid::Uuid;

use super::tests::{
    CERTIFICATE, FakeServer, echo_front, echo_through, endpoint, free_port, gateway, node_with_main,
    tunnel_answer, wait_for,
};
use super::{Gateway, Verdict, WHOAMI_SIZE, whoami_reply};
use crate::hospital::Hospital;
use crate::node::{Joined, Node};
use crate::wire::{JoinState, Kind, TUNNEL_ALPN};

/// The review's attack. A fake main machine answers "approved" at once, with its own certificate.
/// The node must save nothing, trust nothing and open nothing until a person types the digits from
/// the real main machine's screen, which this attacker cannot put there.
#[tokio::test]
async fn a_fake_main_machine_gets_nothing_without_the_second_code() -> anyhow::Result<()> {
    let attacker = FakeServer::new(Uuid::new_v4(), JoinState::Approved);
    let (_fake, addr) = gateway(attacker).await?;
    let (node, _dir) = node_with_main(&addr, "City Hospital").await?;
    node.start_join(&addr.id.to_string(), "Reception PC".to_owned(), Kind::Workstation)?;
    wait_for(&node, "confirm").await?;
    assert!(node.joined()?.is_none(), "the attacker's certificate must not be saved");
    for wrong in ["000000", "111111", "222222"] {
        assert!(node.confirm(wrong).await.is_err());
        assert!(node.joined()?.is_none(), "a wrong code must save nothing");
    }
    assert_eq!(node.standing().state, "mismatch");
    assert!(node.confirm("000000").await.is_err(), "and nothing is left to confirm");
    Ok(())
}

/// A liar at a typed address can claim the main machine's key in plain UDP. Only the key's own
/// handshake counts, so nothing is saved.
#[tokio::test]
async fn a_claimed_key_is_not_enough_to_move_the_saved_address() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_real, addr) = gateway(server).await?;
    let liar = UdpSocket::bind("127.0.0.1:0").await?;
    let port = liar.local_addr()?.port();
    let claim = whoami_reply(&addr.id.to_string(), "City Hospital");
    tokio::spawn(async move {
        let mut buffer = [0_u8; WHOAMI_SIZE];
        while let Ok((_, from)) = liar.recv_from(&mut buffer).await {
            drop(liar.send_to(claim.as_bytes(), from).await);
        }
    });
    let dir = tempfile::tempdir()?;
    let saved = Joined {
        main_id: addr.id.to_string(),
        addresses: vec![SocketAddr::from(([127, 0, 0, 1], 9))],
        kind: Kind::Workstation,
        hospital: "City Hospital".to_owned(),
        certificate: CERTIFICATE.to_owned(),
    };
    std::fs::write(dir.path().join("joined.json"), serde_json::to_vec(&saved)?)?;
    let node = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?, free_port().await?).await?;
    assert!(node.readdress_at([127, 0, 0, 1].into(), port, 9).await.is_err());
    let kept = node.joined()?.ok_or_else(|| anyhow::anyhow!("nothing saved"))?;
    assert_eq!(kept.addresses, saved.addresses);
    Ok(())
}

/// Strangers must not turn connections into database work: however many keys arrive at once, they
/// cause about one look a second.
#[tokio::test]
async fn strangers_cause_at_most_one_sync_a_second() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (_gateway, addr) = gateway(Arc::clone(&server)).await?;
    let before = server.syncs.load(Ordering::SeqCst);
    let stranger = endpoint(Vec::new()).await?;
    let mut dials = Vec::new();
    for _ in 0..20 {
        dials.push(stranger.connect(addr.clone(), TUNNEL_ALPN));
    }
    for dial in dials {
        drop(dial.await);
    }
    tokio::time::sleep(Duration::from_millis(300)).await;
    let caused = server.syncs.load(Ordering::SeqCst) - before;
    assert!(caused <= 2, "20 strangers in under two seconds caused {caused} syncs");
    Ok(())
}

/// Removal must not fail open. With the server silent past the limit, open sessions close and new
/// ones are refused, and this reads as a fault and not a refusal.
#[tokio::test]
async fn a_silent_server_ends_every_session_and_admits_nobody() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let main = endpoint(vec![TUNNEL_ALPN.to_vec()]).await?;
    let addr = main.addr();
    let gateway = Gateway::with_silence(main, Arc::clone(&server) as Arc<dyn Hospital>, CERTIFICATE.to_owned(), echo_front().await?, Duration::ZERO);
    let node = endpoint(Vec::new()).await?;
    server.set_admitted(&[node.id().to_string()]);
    gateway.sync().await?;
    tokio::spawn(Arc::clone(&gateway).accept_forever());
    let conn = node.connect(addr.clone(), TUNNEL_ALPN).await?;
    assert_eq!(echo_through(&conn).await?, b"ping");
    tokio::time::sleep(Duration::from_millis(200)).await;

    // The machine is removed on the server, and then the sync breaks, so the agent never hears.
    server.set_admitted(&[]);
    server.broken.store(true, Ordering::SeqCst);
    gateway.sync_round().await;
    tokio::time::timeout(Duration::from_secs(5), conn.closed()).await?;
    assert_eq!(gateway.verdict(&node.id().to_string()), Verdict::Unknown);
    assert_eq!(gateway.tunnel_admission(&node.id().to_string()).await, Verdict::Unknown);
    assert!(tunnel_answer(&node, addr).await.is_err(), "and a new dial is not admitted");
    Ok(())
}

/// A machine's streams are its own limit, however many connections it opens.
#[tokio::test]
async fn a_machines_stream_limit_covers_all_its_connections() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (gateway, addr) = gateway(Arc::clone(&server)).await?;
    let node = endpoint(Vec::new()).await?;
    server.set_admitted(&[node.id().to_string()]);
    gateway.sync().await?;
    let (one, two) = (node.connect(addr.clone(), TUNNEL_ALPN).await?, node.connect(addr, TUNNEL_ALPN).await?);
    echo_through(&one).await?;
    echo_through(&two).await?;
    let remote = gateway.streams.lock().unwrap_or_else(PoisonError::into_inner);
    assert_eq!(remote.len(), 1, "two connections, one machine, one limit");
    Ok(())
}

/// Damage is a fault, not "never joined", which would send a person through joining again.
#[tokio::test]
async fn an_unreadable_record_is_a_fault_and_not_a_fresh_machine() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    std::fs::write(dir.path().join("joined.json"), b"not json")?;
    let started = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?, free_port().await?).await;
    assert!(started.is_err());
    Ok(())
}

/// Something else holding the clock's port could set this machine's clock, so that is fatal.
#[tokio::test]
async fn a_held_time_port_stops_the_agent_rather_than_being_ignored() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    let saved = Joined {
        main_id: SecretKey::generate().public().to_string(),
        addresses: Vec::new(),
        kind: Kind::Workstation,
        hospital: "City".to_owned(),
        certificate: CERTIFICATE.to_owned(),
    };
    std::fs::write(dir.path().join("joined.json"), serde_json::to_vec(&saved)?)?;
    let squatter = UdpSocket::bind("127.0.0.1:0").await?;
    let held = squatter.local_addr()?;
    let started = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?, held).await;
    assert!(started.is_err());
    Ok(())
}

/// mDNS noise must not stop a person joining by typing the address.
#[tokio::test]
async fn a_full_list_still_takes_a_typed_address() -> anyhow::Result<()> {
    let server = FakeServer::new(Uuid::new_v4(), JoinState::Pending);
    let (real, addr) = gateway(server).await?;
    let socket = UdpSocket::bind("127.0.0.1:0").await?;
    let port = socket.local_addr()?.port();
    tokio::spawn(Arc::clone(&real).whoami_forever(socket));
    let dir = tempfile::tempdir()?;
    let node = Node::start(endpoint(Vec::new()).await?, dir.path(), free_port().await?, free_port().await?).await?;
    for i in 0..40 {
        node.test_remember(format!("noise-{i}"), "Fake", Vec::new());
    }
    assert_eq!(node.found().len(), 32);
    let found = node.find_at([127, 0, 0, 1].into(), port, 7844).await?;
    assert_eq!(found.id, addr.id.to_string());
    assert!(node.found().iter().any(|entry| entry.id == found.id));
    assert_eq!(node.found().len(), 32);
    Ok(())
}
