-- ====================================================================
-- Migration: 1455_drop_automation_tables.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: automation_workflows, automation_credentials, automation_executions, automation_webhooks, automation_state, automation_variables, automation_binaries
-- ====================================================================
-- Drop the seven tables the retired r8r engine used (0978, 0980).
--
-- Why this is safe:
--   * No code reads or writes them: the r8r engine and the crates built on
--     it were removed in #5415.
--   * The data is not needed: owner decision 2026-11-10. Keeping them empty
--     was rejected (tables nothing uses still cost RLS, audit and backup).
--
-- The one live dependant is `revoke_vendor_credentials()` (1420), which
-- switched off a vendor account's automation workflows. It is replaced first
-- with the same body minus that statement, so a vendor flag never hits a
-- missing table. Past `automation_workflow` revocation rows stay: that
-- history is append-only, so the CHECK on `kind` keeps the value.
--
-- Idempotent: CREATE OR REPLACE and DROP ... IF EXISTS. CASCADE takes their
-- own policies, indexes and triggers (RLS from 0990, soft-delete, audit).

CREATE OR REPLACE FUNCTION public.revoke_vendor_credentials()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_prev_tenant text := current_setting('app.tenant_id', true);
BEGIN
    PERFORM set_config('app.tenant_id', NEW.tenant_id::text, true);

    WITH keys AS (
        UPDATE public.api_keys SET revoked_at = now()
         WHERE tenant_id = NEW.tenant_id AND created_by = NEW.id AND revoked_at IS NULL
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'api_key', id FROM keys;

    WITH apps AS (
        UPDATE public.connected_apps
           SET status = 'revoked', revoked_at = now(),
               revoke_reason = 'Registered or approved by a MedBrains account'
         WHERE tenant_id = NEW.tenant_id AND (created_by = NEW.id OR approved_by = NEW.id)
           AND status <> 'revoked'
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'connected_app', id FROM apps;

    -- An app's tokens are API keys; ending the app ends them too.
    UPDATE public.api_keys k SET revoked_at = now()
      FROM public.connected_apps a
     WHERE k.connected_app_id = a.id AND a.tenant_id = NEW.tenant_id
       AND (a.created_by = NEW.id OR a.approved_by = NEW.id) AND k.revoked_at IS NULL;

    WITH devices AS (
        UPDATE public.paired_devices
           SET revoked_at = now(), revoked_reason = 'Issued to a MedBrains account'
         WHERE tenant_id = NEW.tenant_id AND issued_to_user_id = NEW.id AND revoked_at IS NULL
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'paired_device', id FROM devices;

    WITH hooks AS (
        UPDATE public.webhook_subscriptions SET is_active = false
         WHERE tenant_id = NEW.tenant_id AND created_by = NEW.id AND is_active
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'webhook_subscription', id FROM hooks;

    -- Pipelines and connectors stop; a digest subscription stops sending to
    -- the account.
    WITH pipes AS (
        UPDATE public.integration_pipelines SET status = 'paused'
         WHERE tenant_id = NEW.tenant_id AND created_by = NEW.id AND status = 'active'
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'integration_pipeline', id FROM pipes;

    WITH conns AS (
        UPDATE public.connectors SET status = 'inactive'
         WHERE tenant_id = NEW.tenant_id AND created_by = NEW.id AND status <> 'inactive'
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'connector', id FROM conns;

    WITH digests AS (
        UPDATE public.eod_digest_subscriptions SET is_active = false
         WHERE tenant_id = NEW.tenant_id AND user_id = NEW.id AND is_active
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'eod_digest_subscription', id FROM digests;

    PERFORM set_config('app.tenant_id', COALESCE(v_prev_tenant, ''), true);
    RETURN NEW;
END;
$$;

-- Children first (executions/webhooks/binaries reference workflows); CASCADE
-- covers any remaining foreign key either way.
DROP TABLE IF EXISTS public.automation_binaries CASCADE;
DROP TABLE IF EXISTS public.automation_variables CASCADE;
DROP TABLE IF EXISTS public.automation_state CASCADE;
DROP TABLE IF EXISTS public.automation_webhooks CASCADE;
DROP TABLE IF EXISTS public.automation_executions CASCADE;
DROP TABLE IF EXISTS public.automation_credentials CASCADE;
DROP TABLE IF EXISTS public.automation_workflows CASCADE;
