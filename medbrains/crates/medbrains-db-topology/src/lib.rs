//! `medbrains-db-topology` — per-tenant DB connection routing.
//!
//! Sprint B.4.2 per RFCs/sprints/SPRINT-B-patroni-ha.md §4.2.
//!
//! Default tenants stay on the existing Aurora pool (`state.db`).
//! Tier-1 tenants opt into Patroni via `tenant_db_topology.topology`;
//! the router lazily instantiates a per-tenant pool on first use,
//! caches it, and short-circuits to Aurora otherwise.
//!
//! Routing decision is **per-request** — driven by `claims.tenant_id`.
//! Routes that need a pool call `topology.writer_pool(tenant_id)` /
//! `topology.reader_pool(tenant_id)` instead of consuming `state.db`
//! directly. Existing call sites continue to work unchanged via the
//! Aurora default.

pub mod cache;
pub mod resolver;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use thiserror::Error;
use uuid::Uuid;

pub use cache::TopologyRouter;
pub use resolver::{DbTopologyRow, PostgresTopologyResolver, TopologyResolver};

#[derive(Debug, Error)]
pub enum TopologyError {
    #[error("topology lookup failed: {0}")]
    Lookup(#[from] sqlx::Error),

    #[error("topology row missing patroni endpoints: {0}")]
    MissingEndpoints(String),

    #[error("pool creation failed: {0}")]
    PoolCreation(String),

    #[error("topology: {0}")]
    Other(String),
}

/// Per-tenant DB topology choice. Mirrors the SQL CHECK constraint on
/// `tenant_db_topology.topology` (migration 133).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Topology {
    /// Default — writes + reads via the shared Aurora pool.
    Aurora,
    /// Writes + reads via the tenant's dedicated Patroni HA cluster.
    Patroni,
    /// Hybrid: writes to Aurora, analytics reads to Patroni replica
    /// (lower OLTP contention on Aurora writer).
    AuroraWithPatroniReads,
}

impl Topology {
    pub fn as_code(self) -> &'static str {
        match self {
            Self::Aurora => "aurora",
            Self::Patroni => "patroni",
            Self::AuroraWithPatroniReads => "aurora_with_patroni_reads",
        }
    }

    pub fn from_code(s: &str) -> Option<Self> {
        Some(match s {
            "aurora" => Self::Aurora,
            "patroni" => Self::Patroni,
            "aurora_with_patroni_reads" => Self::AuroraWithPatroniReads,
            _ => return None,
        })
    }
}

/// Pool resolution strategy — given a tenant + read/write intent, return
/// the right pool. Wraps `state.db` (Aurora) + lazily-built Patroni pools.
#[async_trait]
pub trait TopologyDispatcher: Send + Sync + std::fmt::Debug {
    /// Get a writer pool for this tenant. Returns the Aurora default for
    /// tenants on `aurora` or `aurora_with_patroni_reads` topologies;
    /// Patroni writer pool for `patroni`.
    async fn writer_pool(&self, tenant_id: Uuid) -> Result<Arc<PgPool>, TopologyError>;

    /// Get a reader pool for this tenant. Returns:
    /// - Aurora reader replica (or writer if no replica configured) for `aurora`
    /// - Patroni reader endpoint for `patroni` and `aurora_with_patroni_reads`
    async fn reader_pool(&self, tenant_id: Uuid) -> Result<Arc<PgPool>, TopologyError>;

    /// Resolve current topology for a tenant. Cheap read after first call.
    async fn topology_for(&self, tenant_id: Uuid) -> Result<Topology, TopologyError>;

    /// Force-evict the cached pool for a tenant. Called by the admin
    /// endpoint when an operator flips `tenant_db_topology.topology`.
    async fn invalidate(&self, tenant_id: Uuid);
}
