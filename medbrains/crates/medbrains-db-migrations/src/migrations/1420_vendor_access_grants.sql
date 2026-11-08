-- ====================================================================
-- Migration: 1420_vendor_access_grants.sql
-- RLS-Posture: tenant-scoped (vendor_email_domains is a global catalog the boot writes)
-- Tenant-Column: tenant_id
-- New-Tables: vendor_access_grants, vendor_access_events, vendor_credential_revocations, vendor_email_domains
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
        CHECK (kind IN ('api_key', 'connected_app', 'paired_device', 'webhook_subscription',
                        'integration_pipeline', 'connector', 'automation_workflow',
                        'eod_digest_subscription')),
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

    -- Pipelines and connectors stop; an automation workflow is switched off,
    -- which also silences its inbound webhooks (the router only runs active
    -- workflows); a digest subscription stops sending to the account.
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

    WITH flows AS (
        UPDATE public.automation_workflows SET active = false
         WHERE tenant_id = NEW.tenant_id AND active
           AND (created_by = NEW.id OR run_as_user_id = NEW.id)
        RETURNING id
    )
    INSERT INTO public.vendor_credential_revocations (tenant_id, user_id, kind, credential_id)
    SELECT NEW.tenant_id, NEW.id, 'automation_workflow', id FROM flows;

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

-- No column list on the UPDATE trigger: a column-specific trigger fires on the
-- columns an UPDATE names, not on a column a BEFORE trigger changes, and the
-- flag is usually set by `users_flag_vendor_on_write` below.
CREATE TRIGGER trg_users_revoke_vendor_credentials
    AFTER UPDATE ON public.users
    FOR EACH ROW WHEN (NEW.is_vendor_staff AND NOT OLD.is_vendor_staff)
    EXECUTE FUNCTION public.revoke_vendor_credentials();
CREATE TRIGGER trg_users_revoke_vendor_credentials_on_insert
    AFTER INSERT ON public.users
    FOR EACH ROW WHEN (NEW.is_vendor_staff)
    EXECUTE FUNCTION public.revoke_vendor_credentials();

-- ── Checks for code that runs without a tenant's row security ────────
-- The outbox worker, the event gate and connector calls must know whether the
-- person who set a channel up is a vendor account, and row security must not
-- turn "could not see the user" into "not a vendor". So the check reads the
-- one flag it needs as the owner, and answers nothing else. A missing user
-- (a system-made pipeline, `created_by` NULL) is not a vendor account.
CREATE OR REPLACE FUNCTION public.app_user_is_vendor(p_user uuid, p_domains text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT u.is_vendor_staff OR public.app_email_is_vendor(u.email, p_domains)
           FROM public.users u WHERE u.id = p_user),
        false)
$$;

REVOKE ALL ON FUNCTION public.app_user_is_vendor(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_user_is_vendor(uuid, text[])
    TO medbrains_app, medbrains_outbox_worker;

-- ── The live vendor-domain list, for code inside the database ─────────
-- Global, not per hospital: the server writes the list it runs with at every
-- boot (`app_set_vendor_domains`), so the trigger below flags an account the
-- moment it is created or renamed onto a vendor domain. Seeded with the
-- default so a server that has not booted since this migration still flags.
CREATE TABLE public.vendor_email_domains (
    domain text PRIMARY KEY CHECK (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$')
);
INSERT INTO public.vendor_email_domains (domain) VALUES ('medbrains.in');
REVOKE ALL ON public.vendor_email_domains FROM PUBLIC, medbrains_app, medbrains_outbox_worker;
-- Read and written only through the SECURITY DEFINER functions below, which run
-- as the owner; row security without FORCE lets the owner through and no one
-- else.
ALTER TABLE public.vendor_email_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_email_domains_owner_only ON public.vendor_email_domains USING (false);

-- Replace the stored list with the one the server runs with.
CREATE OR REPLACE FUNCTION public.app_set_vendor_domains(p_domains text[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    DELETE FROM public.vendor_email_domains WHERE domain <> ALL (p_domains);
    INSERT INTO public.vendor_email_domains (domain)
    SELECT DISTINCT d FROM unnest(p_domains) AS d ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.app_set_vendor_domains(text[]) FROM PUBLIC;

-- The stored list, for code that may not read the table itself.
CREATE OR REPLACE FUNCTION public.app_vendor_domains()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT ARRAY(SELECT domain FROM public.vendor_email_domains ORDER BY domain)
$$;
REVOKE ALL ON FUNCTION public.app_vendor_domains() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_vendor_domains() TO medbrains_app;

-- An account created on a vendor domain is flagged then and there; the AFTER
-- trigger above revokes what it holds. Adding a MedBrains support account is
-- the intended flow, so INSERT is allowed.
--
-- Moving an existing account's address onto a vendor domain is refused from
-- the application — an administrator renaming a colleague, or anyone renaming
-- themselves — because the flag is permanent and revokes what the account set
-- up: a typo would cost a colleague their keys and channels for good. Only the
-- platform path may do it: a role that is a member of the table's owner (the
-- migration, seed and boot connections), never the request role. SECURITY
-- INVOKER so `current_user` is the caller; the domain list comes through
-- `app_vendor_domains`.
CREATE OR REPLACE FUNCTION public.users_flag_vendor_on_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_domains text[] := public.app_vendor_domains();
BEGIN
    IF NEW.is_vendor_staff OR NOT public.app_email_is_vendor(NEW.email, v_domains) THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND NOT public.app_email_is_vendor(OLD.email, v_domains)
       AND NOT pg_has_role(current_user,
                           (SELECT relowner FROM pg_class WHERE oid = 'public.users'::regclass),
                           'MEMBER') THEN
        RAISE EXCEPTION 'an existing account cannot be moved onto a MedBrains address; '
            'add a separate MedBrains account instead'
            USING ERRCODE = 'check_violation';
    END IF;
    NEW.is_vendor_staff := true;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_flag_vendor_on_write BEFORE INSERT OR UPDATE OF email ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.users_flag_vendor_on_write();

-- Flag every account on the live domain list, in every hospital: run at each
-- server start, because accounts made before this migration, or before a
-- domain joined the list, were never flagged. Idempotent; each newly flagged
-- account's revocations go to its hospital's audit chain through the trigger.
--
-- Only a mistake in the list itself stops the boot (raises, flagging no one):
--   * an entry with no dot, or a public suffix (`in`, `co.in`, ...);
--   * an entry that is, contains, or sits under a hospital's own domain (its
--     custom domain or a site domain not issued by the platform);
--   * a list that would flag more than `p_max` accounts.
-- Anything about one account is not a reason to take every hospital offline.
-- An account whose flag would leave its hospital with no active, non-deleted
-- administrator who is not a vendor account is skipped instead (still gated at
-- request time by the domain rule) and returned in `skipped`, for the server
-- to log as an error.
CREATE OR REPLACE FUNCTION public.app_flag_vendor_accounts(
    p_domains text[],
    p_public_suffixes text[],
    p_max integer,
    p_platform_domains text[]
)
RETURNS TABLE (flagged integer, skipped uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bad text[];
    v_count integer;
    v_flagged integer := 0;
    v_skipped uuid[] := '{}';
    r record;
BEGIN
    SELECT array_agg(d) INTO v_bad FROM unnest(p_domains) AS d
     WHERE position('.' IN d) = 0 OR d = ANY (p_public_suffixes);
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'vendor domain list refused: % is a single label or public suffix; '
            'every account under it would become a MedBrains account', v_bad;
    END IF;

    -- A hospital's own domains: its custom domain and its site domains, except
    -- those equal to or under a platform domain (MedBrains' own site, and the
    -- `hospital-x.medbrains.in` sites MedBrains issues to hospitals). An entry is
    -- refused when it equals one of them, sits under one, or has one under it.
    WITH own AS (
        SELECT lower(btrim(s.domain)) AS h FROM public.site_domains s
        UNION
        SELECT lower(btrim(t.custom_domain)) FROM public.tenants t
         WHERE COALESCE(btrim(t.custom_domain), '') <> ''
    )
    SELECT array_agg(DISTINCT d) INTO v_bad
      FROM unnest(p_domains) AS d, own
     WHERE NOT public.app_email_is_vendor('x@' || own.h, p_platform_domains)
       AND (public.app_email_is_vendor('x@' || own.h, ARRAY[d])
            OR public.app_email_is_vendor('x@' || d, ARRAY[own.h]));
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'vendor domain list refused: % is, contains or sits under a hospital''s '
            'own domain', v_bad;
    END IF;

    SELECT count(*) INTO v_count FROM public.users
     WHERE NOT is_vendor_staff AND deleted_at IS NULL
       AND public.app_email_is_vendor(email, p_domains);
    IF v_count > p_max THEN
        RAISE EXCEPTION 'vendor back-fill refused: it would flag % accounts, over the ceiling '
            'of % (MEDBRAINS_VENDOR_BACKFILL_MAX); check MEDBRAINS_VENDOR_EMAIL_DOMAINS',
            v_count, p_max;
    END IF;

    FOR r IN
        SELECT u.id, u.tenant_id,
               (u.is_active AND u.role::text IN ('super_admin', 'hospital_admin')) AS is_admin
          FROM public.users u
         WHERE NOT u.is_vendor_staff AND u.deleted_at IS NULL
           AND public.app_email_is_vendor(u.email, p_domains)
         ORDER BY 3, u.id
    LOOP
        IF r.is_admin AND NOT EXISTS (
            SELECT 1 FROM public.users o
             WHERE o.tenant_id = r.tenant_id AND o.id <> r.id
               AND o.is_active AND o.deleted_at IS NULL
               AND o.role::text IN ('super_admin', 'hospital_admin')
               AND NOT (o.is_vendor_staff OR public.app_email_is_vendor(o.email, p_domains))
        ) THEN
            v_skipped := v_skipped || r.id;
            CONTINUE;
        END IF;
        UPDATE public.users SET is_vendor_staff = true WHERE id = r.id;
        v_flagged := v_flagged + 1;
    END LOOP;

    flagged := v_flagged;
    skipped := v_skipped;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.app_flag_vendor_accounts(text[], text[], integer, text[]) FROM PUBLIC;

-- Back-fill: accounts already on the default MedBrains domain become MedBrains
-- accounts now, which revokes what they made — through the same guarded
-- function the boot uses, so a hospital's last administrator is skipped, not
-- locked out. A refusal here never fails the migration: the boot runs the same
-- pass with the configured list and stops there, with its reason, if the list
-- is wrong.
DO $$
BEGIN
    PERFORM public.app_flag_vendor_accounts(ARRAY['medbrains.in'], ARRAY[]::text[], 2147483647,
                                            ARRAY['medbrains.in', 'medbrains.localhost']);
EXCEPTION WHEN raise_exception THEN
    RAISE WARNING 'vendor back-fill skipped in migration 1420: %', SQLERRM;
END;
$$;
