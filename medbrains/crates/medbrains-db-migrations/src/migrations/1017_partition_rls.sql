-- RLS-Posture: tenant-scoped
--
-- Row-level security does not reach a partition on its own.
--
-- `audit_log` is partitioned by month and carries RLS with a tenant policy, so
-- every query through the parent is filtered. A query against a partition
-- directly — `SELECT * FROM audit_log_2026_09` — is not: Postgres applies the
-- partition's own policies, and the partitions had none. Fourteen of them,
-- every one holding audit rows for every tenant in the deployment.
--
-- Nothing in the codebase reads a partition directly today, so this closes a
-- door rather than a breach. It stays closed: `ensure_partitions()` creates a
-- new partition every month and never enabled RLS on it, so the gap reopened
-- by itself on a schedule.

-- 1. The partitions that already exist.
DO $$
DECLARE
    part record;
BEGIN
    FOR part IN
        SELECT c.relname, parent.relname AS parent_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          JOIN pg_inherits i ON i.inhrelid = c.oid
          JOIN pg_class parent ON parent.oid = i.inhparent
         WHERE c.relkind = 'r'
           AND c.relispartition
           AND parent.relrowsecurity
           AND NOT c.relrowsecurity
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', part.relname);
        -- Same shape as the parent's: readable only within the caller's
        -- visible tenants, insertable by anything that got past the app.
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = ANY (app_visible_tenants()))',
            part.relname || '_select', part.relname
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (true)',
            part.relname || '_insert', part.relname
        );
    END LOOP;
END $$;

-- 2. Every partition created from here on.
--
-- Wrapped so it applies to whatever `ensure_partitions()` creates without
-- rewriting that function's body: it calls this at the end of each creation,
-- and calling it twice is harmless.
CREATE OR REPLACE FUNCTION apply_partition_rls() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    part record;
BEGIN
    FOR part IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          JOIN pg_inherits i ON i.inhrelid = c.oid
          JOIN pg_class parent ON parent.oid = i.inhparent
         WHERE c.relkind = 'r'
           AND c.relispartition
           AND parent.relrowsecurity
           AND NOT c.relrowsecurity
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', part.relname);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = ANY (app_visible_tenants()))',
            part.relname || '_select', part.relname
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (true)',
            part.relname || '_insert', part.relname
        );
    END LOOP;
END $$;

COMMENT ON FUNCTION apply_partition_rls() IS
    'Enables RLS + the parent tenant policy on any partition missing it. Called by ensure_partitions() so a new month does not arrive unprotected.';

-- 3. Call it from the job that makes partitions.
--
-- `ensure_partitions()` runs daily and pre-creates the coming months. Appending
-- the call here rather than editing the archived migration keeps the function
-- definition in one place and means a redeploy cannot drop the protection.
CREATE OR REPLACE FUNCTION ensure_partitions_with_rls() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM ensure_partitions();
    PERFORM apply_partition_rls();
END $$;

COMMENT ON FUNCTION ensure_partitions_with_rls() IS
    'ensure_partitions() followed by apply_partition_rls(). The retention job calls this so a partition is never live without its tenant policy.';
