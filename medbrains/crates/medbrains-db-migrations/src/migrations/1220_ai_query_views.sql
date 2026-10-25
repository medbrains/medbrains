-- ====================================================================
-- Migration: 1220_ai_query_views.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ai_query_log
-- Drops: none
-- ====================================================================
-- What the assistant may query when no report answers the question.
--
-- The assistant (permission `ai.assistant.query`) may write one SELECT. It
-- runs as `medbrains_ai_query`, which can read the views in schema `ai_query`
-- and nothing else: no table in `public`, no catalogue table, no write. The
-- server also parses the statement first and runs it read-only, time-boxed
-- and audited, so the views are the second wall, not the only one.
--
-- The views are curated from the field classes (medbrains-authz
-- field_class.rs):
--   * no Identifying field: no name, UHID, phone, address, ABHA or ID number.
--     A patient appears only as `patient_key`, a hash that lets a query count
--     distinct patients and join views, and that matches nothing outside them.
--   * no Sensitive free text: no notes, complaints, findings or narrative
--     diagnoses. Coded diagnoses only.
--   * no Restricted or Sealed record: medico-legal admissions, and diagnoses
--     and lab tests in a restricted clinical class (HIV/STI, mental health,
--     substance use, PCPNDT, reproductive care, medico-legal) are not in the
--     views at all, so they are in no count either. The server withholds any
--     row that still names a class, as it does for every tool result.
--   * money (`billing.amount`) only in invoices, payments, claims and
--     pharmacy_sales, which the server opens only to holders of
--     `billing.reports.view`.
--
-- The views belong to `medbrains_ai_query_owner`, which is not the tables'
-- owner and does not bypass row level security, so every base table's policy
-- applies as it does to a request. Each view also keeps to the hospital the
-- session works at (`app_current_tenant()`), even in a group that shares
-- records: a query is about one hospital.
--
-- `ai_query_log` records every query the assistant ran or tried: the
-- statement, who asked, the outcome, rows and time. It also shows which
-- questions needed a query because no report answered them.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_ai_query_owner') THEN
        CREATE ROLE medbrains_ai_query_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_ai_query') THEN
        CREATE ROLE medbrains_ai_query NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION NOBYPASSRLS;
    END IF;
END $$;

-- The migrating owner hands the views over; the request role switches to the
-- query role for one statement (SET LOCAL ROLE).
GRANT medbrains_ai_query_owner TO CURRENT_USER;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_app') THEN
        GRANT medbrains_ai_query TO medbrains_app;
    END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS ai_query_private;
CREATE SCHEMA IF NOT EXISTS ai_query;
REVOKE ALL ON SCHEMA ai_query_private FROM PUBLIC;
REVOKE ALL ON SCHEMA ai_query FROM PUBLIC;
GRANT USAGE ON SCHEMA ai_query_private TO medbrains_ai_query_owner;
GRANT USAGE, CREATE ON SCHEMA ai_query TO medbrains_ai_query_owner;
GRANT USAGE ON SCHEMA ai_query TO medbrains_ai_query;

-- Text naming a restricted clinical class. Mirrors the markers in
-- medbrains-core ai_redact/sensitive.rs, which the server applies again.
CREATE OR REPLACE FUNCTION ai_query_private.restricted_text(t text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COALESCE(t ~* (
        '\mhiv\M|plhiv|retrovir|\mictc\M|\mcd4\M|viral\s+load|syphilis|\mvdrl\M|\mrpr\M|\mtpha\M'
        || '|gonorrh|chlamydia|\mstds?\M|\mstis?\M|genital\s+(herpes|wart|ulcer)'
        || '|schizo|bipolar|psychos[ie]s|psychotic|depressive\s+disorder|major\s+depress|suicid'
        || '|self[- ]harm|mental\s+health|psychiatr|antipsychotic|obsessive[- ]compulsive|\mptsd\M'
        || '|sex\s+determination|f[oe]etal\s+sex|pc\s*-?\s*pndt|\mpndt\M'
        || '|\mmlc\M|medico[- ]?legal|\mpocso\M|sexual\s+assault|\mrape\M|\massault\M'
        || '|alcohol\s+(dependence|use\s+disorder|withdrawal)|opioid\s+(dependence|use\s+disorder|substitution)'
        || '|substance\s+(use|abuse|dependence)|de-?\s?addiction|buprenorphine|methadone|naltrexone'
        || '|\mivf\M|in\s+vitro\s+fertili|\micsi\M|\miui\M|embryo|oocyte|surrogacy|\mmtp\M'
        || '|medical\s+termination|abortion|termination\s+of\s+pregnancy|semen\s+analysis|sperm\s+(donor|bank)'
    ), false)
$$;

-- ICD-10 codes that are a restricted class on their own (sensitive.rs
-- class_of_icd): F, B20-B24, A50-A64, Z21, Z31, O04, X60-X99, Y00-Y09.
CREATE OR REPLACE FUNCTION ai_query_private.restricted_icd(code text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COALESCE(upper(btrim(code)) ~ '^(F|B2[0-4]|A5[0-9]|A6[0-4]|Z21|Z31|O04|X[6-9][0-9]|Y0[0-9])', false)
$$;

CREATE OR REPLACE FUNCTION ai_query_private.patient_key(tenant uuid, patient uuid) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT CASE WHEN patient IS NULL THEN NULL ELSE md5(tenant::text || ':' || patient::text) END $$;

-- A function in a view runs as the querying role, so both roles call these.
-- They are pure: no table, no side effect.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ai_query_private FROM PUBLIC;
GRANT USAGE ON SCHEMA ai_query_private TO medbrains_ai_query;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ai_query_private
    TO medbrains_ai_query_owner, medbrains_ai_query;

GRANT SELECT ON public.tenants, public.hospital_groups, public.departments, public.users,
    public.encounters, public.admissions, public.wards, public.beds, public.diagnoses,
    public.lab_orders, public.lab_test_catalog, public.lab_results, public.invoices,
    public.payments, public.insurance_claims, public.pharmacy_pos_sales,
    public.incident_reports
    TO medbrains_ai_query_owner;

-- Every table policy calls app_visible_tenants(), and a function in a policy
-- runs as the querying role, not the view's owner. It reads these columns —
-- ids and flags, no names — so the query role may read them and no more.
GRANT SELECT (id, group_id, is_active) ON public.tenants TO medbrains_ai_query;
GRANT SELECT (id, deleted_at, share_clinical_records) ON public.hospital_groups
    TO medbrains_ai_query;

CREATE OR REPLACE VIEW ai_query.departments AS
SELECT d.name AS department, d.department_type::text AS department_type, d.is_active
FROM public.departments d
WHERE d.tenant_id = public.app_current_tenant() AND d.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai_query.visits AS
SELECT e.encounter_date AS visit_date,
       e.encounter_type::text AS encounter_type,
       e.visit_type,
       e.status::text AS status,
       dep.name AS department,
       doc.full_name AS doctor,
       ai_query_private.patient_key(e.tenant_id, e.patient_id) AS patient_key
FROM public.encounters e
LEFT JOIN public.departments dep ON dep.id = e.department_id
LEFT JOIN public.users doc ON doc.id = e.doctor_id
WHERE e.tenant_id = public.app_current_tenant() AND e.deleted_at IS NULL
  AND NOT COALESCE(e.is_dummy, false);

CREATE OR REPLACE VIEW ai_query.admissions AS
SELECT a.admitted_at,
       a.discharged_at,
       a.status::text AS status,
       dep.name AS department,
       w.name AS ward,
       a.ip_type::text AS ip_type,
       a.admission_source::text AS admission_source,
       a.discharge_type::text AS discharge_type,
       a.priority,
       a.is_critical,
       (COALESCE(a.discharged_at, now())::date - a.admitted_at::date) AS length_of_stay_days,
       ai_query_private.patient_key(a.tenant_id, a.patient_id) AS patient_key
FROM public.admissions a
LEFT JOIN public.departments dep ON dep.id = a.department_id
LEFT JOIN public.wards w ON w.id = a.ward_id
WHERE a.tenant_id = public.app_current_tenant() AND a.deleted_at IS NULL
  AND NOT COALESCE(a.is_dummy, false) AND a.mlc_case_id IS NULL;

CREATE OR REPLACE VIEW ai_query.diagnoses AS
SELECT e.encounter_date AS diagnosed_on,
       e.encounter_type::text AS encounter_type,
       dep.name AS department,
       d.icd_code,
       COALESCE(d.icd_display, d.description) AS diagnosis,
       d.is_primary,
       ai_query_private.patient_key(e.tenant_id, e.patient_id) AS patient_key
FROM public.diagnoses d
JOIN public.encounters e ON e.id = d.encounter_id
LEFT JOIN public.departments dep ON dep.id = e.department_id
WHERE d.tenant_id = public.app_current_tenant() AND d.deleted_at IS NULL
  AND e.deleted_at IS NULL AND NOT COALESCE(e.is_dummy, false)
  AND NOT ai_query_private.restricted_icd(d.icd_code)
  AND NOT ai_query_private.restricted_text(COALESCE(d.icd_display, d.description));

CREATE OR REPLACE VIEW ai_query.lab_orders AS
SELECT COALESCE(o.order_date, o.created_at) AS ordered_at,
       t.name AS test,
       dep.name AS department,
       o.status::text AS status,
       o.priority::text AS priority,
       o.is_stat,
       o.collected_at,
       o.completed_at,
       (EXTRACT(EPOCH FROM (o.completed_at - COALESCE(o.collected_at, o.created_at))) / 60)::integer
           AS turnaround_minutes,
       EXISTS (SELECT 1 FROM public.lab_results r
               WHERE r.order_id = o.id AND r.deleted_at IS NULL AND r.is_critical) AS has_critical_result,
       ai_query_private.patient_key(o.tenant_id, o.patient_id) AS patient_key
FROM public.lab_orders o
LEFT JOIN public.lab_test_catalog t ON t.id = o.test_id
LEFT JOIN public.departments dep ON dep.id = o.department_id
WHERE o.tenant_id = public.app_current_tenant()
  AND NOT ai_query_private.restricted_text(t.name);

CREATE OR REPLACE VIEW ai_query.invoices AS
SELECT COALESCE(i.invoice_date, i.created_at) AS invoice_date,
       i.status::text AS status,
       dep.name AS department,
       doc.full_name AS doctor,
       i.is_interim,
       i.subtotal, i.discount_amount, i.tax_amount, i.total_amount, i.paid_amount,
       ai_query_private.patient_key(i.tenant_id, i.patient_id) AS patient_key
FROM public.invoices i
LEFT JOIN public.departments dep ON dep.id = i.department_id
LEFT JOIN public.users doc ON doc.id = i.doctor_id
WHERE i.tenant_id = public.app_current_tenant() AND i.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai_query.payments AS
SELECT p.paid_at, p.amount, p.mode::text AS mode, p.payment_type, p.status
FROM public.payments p
WHERE p.tenant_id = public.app_current_tenant() AND p.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai_query.insurance_claims AS
SELECT c.submitted_at, c.settled_at, c.status, c.claim_type,
       c.scheme_type::text AS scheme_type, c.insurance_provider, c.tpa_name,
       c.claim_amount, c.pre_auth_amount, c.approved_amount, c.settled_amount,
       ai_query_private.patient_key(c.tenant_id, c.patient_id) AS patient_key
FROM public.insurance_claims c
WHERE c.tenant_id = public.app_current_tenant();

CREATE OR REPLACE VIEW ai_query.pharmacy_sales AS
SELECT COALESCE(s.business_date, s.created_at::date) AS sale_date,
       s.status, s.payment_mode::text AS payment_mode,
       s.subtotal, s.discount_amount, s.gst_amount, s.total_amount, s.refund_amount
FROM public.pharmacy_pos_sales s
WHERE s.tenant_id = public.app_current_tenant() AND s.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai_query.staff AS
SELECT dep.name AS department, u.role::text AS role, u.designation, u.is_active, u.date_of_joining
FROM public.users u
LEFT JOIN public.departments dep ON dep.id = u.department_id
WHERE u.tenant_id = public.app_current_tenant() AND u.deleted_at IS NULL
  AND u.role::text NOT IN ('service_account', 'display_device');

CREATE OR REPLACE VIEW ai_query.beds AS
SELECT w.name AS ward, w.ward_type::text AS ward_type, b.is_occupied
FROM public.beds b
LEFT JOIN public.wards w ON w.id = b.ward_id
WHERE b.tenant_id = public.app_current_tenant() AND b.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai_query.incidents AS
SELECT i.incident_date, i.incident_type, i.incident_category,
       COALESCE(i.severity_level, i.severity) AS severity,
       dep.name AS department, i.patient_involved, i.patient_harm_level
FROM public.incident_reports i
LEFT JOIN public.departments dep ON dep.id = i.department_id
WHERE i.tenant_id = public.app_current_tenant() AND i.deleted_at IS NULL;

DO $$
DECLARE v text;
BEGIN
    FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'ai_query' LOOP
        EXECUTE format('ALTER VIEW ai_query.%I OWNER TO medbrains_ai_query_owner', v);
        EXECUTE format('GRANT SELECT ON ai_query.%I TO medbrains_ai_query', v);
    END LOOP;
END $$;

CREATE TABLE public.ai_query_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    conversation_id uuid,
    run_id uuid,
    model text NOT NULL,
    question text NOT NULL,
    sql text NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('ok', 'refused', 'failed', 'timeout')),
    reason text,
    row_count integer CHECK (row_count >= 0),
    duration_ms integer NOT NULL CHECK (duration_ms >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_ai_query_log_tenant_created ON public.ai_query_log (tenant_id, created_at DESC);
CREATE INDEX idx_ai_query_log_user ON public.ai_query_log (user_id);

ALTER TABLE public.ai_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_query_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_query_log ON public.ai_query_log
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_ai_query_log BEFORE UPDATE ON public.ai_query_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ai_query_log_soft_delete BEFORE DELETE ON public.ai_query_log
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
