//! Peer-to-peer transport over iroh.
//!
//! Two topologies, one code path:
//!
//! * a device dials the **edge node** — the ordinary case inside a hospital,
//!   and the one that works when mDNS does not because the phone is on cellular
//!   or a hotspot with client isolation;
//! * a device dials **another device** — a field camp with no edge box, where
//!   two volunteers need to see each other's registrations before either
//!   reaches signal.
//!
//! Both run the same [`SyncSession`], so the protocol cannot drift between
//! them, and both admit through the same rule — the edge against the database,
//! a device against its cached [`PeerRoster`].
//!
//! # What this layer is not allowed to decide
//!
//! Nothing about authorisation. It learns the dialling peer's node id from the
//! connection, hands it to an [`PeerGatekeeper`], and either opens a session or
//! closes the connection. It never inspects a frame to decide access, and it
//! cannot widen what a session may do.

use std::sync::Arc;

use anyhow::{Context as _, Result};
use iroh::{
    Endpoint, NodeAddr,
    endpoint::{Connection, SendStream},
};
use tokio::io::{AsyncBufReadExt as _, AsyncReadExt as _, BufReader};
use uuid::Uuid;

use crate::{
    peer_admission::{Admission, names_other_tenant, refusal_message},
    session::SyncSession,
    sync::{Frame, SyncServer},
};

/// ALPN for this protocol. Versioned so a future wire format cannot be spoken
/// to a peer that would misread it.
pub const SYNC_ALPN: &[u8] = b"medbrains/sync/1";

/// Frames are newline-delimited JSON, and a peer that sends more than this in
/// one frame is refused rather than allocated for.
const MAX_FRAME_BYTES: usize = 8 * 1024 * 1024;

/// Decides whether a dialling peer may open a session.
///
/// Implemented against the database on the edge node and against the cached
/// roster on a device, so the same transport serves both without knowing which
/// it is running on.
pub trait PeerGatekeeper: Send + Sync {
    fn admit(&self, node_id: &str, claimed_tenant: Uuid) -> Admission;
}

/// Build an endpoint bound to this device's key.
///
/// `relays` is explicit and has no default. Falling back to a public relay
/// would send a hospital's sync metadata — who is talking to whom, and when —
/// through a third party. An operator either supplies relays they run, or the
/// endpoint is direct-only and works on the LAN and wherever hole punching
/// succeeds.
pub async fn build_endpoint(
    secret: iroh::SecretKey,
    relays: Option<iroh::RelayMap>,
) -> Result<Endpoint> {
    let mut builder = Endpoint::builder()
        .secret_key(secret)
        .alpns(vec![SYNC_ALPN.to_vec()])
        .discovery_local_network();

    builder = match relays {
        Some(map) => builder.relay_mode(iroh::RelayMode::Custom(map)),
        None => builder.relay_mode(iroh::RelayMode::Disabled),
    };

    builder.bind().await.context("bind iroh endpoint")
}

/// Serve one accepted connection.
///
/// The peer's node id comes from the connection rather than anything it says,
/// which is the whole point of dialling by public key: identity is established
/// by the transport and authorisation is decided here.
///
/// `serving_tenant` is the tenant *this* node runs for — an edge box is
/// deployed for one hospital, and a device's roster is issued for one. It is
/// not the peer's claim; the peer has not spoken yet.
pub async fn serve_connection(
    server: Arc<SyncServer>,
    gate: Arc<dyn PeerGatekeeper>,
    conn: Connection,
    serving_tenant: Uuid,
) -> Result<()> {
    let node_id = conn.remote_node_id().context("peer node id")?.to_string();

    // The tenant comes from the admission, never from the peer. A key bound to
    // one hospital must not be able to open a session against another simply by
    // saying so in its handshake.
    let admitted_tenant = match gate.admit(&node_id, serving_tenant) {
        Admission::Admit { tenant_id, .. } => tenant_id,
        Admission::Refuse(reason) => {
            // The reason is logged for the operator; the peer is told only the
            // one sentence, so a prober cannot tell an unknown key from a
            // revoked one and map the fleet.
            tracing::warn!(%node_id, ?reason, "peer refused");
            conn.close(1u32.into(), refusal_message().as_bytes());
            return Ok(());
        }
    };

    let mut session = SyncSession::new(server);

    // One bi-stream per connection, frames newline-delimited.
    //
    // Each frame is read and answered before the next is read, so a peer can
    // wait for its Hello to be accepted before deciding what to send. Reading
    // the whole stream first would deadlock exactly that exchange, and would
    // bound the conversation rather than the frame.
    let (mut send, recv) = conn.accept_bi().await.context("accept bi stream")?;
    let mut reader = BufReader::new(recv);
    let mut line = Vec::new();

    loop {
        line.clear();
        // `take` caps one frame, not the session: a long sync is many bounded
        // frames, and an oversized single frame is refused rather than
        // allocated for.
        let read = (&mut reader)
            .take(MAX_FRAME_BYTES as u64)
            .read_until(b'\n', &mut line)
            .await
            .context("read frame")?;

        if read == 0 {
            break;
        }
        if !line.ends_with(b"\n") && read == MAX_FRAME_BYTES {
            send_frame(
                &mut send,
                &Frame::Error {
                    message: format!("frame exceeds {MAX_FRAME_BYTES} bytes"),
                },
            )
            .await?;
            break;
        }

        let body = line.strip_suffix(b"\n").unwrap_or(&line);
        if body.is_empty() {
            continue;
        }

        let reply = match serde_json::from_slice::<Frame>(body) {
            Ok(frame) => {
                if names_other_tenant(&frame, admitted_tenant) {
                    tracing::warn!(%node_id, "peer handshake named a tenant it is not admitted for");
                    send_frame(
                        &mut send,
                        &Frame::Error {
                            message: refusal_message().to_owned(),
                        },
                    )
                    .await?;
                    break;
                }
                session.handle(frame).await
            }
            Err(e) => Frame::Error {
                message: format!("frame parse: {e}"),
            },
        };
        send_frame(&mut send, &reply).await?;
    }

    send.finish().context("finish stream")?;
    Ok(())
}

async fn send_frame(send: &mut SendStream, frame: &Frame) -> Result<()> {
    let mut bytes = serde_json::to_vec(frame).context("encode frame")?;
    bytes.push(b'\n');
    send.write_all(&bytes).await.context("write frame")?;
    Ok(())
}

/// Dial a peer — an edge node or another device, identically.
pub async fn dial(endpoint: &Endpoint, addr: NodeAddr) -> Result<Connection> {
    endpoint.connect(addr, SYNC_ALPN).await.context("dial peer")
}
