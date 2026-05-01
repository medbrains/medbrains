//! WSS sync server. Devices on the hospital LAN open a WebSocket to
//! the edge node and exchange Loro CRDT updates. Protocol is JSON
//! frames with a small header + base64-encoded Loro updates so a
//! browser client can use the same wire format without a binary
//! WebSocket library.
//!
//! The full server with cert pairing and per-device tag enforcement
//! is in apps/edge — this module hosts the protocol types and a
//! reusable `SyncServer` struct that ties together a `DocStore` and
//! a `MerkleAudit`. Tests at the bottom show the merge cycle.

use medbrains_offline_core::{
    AuthzCache, CacheKey, CacheSource, CheckOutcome, DenyReason, OfflinePolicy,
};
use crate::doc_store::{DocStore, DocStoreError};
use crate::merkle::{MerkleAudit, MerkleError};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tracing::warn;
use uuid::Uuid;

/// Wire frame. Versioned via [`crate::PROTOCOL_VERSION`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Frame {
    /// Client → edge: hello, here's who I am and what I have.
    Hello {
        protocol: u32,
        device_id: Uuid,
        tenant_id: Uuid,
    },
    /// Client → edge: send me incremental changes since this version.
    /// `vv_b64` is base64 of Loro version-vector bytes.
    PullSince { doc_id: String, vv_b64: String },
    /// Edge → client: here are the changes you asked for.
    PullResponse { doc_id: String, update_b64: String },
    /// Client → edge: I have new changes; please merge.
    Push { doc_id: String, update_b64: String },
    /// Edge → client: ack of a push, with my new tip hash so the
    /// client can include it in its next chain entry (forming a
    /// device-server-cloud chain).
    Ack { doc_id: String, chain_tip: String },
    /// Cloud → edge: drop these authz cache entries because their
    /// underlying SpiceDB relations changed. The edge cache is
    /// strictly read-only — it never invents grants — but it does
    /// honor invalidations pushed from the watch stream upstream.
    /// Wiring into [`SyncServer`] is deferred to the integration PR.
    CacheInvalidate { keys: Vec<CacheKey> },
    /// Edge → cloud (future): result of an offline authz check, so
    /// cloud can replay decisions for audit. Carried as a frame here
    /// to lock the wire shape; the producer is the integration PR.
    AuthzCheckResult {
        key: CacheKey,
        allowed: bool,
        source: CacheSource,
    },
    /// Either side can send a structured error.
    Error { message: String },
}

#[derive(Debug, Error)]
pub enum SyncServerError {
    #[error(transparent)]
    DocStore(#[from] DocStoreError),

    #[error(transparent)]
    Merkle(#[from] MerkleError),

    #[error("base64 decode: {0}")]
    Base64(String),

    #[error("loro: {0}")]
    Loro(String),

    /// Caller failed offline authz check. Carries the deny reason so
    /// the WSS layer can map it to a `Frame::Error` with a useful
    /// payload.
    #[error("offline authz denied: {0:?}")]
    AuthzDenied(DenyReason),

    #[error("invalid doc_id shape: {0}")]
    InvalidDocId(String),
}

impl From<loro::LoroError> for SyncServerError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

/// Per-connection state established at Hello time: who the user is
/// and what the JWT said they can do. Threaded into authorized push
/// so the offline cache check has the same inputs as the cloud.
#[derive(Debug, Clone)]
pub struct SessionContext {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub jwt_permissions: Vec<String>,
    pub policy: OfflinePolicy,
}

/// Mounts a `DocStore` + `MerkleAudit` and handles each protocol
/// frame. Stateless w.r.t. clients — every frame carries the
/// tenant + doc context. The `authz` cache is optional: when absent,
/// `handle_push_authorized` is unavailable but `handle_push` still
/// works for callers that have already authorized upstream.
#[derive(Debug, Clone)]
pub struct SyncServer {
    pub docs: Arc<DocStore>,
    pub audit: Arc<MerkleAudit>,
    pub authz: Option<Arc<AuthzCache>>,
}

impl SyncServer {
    pub fn new(docs: DocStore, audit: MerkleAudit) -> Self {
        Self {
            docs: Arc::new(docs),
            audit: Arc::new(audit),
            authz: None,
        }
    }

    /// Variant that wires an [`AuthzCache`] for offline gating.
    pub fn with_authz(docs: DocStore, audit: MerkleAudit, authz: Arc<AuthzCache>) -> Self {
        Self {
            docs: Arc::new(docs),
            audit: Arc::new(audit),
            authz: Some(authz),
        }
    }

    /// Apply a Push frame. Returns the Ack frame to send back.
    pub async fn handle_push(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        update_b64: &str,
    ) -> Result<Frame, SyncServerError> {
        let bytes = base64_decode(update_b64).map_err(SyncServerError::Base64)?;
        // Append to audit chain BEFORE applying so we have a record
        // even if the merge fails downstream.
        let entry = self.audit.append(tenant_id, doc_id, "push", &bytes).await?;
        let _doc = self.docs.apply_update(tenant_id, doc_id, &bytes).await?;
        Ok(Frame::Ack {
            doc_id: doc_id.to_owned(),
            chain_tip: entry.entry_hash,
        })
    }

    /// Authorized variant: consults the offline [`AuthzCache`] before
    /// applying. Every check — allow or deny — is appended to the
    /// Merkle chain as an `authz.offline_check` entry so the cloud
    /// can replay decisions during reconciliation.
    ///
    /// Returns `SyncServerError::AuthzDenied` on deny, leaving the
    /// doc store untouched. The caller (WSS layer) should map this
    /// to `Frame::Error` for the client.
    pub async fn handle_push_authorized(
        &self,
        session: &SessionContext,
        doc_id: &str,
        update_b64: &str,
    ) -> Result<Frame, SyncServerError> {
        let Some(ref authz) = self.authz else {
            // No cache wired — fall back to raw push. Callers using
            // `with_authz` get gating; callers using `new` don't.
            return self
                .handle_push(session.tenant_id, doc_id, update_b64)
                .await;
        };

        let (object_type, object_id, action) = parse_doc_id(doc_id)
            .ok_or_else(|| SyncServerError::InvalidDocId(doc_id.to_owned()))?;

        let key = CacheKey {
            tenant_id: session.tenant_id,
            user_id: session.user_id,
            object_type,
            object_id,
            action,
        };

        let outcome = authz.check_offline(&key, &session.jwt_permissions, session.policy);
        self.append_authz_audit(session.tenant_id, doc_id, &key, &outcome)
            .await?;

        match outcome {
            CheckOutcome::Allow { .. } => {
                self.handle_push(session.tenant_id, doc_id, update_b64).await
            }
            CheckOutcome::Deny { reason } => Err(SyncServerError::AuthzDenied(reason)),
        }
    }

    async fn append_authz_audit(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        key: &CacheKey,
        outcome: &CheckOutcome,
    ) -> Result<(), SyncServerError> {
        let (allowed, source, reason) = match outcome {
            CheckOutcome::Allow { source } => (true, Some(*source), None),
            CheckOutcome::Deny { reason } => (false, None, Some(*reason)),
        };
        let payload = serde_json::json!({
            "key": key,
            "allowed": allowed,
            "source": source,
            "reason": reason.map(|r| format!("{r:?}")),
        });
        let bytes = serde_json::to_vec(&payload).unwrap_or_default();
        self.audit
            .append(tenant_id, doc_id, "authz.offline_check", &bytes)
            .await?;
        Ok(())
    }

    /// Apply a PullSince frame. Returns the PullResponse.
    pub async fn handle_pull(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        vv_b64: &str,
    ) -> Result<Frame, SyncServerError> {
        let vv_bytes = base64_decode(vv_b64).map_err(SyncServerError::Base64)?;
        let their_vv = loro::VersionVector::decode(&vv_bytes).map_err(|e| {
            warn!(?e, "version vector decode failed");
            SyncServerError::Loro(e.to_string())
        })?;
        let update = self.docs.export_since(tenant_id, doc_id, &their_vv).await?;
        Ok(Frame::PullResponse {
            doc_id: doc_id.to_owned(),
            update_b64: base64_encode(&update),
        })
    }
}

/// Parse a `doc_id` into the `SpiceDB` tuple shape `(object_type,
/// object_id, action)`.
///
/// Convention used by edge clients and the cloud relay:
///
/// - `obj_type:obj_id`               → action defaults to `write`
/// - `obj_type:obj_id:action_suffix` → action = `action_suffix`
///
/// Examples:
/// - `vitals:550e8400-e29b-41d4-a716-446655440000` →
///   `("vitals", uuid, "write")`
/// - `patient:abc:notes`             → `("patient", "abc", "notes")`
///
/// Returns `None` if the `doc_id` has zero or one segment, or any
/// segment is empty.
fn parse_doc_id(doc_id: &str) -> Option<(String, String, String)> {
    let mut parts = doc_id.splitn(3, ':');
    let object_type = parts.next()?;
    let object_id = parts.next()?;
    if object_type.is_empty() || object_id.is_empty() {
        return None;
    }
    let action = parts.next().unwrap_or("write");
    if action.is_empty() {
        return None;
    }
    Some((object_type.to_owned(), object_id.to_owned(), action.to_owned()))
}

// Local tiny base64 (no extra dep — sha2 is already pulled in).
fn base64_encode(bytes: &[u8]) -> String {
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() * 4 / 3) + 4);
    let mut buf = 0u32;
    let mut buf_len = 0u32;
    for &b in bytes {
        buf = (buf << 8) | u32::from(b);
        buf_len += 8;
        while buf_len >= 6 {
            buf_len -= 6;
            let idx = ((buf >> buf_len) & 0x3F) as usize;
            out.push(alphabet[idx] as char);
        }
    }
    if buf_len > 0 {
        let idx = ((buf << (6 - buf_len)) & 0x3F) as usize;
        out.push(alphabet[idx] as char);
    }
    while out.len() % 4 != 0 {
        out.push('=');
    }
    out
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    let mut lookup = [255u8; 256];
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i, &c) in alphabet.iter().enumerate() {
        lookup[c as usize] = i as u8;
    }
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf = 0u32;
    let mut buf_len = 0u32;
    for c in s.bytes() {
        if c == b'=' {
            break;
        }
        let v = lookup[c as usize];
        if v == 255 {
            return Err(format!("invalid base64 char: {c}"));
        }
        buf = (buf << 6) | u32::from(v);
        buf_len += 6;
        if buf_len >= 8 {
            buf_len -= 8;
            out.push(((buf >> buf_len) & 0xFF) as u8);
        }
    }
    Ok(out)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;
    use loro::{ExportMode, LoroDoc};
    use tempfile::TempDir;

    fn server() -> (SyncServer, TempDir) {
        let dir = TempDir::new().unwrap();
        let docs = DocStore::new(dir.path().join("docs"));
        let audit = MerkleAudit::new(dir.path().join("chain"));
        (SyncServer::new(docs, audit), dir)
    }

    #[tokio::test]
    async fn push_then_pull_roundtrip() {
        let (srv, _td) = server();
        let tenant = Uuid::new_v4();
        let doc_id = "ptnotes-roundtrip";

        // Client A does a Push
        let local = LoroDoc::new();
        local.get_map("root").insert("hr", 80).unwrap();
        let upd = local.export(ExportMode::Snapshot).unwrap();
        let frame = srv
            .handle_push(tenant, doc_id, &base64_encode(&upd))
            .await
            .unwrap();
        match frame {
            Frame::Ack {
                doc_id: d,
                chain_tip,
            } => {
                assert_eq!(d, doc_id);
                assert!(!chain_tip.is_empty());
            }
            other => panic!("expected Ack got {other:?}"),
        }

        // Client B pulls from scratch (empty version vector)
        let empty_vv = loro::VersionVector::default();
        let vv_bytes = empty_vv.encode();
        let frame = srv
            .handle_pull(tenant, doc_id, &base64_encode(&vv_bytes))
            .await
            .unwrap();
        match frame {
            Frame::PullResponse { update_b64, .. } => {
                let bytes = base64_decode(&update_b64).unwrap();
                let merged = LoroDoc::new();
                merged.import(&bytes).unwrap();
                assert!(merged.get_map("root").get("hr").is_some());
            }
            other => panic!("expected PullResponse got {other:?}"),
        }
    }

    #[tokio::test]
    async fn concurrent_pushes_merge_without_conflict() {
        let (srv, _td) = server();
        let tenant = Uuid::new_v4();
        let doc_id = "ptnotes-merge";

        // Client A writes "hr"
        let a = LoroDoc::new();
        a.get_map("root").insert("hr", 80).unwrap();
        let a_upd = a.export(ExportMode::Snapshot).unwrap();
        srv.handle_push(tenant, doc_id, &base64_encode(&a_upd))
            .await
            .unwrap();

        // Client B writes "spo2" without seeing A's changes
        let b = LoroDoc::new();
        b.get_map("root").insert("spo2", 98).unwrap();
        let b_upd = b.export(ExportMode::Snapshot).unwrap();
        srv.handle_push(tenant, doc_id, &base64_encode(&b_upd))
            .await
            .unwrap();

        // Pull merged state from server
        let empty_vv = loro::VersionVector::default();
        let vv_bytes = empty_vv.encode();
        let frame = srv
            .handle_pull(tenant, doc_id, &base64_encode(&vv_bytes))
            .await
            .unwrap();
        if let Frame::PullResponse { update_b64, .. } = frame {
            let bytes = base64_decode(&update_b64).unwrap();
            let merged = LoroDoc::new();
            merged.import(&bytes).unwrap();
            let m = merged.get_map("root");
            assert!(m.get("hr").is_some(), "hr from client A preserved");
            assert!(m.get("spo2").is_some(), "spo2 from client B preserved");
        } else {
            panic!("expected PullResponse");
        }
    }

    #[test]
    fn base64_roundtrip() {
        let data = b"hello \x00\xff world";
        let s = base64_encode(data);
        let back = base64_decode(&s).unwrap();
        assert_eq!(back, data);
    }

    #[test]
    fn parse_doc_id_two_segments_defaults_action_write() {
        let (ot, oid, act) = parse_doc_id("vitals:abc-123").unwrap();
        assert_eq!(ot, "vitals");
        assert_eq!(oid, "abc-123");
        assert_eq!(act, "write");
    }

    #[test]
    fn parse_doc_id_three_segments_uses_explicit_action() {
        let (ot, oid, act) = parse_doc_id("patient:p1:notes").unwrap();
        assert_eq!(ot, "patient");
        assert_eq!(oid, "p1");
        assert_eq!(act, "notes");
    }

    #[test]
    fn parse_doc_id_rejects_short_or_empty() {
        assert!(parse_doc_id("vitals").is_none());
        assert!(parse_doc_id(":abc").is_none());
        assert!(parse_doc_id("vitals:").is_none());
        assert!(parse_doc_id("vitals:abc:").is_none());
    }

    fn server_with_authz() -> (SyncServer, TempDir) {
        let dir = TempDir::new().unwrap();
        let docs = DocStore::new(dir.path().join("docs"));
        let audit = MerkleAudit::new(dir.path().join("chain"));
        let cache = AuthzCache::new(
            &dir.path().join("authz"),
            64,
            std::time::Duration::from_secs(60),
        )
        .unwrap();
        let srv = SyncServer::with_authz(docs, audit, Arc::new(cache));
        (srv, dir)
    }

    fn make_session(policy: OfflinePolicy, perms: &[&str]) -> SessionContext {
        SessionContext {
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            jwt_permissions: perms.iter().map(|s| (*s).to_owned()).collect(),
            policy,
        }
    }

    #[tokio::test]
    async fn push_denied_when_user_lacks_permission() {
        let (srv, _td) = server_with_authz();
        let session = make_session(OfflinePolicy::CacheOnly, &[]);
        let doc_id = "vitals:patient-xyz";

        let local = LoroDoc::new();
        local.get_map("root").insert("hr", 80).unwrap();
        let upd = local.export(ExportMode::Snapshot).unwrap();
        let result = srv
            .handle_push_authorized(&session, doc_id, &base64_encode(&upd))
            .await;

        match result {
            Err(SyncServerError::AuthzDenied(DenyReason::CacheMissStrict)) => {}
            other => panic!("expected AuthzDenied(CacheMissStrict), got {other:?}"),
        }

        // Doc store must be untouched on deny.
        let empty_vv = loro::VersionVector::default();
        let vv_bytes = empty_vv.encode();
        let frame = srv
            .handle_pull(session.tenant_id, doc_id, &base64_encode(&vv_bytes))
            .await
            .unwrap();
        if let Frame::PullResponse { update_b64, .. } = frame {
            let bytes = base64_decode(&update_b64).unwrap();
            let merged = LoroDoc::new();
            merged.import(&bytes).unwrap();
            assert!(
                merged.get_map("root").get("hr").is_none(),
                "denied push leaked into doc store"
            );
        } else {
            panic!("expected PullResponse");
        }
    }

    #[tokio::test]
    async fn push_allowed_via_jwt_fallback() {
        let (srv, _td) = server_with_authz();
        let session = make_session(OfflinePolicy::CacheThenJwt, &["vitals.write"]);
        let doc_id = "vitals:patient-xyz";

        let local = LoroDoc::new();
        local.get_map("root").insert("hr", 80).unwrap();
        let upd = local.export(ExportMode::Snapshot).unwrap();
        let frame = srv
            .handle_push_authorized(&session, doc_id, &base64_encode(&upd))
            .await
            .unwrap();
        match frame {
            Frame::Ack { .. } => {}
            other => panic!("expected Ack got {other:?}"),
        }
    }

    #[tokio::test]
    async fn online_required_action_denied_offline() {
        let (srv, _td) = server_with_authz();
        // Even with a permissive JWT the prescription.sign action
        // must deny offline — it's on the ONLINE_REQUIRED list.
        let session = make_session(
            OfflinePolicy::CacheThenJwt,
            &["prescription.sign", "prescription.write"],
        );
        let doc_id = "prescription:rx-1:sign";

        let local = LoroDoc::new();
        local.get_map("root").insert("k", "v").unwrap();
        let upd = local.export(ExportMode::Snapshot).unwrap();
        let result = srv
            .handle_push_authorized(&session, doc_id, &base64_encode(&upd))
            .await;
        match result {
            Err(SyncServerError::AuthzDenied(DenyReason::OnlineRequired)) => {}
            other => panic!("expected OnlineRequired deny, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn invalid_doc_id_rejected() {
        let (srv, _td) = server_with_authz();
        let session = make_session(OfflinePolicy::CacheThenJwt, &["vitals.write"]);
        let result = srv
            .handle_push_authorized(&session, "no-colon-here", "")
            .await;
        match result {
            Err(SyncServerError::InvalidDocId(_)) => {}
            other => panic!("expected InvalidDocId, got {other:?}"),
        }
    }
}
