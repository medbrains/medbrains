//! `AuditSink` — substrate-agnostic archive of audit-chain segments.
//!
//! `medbrains-db::audit::archive_segment` rotates the in-DB audit_log
//! into immutable archive files; this trait is where those files land.
//!
//! - `saas` / cloud nodes → S3 with Object Lock (impl in
//!   `medbrains-server`)
//! - `onprem` / `hybrid` on-prem nodes → `LocalFsAuditSink` writing
//!   to `/var/lib/medbrains/audit/archive/` with sequential filenames

pub mod local;

use async_trait::async_trait;
use std::fmt;
use uuid::Uuid;

#[derive(Debug)]
pub enum AuditSinkError {
    Io(String),
    Backend(String),
}

impl fmt::Display for AuditSinkError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(m) => write!(f, "audit_sink io: {m}"),
            Self::Backend(m) => write!(f, "audit_sink backend: {m}"),
        }
    }
}

impl std::error::Error for AuditSinkError {}

#[async_trait]
pub trait AuditSink: Send + Sync + fmt::Debug {
    /// Archive a closed segment. Implementations MUST be append-only
    /// and idempotent (same segment_id should produce the same path).
    async fn archive_segment(
        &self,
        tenant_id: Uuid,
        segment_id: Uuid,
        sealed_bytes: Vec<u8>,
    ) -> Result<String, AuditSinkError>;

    /// Read back a segment by id (for chain verification or audit
    /// dossier export).
    async fn fetch_segment(
        &self,
        tenant_id: Uuid,
        segment_id: Uuid,
    ) -> Result<Vec<u8>, AuditSinkError>;
}

pub use local::LocalFsAuditSink;
