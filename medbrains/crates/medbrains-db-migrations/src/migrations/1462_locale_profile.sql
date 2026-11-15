-- ====================================================================
-- Migration: 1462_locale_profile.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: scoped_settings
-- Drops: default on hospital_groups.default_currency, hospital_groups.timezone;
--        tenants timezone/locale/currency/fy_start_month defaults become neutral
-- ====================================================================
-- The tenant locale profile (RFCs/RFC-WORLD-READY.md §2, #5926).
--
-- One profile, read at `locale/*` paths in the kernel's configuration tree,
-- most specific scope first: user › facility › hospital › country pack.
--
--   * Hospital scope stays in `tenant_settings`. Every tenant's profile is
--     backfilled here from the `tenants` columns it is read from today
--     (timezone, locale, currency, fy_start_month, country), so an Indian
--     hospital keeps exactly the values it has. Where a `locale/*` row already
--     existed it is overwritten by the column, because the column is what
--     every reader used.
--   * `scoped_settings` holds the narrower scopes the resolver now reads:
--     a facility (region, timezone, locale, languages, display preferences) and
--     a user (languages and display preferences only, enforced by a CHECK).
--   * The `tenants` columns become derived: a write to the profile is mirrored
--     onto them, so readers not yet moved (#5928) see the profile, never a
--     second answer. A direct write to one of those columns sets the profile
--     only when the profile has no value yet (onboarding); changing a value
--     the profile holds is refused (SQLSTATE MB409, answered 409).
--   * A profile value, once set, changes only through a locale-profile change
--     set (second-person approval, audited). The change-set writer marks its
--     transaction with `medbrains.locale_profile_writer = 'change_set'`; any
--     other writer that would change a set value is refused here, whichever
--     route it came by.
--   * `hospital_groups` loses its India defaults and `tenants` gets neutral ones;
--     existing rows keep their values.
--
-- Re-runnable, which the migration test relies on.

-- ── Backfill the hospital scope from today's columns ────────────────────
INSERT INTO public.tenant_settings (tenant_id, category, key, value)
SELECT t.id, 'locale', v.key, v.value
  FROM public.tenants t
 CROSS JOIN LATERAL (VALUES
        ('timezone', to_jsonb(t.timezone)),
        ('locale', to_jsonb(t.locale)),
        ('currency', to_jsonb(t.currency)),
        ('fiscal_year_start', to_jsonb(t.fy_start_month))
       ) AS v(key, value)
ON CONFLICT (tenant_id, category, key) DO UPDATE
   SET value = EXCLUDED.value, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;

INSERT INTO public.tenant_settings (tenant_id, category, key, value)
SELECT t.id, 'locale', 'country', to_jsonb(c.code)
  FROM public.tenants t
  JOIN public.geo_countries c ON c.id = t.country_id
ON CONFLICT (tenant_id, category, key) DO UPDATE
   SET value = EXCLUDED.value, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;

ALTER TABLE public.hospital_groups
    ALTER COLUMN default_currency DROP DEFAULT,
    ALTER COLUMN timezone DROP DEFAULT;

-- A new hospital no longer starts Indian. The columns stay NOT NULL for the
-- readers #5928 moves, so they take the neutral values the screens render
-- when a profile is missing: UTC, plain English formatting, ISO 4217 "XXX"
-- (no currency) and a calendar fiscal year. Onboarding sets the real values,
-- and its first write becomes the profile (the guard below).
ALTER TABLE public.tenants
    ALTER COLUMN timezone SET DEFAULT 'UTC',
    ALTER COLUMN locale SET DEFAULT 'en',
    ALTER COLUMN currency SET DEFAULT 'XXX',
    ALTER COLUMN fy_start_month SET DEFAULT 1;

-- ── Facility and user scopes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scoped_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    scope text NOT NULL CHECK (scope IN ('facility', 'user')),
    scope_id uuid NOT NULL,
    category text NOT NULL CHECK (length(category) >= 1),
    key text NOT NULL CHECK (length(key) >= 1),
    value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    -- A person may set how things look to them, never what is true for the
    -- hospital (RFC-WORLD-READY §2.2: no user timezone, currency or country).
    CONSTRAINT scoped_settings_user_locale_keys CHECK (
        scope <> 'user' OR category <> 'locale'
        OR key IN ('languages', 'hour_cycle', 'calendars'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoped_settings_live
    ON public.scoped_settings (tenant_id, scope, scope_id, category, key)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scoped_settings_lookup
    ON public.scoped_settings (tenant_id, category, scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_scoped_settings_deleted_at
    ON public.scoped_settings (deleted_at);

ALTER TABLE public.scoped_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoped_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_scoped_settings ON public.scoped_settings;
CREATE POLICY tenant_isolation_scoped_settings ON public.scoped_settings
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP TRIGGER IF EXISTS set_updated_at_scoped_settings ON public.scoped_settings;
CREATE TRIGGER set_updated_at_scoped_settings BEFORE UPDATE ON public.scoped_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_scoped_settings_soft_delete ON public.scoped_settings;
CREATE TRIGGER trg_scoped_settings_soft_delete BEFORE DELETE ON public.scoped_settings
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── A set profile value changes only through a change set ───────────────
CREATE OR REPLACE FUNCTION public.locale_profile_keys() RETURNS text[]
    LANGUAGE sql IMMUTABLE AS $$
    SELECT ARRAY['country', 'region', 'pack_version', 'currency', 'locale', 'languages',
                 'timezone', 'calendars', 'hour_cycle', 'week_start', 'fiscal_year_start',
                 'name_order']
$$;

CREATE OR REPLACE FUNCTION public.locale_profile_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    zone text := NEW.value #>> '{}';
BEGIN
    -- Every writer, the change set included, stores only an IANA zone name
    -- every platform accepts (validate.rs `check_zone_name`): an abbreviation
    -- or POSIX string (IST, GMT+4) breaks Intl and shifts prints.
    IF NEW.key = 'timezone' AND NEW.deleted_at IS NULL AND NOT (
           zone = 'UTC'
        OR (zone LIKE '%/%' AND zone NOT LIKE 'posix/%' AND zone NOT LIKE 'right/%'
            AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = zone))) THEN
        RAISE EXCEPTION '"%" is not an IANA time zone; use a name such as Asia/Kolkata', zone
            USING ERRCODE = '23514';
    END IF;
    IF current_setting('medbrains.locale_profile_writer', true) = 'change_set' THEN
        RETURN NEW;
    END IF;
    -- First set (onboarding), or setting a key that was removed: allowed.
    IF TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.value IS DISTINCT FROM OLD.value OR NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'The hospital''s % is part of its locale profile; change it in Settings, Locale profile, where a second person approves it', OLD.key
            USING ERRCODE = 'MB409';
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tenant_settings_locale_guard ON public.tenant_settings;
CREATE TRIGGER trg_tenant_settings_locale_guard
    BEFORE INSERT OR UPDATE ON public.tenant_settings
    FOR EACH ROW WHEN (NEW.category = 'locale' AND NEW.key = ANY (public.locale_profile_keys()))
    EXECUTE FUNCTION public.locale_profile_guard();

DROP TRIGGER IF EXISTS trg_scoped_settings_locale_guard ON public.scoped_settings;
CREATE TRIGGER trg_scoped_settings_locale_guard
    BEFORE INSERT OR UPDATE ON public.scoped_settings
    FOR EACH ROW WHEN (NEW.scope = 'facility' AND NEW.category = 'locale')
    EXECUTE FUNCTION public.locale_profile_guard();

-- ── The tenants columns follow the profile ──────────────────────────────
CREATE OR REPLACE FUNCTION public.locale_profile_mirror() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v text := NEW.value #>> '{}';
BEGIN
    -- Written by the tenants guard below: the tenants row already holds it.
    IF pg_trigger_depth() > 1 OR NEW.deleted_at IS NOT NULL OR v IS NULL THEN
        RETURN NULL;
    END IF;
    CASE NEW.key
        WHEN 'timezone' THEN UPDATE public.tenants SET timezone = v WHERE id = NEW.tenant_id;
        WHEN 'locale' THEN UPDATE public.tenants SET locale = v WHERE id = NEW.tenant_id;
        WHEN 'currency' THEN UPDATE public.tenants SET currency = v WHERE id = NEW.tenant_id;
        WHEN 'fiscal_year_start' THEN
            UPDATE public.tenants SET fy_start_month = v::integer WHERE id = NEW.tenant_id;
        WHEN 'country' THEN
            UPDATE public.tenants
               SET country_id = (SELECT c.id FROM public.geo_countries c WHERE c.code = v)
             WHERE id = NEW.tenant_id;
        ELSE NULL;
    END CASE;
    RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_tenant_settings_locale_mirror ON public.tenant_settings;
CREATE TRIGGER trg_tenant_settings_locale_mirror
    AFTER INSERT OR UPDATE ON public.tenant_settings
    FOR EACH ROW WHEN (NEW.category = 'locale'
        AND NEW.key IN ('timezone', 'locale', 'currency', 'fiscal_year_start', 'country'))
    EXECUTE FUNCTION public.locale_profile_mirror();

-- One column of `tenants` written directly: set the profile if it has no
-- value, refuse if it holds a different one.
CREATE OR REPLACE FUNCTION public.locale_profile_from_tenant(
    p_tenant uuid, p_key text, p_value jsonb
) RETURNS void
    LANGUAGE plpgsql AS $$
DECLARE
    held jsonb;
BEGIN
    SELECT value INTO held FROM public.tenant_settings
     WHERE tenant_id = p_tenant AND category = 'locale' AND key = p_key AND deleted_at IS NULL;
    -- Clearing a column the profile holds is a change too: refused, so the
    -- column and the profile never disagree.
    IF p_value IS NULL OR p_value = 'null'::jsonb THEN
        IF held IS NOT NULL THEN
            RAISE EXCEPTION 'The hospital''s % is part of its locale profile; change it in Settings, Locale profile, where a second person approves it', p_key
                USING ERRCODE = 'MB409';
        END IF;
        RETURN;
    END IF;
    IF held IS NULL THEN
        INSERT INTO public.tenant_settings (tenant_id, category, key, value)
        VALUES (p_tenant, 'locale', p_key, p_value)
        ON CONFLICT (tenant_id, category, key) DO UPDATE
           SET value = EXCLUDED.value, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;
    ELSIF held IS DISTINCT FROM p_value THEN
        RAISE EXCEPTION 'The hospital''s % is part of its locale profile; change it in Settings, Locale profile, where a second person approves it', p_key
            USING ERRCODE = 'MB409';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.tenants_locale_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    -- The mirror above is writing what the profile already says.
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    IF NEW.timezone IS DISTINCT FROM OLD.timezone THEN
        PERFORM public.locale_profile_from_tenant(NEW.id, 'timezone', to_jsonb(NEW.timezone));
    END IF;
    IF NEW.locale IS DISTINCT FROM OLD.locale THEN
        PERFORM public.locale_profile_from_tenant(NEW.id, 'locale', to_jsonb(NEW.locale));
    END IF;
    IF NEW.currency IS DISTINCT FROM OLD.currency THEN
        PERFORM public.locale_profile_from_tenant(NEW.id, 'currency', to_jsonb(NEW.currency));
    END IF;
    IF NEW.fy_start_month IS DISTINCT FROM OLD.fy_start_month THEN
        PERFORM public.locale_profile_from_tenant(
            NEW.id, 'fiscal_year_start', to_jsonb(NEW.fy_start_month));
    END IF;
    IF NEW.country_id IS DISTINCT FROM OLD.country_id THEN
        PERFORM public.locale_profile_from_tenant(NEW.id, 'country',
            (SELECT to_jsonb(c.code) FROM public.geo_countries c WHERE c.id = NEW.country_id));
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tenants_locale_guard ON public.tenants;
CREATE TRIGGER trg_tenants_locale_guard
    BEFORE UPDATE OF timezone, locale, currency, fy_start_month, country_id ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.tenants_locale_guard();

-- ── Knowledge change sets learn the locale-profile area ─────────────────
ALTER TABLE public.knowledge_change_sets
    DROP CONSTRAINT IF EXISTS knowledge_change_sets_area_check,
    ADD CONSTRAINT knowledge_change_sets_area_check
        CHECK (area IN ('drug_interactions', 'critical_value_rules', 'flow_switches',
                        'locale_profile'));
