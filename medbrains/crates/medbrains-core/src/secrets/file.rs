//! File-based `SecretResolver`. Used in `onprem` and `hybrid` on-prem
//! deploy modes.
//!
//! Reads from `/etc/medbrains/secrets/<key>.txt` (one file per secret,
//! plain text after Flux/sops decryption). Files are 0640 owned by
//! the medbrains user. The decryption itself is sops's job — by the
//! time we read here, the values are plain.
//!
//! Why one-file-per-secret instead of a single .env: lets sops-encrypt
//! per-key with different recipients (some secrets only the DBA
//! decrypts; some only the DevOps team) and lets Flux refresh one
//! without restarting the binary.

use super::{SecretError, SecretResolver};
use async_trait::async_trait;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct FileSecretResolver {
    base: PathBuf,
}

impl FileSecretResolver {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    /// Default base path on Linux hosts.
    pub fn default_base() -> Self {
        Self::new("/etc/medbrains/secrets")
    }

    /// Translate a logical key into a file path. Slashes and dots
    /// are replaced with hyphens so we don't accidentally create
    /// nested dirs OR enable `..` traversal from untrusted input.
    /// `medbrains/dev/global/foo` → `<base>/medbrains-dev-global-foo.txt`.
    fn path_for(&self, key: &str) -> PathBuf {
        let safe: String = key
            .chars()
            .map(|c| match c {
                'a'..='z' | 'A'..='Z' | '0'..='9' | '-' => c,
                _ => '-',
            })
            .collect();
        self.base.join(format!("{safe}.txt"))
    }
}

#[async_trait]
impl SecretResolver for FileSecretResolver {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        let path = self.path_for(key);
        let bytes = tokio::fs::read(&path)
            .await
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => SecretError::NotFound(key.to_owned()),
                _ => SecretError::Io(format!("{}: {e}", path.display())),
            })?;
        let s = String::from_utf8(bytes).map_err(|e| SecretError::Parse(e.to_string()))?;
        Ok(s.trim_end_matches(['\n', '\r']).to_owned())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn reads_secret_file() {
        let dir = TempDir::new().unwrap();
        let r = FileSecretResolver::new(dir.path());
        let key = "medbrains/dev/global/foo";
        let p = r.path_for(key);
        std::fs::write(&p, "hunter2\n").unwrap();
        assert_eq!(r.get(key).await.unwrap(), "hunter2");
    }

    #[tokio::test]
    async fn missing_returns_not_found() {
        let dir = TempDir::new().unwrap();
        let r = FileSecretResolver::new(dir.path());
        let err = r.get("medbrains/dev/missing").await.unwrap_err();
        assert!(matches!(err, SecretError::NotFound(_)));
    }

    #[test]
    fn path_sanitizes_slashes() {
        let r = FileSecretResolver::new("/x");
        let p = r.path_for("medbrains/dev/global/foo");
        assert_eq!(
            p.to_string_lossy(),
            "/x/medbrains-dev-global-foo.txt"
        );
    }

    #[test]
    fn path_blocks_path_traversal() {
        let r = FileSecretResolver::new("/x");
        let p = r.path_for("../../etc/passwd");
        assert!(!p.to_string_lossy().contains(".."));
        assert!(!p.to_string_lossy().contains("etc/passwd"));
    }
}
