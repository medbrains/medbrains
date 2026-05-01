//! Cold-tier `ObjectStore` impl — gzip-compressed local FS.
//!
//! Used as the default `cold` tier on the standalone deploy. Same
//! contract as `LocalFsObjectStore` but bytes are gzip'd on the way
//! in and decompressed on the way out. Lives at a separate root
//! (`/var/lib/medbrains/cold` by convention) so the operator can
//! mount it on a cheaper / slower disk.
//!
//! Restore is instant — same machine, same kernel-cached open(2).
//! For multi-hour cold use the `glacier` adapter instead.

use super::{ObjectStore, ObjectStoreError};
use async_trait::async_trait;
use std::io::{Read, Write};
use std::path::PathBuf;
use tokio::fs;

const GZIP_SUFFIX: &str = ".gz";

#[derive(Debug, Clone)]
pub struct ColdLocalObjectStore {
    base: PathBuf,
}

impl ColdLocalObjectStore {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    pub fn default_base() -> Self {
        Self::new("/var/lib/medbrains/cold")
    }

    /// Resolve `key` to the on-disk path with `.gz` suffix. Strips
    /// leading slashes and rejects path traversal — same posture as
    /// `LocalFsObjectStore::safe_path`.
    fn safe_path(&self, key: &str) -> Result<PathBuf, ObjectStoreError> {
        let trimmed = key.trim_start_matches('/');
        for seg in trimmed.split('/') {
            if seg == ".." {
                return Err(ObjectStoreError::Backend(format!(
                    "path traversal rejected: {key}"
                )));
            }
        }
        let mut p = self.base.join(trimmed);
        let file_name = format!(
            "{}{GZIP_SUFFIX}",
            p.file_name()
                .and_then(|s| s.to_str())
                .ok_or_else(|| ObjectStoreError::Backend(format!("invalid key: {key}")))?
        );
        p.set_file_name(file_name);
        Ok(p)
    }
}

#[async_trait]
impl ObjectStore for ColdLocalObjectStore {
    async fn put(
        &self,
        key: &str,
        bytes: Vec<u8>,
        _content_type: Option<&str>,
    ) -> Result<(), ObjectStoreError> {
        let path = self.safe_path(key)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| ObjectStoreError::Io(e.to_string()))?;
        }
        let compressed = tokio::task::spawn_blocking(move || {
            use flate2::write::GzEncoder;
            use flate2::Compression;
            let mut enc = GzEncoder::new(Vec::with_capacity(bytes.len()), Compression::default());
            enc.write_all(&bytes)
                .map_err(|e| ObjectStoreError::Io(e.to_string()))?;
            enc.finish().map_err(|e| ObjectStoreError::Io(e.to_string()))
        })
        .await
        .map_err(|e| ObjectStoreError::Backend(e.to_string()))??;
        fs::write(&path, compressed)
            .await
            .map_err(|e| ObjectStoreError::Io(e.to_string()))
    }

    async fn get(&self, key: &str) -> Result<Vec<u8>, ObjectStoreError> {
        let path = self.safe_path(key)?;
        let compressed = fs::read(&path).await.map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                ObjectStoreError::NotFound(key.to_owned())
            } else {
                ObjectStoreError::Io(e.to_string())
            }
        })?;
        tokio::task::spawn_blocking(move || {
            use flate2::read::GzDecoder;
            let mut dec = GzDecoder::new(&compressed[..]);
            let mut out = Vec::new();
            dec.read_to_end(&mut out)
                .map_err(|e| ObjectStoreError::Io(e.to_string()))?;
            Ok(out)
        })
        .await
        .map_err(|e| ObjectStoreError::Backend(e.to_string()))?
    }

    async fn delete(&self, key: &str) -> Result<(), ObjectStoreError> {
        let path = self.safe_path(key)?;
        match fs::remove_file(&path).await {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                Err(ObjectStoreError::NotFound(key.to_owned()))
            }
            Err(e) => Err(ObjectStoreError::Io(e.to_string())),
        }
    }

    async fn exists(&self, key: &str) -> Result<bool, ObjectStoreError> {
        let path = self.safe_path(key)?;
        Ok(fs::try_exists(&path)
            .await
            .map_err(|e| ObjectStoreError::Io(e.to_string()))?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (ColdLocalObjectStore, TempDir) {
        let dir = TempDir::new().unwrap();
        let s = ColdLocalObjectStore::new(dir.path());
        (s, dir)
    }

    #[tokio::test]
    async fn put_get_round_trip_decompresses() {
        let (s, _td) = store();
        let payload = b"hello cold world ".repeat(64);
        s.put("docs/abc/file.bin", payload.clone(), None)
            .await
            .unwrap();
        let got = s.get("docs/abc/file.bin").await.unwrap();
        assert_eq!(got, payload);
    }

    #[tokio::test]
    async fn stored_file_is_smaller_than_input() {
        let (s, td) = store();
        // Highly compressible payload.
        let payload = vec![0u8; 64 * 1024];
        s.put("zeros.bin", payload.clone(), None).await.unwrap();
        let on_disk = std::fs::read(td.path().join("zeros.bin.gz")).unwrap();
        assert!(
            on_disk.len() < payload.len() / 4,
            "compression should yield <25% of input for zero buffer"
        );
    }

    #[tokio::test]
    async fn get_missing_returns_not_found() {
        let (s, _td) = store();
        let err = s.get("missing.bin").await.unwrap_err();
        assert!(matches!(err, ObjectStoreError::NotFound(_)));
    }

    #[tokio::test]
    async fn path_traversal_rejected() {
        let (s, _td) = store();
        let err = s.put("../escape", vec![1, 2, 3], None).await.unwrap_err();
        assert!(matches!(err, ObjectStoreError::Backend(_)));
    }

    #[tokio::test]
    async fn exists_reports_correctly() {
        let (s, _td) = store();
        assert!(!s.exists("nope").await.unwrap());
        s.put("here", b"x".to_vec(), None).await.unwrap();
        assert!(s.exists("here").await.unwrap());
        s.delete("here").await.unwrap();
        assert!(!s.exists("here").await.unwrap());
    }
}
