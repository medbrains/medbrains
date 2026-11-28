-- ====================================================================
-- Migration: 1493_patient_match_candidates.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The duplicate-patient check (medbrains_server_services::patient_match)
-- read every patient of the hospital on each check, twice over:
--
-- 1. its keys were OR'ed together, and `similarity() > 0.3` can use no index;
-- 2. even written as `%`, which the trigram indexes serve, the request role
--    (medbrains_app) is under row level security, and PostgreSQL never uses
--    an operator that is not LEAKPROOF (pg_trgm's `%`, regexp_replace) as an
--    index condition ahead of a policy. Marking them LEAKPROOF needs a
--    superuser and would be untrue.
--
-- So the blocking runs here, as the table owner, one indexed arm per key:
-- similar first or last name (either way round; `%` for the index,
-- `similarity() > 0.3` for the exact old rule, the threshold pinned on the
-- function), the same date of birth, the same last ten digits of the mobile
-- (index in 1497). It keeps the old filters and order (not merged, active,
-- not deleted, not a decoy; best name match and same birth date first) and
-- returns the first p_limit patient ids only, only for a hospital the caller
-- may see (app_visible_tenants()). The caller reads the rows through
-- patients as itself, so every policy still applies to what is shown.
CREATE OR REPLACE FUNCTION public.patient_match_candidates(
    p_tenant uuid, p_first text, p_last text, p_dob date, p_phone10 text, p_limit int)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET pg_trgm.similarity_threshold = 0.3
AS $fn$
BEGIN
    -- EXECUTE, so each check is planned for the names it was given: a plan
    -- cached for any name prices the trigram arms as unselective and reads
    -- the whole hospital through the tenant index instead.
    RETURN QUERY EXECUTE $q$
    SELECT p.id FROM (
        SELECT id FROM patients WHERE tenant_id = $1 AND $2 <> ''
           AND first_name % $2 AND similarity(first_name, $2) > 0.3
        UNION SELECT id FROM patients WHERE tenant_id = $1 AND $3 <> ''
           AND last_name % $3 AND similarity(last_name, $3) > 0.3
        UNION SELECT id FROM patients WHERE tenant_id = $1 AND $2 <> ''
           AND last_name % $2 AND similarity(last_name, $2) > 0.3
        UNION SELECT id FROM patients WHERE tenant_id = $1 AND $3 <> ''
           AND first_name % $3 AND similarity(first_name, $3) > 0.3
        UNION SELECT id FROM patients WHERE tenant_id = $1 AND date_of_birth = $4
        UNION SELECT id FROM patients WHERE tenant_id = $1 AND length($5) = 10
           AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $5
    ) c
    JOIN patients p ON p.id = c.id
    WHERE $1 = ANY (public.app_visible_tenants())
      AND p.is_merged = false AND p.is_active = true AND p.deleted_at IS NULL
      AND p.id <> ALL (COALESCE(public.app_decoy_patient_ids(), '{}'))
    ORDER BY (COALESCE(similarity(p.first_name || ' ' || p.last_name, $2 || ' ' || $3), 0)
              + CASE WHEN p.date_of_birth = $4 THEN 1 ELSE 0 END) DESC
    LIMIT $6
    $q$
        USING p_tenant, p_first, p_last, p_dob, p_phone10, p_limit;
END;
$fn$;

REVOKE ALL ON FUNCTION public.patient_match_candidates(uuid, text, text, date, text, int) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_app') THEN
        GRANT EXECUTE ON FUNCTION public.patient_match_candidates(uuid, text, text, date, text, int)
            TO medbrains_app;
    END IF;
END $$;
