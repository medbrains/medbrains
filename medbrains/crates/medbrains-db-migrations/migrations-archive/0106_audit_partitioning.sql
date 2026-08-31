-- Audit retention partitioning.
--
-- audit_log grows ~50K rows/day at 1000-bed hospital scale → 18M/year.
-- 6-year HIPAA retention = 110M rows total. A single table this size
-- makes vacuum, index rebuilds, and time-bounded queries painful.
--
-- Solution: declarative range partitioning by created_at, one partition
-- per month. Hot months (last 90 days) keep all indexes; older months
-- can be detached to cold storage and dropped from CI / restored on
-- demand for compliance audits.
--
-- This migration creates the partitioned shell + 12 forward partitions
-- (1 year ahead). A nightly cron creates next-month's partition before
-- the boundary; we don't auto-create from inside Postgres because that
-- requires pg_cron or a background extension.
--
-- ⚠ Existing rows are migrated via INSERT … SELECT into the new table.
-- The trigger from migration 0056 fires per-row during the copy and
-- chain-rebuilds the hashes (so backfill is verifiable end-to-end).

-- Sentinel: only run if the table isn't already partitioned.
DO $$
DECLARE
    is_partitioned BOOL;
BEGIN
    SELECT (relkind = 'p') INTO is_partitioned
    FROM pg_class WHERE relname = 'audit_log' AND relkind IN ('r', 'p');

    IF is_partitioned THEN
        RAISE NOTICE 'audit_log already partitioned, skipping';
        RETURN;
    END IF;

    -- 1) Rename current table aside.
    EXECUTE 'ALTER TABLE audit_log RENAME TO audit_log_legacy';
    EXECUTE 'ALTER TABLE audit_log_legacy DISABLE ROW LEVEL SECURITY';
    -- Drop the trigger temporarily so the copy doesn't double-hash.
    EXECUTE 'DROP TRIGGER IF EXISTS audit_log_hash_chain_trigger ON audit_log_legacy';
END $$;

-- 2) Recreate as PARTITION BY RANGE (created_at).
CREATE TABLE IF NOT EXISTS audit_log (
    id                   UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id            UUID NOT NULL,
    user_id              UUID,
    action               TEXT NOT NULL,
    entity_type          TEXT NOT NULL,
    entity_id            UUID,
    old_values           JSONB,
    new_values           JSONB,
    ip_address           TEXT,
    prev_hash            TEXT,
    hash                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent           TEXT,
    session_id           UUID,
    module               TEXT,
    description          TEXT,
    correlation_id       UUID,
    hash_input_canonical TEXT,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Indexes (mirror the legacy ones).
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action_time
    ON audit_log (tenant_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation
    ON audit_log (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
    ON audit_log (entity_type, entity_id);

-- 3) Create 12 monthly partitions starting last month.
DO $$
DECLARE
    start_month DATE := date_trunc('month', now())::date - INTERVAL '1 month';
    i INT;
    p_start DATE;
    p_end   DATE;
    p_name  TEXT;
BEGIN
    FOR i IN 0..12 LOOP
        p_start := (start_month + (i || ' months')::INTERVAL)::date;
        p_end   := (p_start    + '1 month'::INTERVAL)::date;
        p_name  := 'audit_log_' || to_char(p_start, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log
             FOR VALUES FROM (%L) TO (%L)',
            p_name, p_start, p_end
        );
    END LOOP;
END $$;

-- 4) Default catch-all partition for any rows outside the current window
--    (legacy backfill goes here; can be split later via DETACH+ATTACH).
CREATE TABLE IF NOT EXISTS audit_log_legacy_archive
    PARTITION OF audit_log DEFAULT;

-- 5) Re-attach the hash-chain trigger to the parent (cascades to partitions).
DROP TRIGGER IF EXISTS audit_log_hash_chain_trigger ON audit_log;
CREATE TRIGGER audit_log_hash_chain_trigger
    BEFORE INSERT ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_hash_chain();

-- 6) Append-only RLS on the parent (cascades).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log
    FOR SELECT USING (true);
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log
    FOR INSERT WITH CHECK (true);

-- 7) Backfill from legacy → partitioned (trigger re-derives hashes per row).
INSERT INTO audit_log
    (id, tenant_id, user_id, action, entity_type, entity_id, old_values,
     new_values, ip_address, created_at, user_agent, session_id, module,
     description, correlation_id)
SELECT
    id, tenant_id, user_id, action, entity_type, entity_id, old_values,
    new_values, ip_address, created_at, user_agent, session_id, module,
    description, correlation_id
FROM audit_log_legacy
ON CONFLICT DO NOTHING;

-- 8) Keep the legacy table around for one cycle so we can compare row
--    counts. Drop it manually after verification:
--      DROP TABLE audit_log_legacy CASCADE;
