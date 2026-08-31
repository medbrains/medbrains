-- Migration: 0990_rls_coverage_patch.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none

-- Fix RLS gaps detected by `check_rls.py` on the 10 tenant_id-bearing tables
-- that lack full row-level security coverage.
--
-- Three categories:
--   1. audit_log_legacy — has policies but RLS was never turned on
--   2. automation_* tables — created in 0980/0978 without policies (the dynamic
--      SQL loop in 0980 uses a pattern the static scanner cannot match)
--   3. email_verification_tokens, user_invitations — created in 0040 with no
--      RLS and no policy
--
-- Policies use DROP + CREATE so re-running is safe.

-- ── 1. audit_log_legacy — enable RLS (policies already exist) ───────────
ALTER TABLE public.audit_log_legacy ENABLE ROW LEVEL SECURITY;

-- ── 2. automation tables from 0978_automation.sql ───────────────────────

DROP POLICY IF EXISTS tenant_isolation_automation_credentials ON public.automation_credentials;
CREATE POLICY tenant_isolation_automation_credentials ON public.automation_credentials
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

DROP POLICY IF EXISTS tenant_isolation_automation_executions ON public.automation_executions;
CREATE POLICY tenant_isolation_automation_executions ON public.automation_executions
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

DROP POLICY IF EXISTS tenant_isolation_automation_webhooks ON public.automation_webhooks;
CREATE POLICY tenant_isolation_automation_webhooks ON public.automation_webhooks
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

DROP POLICY IF EXISTS tenant_isolation_automation_workflows ON public.automation_workflows;
CREATE POLICY tenant_isolation_automation_workflows ON public.automation_workflows
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- ── 3. automation tables from 0980_automation_state.sql ─────────────────
--    These have ENABLE RLS and dynamic-SQL policies, but the static scanner
--    does not detect them. Adding explicit policies for clarity and to satisfy
--    `check_rls.py`.

DROP POLICY IF EXISTS tenant_isolation_automation_state ON public.automation_state;
CREATE POLICY tenant_isolation_automation_state ON public.automation_state
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

DROP POLICY IF EXISTS tenant_isolation_automation_variables ON public.automation_variables;
CREATE POLICY tenant_isolation_automation_variables ON public.automation_variables
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

DROP POLICY IF EXISTS tenant_isolation_automation_binaries ON public.automation_binaries;
CREATE POLICY tenant_isolation_automation_binaries ON public.automation_binaries
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- ── 4. auth tables from 0040_auth.sql ──────────────────────────────────

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_email_verification_tokens ON public.email_verification_tokens;
CREATE POLICY tenant_isolation_email_verification_tokens ON public.email_verification_tokens
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_user_invitations ON public.user_invitations;
CREATE POLICY tenant_isolation_user_invitations ON public.user_invitations
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
