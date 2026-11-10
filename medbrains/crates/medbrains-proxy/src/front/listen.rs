//! Accepting connections, and reading each request head under a deadline.
//!
//! Pingora's own listener has a fixed 60-second handshake limit, no connection limit, a 1 MiB head
//! limit and no limit at all on a slow head once a connection has been reused. So this file owns
//! those, and hands Pingora only complete, checked heads.

use crate::head::{Refusal, Scan, check_head, scan_head};
use crate::limits::{ConnectionGate, Permit};
use crate::names::is_machine;
use bytes::BytesMut;
use pingora_core::apps::{HttpPersistentSettings, HttpServerApp};
use pingora_core::listeners::tls::Acceptor;
use pingora_core::protocols::http::ServerSession;
use pingora_core::protocols::l4::stream::Stream as L4Stream;
use pingora_core::protocols::{GetSocketDigest, SocketDigest, Stream};
use pingora_core::server::ShutdownWatch;
use std::net::{IpAddr, SocketAddr};
use std::os::fd::AsRawFd;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpSocket, TcpStream};
use tokio::time::{Instant, sleep, timeout, timeout_at};

/// A TLS handshake takes milliseconds; this is for a slow Wi-Fi link, not a slow client.
const HANDSHAKE: Duration = Duration::from_secs(10);
/// Silence allowed before a request starts, on a new or a reused connection.
const IDLE: Duration = Duration::from_secs(75);
/// A head is one packet or a few; once it has started, all of it must arrive within this.
const HEAD_DEADLINE: Duration = Duration::from_secs(10);
/// Largest head, with its cookies. Pingora would allow 1 MiB per connection, and this times the
/// connection limit is the bulk of the front's memory under a flood.
const MAX_HEAD: usize = 16 * 1024;
const HEAD_READ_SIZE: usize = 4096;
/// Sending a refusal to a client that is not reading must not hold the connection.
const REFUSAL_WRITE: Duration = Duration::from_secs(2);
const LISTEN_BACKLOG: u32 = 1024;
/// When the process is out of file descriptors, accept fails at once; pause instead of spinning.
const ACCEPT_ERROR_PAUSE: Duration = Duration::from_millis(100);

const BAD_REQUEST: &[u8] = b"HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 13\r\nConnection: close\r\n\r\nBad request.\n";
const NOT_ALLOWED: &[u8] = b"HTTP/1.1 405 Method Not Allowed\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 20\r\nConnection: close\r\n\r\nMethod not allowed.\n";
const TIMED_OUT: &[u8] = b"HTTP/1.1 408 Request Timeout\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 18\r\nConnection: close\r\n\r\nRequest too slow.\n";
const TOO_LARGE: &[u8] = b"HTTP/1.1 431 Request Header Fields Too Large\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 19\r\nConnection: close\r\n\r\nHeaders too large.\n";

/// One bound port, ready to accept.
pub(crate) struct Listener {
    pub(crate) socket: TcpListener,
    pub(crate) tls: Option<Arc<Acceptor>>,
    pub(crate) gate: Arc<ConnectionGate>,
}

/// How reading a head ended.
enum HeadRead {
    /// A checked head, and any bytes of the body that came with it.
    Ready(BytesMut),
    /// Answer this, then close.
    Refuse(&'static [u8]),
    /// The client left, or stayed silent past the idle limit.
    Gone,
}

/// Binds a port. IPv6's any-address also takes IPv4, so one listener covers both families.
pub(crate) fn bind(addr: SocketAddr) -> std::io::Result<TcpListener> {
    let socket = if addr.is_ipv6() {
        TcpSocket::new_v6()?
    } else {
        TcpSocket::new_v4()?
    };
    socket.set_reuseaddr(true)?;
    socket.bind(addr)?;
    socket.listen(LISTEN_BACKLOG)
}

/// True if a listener takes a connection from `client`. On a LAN port the only loopback client is
/// the machine itself at `127.0.0.1` or `::1`. Any local program can connect from `127.x.y.z`, the
/// addresses a node's tunnel arrives from on the loopback port, so taking one here would let it
/// pass as a machine in the audit log and the sign-in limit. The firewall says the same; this does
/// not depend on it.
fn admits_peer(on_lan: bool, client: IpAddr) -> bool {
    !on_lan || !client.is_loopback() || is_machine(client)
}

/// Accepts until shutdown. The only loop here meant to run forever.
pub(crate) async fn accept_loop<A>(listener: Listener, app: Arc<A>, mut shutdown: ShutdownWatch)
where
    A: HttpServerApp + Send + Sync + 'static,
{
    // A port bound to an address this machine cannot be reached on from the LAN is not a LAN port.
    let on_lan = listener
        .socket
        .local_addr()
        .ok()
        .is_none_or(|addr| !addr.ip().is_loopback());
    loop {
        let accepted = tokio::select! {
            accepted = listener.socket.accept() => accepted,
            _ = shutdown.changed() => {
                // A finished task would read as a listener having failed.
                std::future::pending::<()>().await;
                return;
            }
        };
        let (tcp, peer) = match accepted {
            Ok(accepted) => accepted,
            Err(error) => {
                tracing::warn!(%error, "accept failed");
                sleep(ACCEPT_ERROR_PAUSE).await;
                continue;
            }
        };
        let client = crate::names::canonical_ip(peer.ip());
        if !admits_peer(on_lan, client) {
            continue;
        }
        // Refused with a plain close: nothing has been spent on it yet, least of all a handshake.
        let Some(permit) = listener.gate.admit(client) else {
            continue;
        };
        let (tls, app, shutdown) = (listener.tls.clone(), Arc::clone(&app), shutdown.clone());
        tokio::spawn(serve_connection(tcp, peer, tls, app, shutdown, permit));
    }
}

/// Wraps a TCP stream as Pingora expects, recording the client's address.
fn pingora_stream(tcp: TcpStream, peer: SocketAddr) -> L4Stream {
    if let Err(error) = tcp.set_nodelay(true) {
        tracing::debug!(%error, "could not set nodelay");
    }
    let mut stream = L4Stream::from(tcp);
    let digest = SocketDigest::from_raw_fd(stream.as_raw_fd());
    // A new digest's cell is empty, so this cannot fail, and would change nothing if it did.
    drop(digest.peer_addr.set(Some(peer.into())));
    stream.set_socket_digest(digest);
    stream
}

/// One connection, from accept to close. `permit` holds its place until then.
async fn serve_connection<A>(
    tcp: TcpStream,
    peer: SocketAddr,
    tls: Option<Arc<Acceptor>>,
    app: Arc<A>,
    shutdown: ShutdownWatch,
    permit: Permit,
) where
    A: HttpServerApp + Send + Sync + 'static,
{
    let _permit = permit;
    let l4 = pingora_stream(tcp, peer);
    let stream: Stream = match tls {
        None => Box::new(l4),
        Some(acceptor) => match timeout(HANDSHAKE, acceptor.tls_handshake(l4)).await {
            Ok(Ok(tls_stream)) => Box::new(tls_stream),
            Ok(Err(error)) => {
                tracing::debug!(%error, "TLS handshake failed");
                return;
            }
            Err(_) => return,
        },
    };
    serve_requests(stream, app, shutdown).await;
}

/// Requests on one connection, one after another, each head under its own deadline.
async fn serve_requests<A>(mut stream: Stream, app: Arc<A>, shutdown: ShutdownWatch)
where
    A: HttpServerApp + Send + Sync + 'static,
{
    let mut settings = None;
    loop {
        let head = match read_head(&mut stream).await {
            HeadRead::Ready(head) => head,
            HeadRead::Refuse(response) => {
                // Best effort: it is the last thing this connection does either way.
                drop(timeout(REFUSAL_WRITE, stream.write_all(response)).await);
                return;
            }
            HeadRead::Gone => return,
        };
        let mut session = ServerSession::new_http1(stream);
        next_settings(settings.take(), &session, head).apply_to_session(&mut session);
        let Some(reused) = app.process_new_http(session, &shutdown).await else {
            return;
        };
        let (reused_stream, reused_settings) = reused.consume();
        stream = reused_stream;
        settings = reused_settings;
    }
}

/// The settings the next request on a connection starts from, with `head` as all it may parse.
///
/// Pingora hands back the bytes it read past the last request as a pipelined prefix inside `reused`.
/// Those never passed `check_head`, so they are replaced here by `head`, which did. Keeping them would
/// let a second head skip every rule in `head.rs`: smuggling. Pingora gives no way to read them back
/// out to check them, so they are dropped; a client that pipelines waits, and browsers do not.
fn next_settings(
    reused: Option<HttpPersistentSettings>,
    session: &ServerSession,
    head: BytesMut,
) -> HttpPersistentSettings {
    let mut next = reused.unwrap_or_else(|| HttpPersistentSettings::for_session(session));
    next.set_pipelined_prefix(head);
    next
}

/// Reads one complete head, refusing it at the first sign of trouble.
async fn read_head(stream: &mut Stream) -> HeadRead {
    let mut buf = BytesMut::with_capacity(HEAD_READ_SIZE);
    match timeout(IDLE, stream.read_buf(&mut buf)).await {
        Ok(Ok(count)) if count > 0 => {}
        _ => return HeadRead::Gone,
    }
    let deadline = Instant::now() + HEAD_DEADLINE;
    let mut scanned = 0;
    loop {
        match scan_head(&buf, scanned) {
            Scan::Complete(end) => return judge(buf, end),
            Scan::BareLineFeed => return HeadRead::Refuse(BAD_REQUEST),
            Scan::Partial(at) => scanned = at,
        }
        if buf.len() > MAX_HEAD {
            return HeadRead::Refuse(TOO_LARGE);
        }
        buf.reserve(HEAD_READ_SIZE);
        match timeout_at(deadline, stream.read_buf(&mut buf)).await {
            Ok(Ok(count)) if count > 0 => {}
            Ok(_) => return HeadRead::Gone,
            Err(_) => return HeadRead::Refuse(TIMED_OUT),
        }
    }
}

/// The verdict on a head that has fully arrived.
fn judge(buf: BytesMut, end: usize) -> HeadRead {
    if end > MAX_HEAD {
        return HeadRead::Refuse(TOO_LARGE);
    }
    match check_head(buf.get(..end).unwrap_or_default()) {
        Ok(()) => HeadRead::Ready(buf),
        Err(Refusal::Malformed) => HeadRead::Refuse(BAD_REQUEST),
        Err(Refusal::Method) => HeadRead::Refuse(NOT_ALLOWED),
    }
}

#[cfg(test)]
#[path = "listen_tests.rs"]
mod tests;
