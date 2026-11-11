//! Carrying an admitted machine's screen to the local front end.

use std::net::{Ipv4Addr, SocketAddr};
use std::sync::{Arc, PoisonError};

use iroh::endpoint::Connection;
use sha2::{Digest, Sha256};
use tokio::net::TcpStream;
use tokio::sync::Semaphore;

use super::Gateway;

/// Connections to the front end, per machine: a screen opens a handful.
const MAX_STREAMS: usize = 64;
/// `127.0.0.1` and the loopback addresses system services use are never given to a machine.
const LOOPBACK_FIRST_OCTET_SPAN: u8 = 254;

impl Gateway {
    /// The streams this machine may hold, shared by all its connections, so opening more connections
    /// gets it no more.
    pub(super) fn machine_streams(&self, conn: &Connection) -> Arc<Semaphore> {
        let mut streams = self.streams.lock().unwrap_or_else(PoisonError::into_inner);
        let shared = streams
            .entry(conn.remote_id().to_string())
            .or_insert_with(|| Arc::new(Semaphore::new(MAX_STREAMS)));
        Arc::clone(shared)
    }

    /// Carries each connection from a machine's screen to the local front end.
    pub(super) async fn carry_screen(&self, conn: &Connection, limit: &Arc<Semaphore>) {
        let source = machine_source(conn.remote_id().as_bytes());
        while let Ok((mut send, mut recv)) = conn.accept_bi().await {
            let Ok(permit) = Arc::clone(limit).try_acquire_owned() else {
                continue;
            };
            let front = self.front;
            tokio::spawn(async move {
                let _permit = permit;
                let Ok(mut upstream) = connect_front(source, front).await else {
                    return;
                };
                let mut stream = tokio::io::join(&mut recv, &mut send);
                drop(tokio::io::copy_bidirectional(&mut stream, &mut upstream).await);
            });
        }
    }
}

/// The loopback address a machine's connections come from, derived from its key. So the front end,
/// the sign-in limit and the audit log each see one address per machine, not one for them all. The
/// server records it against the machine, which is how an address in the log names one.
pub(crate) fn machine_source(key: &[u8; 32]) -> Ipv4Addr {
    let hash = Sha256::new().chain_update(b"medbrains/machine-source/1").chain_update(key).finalize();
    Ipv4Addr::new(127, 1 + hash[0] % LOOPBACK_FIRST_OCTET_SPAN, hash[1], hash[2])
}

/// Connects to the front end from a machine's own loopback address.
#[cfg(target_os = "linux")]
async fn connect_front(source: Ipv4Addr, front: SocketAddr) -> std::io::Result<TcpStream> {
    let socket = tokio::net::TcpSocket::new_v4()?;
    socket.bind(SocketAddr::new(std::net::IpAddr::V4(source), 0))?;
    socket.connect(front).await
}

/// Elsewhere only `127.0.0.1` is on loopback. The agent runs on Linux; its tests also run on Macs.
#[cfg(not(target_os = "linux"))]
async fn connect_front(_source: Ipv4Addr, front: SocketAddr) -> std::io::Result<TcpStream> {
    TcpStream::connect(front).await
}

#[cfg(test)]
mod tests {
    use super::machine_source;

    /// One address per machine, stable across restarts, and never a service's own.
    #[test]
    fn a_machine_keeps_its_own_loopback_address() {
        let (one, two) = (machine_source(&[1; 32]), machine_source(&[2; 32]));
        assert_eq!(one, machine_source(&[1; 32]));
        assert_ne!(one, two);
        for key in 0..=255_u8 {
            let address = machine_source(&[key; 32]).octets();
            assert_eq!(address[0], 127);
            assert_ne!(address[1], 0, "127.0.x.x holds this machine's own services");
        }
    }
}
