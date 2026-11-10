-- ====================================================================
-- Migration: 1401_security_intel.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: security_check_runs, security_honeytokens
-- Drops: none
-- ====================================================================
-- Security intelligence, phase 1 (RFC-OSINT §3.1, §3.3, §3a).
--
-- vulnerabilities: findings from the continuous checks land in the existing
-- table. A finding is identified by (check, asset, key); the same finding
-- seen again updates last_seen_at instead of adding a row, and a resolved
-- one re-opens. 'accepted' (risk accepted) does not re-open.
--
-- security_check_runs: one heartbeat per check run per hospital. A check
-- that stops reporting is itself an alert ("watch the watchers"); rows older
-- than the runner's retention are deleted by the runner (churn table, no
-- soft-delete guardrail).
--
-- security_honeytokens: decoy patients and a decoy API key per hospital.
-- Decoy patients are hidden from the request role by a restrictive policy
-- on patients, so no list, search, count or report built on it can show
-- them. A read that names one anyway (it can only come from exfiltrated
-- data) and any use of the decoy key raises a critical finding at once.

ALTER TABLE public.vulnerabilities
    ADD COLUMN check_key text,
    ADD COLUMN finding_key text,
    ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN how_to_fix text,
    ADD COLUMN owner_id uuid REFERENCES public.users(id),
    ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN occurrences integer NOT NULL DEFAULT 1,
    ADD COLUMN reopened_count integer NOT NULL DEFAULT 0,
    ADD COLUMN incident_id uuid REFERENCES public.security_incidents(id);
ALTER TABLE public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_severity_words
        CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT VALID,
    ADD CONSTRAINT vulnerabilities_status_words
        CHECK (remediation_status IS NULL
               OR remediation_status IN ('open', 'in_progress', 'resolved', 'accepted')) NOT VALID,
    ADD CONSTRAINT vulnerabilities_check_identity
        CHECK ((check_key IS NULL) = (finding_key IS NULL));
CREATE UNIQUE INDEX uq_vulnerabilities_finding
    ON public.vulnerabilities (tenant_id, check_key, affected_component, finding_key)
    WHERE check_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_vulnerabilities_owner ON public.vulnerabilities (owner_id);
CREATE INDEX idx_vulnerabilities_incident ON public.vulnerabilities (incident_id);

-- Record a finding: insert, or merge into the open one with the same identity.
CREATE OR REPLACE FUNCTION public.security_upsert_finding(
    p_tenant uuid, p_check text, p_asset text, p_key text, p_title text,
    p_severity text, p_evidence jsonb, p_how_to_fix text, p_cve text
) RETURNS uuid
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
    INSERT INTO vulnerabilities AS v (
        tenant_id, check_key, affected_component, finding_key, title, severity,
        evidence, how_to_fix, cve_id, discovered_at, last_seen_at, remediation_status)
    VALUES (p_tenant, p_check, p_asset, p_key, p_title, p_severity,
            COALESCE(p_evidence, '{}'::jsonb), p_how_to_fix, p_cve, now(), now(), 'open')
    ON CONFLICT (tenant_id, check_key, affected_component, finding_key)
        WHERE check_key IS NOT NULL AND deleted_at IS NULL
    DO UPDATE SET
        title = EXCLUDED.title,
        severity = EXCLUDED.severity,
        evidence = EXCLUDED.evidence,
        how_to_fix = EXCLUDED.how_to_fix,
        cve_id = EXCLUDED.cve_id,
        last_seen_at = now(),
        occurrences = v.occurrences + 1,
        reopened_count = v.reopened_count + (v.remediation_status = 'resolved')::int,
        remediation_status = CASE WHEN v.remediation_status = 'resolved' THEN 'open'
                                  ELSE v.remediation_status END,
        remediated_at = CASE WHEN v.remediation_status = 'resolved' THEN NULL
                             ELSE v.remediated_at END,
        remediated_by = CASE WHEN v.remediation_status = 'resolved' THEN NULL
                             ELSE v.remediated_by END,
        updated_at = now()
    RETURNING v.id
$$;

CREATE TABLE public.security_check_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    check_key text NOT NULL CHECK (length(check_key) BETWEEN 1 AND 80),
    started_at timestamptz NOT NULL,
    finished_at timestamptz NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('ok', 'error', 'not_applicable')),
    findings_count integer NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT security_check_runs_error_shape CHECK ((outcome = 'error') = (error IS NOT NULL))
);
CREATE INDEX idx_security_check_runs_latest
    ON public.security_check_runs (tenant_id, check_key, started_at DESC);
CREATE INDEX idx_security_check_runs_due ON public.security_check_runs (check_key, started_at DESC);
ALTER TABLE public.security_check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_check_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_security_check_runs ON public.security_check_runs
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TABLE public.security_honeytokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    kind text NOT NULL CHECK (kind IN ('patient', 'api_key')),
    patient_id uuid REFERENCES public.patients(id),
    key_fingerprint text UNIQUE,
    -- What a finding calls it (the decoy's UHID): read without touching
    -- patients, whose policy hides the decoy even from these functions.
    label text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT security_honeytokens_shape CHECK (
        (kind = 'patient' AND patient_id IS NOT NULL AND key_fingerprint IS NULL)
        OR (kind = 'api_key' AND patient_id IS NULL AND key_fingerprint IS NOT NULL))
);
CREATE UNIQUE INDEX uq_security_honeytokens_patient
    ON public.security_honeytokens (tenant_id, patient_id) WHERE patient_id IS NOT NULL;
-- ENABLE without FORCE, like api_keys (0970): the definer functions below run
-- as the owner and must find a decoy key before any tenant is known. The
-- request role is denied the table outright (REVOKE below), so the missing
-- FORCE opens nothing to it.
ALTER TABLE public.security_honeytokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_security_honeytokens ON public.security_honeytokens
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER trg_security_honeytokens_soft_delete BEFORE DELETE ON public.security_honeytokens
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
-- The request role never reads the registry itself: only the definer
-- functions below do, so an injected query cannot list the decoys.
REVOKE ALL ON public.security_honeytokens FROM medbrains_app;

-- The current hospital's decoy patients. Definer, so the policy below works
-- for a role that may not read the registry.
CREATE OR REPLACE FUNCTION public.app_decoy_patient_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(array_agg(h.patient_id), '{}'::uuid[])
      FROM security_honeytokens h
     WHERE h.kind = 'patient' AND h.deleted_at IS NULL
       AND h.tenant_id::text = current_setting('app.tenant_id', true)
$$;

-- Restrictive: ANDed with tenant isolation. The scalar sub-select makes it
-- one evaluation per query (an InitPlan), not one per row.
CREATE POLICY patients_hide_honeytokens ON public.patients AS RESTRICTIVE
    USING (id <> ALL (COALESCE((SELECT public.app_decoy_patient_ids()), '{}'::uuid[])));

-- A decoy patient was named by someone: a critical finding, now.
CREATE OR REPLACE FUNCTION public.security_honeytoken_hit(
    p_tenant uuid, p_patient uuid, p_user uuid, p_via text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uhid text;
    v_who text;
BEGIN
    SELECT h.label INTO v_uhid
      FROM security_honeytokens h
     WHERE h.tenant_id = p_tenant AND h.patient_id = p_patient
       AND h.kind = 'patient' AND h.deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    SELECT u.username INTO v_who FROM users u WHERE u.id = p_user AND u.tenant_id = p_tenant;
    PERFORM security_upsert_finding(
        p_tenant, 'honeytoken.access', 'Decoy patient ' || v_uhid,
        'user:' || COALESCE(p_user::text, 'unknown'),
        'Decoy patient record opened by ' || COALESCE(v_who, 'an unknown user'),
        'critical',
        jsonb_build_object('user_id', p_user, 'username', v_who, 'via', p_via, 'at', now()),
        'No workflow ever opens this record: its ID can only come from copied data or '
        || 'guessing. Open an incident, find who used this account and how they got the '
        || 'ID, and reset the account''s password and sessions.',
        NULL);
    RETURN true;
END
$$;

-- Every writer of access_log (the read logger, the audit screen, the
-- mental-health gate) goes through this one trigger.
CREATE OR REPLACE FUNCTION public.security_access_log_honeytoken() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM security_honeytoken_hit(NEW.tenant_id, NEW.patient_id, NEW.user_id,
                                    'access_log:' || NEW.entity_type);
    RETURN NULL;
END
$$;
CREATE TRIGGER trg_access_log_honeytoken AFTER INSERT ON public.access_log
    FOR EACH ROW WHEN (NEW.patient_id IS NOT NULL)
    EXECUTE FUNCTION public.security_access_log_honeytoken();

-- The decoy API key was presented. Called before the caller has a tenant
-- (the key is how a tenant is learned), so definer and keyed on the hash.
CREATE OR REPLACE FUNCTION public.app_honeytoken_key_hit(p_fingerprint text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant uuid;
BEGIN
    SELECT h.tenant_id INTO v_tenant FROM security_honeytokens h
     WHERE h.key_fingerprint = p_fingerprint AND h.kind = 'api_key' AND h.deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    -- vulnerabilities is FORCE RLS: write as the key's hospital.
    PERFORM set_config('app.tenant_id', v_tenant::text, true);
    PERFORM security_upsert_finding(
        v_tenant, 'honeytoken.access', 'Decoy API key', 'api_key',
        'Decoy API key was used', 'critical',
        jsonb_build_object('at', now()),
        'This key was never issued to anyone; it exists only in the hospital''s stored '
        || 'settings. Someone has a copy of the database or its settings. Open an incident '
        || 'and rotate every real API key and integration secret.',
        NULL);
    RETURN true;
END
$$;

GRANT EXECUTE ON FUNCTION public.app_honeytoken_key_hit(text) TO PUBLIC;
