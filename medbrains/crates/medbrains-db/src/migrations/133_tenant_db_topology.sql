-- ====================================================================
-- Migration: 133_tenant_db_topology.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: tenant_db_topology
-- Drops: none
-- ====================================================================
-- Sprint B per RFCs/sprints/SPRINT-B-patroni-ha.md §4.1.
--
-- Per-tenant DB topology selector. Default 'aurora' keeps SaaS tenants
-- on the existing managed RDS path. Tier-1 hospitals + on-prem
-- deployments opt into 'patroni' (writes go to a self-managed Patroni
-- HA cluster) or 'aurora_with_patroni_reads' (writes to Aurora,
-- analytics reads to Patroni for query-isolation).
--
-- The app resolves topology at request scope via `medbrains-db-topology`
-- crate (Sprint B.3 deliverable). Existing `state.db: PgPool` stays the
-- default Aurora pool; per-tenant overrides instantiate fresh pools
-- on first use, cached in `Arc<TopologyRouter>`.
-- ====================================================================

CREATE TABLE tenant_db_topology (
    tenant_id        UUID PRIMARY KEY REFERENCES tenants(id),
    topology         TEXT NOT NULL DEFAULT 'aurora'
                     CHECK (topology IN ('aurora', 'patroni', 'aurora_with_patroni_reads')),
    -- Patroni endpoint URLs (writer + reader) when topology != 'aurora'.
    -- NULL when topology = 'aurora'. Validated by trigger below.
    patroni_writer_url TEXT,
    patroni_reader_url TEXT,
    notes            TEXT,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       UUID REFERENCES users(id)
);

CREATE TRIGGER tenant_db_topology_updated_at
    BEFORE UPDATE ON tenant_db_topology
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Validation: if topology requires patroni endpoints, they must be set.
CREATE OR REPLACE FUNCTION validate_tenant_db_topology() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.topology IN ('patroni', 'aurora_with_patroni_reads') THEN
        IF NEW.patroni_writer_url IS NULL OR NEW.patroni_reader_url IS NULL THEN
            RAISE EXCEPTION 'topology=%, patroni_writer_url AND patroni_reader_url required',
                            NEW.topology;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER tenant_db_topology_validate
    BEFORE INSERT OR UPDATE ON tenant_db_topology
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_db_topology();

SELECT apply_tenant_rls('tenant_db_topology');

COMMENT ON TABLE tenant_db_topology IS
    'Per-tenant DB topology: aurora (default) | patroni | aurora_with_patroni_reads. Resolved at request scope by medbrains-db-topology crate. Sprint B per RFCs/sprints/SPRINT-B-patroni-ha.md.';
