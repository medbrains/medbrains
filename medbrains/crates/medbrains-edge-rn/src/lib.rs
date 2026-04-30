//! React Native bridge for the Loro CRDT engine.
//!
//! Phase 12 of the hybrid roadmap. Same Rust core that powers the
//! `medbrains-edge` server now compiles for iOS (staticlib) and
//! Android (cdylib) so the mobile + TV apps run the *same* CRDT
//! conflict-resolution code as web — no JS-side reimplementation
//! that could drift.
//!
//! UniFFI generates Kotlin, Swift, and TypeScript bindings from
//! `edge_rn.udl`. The TS binding is consumed by React Native via
//! `uniffi-bindgen-react-native` (deferred to the mobile-app PR).
//!
//! What this crate explicitly does NOT do:
//! - WebSocket transport (handled by the existing JS layer; the
//!   Rust core stays transport-free)
//! - Per-doc persistence to disk (the mobile app picks a storage
//!   location — defaults to RN's documents directory — and feeds
//!   bytes in/out via `apply_update` / `export_since`)
//! - Authz cache (lives in `medbrains-edge::authz_cache` and runs on
//!   the on-prem edge server, not on every device)

use std::sync::{Arc, Mutex};
use thiserror::Error;

uniffi::include_scaffolding!("edge_rn");

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("doc not found")]
    DocNotFound,

    #[error("invalid update")]
    InvalidUpdate,

    #[error("invalid version vector")]
    InvalidVersionVector,

    #[error("loro: {0}")]
    Loro(String),

    #[error("serde: {0}")]
    Serde(String),
}

impl From<loro::LoroError> for BridgeError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

impl From<loro::LoroEncodeError> for BridgeError {
    fn from(value: loro::LoroEncodeError) -> Self {
        Self::Loro(format!("encode: {value}"))
    }
}

impl From<serde_json::Error> for BridgeError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct AppendItem {
    pub json_value: String,
}

#[derive(Debug, Clone)]
pub struct TextSnapshot {
    pub text: String,
    pub version_vector: Vec<u8>,
}

/// Opaque handle the mobile/TV app holds for the lifetime of a
/// document mount. UniFFI requires interface impls to be `Send +
/// Sync`; `LoroDoc` itself is `Send` but not `Sync`, so we wrap in
/// `Mutex`. Doc updates are short — measured in microseconds at the
/// CRDT layer — so contention is fine.
pub struct DocHandle {
    inner: Arc<Mutex<loro::LoroDoc>>,
    doc_id: String,
}

impl DocHandle {
    pub fn new(doc_id: String) -> Result<Self, BridgeError> {
        Ok(Self {
            inner: Arc::new(Mutex::new(loro::LoroDoc::new())),
            doc_id,
        })
    }

    pub fn doc_id(&self) -> String {
        self.doc_id.clone()
    }

    pub fn apply_update(&self, update_bytes: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        doc.import(&update_bytes)?;
        Ok(doc.oplog_vv().encode())
    }

    pub fn export_since(&self, their_vv: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let vv = loro::VersionVector::decode(&their_vv)
            .map_err(|_| BridgeError::InvalidVersionVector)?;
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.export(loro::ExportMode::updates(&vv))?)
    }

    pub fn version_vector(&self) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.oplog_vv().encode())
    }

    /// Append a JSON-encoded item to a Loro list container, matching
    /// the wire format the web hook expects.
    pub fn append_to_list(
        &self,
        container_name: String,
        item: AppendItem,
    ) -> Result<Vec<u8>, BridgeError> {
        let value: serde_json::Value = serde_json::from_str(&item.json_value)?;
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        list.push(loro::LoroValue::String(serde_json::to_string(&value)?.into()))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn list_entries(&self, container_name: String) -> Result<Vec<String>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        let mut out = Vec::with_capacity(list.len());
        for i in 0..list.len() {
            if let Some(v) = list.get(i) {
                if let Some(s) = value_or_container_as_string(&v) {
                    out.push(s);
                }
            }
        }
        Ok(out)
    }

    /// Replace the text container's contents with `new_text`. Loro's
    /// text container handles diff/merge internally.
    pub fn set_text(
        &self,
        container_name: String,
        new_text: String,
    ) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        text.update(&new_text, loro::UpdateOptions::default())
            .map_err(|e| BridgeError::Loro(format!("text update: {e}")))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn read_text(&self, container_name: String) -> Result<TextSnapshot, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        Ok(TextSnapshot {
            text: text.to_string(),
            version_vector: doc.oplog_vv().encode(),
        })
    }
}

fn value_or_container_as_string(v: &loro::ValueOrContainer) -> Option<String> {
    match v {
        loro::ValueOrContainer::Value(loro::LoroValue::String(s)) => Some(s.to_string()),
        _ => None,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn doc_handle_carries_id() {
        let h = DocHandle::new("vitals:abc".into()).unwrap();
        assert_eq!(h.doc_id(), "vitals:abc");
    }

    #[test]
    fn append_then_list_roundtrip() {
        let h = DocHandle::new("notes:xyz".into()).unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem { json_value: r#"{"note":"first"}"#.to_owned() },
        )
        .unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem { json_value: r#"{"note":"second"}"#.to_owned() },
        )
        .unwrap();
        let entries = h.list_entries("entries".into()).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].contains("first"));
        assert!(entries[1].contains("second"));
    }

    #[test]
    fn text_set_then_read() {
        let h = DocHandle::new("doc:1".into()).unwrap();
        h.set_text("body".into(), "hello".into()).unwrap();
        let snap = h.read_text("body".into()).unwrap();
        assert_eq!(snap.text, "hello");
        assert!(!snap.version_vector.is_empty());
    }

    #[test]
    fn export_apply_roundtrip_between_handles() {
        // Two devices simulated by two DocHandles. The update from
        // A applies cleanly into B and vice versa — the merge is
        // commutative which is the whole point of CRDTs.
        let a = DocHandle::new("shared".into()).unwrap();
        let b = DocHandle::new("shared".into()).unwrap();

        a.append_to_list(
            "log".into(),
            AppendItem { json_value: r#"{"v":1}"#.to_owned() },
        )
        .unwrap();
        let empty_vv = loro::VersionVector::default().encode();
        let a_to_b = a.export_since(empty_vv.clone()).unwrap();
        b.apply_update(a_to_b).unwrap();

        b.append_to_list(
            "log".into(),
            AppendItem { json_value: r#"{"v":2}"#.to_owned() },
        )
        .unwrap();
        let b_to_a = b.export_since(empty_vv).unwrap();
        a.apply_update(b_to_a).unwrap();

        let final_a = a.list_entries("log".into()).unwrap();
        let final_b = b.list_entries("log".into()).unwrap();
        assert_eq!(final_a.len(), 2);
        assert_eq!(final_b.len(), 2);
        // Same membership — order is implementation-defined for
        // append-only lists during merge but membership is invariant.
        let mut sorted_a = final_a.clone();
        sorted_a.sort();
        let mut sorted_b = final_b.clone();
        sorted_b.sort();
        assert_eq!(sorted_a, sorted_b);
    }

    #[test]
    fn version_vector_advances_on_write() {
        let h = DocHandle::new("doc".into()).unwrap();
        let vv0 = h.version_vector().unwrap();
        h.append_to_list(
            "log".into(),
            AppendItem { json_value: "true".into() },
        )
        .unwrap();
        let vv1 = h.version_vector().unwrap();
        assert_ne!(vv0, vv1, "VV must advance after a write");
    }

    #[test]
    fn invalid_version_vector_returns_typed_error() {
        let h = DocHandle::new("doc".into()).unwrap();
        let err = h.export_since(vec![0xff, 0xfe, 0xfd]).unwrap_err();
        assert!(matches!(err, BridgeError::InvalidVersionVector));
    }
}
