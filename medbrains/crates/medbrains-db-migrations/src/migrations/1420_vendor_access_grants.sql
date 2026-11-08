-- ====================================================================
-- Migration: 1420_vendor_access_grants.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: vendor_access_grants, vendor_access_events, vendor_credential_revocations
-- Drops: none
-- ====================================================================
-- MedBrains staff reaching a hospital's data, only with that hospital's say.
--
-- Under DPDP the hospital is the Data Fiduciary and MedBrains its Data
-- Processor. A MedBrains support or engineering account may act on a tenant's
-- data only while the hospital holds a live grant for it: named person,
-- required reason, scope (modules, or configuration only), masked unless a
-- second hospital approver opened it, at most 72 hours. Without one the auth
-- middleware refuses every request, whatever role the account holds — the
-- super_admin / hospital_admin bypass included.
--
-- `users.is_vendor_staff` marks a MedBrains identity. The auth middleware also
-- treats any address on a MedBrains domain (MEDBRAINS_VENDOR_EMAIL_DOMAINS) as
-- one, so an account is gated from the moment it exists. A grant may only
-- name an account that is already one of these: it never turns a hospital
-- colleague into a MedBrains account. The flag only ever goes on, and nothing
-- may clear it, because clearing it would hand the ungated bypass back.
--
-- Credentials a MedBrains account made or owns — API keys, connected apps it
-- registered or approved, devices issued to it, webhooks it set up — would
-- keep working after the person is gated, so they are revoked (never deleted)
-- the moment an account is flagged, each revocation on the audit chain.
--
-- `vendor_access_events` holds one row per request made under a grant, written
-- before the handler runs: an action the hospital cannot see is not allowed to
-- happen. The hospital reads both on Security → MedBrains access.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_vendor_staff boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_vendor_staff IS
    'A MedBrains (vendor) account. Refused on every request unless the hospital '
    'holds a live vendor_access_grants row for it. Never cleared once set.';

CREATE OR REPLACE FUNCTION public.vendor_staff_flag_is_permanent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_vendor_staff AND NOT NEW.is_vendor_staff THEN
        RAISE EXCEPTION 'a MedBrains account cannot be turned back into a hospital account'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_vendor_staff_permanent BEFORE UPDATE OF is_vendor_staff ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.vendor_staff_flag_is_permanent();

CREATE TABLE public.vendor_access_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    grantee_user_id uuid NOT NULL REFERENCES public.users(id),
    -- As typed by the hospital, kept so the record reads the same after the
    -- account is renamed.
    grantee_email text NOT NULL CHECK (length(btrim(grantee_email)) BETWEEN 3 AND 254),
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
    -- Top-level permission modules (`opd`, `lab`, ...) or the one entry
    -- `config` for configuration only.
    scope text[] NOT NULL CHECK (cardinality(scope) BETWEEN 1 AND 80),
    is_masked boolean NOT NULL DEFAULT true,
    expires_at timestamptz NOT NULL,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    approved_by uuid REFERENCES public.users(id),
    approved_at timestamptz,
    revoked_by uuid REFERENCES public.users(id),
    revoked_at timestamptz,
    revoke_reason text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT vendor_access_expiry_at_most_72h
        CHECK (expires_at > created_at AND expires_at <= created_at + interval '72 hours'),
    CONSTRAINT vendor_access_grantee_not_granter CHECK (grantee_user_id <> created_by),
    -- The second person is a different person: not the one who asked, and not
    -- the MedBrains account it opens.
    CONSTRAINT vendor_access_second_approver CHECK (
        approved_by IS NULL
        OR (approved_by <> created_by AND approved_by <> grantee_user_id AND approved_at IS NOT NULL)
    ),
    CONSTRAINT vendor_access_masked_needs_no_approval CHECK (NOT is_masked OR approved_by IS NULL),
    CONSTRAINT vendor_access_revoked_has_who CHECK (revoked_at IS NULL OR revoked_by IS NOT NULL)
);

-- The per-request lookup: this account's grants in this hospital.
CREATE INDEX idx_vendor_access_grants_grantee
    ON public.vendor_access_grants (tenant_id, grantee_user_id, created_at DESC)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_vendor_access_grants_tenant
    ON public.vendor_access_grants (tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.vendor_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_access_grants FORCE ROW LEVEL SECURITY;
-- The hospital the session works at, never the group: a grant opens one
-- hospital, and another hospital in the chain must not read or count it.
CREATE POLICY tenant_isolation_vendor_access_grants ON public.vendor_access_grants
    USING (tenant_id = public.app_current_tenant())
    WITH CHECK (tenant_id = public.app_current_tenant());

CREATE TRIGGER set_updated_at_vendor_access_grants BEFORE UPDATE ON public.vendor_access_grants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_vendor_access_grants_soft_delete BEFORE DELETE ON public.vendor_access_grants
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_vendor_access_grants AFTER INSERT OR UPDATE OR DELETE
    ON public.vendor_access_grants
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('security');

CREATE TABLE public.vendor_access_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    grant_id uuid NOT NULL REFERENCES public.vendor_access_grants(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    method text NOT NULL CHECK (method ~ '^[A-Z]{3,7}$'),
    -- The path only: a query string can carry a patient's name typed into search.
    path text NOT NULL CHECK (length(path) BETWEEN 1 AND 300),
    -- Filled in after the handler answers; NULL means it never did (a crash
    -- or a dropped connection), which is itself worth seeing.
    status_code smallint,
    was_masked boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_access_events_grant
    ON public.vendor_access_events (tenant_id, grant_id, created_at DESC);

ALTER TABLE public.vendor_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_access_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_vendor_access_events ON public.vendor_access_events
    USING (tenant_id = public.app_current_tenant())
    WITH CHECK (tenant_id = public.app_current_tenant());

-- An event row is evidence. It is never removed, and the one change it takes
-- is the answer's status, once.
CREATE TRIGGER trg_vendor_access_events_no_delete BEFORE DELETE ON public.vendor_access_events
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();

CREATE OR REPLACE FUNCTION public.vendor_access_event_status_once()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status_code IS NOT NULL
       OR (NEW.id, NEW.tenant_id, NEW.grant_id, NEW.user_id, NEW.method, NEW.path,
           NEW.was_masked, NEW.created_at)
          IS DISTINCT FROM
          (OLD.id, OLD.tenant_id, OLD.grant_id, OLD.user_id, OLD.method, OLD.path,
           OLD.was_masked, OLD.created_at) THEN
        RAISE EXCEPTION 'a MedBrains access event records its status once and is otherwise fixed'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_access_events_status_once BEFORE UPDATE ON public.vendor_access_events
    FOR EACH ROW EXECUTE FUNCTION public.vendor_access_event_status_once();

-- ── Which accounts are MedBrains accounts ────────────────────────────
-- The host is the part after the last @, trimmed, lower-cased, without a
-- trailing dot; it matches a domain or any subdomain of it. One definition, used
-- by the auth middleware, the API-key check and the notification queries.
CREATE OR REPLACE FUNCTION public.app_email_is_vendor(p_email text, p_domains text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_email IS NULL OR position('@' IN p_email) = 0 THEN false
        ELSE EXISTS (
            SELECT 1
              FROM unnest(p_domains) AS d(domain),
                   LATERAL (SELECT rtrim(regexp_replace(lower(btrim(p_email)), '^.*@', ''), '.')
                                AS host) h
             WHERE btrim(d.domain) <> ''
               AND (h.host = lower(btrim(d.domain))
                    OR h.host LIKE '%.' || lower(btrim(d.domain)))
        )
    END
$$;

-- ── An approved grant is what was approved ───────────────────────────
-- Once a second person has approved it, who it is for, what it opens, whether
-- it masks and when it ends are fixed. Only ending it (revoked_*) may change.
CREATE OR REPLACE FUNCTION public.vendor_access_grant_frozen_once_approved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.approved_at IS NOT NULL
       AND (NEW.grantee_user_id, NEW.scope, NEW.is_masked, NEW.expires_at,
            NEW.approved_by, NEW.approved_at, NEW.created_by)
           IS DISTINCT FROM
           (OLD.grantee_user_id, OLD.scope, OLD.is_masked, OLD.expires_at,
            OLD.approved_by, OLD.approved_at, OLD.created_by) THEN
        RAISE EXCEPTION 'an approved MedBrains access grant cannot be changed, only ended'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_access_grants_frozen BEFORE UPDATE ON public.vendor_access_grants
    FOR EACH ROW EXECUTE FUNCTION public.vendor_access_grant_frozen_once_approved();

-- ── Credentials a MedBrains account made stop working ─────────────────
CREATE TABLE public.vendor_credential_revocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    -- The MedBrains account whose credential it was.
    user_id uuid NOT NULL REFERENCES public.users(id),
    kind text NOT NULL
        CHECK (kind IN ('api_key', 'connected_app', 'paired_device', 'webhook_subscription')),
    credential_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_credential_revocations_tenant
    ON public.vendor_credential_revocations (tenant_id, created_at DESC);

ALTER TABLE public.vendor_credential_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_credential_revocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_vendor_credential_revocations
    ON public.vendor_credential_revocations
    USING (tenant_id = public.app_current_tenant())
    WITH CHECK (tenant_id = public.app_current_tenant());

CREATE TRIGGER trg_vendor_credential_revocations_no_change
    BEFORE UPDATE OR DELETE ON public.vendor_credential_revocations
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();
CREATE TRIGGER audit_vendor_credential_revocations AFTER INSERT
    ON public.vendor_credential_revocations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('security');

-- Revoke, never delete: the hospital keeps the record of what existed.
--
-- The account's own hospital is set as the tenant context while this runs, so
-- each revocation row reaches that hospital's audit chain even from the
-- back-fill below, which runs with no context; the caller's is put back after.
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

    PERFORM set_config('app.tenant_id', COALESCE(v_prev_tenant, ''), true);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_revoke_vendor_credentials
    AFTER INSERT OR UPDATE OF is_vendor_staff ON public.users
    FOR EACH ROW WHEN (NEW.is_vendor_staff)
    EXECUTE FUNCTION public.revoke_vendor_credentials();

-- Back-fill: accounts already on the default MedBrains domain become MedBrains
-- accounts now, which revokes what they made. A deployment with other domains
-- in MEDBRAINS_VENDOR_EMAIL_DOMAINS is gated at sign-in by the domain rule and
-- its credentials by the API-key and device checks; flagging those accounts is
-- the operator's step (docs/compliance/vendor-access.md).
UPDATE public.users SET is_vendor_staff = true
 WHERE NOT is_vendor_staff AND public.app_email_is_vendor(email, ARRAY['medbrains.in']);
