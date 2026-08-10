//! Transport-agnostic sync session.
//!
//! The frame state machine used to live inside the WebSocket accept loop in
//! `apps/edge`, tangled with `tungstenite` types. That made it untestable
//! without a socket, and it made a second transport impossible without copying
//! the protocol — which is how two transports drift apart and start disagreeing
//! about who is allowed to push what.
//!
//! It is a plain state machine here: frames in, frames out, tenant held across
//! the connection. A caller supplies the bytes, whether they arrive over a
//! WebSocket on the hospital LAN or a QUIC stream from a device that could not
//! find the LAN at all.
//!
//! The authorisation path is unchanged and non-negotiable: every push and pull
//! still goes through [`SyncServer`], which holds the tenant context and the
//! authz cache. A transport can only deliver frames; it can never widen what a
//! frame is permitted to do.

use std::sync::Arc;

use uuid::Uuid;

use crate::sync::{Frame, SyncServer};

/// One client connection's worth of state.
///
/// Deliberately tiny: the only thing a session remembers is which tenant
/// completed the handshake. Everything else is per-frame, so a dropped
/// connection cannot leave a half-authorised session behind.
pub struct SyncSession {
    server: Arc<SyncServer>,
    tenant: Option<Uuid>,
}

impl SyncSession {
    pub const fn new(server: Arc<SyncServer>) -> Self {
        Self {
            server,
            tenant: None,
        }
    }

    /// The tenant this session speaks for, once `Hello` has succeeded.
    pub const fn tenant(&self) -> Option<Uuid> {
        self.tenant
    }

    /// Handle one frame and produce the reply.
    ///
    /// Never returns an error: a protocol fault is answered with
    /// [`Frame::Error`] and the connection stays open, because dropping the
    /// socket on a bad frame costs a field device its whole sync round for one
    /// malformed message.
    pub async fn handle(&mut self, frame: Frame) -> Frame {
        match (frame, self.tenant) {
            (
                Frame::Hello {
                    protocol,
                    tenant_id,
                    ..
                },
                _,
            ) => {
                if protocol == crate::PROTOCOL_VERSION {
                    self.tenant = Some(tenant_id);
                    Frame::Ack {
                        doc_id: String::new(),
                        chain_tip: String::new(),
                    }
                } else {
                    Frame::Error {
                        message: format!(
                            "protocol mismatch: server={}, client={protocol}",
                            crate::PROTOCOL_VERSION
                        ),
                    }
                }
            }
            (Frame::Push { doc_id, update_b64 }, Some(tenant)) => self
                .server
                .handle_push(tenant, &doc_id, &update_b64)
                .await
                .unwrap_or_else(|e| Frame::Error {
                    message: format!("push: {e}"),
                }),
            (Frame::PullSince { doc_id, vv_b64 }, Some(tenant)) => self
                .server
                .handle_pull(tenant, &doc_id, &vv_b64)
                .await
                .unwrap_or_else(|e| Frame::Error {
                    message: format!("pull: {e}"),
                }),
            // The gate. A push or pull before a completed handshake has no
            // tenant, and without a tenant there is no row-level security to
            // apply — so it is refused rather than defaulted.
            (_, None) => Frame::Error {
                message: "send Hello first".to_owned(),
            },
            (other, _) => Frame::Error {
                message: format!("unexpected frame: {other:?}"),
            },
        }
    }
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::{DocStore, MerkleAudit};

    fn session(dir: &tempfile::TempDir) -> SyncSession {
        let server = SyncServer::new(DocStore::new(dir.path()), MerkleAudit::new(dir.path()));
        SyncSession::new(Arc::new(server))
    }

    fn hello(protocol: u32, tenant: Uuid) -> Frame {
        Frame::Hello {
            protocol,
            device_id: Uuid::new_v4(),
            tenant_id: tenant,
        }
    }

    /// The gate that matters. Without a completed handshake there is no tenant,
    /// and without a tenant there is no row-level security to apply — so a push
    /// must be refused rather than defaulted to something.
    #[tokio::test]
    async fn a_push_before_hello_is_refused() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);

        let reply = s
            .handle(Frame::Push {
                doc_id: "t/patients/1".to_owned(),
                update_b64: String::new(),
            })
            .await;

        assert!(
            matches!(reply, Frame::Error { ref message } if message.contains("Hello")),
            "a push with no tenant must be refused, not applied: {reply:?}"
        );
        assert!(s.tenant().is_none(), "and it must not establish a session");
    }

    #[tokio::test]
    async fn a_pull_before_hello_is_refused() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);

        let reply = s
            .handle(Frame::PullSince {
                doc_id: "t/patients/1".to_owned(),
                vv_b64: String::new(),
            })
            .await;

        assert!(matches!(reply, Frame::Error { .. }), "got {reply:?}");
    }

    #[tokio::test]
    async fn a_matching_protocol_opens_the_session() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);
        let tenant = Uuid::new_v4();

        let reply = s.handle(hello(crate::PROTOCOL_VERSION, tenant)).await;

        assert!(matches!(reply, Frame::Ack { .. }), "got {reply:?}");
        assert_eq!(s.tenant(), Some(tenant));
    }

    /// A version mismatch must not leave a usable session behind. Two peers
    /// disagreeing about the wire format is exactly when silently continuing
    /// corrupts a document.
    #[tokio::test]
    async fn a_protocol_mismatch_leaves_no_session() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);

        let reply = s
            .handle(hello(crate::PROTOCOL_VERSION + 1, Uuid::new_v4()))
            .await;

        assert!(
            matches!(reply, Frame::Error { ref message } if message.contains("protocol mismatch")),
            "got {reply:?}"
        );
        assert!(
            s.tenant().is_none(),
            "a rejected handshake must not authorise anything"
        );
    }

    /// A second Hello re-points the session at a different tenant.
    ///
    /// Pinned deliberately: whichever way this behaves, a transport must not be
    /// able to change it. If it is ever tightened to refuse re-handshakes, this
    /// test is where that decision gets recorded.
    #[tokio::test]
    async fn a_second_hello_rebinds_the_tenant() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        s.handle(hello(crate::PROTOCOL_VERSION, first)).await;
        assert_eq!(s.tenant(), Some(first));

        s.handle(hello(crate::PROTOCOL_VERSION, second)).await;
        assert_eq!(s.tenant(), Some(second));
    }

    /// A malformed exchange answers and stays open. Dropping the connection on
    /// one bad frame costs a field device its whole sync round.
    #[tokio::test]
    async fn an_unexpected_frame_answers_without_closing() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut s = session(&dir);
        let tenant = Uuid::new_v4();
        s.handle(hello(crate::PROTOCOL_VERSION, tenant)).await;

        let reply = s
            .handle(Frame::Ack {
                doc_id: String::new(),
                chain_tip: String::new(),
            })
            .await;

        assert!(matches!(reply, Frame::Error { .. }), "got {reply:?}");
        assert_eq!(
            s.tenant(),
            Some(tenant),
            "a bad frame must not tear down a valid session"
        );
    }
}
