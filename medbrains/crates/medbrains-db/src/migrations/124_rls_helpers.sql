-- ====================================================================
-- Migration: 124_rls_helpers.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Reusable RLS policy helpers for RFC-INFRA-2026-002 Phase 1.
-- All future migrations should call these one-liners instead of
-- hand-writing CREATE POLICY blocks per table.
--
--   SELECT apply_tenant_rls('table_name');
--   SELECT apply_tenant_rls_with_global('table_name');     -- NULL tenant_id = global default
--   SELECT apply_department_rls('table_name', 'department_id');
--
-- These wrap the patterns already in 001_initial.sql + 011_department_scoped_rls.sql.
-- ====================================================================

-- ── apply_tenant_rls ────────────────────────────────────────────────
-- Standard tenant isolation: tenant_id NOT NULL, policy matches
-- current_setting('app.tenant_id', true).

CREATE OR REPLACE FUNCTION apply_tenant_rls(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'tenant_isolation_' || short_name;
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policy with same name to make this idempotent
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'USING (tenant_id::text = current_setting(''app.tenant_id'', true)) '
        || 'WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
        policy_name, tbl
    );
END $$;

-- ── apply_tenant_rls_with_global ─────────────────────────────────────
-- For tables where `tenant_id` is NULLABLE and NULL means "global default
-- row visible to all tenants" (master_occupations, master_relations, etc.).
-- Cross-tenant analytics tables also use this when NULL = aggregated.

CREATE OR REPLACE FUNCTION apply_tenant_rls_with_global(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'tenant_isolation_' || short_name;
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'USING (tenant_id IS NULL OR tenant_id::text = current_setting(''app.tenant_id'', true)) '
        || 'WITH CHECK (tenant_id IS NULL OR tenant_id::text = current_setting(''app.tenant_id'', true))',
        policy_name, tbl
    );
END $$;

-- ── apply_department_rls ────────────────────────────────────────────
-- Adds a SECOND policy on top of tenant isolation, scoping reads to the
-- user's department_ids set (via app.user_department_ids GUC). Bypass
-- roles set this to empty string -> see everything in their tenant.
--
-- Uses check_department_access() function from migration 011.

CREATE OR REPLACE FUNCTION apply_department_rls(tbl regclass, dept_col TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'dept_scope_' || short_name;
BEGIN
    -- Department policy is additive to tenant isolation; both must pass.
    -- Postgres applies all permissive policies as OR within action, so we
    -- must declare this RESTRICTIVE so it AND-combines with tenant policy.
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'AS RESTRICTIVE '
        || 'USING (check_department_access(%I)) '
        || 'WITH CHECK (check_department_access(%I))',
        policy_name, tbl, dept_col, dept_col
    );
END $$;

-- ── Document the helpers ────────────────────────────────────────────

COMMENT ON FUNCTION apply_tenant_rls(regclass)
    IS 'Standard RLS: tenant_id NOT NULL must match app.tenant_id GUC. Idempotent.';
COMMENT ON FUNCTION apply_tenant_rls_with_global(regclass)
    IS 'RLS where NULL tenant_id is a global-default row visible to all tenants. Idempotent.';
COMMENT ON FUNCTION apply_department_rls(regclass, TEXT)
    IS 'Adds restrictive department-scope policy. Combines AND with tenant_isolation policy. Reuses check_department_access() from migration 011. Idempotent.';
