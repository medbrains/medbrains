//! Resolves `tenant_db_topology` rows from Postgres.

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{Topology, TopologyError};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DbTopologyRow {
    pub tenant_id: Uuid,
    pub topology: String,
    pub patroni_writer_url: Option<String>,
    pub patroni_reader_url: Option<String>,
}

impl DbTopologyRow {
    pub fn topology_enum(&self) -> Topology {
        Topology::from_code(&self.topology).unwrap_or(Topology::Aurora)
    }
}

/// Source-of-truth lookup for tenant topology. Production impl reads
/// from `tenant_db_topology` table; tests stub via `InMemoryResolver`.
#[async_trait]
pub trait TopologyResolver: Send + Sync + std::fmt::Debug {
    /// Look up topology for a tenant. Returns `None` (default Aurora) if
    /// no row exists — which is the common case.
    async fn resolve(&self, tenant_id: Uuid) -> Result<Option<DbTopologyRow>, TopologyError>;
}

/// Postgres-backed resolver. Uses the application's main Aurora pool
/// for the lookup itself (the `tenant_db_topology` table lives there
/// regardless of the resolved topology).
#[derive(Debug, Clone)]
pub struct PostgresTopologyResolver {
    pool: PgPool,
}

impl PostgresTopologyResolver {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TopologyResolver for PostgresTopologyResolver {
    async fn resolve(&self, tenant_id: Uuid) -> Result<Option<DbTopologyRow>, TopologyError> {
        // allow-raw-sql: topology lookup is a one-shot self-contained query;
        // belongs in db-topology crate not medbrains-db
        let row: Option<DbTopologyRow> = sqlx::query_as::<_, DbTopologyRow>(
            "SELECT tenant_id, topology, patroni_writer_url, patroni_reader_url \
             FROM tenant_db_topology WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }
}
