//! Local-FS `ObjectStore`. Replaces MinIO for on-prem deploys.

use super::{ObjectStore, ObjectStoreError};
use async_trait::async_trait;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct LocalFsObjectStore {
    base: PathBuf,
}

impl LocalFsObjectStore {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    pub fn default_base() -> Self {
        Self::new("/var/lib/medbrains/objects")
    }

    /// Sanitize key: strip leading slashes, refuse `..` segments.
    fn safe_path(&self, key: &str) -> Result<PathBuf, ObjectStoreError> {
        let trimmed = key.trim_start_matches('/');
        for seg in trimmed.split('/') {
            if seg == ".." {
                return Err(ObjectStoreError::Backend(format!(
                    "path traversal rejected: {key}"
                )));
            }
        }
        Ok(self.base.join(trimmed))
    }
}

#[async_trait]
impl ObjectStore for LocalFsObjectStore {
    async fn put(
        &self,
        key: &str,
        bytes: Vec<u8>,
        _content_type: Option<&str>,
    ) -> Result<(), ObjectStoreError> {
        let path = self.safe_path(key)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| ObjectStoreError::Io(e.to_string()))?;
        }
        tokio::fs::write(&path, bytes)
            .await
            .map_err(|e| ObjectStoreError::Io(e.to_string()))
    }

    async fn get(&self, key: &str) -> Result<Vec<u8>, ObjectStoreError> {
        let path = self.safe_path(key)?;
        tokio::fs::read(&path).await.map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => ObjectStoreError::NotFound(key.to_owned()),
            _ => ObjectStoreError::Io(e.to_string()),
        })
    }

    async fn delete(&self, key: &str) -> Result<(), ObjectStoreError> {
        let path = self.safe_path(key)?;
        match tokio::fs::remove_file(&path).await {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(ObjectStoreError::Io(e.to_string())),
        }
    }

    async fn exists(&self, key: &str) -> Result<bool, ObjectStoreError> {
        let path = self.safe_path(key)?;
        Ok(tokio::fs::try_exists(&path).await.unwrap_or(false))
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn put_get_delete() {
        let dir = TempDir::new().unwrap();
        let s = LocalFsObjectStore::new(dir.path());
        s.put("a/b/c.bin", b"hello".to_vec(), None).await.unwrap();
        assert!(s.exists("a/b/c.bin").await.unwrap());
        assert_eq!(s.get("a/b/c.bin").await.unwrap(), b"hello");
        s.delete("a/b/c.bin").await.unwrap();
        assert!(!s.exists("a/b/c.bin").await.unwrap());
    }

    #[tokio::test]
    async fn rejects_path_traversal() {
        let dir = TempDir::new().unwrap();
        let s = LocalFsObjectStore::new(dir.path());
        let err = s.put("../etc/x", b"y".to_vec(), None).await.unwrap_err();
        assert!(matches!(err, ObjectStoreError::Backend(_)));
    }

    #[tokio::test]
    async fn missing_get_returns_not_found() {
        let dir = TempDir::new().unwrap();
        let s = LocalFsObjectStore::new(dir.path());
        let err = s.get("nope").await.unwrap_err();
        assert!(matches!(err, ObjectStoreError::NotFound(_)));
    }
}
