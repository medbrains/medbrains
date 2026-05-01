//! Object-storage lifecycle types.
//!
//! Three tiers + per-document-category policies. The
//! `medbrains-archive` binary in `medbrains-server` sweeps records
//! eligible for tier transition based on these policies.
//!
//! Wire shape mirrors migration 0060_object_storage_lifecycle.sql.

use serde::{Deserialize, Serialize};

/// Where a blob currently lives. Mirrors the SQL `storage_tier` enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageTier {
    /// Frequent reads. LocalFs / RustFS / AWS S3 standard.
    Hot,
    /// Rare reads. Same store, compressed; restore is instant.
    Cold,
    /// Long-term. Glacier / external HDD; restore is hours.
    Archive,
    /// Tombstone — content removed per retention policy.
    Deleted,
}

impl StorageTier {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hot => "hot",
            Self::Cold => "cold",
            Self::Archive => "archive",
            Self::Deleted => "deleted",
        }
    }
}

/// Per-document-category lifecycle policy. Each tenant has its own
/// row in `object_storage_policies`; values populate the standard
/// path the sweeper applies on each run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectStoragePolicy {
    pub document_category: String,
    /// Days after `created_at` before moving hot → cold. `None` keeps
    /// the document on the hot tier indefinitely.
    pub hot_to_cold_days: Option<i32>,
    /// Days after the cold transition before moving to archive.
    pub cold_to_archive_days: Option<i32>,
    /// Days after the archive transition before deletion. `None` =
    /// retain forever (consent forms, MLC, ID proofs).
    pub archive_to_delete_days: Option<i32>,
    /// Audit-friendly retention floor — even if other deltas are set
    /// shorter, never delete before this many years from creation.
    pub retention_years: i32,
    pub description: Option<String>,
}

/// One row of `object_storage_transitions`. Hash-chained against the
/// previous transition's `hash` so the tier history is tamper-
/// evident — same pattern as the audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageTierTransition {
    pub document_id: uuid::Uuid,
    pub document_table: String,
    pub from_tier: StorageTier,
    pub to_tier: StorageTier,
    pub from_key: Option<String>,
    pub to_key: Option<String>,
    pub byte_size: Option<i64>,
    pub triggered_by: String,
    pub triggered_at: chrono::DateTime<chrono::Utc>,
    pub previous_hash: Option<String>,
    pub hash: String,
}

/// Compute the SHA-256 hash for a tier transition row, chained
/// against the previous one. Caller passes `previous_hash` from the
/// last row; we hash the canonical concatenation of fields. The
/// result is what gets persisted as `hash`.
pub fn transition_hash(t: &StorageTierTransition) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(t.previous_hash.as_deref().unwrap_or("").as_bytes());
    h.update(b"|");
    h.update(t.document_id.as_bytes());
    h.update(b"|");
    h.update(t.document_table.as_bytes());
    h.update(b"|");
    h.update(t.from_tier.as_str().as_bytes());
    h.update(b"|");
    h.update(t.to_tier.as_str().as_bytes());
    h.update(b"|");
    h.update(t.from_key.as_deref().unwrap_or("").as_bytes());
    h.update(b"|");
    h.update(t.to_key.as_deref().unwrap_or("").as_bytes());
    h.update(b"|");
    h.update(t.triggered_at.to_rfc3339().as_bytes());
    hex::encode(h.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(prev: Option<&str>) -> StorageTierTransition {
        StorageTierTransition {
            document_id: uuid::Uuid::nil(),
            document_table: "patient_documents".to_owned(),
            from_tier: StorageTier::Hot,
            to_tier: StorageTier::Cold,
            from_key: Some("hot/abc".to_owned()),
            to_key: Some("cold/abc".to_owned()),
            byte_size: Some(4096),
            triggered_by: "medbrains-archive".to_owned(),
            triggered_at: chrono::DateTime::parse_from_rfc3339("2026-05-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
            previous_hash: prev.map(str::to_owned),
            hash: String::new(),
        }
    }

    #[test]
    fn transition_hash_is_deterministic() {
        let t = fixture(None);
        let h1 = transition_hash(&t);
        let h2 = transition_hash(&t);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn transition_hash_chains_with_previous() {
        let h1 = transition_hash(&fixture(None));
        let h2 = transition_hash(&fixture(Some(&h1)));
        let h3 = transition_hash(&fixture(Some("different")));
        assert_ne!(h1, h2, "different previous_hash must change hash");
        assert_ne!(h2, h3, "different previous_hash must change hash");
    }

    #[test]
    fn tier_strings_match_sql_enum() {
        assert_eq!(StorageTier::Hot.as_str(), "hot");
        assert_eq!(StorageTier::Cold.as_str(), "cold");
        assert_eq!(StorageTier::Archive.as_str(), "archive");
        assert_eq!(StorageTier::Deleted.as_str(), "deleted");
    }
}
