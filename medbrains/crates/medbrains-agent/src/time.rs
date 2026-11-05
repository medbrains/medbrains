//! A node's time comes from the main machine's chrony, carried over the join tunnel.
//!
//! The node's chrony asks `127.0.0.1:12300`; this relays each NTP packet over iroh to the main
//! machine's chrony on its loopback, and back. So chrony's own algorithm does all the work, the key
//! authenticates the main machine, a removed node loses its time source with its access, and no
//! address or certificate has to be set up. NTS would need a certificate naming a LAN address that
//! can change.
//!
//! Chrony sees the delay of the iroh path as network delay and corrects for it as it does on any
//! path. A main machine with no time source of its own answers with stratum 10, from `local`, and
//! the setup service reads that as unconfirmed on both machines.

use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use anyhow::Context;
use iroh::endpoint::Connection;
use tokio::net::UdpSocket;

/// Where a node's chrony asks. The same value is in `/usr/lib/medbrains/time-role`. Below 1024, so
/// only the agent can bind it: a screen process listening here could set the machine's clock.
pub(crate) const NODE_TIME_PORT: u16 = 1023;
const MAIN_CHRONY: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 123);
/// An answer later than this is no use to a clock, so chrony counts it as lost.
const ANSWER_TIMEOUT: Duration = Duration::from_secs(2);
/// NTP with extension fields is under this; anything longer is not a time packet.
const MAX_PACKET: usize = 1024;
/// The shortest NTP packet.
const MIN_PACKET: usize = 48;

/// True for a packet the right size to be NTP. Keeps the relay from carrying anything else.
pub(crate) const fn is_time_packet(length: usize) -> bool {
    length >= MIN_PACKET && length <= MAX_PACKET
}

/// One question on one stream: passes it to the main machine's chrony and returns the answer.
async fn answer_one(question: &[u8]) -> anyhow::Result<Vec<u8>> {
    let socket = UdpSocket::bind(SocketAddr::new(MAIN_CHRONY.ip(), 0)).await?;
    // Connected, so the kernel takes answers only from chrony.
    socket.connect(MAIN_CHRONY).await?;
    socket.send(question).await?;
    let mut buffer = vec![0_u8; MAX_PACKET];
    let read = tokio::time::timeout(ANSWER_TIMEOUT, socket.recv(&mut buffer))
        .await
        .context("chrony did not answer")??;
    buffer.truncate(read);
    Ok(buffer)
}

/// The main machine's side: answers an admitted node's time packets until it goes away. Ends when
/// the connection does, which is how a removal stops it.
pub(crate) async fn serve_main(conn: &Connection) {
    while let Ok((mut send, mut recv)) = conn.accept_bi().await {
        let question = recv.read_to_end(MAX_PACKET).await;
        let answered = async {
            let question = question.context("read a time packet")?;
            anyhow::ensure!(is_time_packet(question.len()), "not a time packet");
            send.write_all(&answer_one(&question).await?).await?;
            send.finish()?;
            Ok::<(), anyhow::Error>(())
        };
        if let Err(error) = answered.await {
            tracing::info!(%error, "a time packet went unanswered");
        }
    }
}

/// The node's side of one packet, over an open connection.
pub(crate) async fn ask_main(conn: &Connection, question: &[u8]) -> anyhow::Result<Vec<u8>> {
    let (mut send, mut recv) = conn.open_bi().await?;
    send.write_all(question).await?;
    send.finish()?;
    let answer = tokio::time::timeout(ANSWER_TIMEOUT, recv.read_to_end(MAX_PACKET));
    Ok(answer.await.context("the main machine did not answer")??)
}

#[cfg(test)]
mod tests {
    use super::is_time_packet;

    #[test]
    fn only_a_packet_the_size_of_ntp_is_carried() {
        assert!(is_time_packet(48));
        assert!(is_time_packet(1024));
        assert!(!is_time_packet(47));
        assert!(!is_time_packet(1025));
    }
}
