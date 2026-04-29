//! Local-FS `AuditSink`. Used in `onprem` and `hybrid` on-prem nodes.
//!
//! Layout: `<base>/<tenant_id>/<segment_id>.bin`. One file per
//! sealed segment, immutable after write (chmod 0444).

use super::{AuditSink, AuditSinkError};
use async_trait::async_trait;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct LocalFsAuditSink {
    base: PathBuf,
}

impl LocalFsAuditSink {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    pub fn default_base() -> Self {
        Self::new("/var/lib/medbrains/audit/archive")
    }

    fn segment_path(&self, tenant_id: Uuid, segment_id: Uuid) -> PathBuf {
        self.base.join(tenant_id.to_string()).join(format!("{segment_id}.bin"))
    }
}

#[async_trait]
impl AuditSink for LocalFsAuditSink {
    async fn archive_segment(
        &self,
        tenant_id: Uuid,
        segment_id: Uuid,
        sealed_bytes: Vec<u8>,
    ) -> Result<String, AuditSinkError> {
        let path = self.segment_path(tenant_id, segment_id);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AuditSinkError::Io(format!("mkdir {}: {e}", parent.display())))?;
        }

        // Idempotent: if file exists with same bytes, return the path.
        // If file exists with different bytes, that's a chain integrity
        // violation — refuse silently overwriting (NABH IMS-10
        // immutability requirement).
        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            let existing = tokio::fs::read(&path)
                .await
                .map_err(|e| AuditSinkError::Io(e.to_string()))?;
            if existing == sealed_bytes {
                return Ok(path.to_string_lossy().into_owned());
            }
            return Err(AuditSinkError::Backend(format!(
                "segment {segment_id} already archived with different bytes — chain integrity violation"
            )));
        }

        tokio::fs::write(&path, &sealed_bytes)
            .await
            .map_err(|e| AuditSinkError::Io(format!("write {}: {e}", path.display())))?;

        // chmod 0444 — immutable on disk
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = tokio::fs::metadata(&path)
                .await
                .map_err(|e| AuditSinkError::Io(e.to_string()))?
                .permissions();
            perms.set_mode(0o444);
            tokio::fs::set_permissions(&path, perms)
                .await
                .map_err(|e| AuditSinkError::Io(e.to_string()))?;
        }

        Ok(path.to_string_lossy().into_owned())
    }

    async fn fetch_segment(
        &self,
        tenant_id: Uuid,
        segment_id: Uuid,
    ) -> Result<Vec<u8>, AuditSinkError> {
        let path = self.segment_path(tenant_id, segment_id);
        tokio::fs::read(&path)
            .await
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => {
                    AuditSinkError::Io(format!("segment {segment_id} not found"))
                }
                _ => AuditSinkError::Io(format!("read {}: {e}", path.display())),
            })
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn archive_then_fetch() {
        let dir = TempDir::new().unwrap();
        let sink = LocalFsAuditSink::new(dir.path());
        let tenant = Uuid::new_v4();
        let seg = Uuid::new_v4();
        let bytes = b"sealed-segment-bytes".to_vec();
        let path = sink.archive_segment(tenant, seg, bytes.clone()).await.unwrap();
        assert!(path.contains(&seg.to_string()));
        let back = sink.fetch_segment(tenant, seg).await.unwrap();
        assert_eq!(back, bytes);
    }

    #[tokio::test]
    async fn idempotent_re_archive_same_bytes() {
        let dir = TempDir::new().unwrap();
        let sink = LocalFsAuditSink::new(dir.path());
        let tenant = Uuid::new_v4();
        let seg = Uuid::new_v4();
        let bytes = b"same".to_vec();
        let p1 = sink.archive_segment(tenant, seg, bytes.clone()).await.unwrap();
        let p2 = sink.archive_segment(tenant, seg, bytes).await.unwrap();
        assert_eq!(p1, p2);
    }

    #[tokio::test]
    async fn rejects_diff_bytes_for_existing_segment() {
        let dir = TempDir::new().unwrap();
        let sink = LocalFsAuditSink::new(dir.path());
        let tenant = Uuid::new_v4();
        let seg = Uuid::new_v4();
        sink.archive_segment(tenant, seg, b"v1".to_vec()).await.unwrap();
        let err = sink
            .archive_segment(tenant, seg, b"v2-tampered".to_vec())
            .await
            .unwrap_err();
        assert!(matches!(err, AuditSinkError::Backend(_)));
    }
}
