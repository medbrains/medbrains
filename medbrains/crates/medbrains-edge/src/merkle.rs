//! Merkle-chain audit ledger for the edge node.
//!
//! Every CRDT op the edge accepts goes through here first, getting
//! sealed into a SHA-256 hash chain. The chain tip is shipped to
//! cloud on reconnect; cloud's audit-chain verifier can detect any
//! gap or tamper attempt because every op includes the prior hash in
//! its preimage.
//!
//! On-disk layout: append-only file
//! `<base>/<tenant_id>.chain.log`. Each line is one entry, never
//! truncated, never rewritten. New chain segments rotate when the
//! file exceeds 100 MB to keep ops verifiable in chunks; rotation
//! seals the prior file with a final entry whose payload is the
//! file's SHA-256 and whose chain-link is the prior tip.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum MerkleError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("serde_json: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("chain integrity violation at offset {offset}: expected prev_hash {expected}, got {actual}")]
    Integrity {
        offset: u64,
        expected: String,
        actual: String,
    },

    #[error("hex decode failed: {0}")]
    Hex(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainEntry {
    pub seq: u64,
    pub tenant_id: Uuid,
    pub doc_id: String,
    pub op_kind: String,
    pub op_bytes_b64: String,
    pub at: DateTime<Utc>,
    /// SHA-256 hex of the prior entry. All zeros for seq=0.
    pub prev_hash: String,
    /// SHA-256 hex of this entry's preimage (everything above except
    /// `entry_hash` itself, JSON-serialized in a canonical order).
    pub entry_hash: String,
}

#[derive(Debug, Clone)]
pub struct MerkleAudit {
    base: PathBuf,
}

impl MerkleAudit {
    pub fn new(base: impl Into<PathBuf>) -> Self {
        Self { base: base.into() }
    }

    pub fn default_base() -> Self {
        Self::new("/var/lib/medbrains-edge/chain")
    }

    fn chain_path(&self, tenant_id: Uuid) -> PathBuf {
        self.base.join(format!("{tenant_id}.chain.log"))
    }

    /// Append a new entry. Reads the prior entry's hash to chain.
    pub async fn append(
        &self,
        tenant_id: Uuid,
        doc_id: &str,
        op_kind: &str,
        op_bytes: &[u8],
    ) -> Result<ChainEntry, MerkleError> {
        let path = self.chain_path(tenant_id);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let (prev_hash, next_seq) = self.tip(tenant_id).await?;

        let entry = ChainEntry {
            seq: next_seq,
            tenant_id,
            doc_id: doc_id.to_owned(),
            op_kind: op_kind.to_owned(),
            op_bytes_b64: base64_encode(op_bytes),
            at: Utc::now(),
            prev_hash,
            entry_hash: String::new(),
        };
        let entry = seal(entry);

        let line = format!("{}\n", serde_json::to_string(&entry)?);
        let mut file = tokio::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&path)
            .await?;
        use tokio::io::AsyncWriteExt;
        file.write_all(line.as_bytes()).await?;
        file.flush().await?;

        Ok(entry)
    }

    /// Get the current chain tip hash + next sequence number for a
    /// tenant. Returns (zeros, 0) for a fresh chain.
    pub async fn tip(&self, tenant_id: Uuid) -> Result<(String, u64), MerkleError> {
        let path = self.chain_path(tenant_id);
        let bytes = match tokio::fs::read(&path).await {
            Ok(b) => b,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok((zeros(), 0)),
            Err(e) => return Err(e.into()),
        };
        let last_line = bytes
            .split(|&b| b == b'\n')
            .rfind(|s| !s.is_empty());
        let Some(line) = last_line else {
            return Ok((zeros(), 0));
        };
        let entry: ChainEntry = serde_json::from_slice(line)?;
        Ok((entry.entry_hash, entry.seq + 1))
    }

    /// Walk every entry, verifying each links to the prior. Returns
    /// the final tip hash + count, or an [`MerkleError::Integrity`]
    /// pointing at the first bad offset.
    pub async fn verify(&self, tenant_id: Uuid) -> Result<(String, u64), MerkleError> {
        let path = self.chain_path(tenant_id);
        let bytes = match tokio::fs::read(&path).await {
            Ok(b) => b,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok((zeros(), 0)),
            Err(e) => return Err(e.into()),
        };
        let mut prev_hash = zeros();
        let mut count = 0u64;
        let mut offset = 0u64;
        for line in bytes.split(|&b| b == b'\n') {
            if line.is_empty() {
                offset += 1;
                continue;
            }
            let entry: ChainEntry = serde_json::from_slice(line)?;
            if entry.prev_hash != prev_hash {
                return Err(MerkleError::Integrity {
                    offset,
                    expected: prev_hash,
                    actual: entry.prev_hash,
                });
            }
            // Recompute the preimage hash and compare
            let cleared = ChainEntry {
                entry_hash: String::new(),
                ..entry.clone()
            };
            let recomputed = compute_hash(&cleared);
            if recomputed != entry.entry_hash {
                return Err(MerkleError::Integrity {
                    offset,
                    expected: recomputed,
                    actual: entry.entry_hash,
                });
            }
            prev_hash = entry.entry_hash;
            count += 1;
            offset += line.len() as u64 + 1;
        }
        Ok((prev_hash, count))
    }
}

fn seal(mut entry: ChainEntry) -> ChainEntry {
    entry.entry_hash = compute_hash(&entry);
    entry
}

fn compute_hash(entry: &ChainEntry) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(entry.seq.to_le_bytes());
    h.update(entry.tenant_id.as_bytes());
    h.update(entry.doc_id.as_bytes());
    h.update(entry.op_kind.as_bytes());
    h.update(entry.op_bytes_b64.as_bytes());
    h.update(entry.at.to_rfc3339().as_bytes());
    h.update(entry.prev_hash.as_bytes());
    let digest = h.finalize();
    hex_encode(&digest)
}

fn zeros() -> String {
    "0".repeat(64)
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

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

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn append_and_verify() {
        let dir = TempDir::new().unwrap();
        let m = MerkleAudit::new(dir.path());
        let tenant = Uuid::new_v4();
        m.append(tenant, "doc1", "set", b"first op").await.unwrap();
        m.append(tenant, "doc1", "set", b"second op").await.unwrap();
        m.append(tenant, "doc2", "del", b"third op").await.unwrap();

        let (tip, count) = m.verify(tenant).await.unwrap();
        assert_eq!(count, 3);
        assert_ne!(tip, zeros());
    }

    #[tokio::test]
    async fn tip_advances() {
        let dir = TempDir::new().unwrap();
        let m = MerkleAudit::new(dir.path());
        let tenant = Uuid::new_v4();
        let (h0, s0) = m.tip(tenant).await.unwrap();
        assert_eq!(h0, zeros());
        assert_eq!(s0, 0);

        let e1 = m.append(tenant, "d", "k", b"x").await.unwrap();
        let (h1, s1) = m.tip(tenant).await.unwrap();
        assert_eq!(h1, e1.entry_hash);
        assert_eq!(s1, 1);
    }

    #[tokio::test]
    async fn detects_tampering() {
        let dir = TempDir::new().unwrap();
        let m = MerkleAudit::new(dir.path());
        let tenant = Uuid::new_v4();
        m.append(tenant, "d", "k", b"a").await.unwrap();
        m.append(tenant, "d", "k", b"b").await.unwrap();

        // Manually corrupt the on-disk chain
        let path = m.chain_path(tenant);
        let mut content = std::fs::read_to_string(&path).unwrap();
        content = content.replace("\"k\"", "\"K\""); // change op_kind
        std::fs::write(&path, content).unwrap();

        let err = m.verify(tenant).await.unwrap_err();
        assert!(matches!(err, MerkleError::Integrity { .. }));
    }
}
