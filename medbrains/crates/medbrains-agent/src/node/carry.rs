//! A joined node's two paths to the main machine: the screen's connections and the clock's packets.

use std::sync::Arc;

use anyhow::Context;
use iroh::endpoint::Connection;
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::Semaphore;

use super::Node;
use crate::time::{ask_main, is_time_packet};
use crate::wire::{TIME_ALPN, TUNNEL_ALPN};

/// Connections from the screen at once. WebKit opens a handful.
const MAX_STREAMS: usize = 64;

impl Node {
    /// Opens the screen's loopback path and the clock's. Only ever once. A port something else holds
    /// is fatal: the agent stops, says so in the journal and is restarted, because whoever holds it
    /// would be answering this machine's screen or clock.
    pub(super) async fn open_tunnel(self: &Arc<Self>) -> anyhow::Result<()> {
        let mut open = self.tunnel_open.lock().await;
        if *open {
            return Ok(());
        }
        let listener = TcpListener::bind(self.screen_port).await.context("the screen's port")?;
        let clock = UdpSocket::bind(self.time_port).await.context("the clock's port")?;
        let (this, time_node) = (Arc::clone(self), Arc::clone(self));
        tokio::spawn(async move { time_node.relay_time_forever(clock).await });
        tokio::spawn(async move { this.carry_forever(listener).await });
        *open = true;
        Ok(())
    }

    /// Relays chrony's packets to the main machine for as long as the agent runs; one at a time,
    /// which is plenty at chrony's rate, and each with a time limit. Returns `!`: a node whose clock
    /// relay stopped would drift unseen, so no path may end it.
    async fn relay_time_forever(self: Arc<Self>, socket: UdpSocket) -> ! {
        let mut buffer = [0_u8; 1024];
        let mut held: Option<Connection> = None;
        loop {
            let Ok((read, from)) = socket.recv_from(&mut buffer).await else {
                continue;
            };
            if !is_time_packet(read) {
                continue;
            }
            match self.ask_time(&mut held, &buffer[..read]).await {
                Ok(answer) => drop(socket.send_to(&answer, from).await),
                Err(error) => tracing::info!(%error, "no answer from the main machine's clock"),
            }
        }
    }

    /// One time packet, dialling again if the connection has dropped.
    async fn ask_time(
        &self,
        held: &mut Option<Connection>,
        question: &[u8],
    ) -> anyhow::Result<Vec<u8>> {
        if held.as_ref().is_none_or(|conn| conn.close_reason().is_some()) {
            *held = Some(self.dial_main(TIME_ALPN).await?);
        }
        let conn = held.as_ref().context("no connection")?;
        ask_main(conn, question).await
    }

    /// Carries each connection from the screen over one iroh connection, which is dialled again
    /// when it has dropped. Knows nothing about what it carries: TLS ends at the main machine.
    /// Returns `!`: a failed accept is skipped, so the screen never loses its path by the loop ending.
    async fn carry_forever(self: Arc<Self>, listener: TcpListener) -> ! {
        let conn: Arc<tokio::sync::Mutex<Option<Connection>>> = Arc::default();
        let limit = Arc::new(Semaphore::new(MAX_STREAMS));
        loop {
            let Ok((screen, _)) = listener.accept().await else {
                continue;
            };
            let Ok(permit) = Arc::clone(&limit).try_acquire_owned() else {
                continue;
            };
            let (this, conn) = (Arc::clone(&self), Arc::clone(&conn));
            tokio::spawn(async move {
                let _permit = permit;
                if let Err(error) = this.carry(screen, &conn).await {
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
    ) -> anyhow::Result<()> {
        let tunnel = {
            let mut held = conn.lock().await;
            match held.as_ref().filter(|c| c.close_reason().is_none()) {
                Some(open) => open.clone(),
                None => {
                    let dialled = self.dial_main(TUNNEL_ALPN).await?;
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
