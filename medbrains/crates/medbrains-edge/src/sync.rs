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
    PullSince {
        doc_id: String,
        vv_b64: String,
    },
    /// Edge → client: here are the changes you asked for.
    PullResponse {
        doc_id: String,
        update_b64: String,
    },
    /// Client → edge: I have new changes; please merge.
    Push {
        doc_id: String,
        update_b64: String,
    },
    /// Edge → client: ack of a push, with my new tip hash so the
    /// client can include it in its next chain entry (forming a
    /// device-server-cloud chain).
    Ack {
        doc_id: String,
        chain_tip: String,
    },
    /// Either side can send a structured error.
    Error {
        message: String,
    },
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
}

impl From<loro::LoroError> for SyncServerError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

/// Mounts a `DocStore` + `MerkleAudit` and handles each protocol
/// frame. Stateless w.r.t. clients — every frame carries the
/// tenant + doc context.
#[derive(Debug, Clone)]
pub struct SyncServer {
    pub docs: Arc<DocStore>,
    pub audit: Arc<MerkleAudit>,
}

impl SyncServer {
    pub fn new(docs: DocStore, audit: MerkleAudit) -> Self {
        Self {
            docs: Arc::new(docs),
            audit: Arc::new(audit),
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
        let entry = self
            .audit
            .append(tenant_id, doc_id, "push", &bytes)
            .await?;
        let _doc = self
            .docs
            .apply_update(tenant_id, doc_id, &bytes)
            .await?;
        Ok(Frame::Ack {
            doc_id: doc_id.to_owned(),
            chain_tip: entry.entry_hash,
        })
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
#[allow(clippy::unwrap_used, clippy::expect_used)]
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
            Frame::Ack { doc_id: d, chain_tip } => {
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
        srv.handle_push(tenant, doc_id, &base64_encode(&a_upd)).await.unwrap();

        // Client B writes "spo2" without seeing A's changes
        let b = LoroDoc::new();
        b.get_map("root").insert("spo2", 98).unwrap();
        let b_upd = b.export(ExportMode::Snapshot).unwrap();
        srv.handle_push(tenant, doc_id, &base64_encode(&b_upd)).await.unwrap();

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
}
