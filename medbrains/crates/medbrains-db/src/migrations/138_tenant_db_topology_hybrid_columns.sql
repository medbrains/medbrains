-- ====================================================================
-- Migration: 138_tenant_db_topology_hybrid_columns.sql
-- RLS-Posture: tenant-scoped (inherits from 133)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Extends 133's tenant_db_topology with the hybrid (cloud + on-prem)
-- deploy_mode + Headscale tunnel columns.
--
-- 133 created the base table with topology ∈ {aurora, patroni,
-- aurora_with_patroni_reads}. This migration adds:
--
--   - deploy_mode      — saas | hybrid | onprem (infra-layer twin of
--                        topology; tells the binary which substrate
--                        trait-objects to instantiate — SecretResolver,
--                        AuditSink, ObjectStore, JwtSigner)
--   - tunnel_provider  — headscale | wss | none (matches Headscale +
--                        bridge-ingress modules in
--                        infra/terraform/modules/)
--   - tunnel_node_key  — WireGuard pubkey we expect to see for this
--                        tenant's bridge node
--   - onprem_cluster_id — e.g. medbrains-acmehospital-onprem-pg, used
--                        for ops correlation
--   - 'patroni_with_cloud_analytics' added to the topology CHECK
--     constraint (writes Patroni on-prem, analytics events flow to
--     cloud via outbox + boundary filter — the canonical hybrid
--     pattern)
-- ====================================================================

-- Replace the topology CHECK constraint to include the new variant
ALTER TABLE tenant_db_topology
    DROP CONSTRAINT IF EXISTS tenant_db_topology_topology_check;

ALTER TABLE tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_topology_check
    CHECK (topology IN (
        'aurora',
        'patroni',
        'aurora_with_patroni_reads',
        'patroni_with_cloud_analytics'
    ));

-- Add hybrid columns
ALTER TABLE tenant_db_topology
    ADD COLUMN IF NOT EXISTS deploy_mode TEXT NOT NULL DEFAULT 'saas'
        CHECK (deploy_mode IN ('saas', 'hybrid', 'onprem'));

ALTER TABLE tenant_db_topology
    ADD COLUMN IF NOT EXISTS tunnel_provider TEXT
        CHECK (tunnel_provider IN ('headscale', 'wss', 'none'));

ALTER TABLE tenant_db_topology
    ADD COLUMN IF NOT EXISTS tunnel_node_key TEXT;

ALTER TABLE tenant_db_topology
    ADD COLUMN IF NOT EXISTS onprem_cluster_id TEXT;

-- Sanity: hybrid deploy_mode requires a tunnel. Drop-and-recreate so
-- this migration is idempotent on re-runs.
ALTER TABLE tenant_db_topology
    DROP CONSTRAINT IF EXISTS tenant_db_topology_hybrid_requires_tunnel;

ALTER TABLE tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_hybrid_requires_tunnel
    CHECK (
        deploy_mode <> 'hybrid'
        OR tunnel_provider IS NOT NULL
    );

-- Index for ops queries that filter/group by deploy_mode (e.g.
-- "list all hybrid tenants" admin endpoints).
CREATE INDEX IF NOT EXISTS idx_tenant_db_topology_deploy_mode
    ON tenant_db_topology(deploy_mode);
