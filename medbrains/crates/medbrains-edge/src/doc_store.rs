//! Persistent Loro document store.
//!
//! One Loro document per (tenant_id, doc_id). The doc_id is typically
//! a row UUID for T2/T3 tables — e.g. `patient_notes/<patient_id>` or
//! `vitals/<encounter_id>`. The store persists each doc as a single
//! file under `<base>/<tenant_id>/<sanitized_doc_id>.loro`.
//!
//! Loro's snapshot encoding is forward-compatible — older readers can
//! decode newer writers' output up to additive container changes.

use loro::{ExportMode, LoroDoc};
use std::path::PathBuf;
use thiserror::Error;
use tracing::debug;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum DocStoreError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("loro: {0}")]
    Loro(String),

    #[error("doc id contains invalid characters: {0}")]
    InvalidDocId(String),
}

impl From<loro::LoroError> for DocStoreError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

impl From<loro::LoroEncodeError> for DocStoreError {
    fn from(value: loro::LoroEncodeError) -> Self {
        Self::Loro(value.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct DocStore {
    base: PathBuf,
}

impl DocStore {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    /// Default base path inside the edge appliance.
    pub fn default_base() -> Self {
        Self::new("/var/lib/medbrains-edge/docs")
    }

    fn doc_path(&self, tenant_id: Uuid, doc_id: &str) -> Result<PathBuf, DocStoreError> {
        let safe = sanitize_doc_id(doc_id)?;
        Ok(self.base.join(tenant_id.to_string()).join(format!("{safe}.loro")))
    }

    /// Load a document by id. Returns a fresh empty doc if no file
    /// exists yet.
    pub async fn load(&self, tenant_id: Uuid, doc_id: &str) -> Result<LoroDoc, DocStoreError> {
        let path = self.doc_path(tenant_id, doc_id)?;
        match tokio::fs::read(&path).await {
            Ok(bytes) => {
                let doc = LoroDoc::new();
                doc.import(&bytes)?;
                debug!(%tenant_id, doc_id, bytes = bytes.len(), "loaded doc");
                Ok(doc)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                debug!(%tenant_id, doc_id, "starting fresh doc");
                Ok(LoroDoc::new())
            }
            Err(e) => Err(DocStoreError::Io(e)),
        }
    }

    /// Persist the full snapshot. Atomic via tmp + rename so a power
    /// loss mid-write can't corrupt the file.
    pub async fn save(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        doc: &LoroDoc,
    ) -> Result<(), DocStoreError> {
        let path = self.doc_path(tenant_id, doc_id)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let snapshot = doc.export(ExportMode::Snapshot)?;
        let tmp = path.with_extension("loro.tmp");
        tokio::fs::write(&tmp, &snapshot).await?;
        tokio::fs::rename(&tmp, &path).await?;
        debug!(%tenant_id, doc_id, bytes = snapshot.len(), "saved doc");
        Ok(())
    }

    /// Apply a remote update (incremental, not a full snapshot) and
    /// persist the merged result. Returns the merged doc so callers
    /// can read post-merge state.
    pub async fn apply_update(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        update_bytes: &[u8],
    ) -> Result<LoroDoc, DocStoreError> {
        let doc = self.load(tenant_id, doc_id).await?;
        doc.import(update_bytes)?;
        self.save(tenant_id, doc_id, &doc).await?;
        Ok(doc)
    }

    /// Compute the bytes a peer needs to catch up from `their_vv`
    /// (their version vector). Used for incremental sync.
    pub async fn export_since(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        their_vv: &loro::VersionVector,
    ) -> Result<Vec<u8>, DocStoreError> {
        let doc = self.load(tenant_id, doc_id).await?;
        Ok(doc.export(ExportMode::updates(their_vv))?)
    }
}

fn sanitize_doc_id(doc_id: &str) -> Result<String, DocStoreError> {
    if doc_id.is_empty() || doc_id.len() > 200 {
        return Err(DocStoreError::InvalidDocId(doc_id.to_owned()));
    }
    let mut out = String::with_capacity(doc_id.len());
    for c in doc_id.chars() {
        match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => out.push(c),
            // ':' is the SpiceDB-style separator used by
            // [`crate::sync::parse_doc_id`]. Map to '_' on disk so the
            // filename stays portable across filesystems.
            ':' => out.push('_'),
            '/' => out.push('-'),
            _ => return Err(DocStoreError::InvalidDocId(doc_id.to_owned())),
        }
    }
    Ok(out)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn load_returns_empty_for_missing_doc() {
        let dir = TempDir::new().unwrap();
        let store = DocStore::new(dir.path());
        let doc = store.load(Uuid::new_v4(), "ptnotes-1").await.unwrap();
        // Fresh doc has empty maps/lists
        assert_eq!(doc.get_map("root").len(), 0);
    }

    #[tokio::test]
    async fn save_then_load_preserves_state() {
        let dir = TempDir::new().unwrap();
        let store = DocStore::new(dir.path());
        let tenant = Uuid::new_v4();
        let doc_id = "ptnotes-1";

        // Write something into a fresh doc
        let doc = store.load(tenant, doc_id).await.unwrap();
        doc.get_map("root").insert("text", "hello world").unwrap();
        store.save(tenant, doc_id, &doc).await.unwrap();

        // Load it back
        let loaded = store.load(tenant, doc_id).await.unwrap();
        let cv = loaded.get_map("root").get("text");
        assert!(cv.is_some(), "value present after reload");
    }

    #[tokio::test]
    async fn apply_update_merges_remote_changes() {
        let dir = TempDir::new().unwrap();
        let store = DocStore::new(dir.path());
        let tenant = Uuid::new_v4();
        let doc_id = "vitals-1";

        // Local writes "hr" reading
        let local = store.load(tenant, doc_id).await.unwrap();
        local.get_map("root").insert("hr", 72).unwrap();
        store.save(tenant, doc_id, &local).await.unwrap();

        // Remote (e.g. another nurse station) writes "spo2" concurrently
        let remote = LoroDoc::new();
        remote.get_map("root").insert("spo2", 98).unwrap();
        let remote_update = remote.export(ExportMode::Snapshot).unwrap();

        // Merge remote into local store
        let merged = store.apply_update(tenant, doc_id, &remote_update).await.unwrap();
        let m = merged.get_map("root");
        assert!(m.get("hr").is_some(), "local change preserved");
        assert!(m.get("spo2").is_some(), "remote change merged in");
    }

    #[test]
    fn rejects_bad_doc_ids() {
        let s = DocStore::new("/tmp/x");
        assert!(s.doc_path(Uuid::new_v4(), "../etc/passwd").is_err());
        assert!(s.doc_path(Uuid::new_v4(), "").is_err());
    }
}
