-- 118: tenant_db_topology + hybrid deployment columns
--
-- Per-tenant DB routing for the hybrid (cloud + on-prem) story.
-- The medbrains-db-topology crate (when shipped on this branch)
-- consumes these rows at request time to pick which pool to use.
--
-- topology values:
--   'aurora'                       — default, all reads/writes via the
--                                    shared Aurora pool
--   'patroni'                      — all reads/writes via tenant's
--                                    on-prem Patroni HA cluster (PHI
--                                    stays in hospital DC; this is the
--                                    tier-1 hospital topology)
--   'aurora_with_patroni_reads'    — writes Aurora, analytics reads
--                                    Patroni replica (lower OLTP
--                                    contention on writer)
--   'patroni_with_cloud_analytics' — writes Patroni on-prem, analytics
--                                    derived events flow to cloud via
--                                    outbox + boundary filter (the
--                                    canonical hybrid pattern)
--
-- deploy_mode is the infra-layer twin of topology. It tells the binary
-- which substrate trait-object impls to instantiate (SecretResolver,
-- AuditSink, ObjectStore, JwtSigner). Distinct from topology so a
-- tenant can be on 'patroni' DB topology while running in 'saas'
-- deploy mode (e.g. cloud-hosted Patroni on EC2) — that's a different
-- combination than 'patroni' + 'hybrid' (PHI on hospital DC).

CREATE TABLE IF NOT EXISTS tenant_db_topology (
    tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

    topology             TEXT NOT NULL DEFAULT 'aurora'
        CHECK (topology IN (
            'aurora',
            'patroni',
            'aurora_with_patroni_reads',
            'patroni_with_cloud_analytics'
        )),

    deploy_mode          TEXT NOT NULL DEFAULT 'saas'
        CHECK (deploy_mode IN ('saas', 'hybrid', 'onprem')),

    -- Patroni connection — populated only for non-aurora topologies
    patroni_writer_url   TEXT,
    patroni_reader_url   TEXT,

    -- Headscale tailnet wiring (hybrid + onprem with bridge)
    tunnel_provider      TEXT
        CHECK (tunnel_provider IN ('headscale', 'wss', 'none')),
    tunnel_node_key      TEXT,                 -- WireGuard pubkey we
                                                -- expect to see for this
                                                -- tenant's bridge node
    onprem_cluster_id    TEXT,                 -- e.g. medbrains-acmehospital-onprem-pg

    -- Operator metadata (who flipped this row, why, when)
    notes                TEXT,
    updated_by           UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sanity: patroni-* topologies must have writer_url set
    CHECK (
        topology = 'aurora'
        OR (patroni_writer_url IS NOT NULL AND patroni_reader_url IS NOT NULL)
    ),
    -- Sanity: hybrid deploy_mode requires a tunnel
    CHECK (
        deploy_mode <> 'hybrid'
        OR tunnel_provider IS NOT NULL
    )
);

CREATE INDEX idx_tenant_db_topology_topology ON tenant_db_topology(topology);
CREATE INDEX idx_tenant_db_topology_deploy_mode ON tenant_db_topology(deploy_mode);

-- updated_at trigger (reuses 001's update_updated_at function)
CREATE TRIGGER tenant_db_topology_updated_at
BEFORE UPDATE ON tenant_db_topology
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS — every tenant only sees its own row. Admin users that need to
-- see the whole table for cross-tenant ops use BYPASSRLS via the
-- medbrains_admin_topology DB role (provisioned out-of-band; not in
-- this migration).
ALTER TABLE tenant_db_topology ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_db_topology FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_db_topology_isolation ON tenant_db_topology
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Auto-populate a default 'aurora' row when a new tenant is created.
-- Existing tenants get a one-time backfill below.
CREATE OR REPLACE FUNCTION tenant_db_topology_default_for_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tenant_db_topology (tenant_id, topology, deploy_mode)
    VALUES (NEW.id, 'aurora', 'saas')
    ON CONFLICT (tenant_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_db_topology_seed ON tenants;
CREATE TRIGGER tenant_db_topology_seed
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION tenant_db_topology_default_for_new_tenant();

-- Backfill rows for existing tenants
INSERT INTO tenant_db_topology (tenant_id, topology, deploy_mode)
SELECT id, 'aurora', 'saas' FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
