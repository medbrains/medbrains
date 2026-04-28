//! Per-tenant pool cache. Uses moka::future::Cache with a 5-min TTL
//! so admin topology flips propagate within 5 min in the worst case
//! (or instantly via explicit `invalidate`).

use async_trait::async_trait;
use moka::future::Cache;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use crate::resolver::{DbTopologyRow, TopologyResolver};
use crate::{Topology, TopologyDispatcher, TopologyError};

/// Resolved per-tenant pools. Populated lazily on first request.
#[derive(Clone)]
struct TenantPools {
    topology: Topology,
    writer: Arc<PgPool>,
    reader: Arc<PgPool>,
}

impl std::fmt::Debug for TenantPools {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TenantPools")
            .field("topology", &self.topology)
            .field("writer", &"PgPool")
            .field("reader", &"PgPool")
            .finish()
    }
}

/// The shared router.  Holds:
/// - The default Aurora pool — used for tenants on the default topology
/// - A cache of per-tenant `TenantPools` for tenants that opted into Patroni
pub struct TopologyRouter {
    aurora_writer: Arc<PgPool>,
    aurora_reader: Arc<PgPool>,
    resolver: Arc<dyn TopologyResolver>,
    cache: Cache<Uuid, TenantPools>,
    /// Pool sizing for tenant-scoped Patroni pools. Aurora keeps its own.
    tenant_pool_max: u32,
}

impl std::fmt::Debug for TopologyRouter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TopologyRouter")
            .field("aurora_writer", &"PgPool")
            .field("aurora_reader", &"PgPool")
            .field("resolver", &self.resolver)
            .field("cache_entries", &self.cache.entry_count())
            .field("tenant_pool_max", &self.tenant_pool_max)
            .finish()
    }
}

impl TopologyRouter {
    /// Build a router. `aurora_writer`/`aurora_reader` are the existing
    /// AppState.db pools (often the same — Aurora handles read/write
    /// split internally via its endpoint). `resolver` looks up
    /// `tenant_db_topology` rows.
    pub fn new(
        aurora_writer: PgPool,
        aurora_reader: PgPool,
        resolver: Arc<dyn TopologyResolver>,
    ) -> Self {
        Self {
            aurora_writer: Arc::new(aurora_writer),
            aurora_reader: Arc::new(aurora_reader),
            resolver,
            cache: Cache::builder()
                .time_to_live(Duration::from_secs(5 * 60))
                .max_capacity(1000)
                .build(),
            tenant_pool_max: 5,
        }
    }

    async fn ensure_pools(&self, tenant_id: Uuid) -> Result<TenantPools, TopologyError> {
        if let Some(p) = self.cache.get(&tenant_id).await {
            return Ok(p);
        }

        let row = self.resolver.resolve(tenant_id).await?;
        let pools = match row {
            None => {
                // Default — Aurora for both reads + writes
                TenantPools {
                    topology: Topology::Aurora,
                    writer: self.aurora_writer.clone(),
                    reader: self.aurora_reader.clone(),
                }
            }
            Some(row) => self.build_pools(row).await?,
        };
        self.cache.insert(tenant_id, pools.clone()).await;
        Ok(pools)
    }

    async fn build_pools(&self, row: DbTopologyRow) -> Result<TenantPools, TopologyError> {
        let topology = row.topology_enum();
        match topology {
            Topology::Aurora => Ok(TenantPools {
                topology,
                writer: self.aurora_writer.clone(),
                reader: self.aurora_reader.clone(),
            }),
            Topology::Patroni => {
                let writer = self.connect(&row, /*reader=*/ false).await?;
                let reader = self.connect(&row, /*reader=*/ true).await?;
                Ok(TenantPools {
                    topology,
                    writer: Arc::new(writer),
                    reader: Arc::new(reader),
                })
            }
            Topology::AuroraWithPatroniReads => {
                let reader = self.connect(&row, /*reader=*/ true).await?;
                Ok(TenantPools {
                    topology,
                    writer: self.aurora_writer.clone(),
                    reader: Arc::new(reader),
                })
            }
        }
    }

    async fn connect(&self, row: &DbTopologyRow, reader: bool) -> Result<PgPool, TopologyError> {
        let url = if reader {
            row.patroni_reader_url
                .as_deref()
                .ok_or_else(|| TopologyError::MissingEndpoints(row.tenant_id.to_string()))?
        } else {
            row.patroni_writer_url
                .as_deref()
                .ok_or_else(|| TopologyError::MissingEndpoints(row.tenant_id.to_string()))?
        };

        PgPoolOptions::new()
            .max_connections(self.tenant_pool_max)
            .acquire_timeout(Duration::from_secs(10))
            .connect(url)
            .await
            .map_err(|e| TopologyError::PoolCreation(e.to_string()))
    }
}

#[async_trait]
impl TopologyDispatcher for TopologyRouter {
    async fn writer_pool(&self, tenant_id: Uuid) -> Result<Arc<PgPool>, TopologyError> {
        Ok(self.ensure_pools(tenant_id).await?.writer)
    }

    async fn reader_pool(&self, tenant_id: Uuid) -> Result<Arc<PgPool>, TopologyError> {
        Ok(self.ensure_pools(tenant_id).await?.reader)
    }

    async fn topology_for(&self, tenant_id: Uuid) -> Result<Topology, TopologyError> {
        Ok(self.ensure_pools(tenant_id).await?.topology)
    }

    async fn invalidate(&self, tenant_id: Uuid) {
        self.cache.invalidate(&tenant_id).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Debug)]
    struct StubResolver {
        rows: Mutex<std::collections::HashMap<Uuid, Option<DbTopologyRow>>>,
    }

    #[async_trait]
    impl TopologyResolver for StubResolver {
        async fn resolve(
            &self,
            tenant_id: Uuid,
        ) -> Result<Option<DbTopologyRow>, TopologyError> {
            Ok(self.rows.lock().expect("stub-resolver lock").get(&tenant_id).cloned().flatten())
        }
    }

    #[test]
    fn topology_codes_round_trip() {
        for t in [Topology::Aurora, Topology::Patroni, Topology::AuroraWithPatroniReads] {
            assert_eq!(Topology::from_code(t.as_code()), Some(t));
        }
    }

    #[test]
    fn unknown_code_rejected() {
        assert!(Topology::from_code("citus").is_none());
    }

    #[test]
    fn db_topology_row_resolves_to_enum() {
        let row = DbTopologyRow {
            tenant_id: Uuid::nil(),
            topology: "patroni".to_string(),
            patroni_writer_url: Some("postgres://x".to_string()),
            patroni_reader_url: Some("postgres://y".to_string()),
        };
        assert_eq!(row.topology_enum(), Topology::Patroni);
    }
}
