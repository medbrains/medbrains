-- ====================================================================
-- Migration: 1230_notifiable_detection.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: notifiable_state_overrides, notifiable_lab_rules
-- Drops: none
-- ====================================================================
-- Notifiable-disease detection from every source.
--
-- Detection ran only when an OPD doctor coded an ICD-10 diagnosis. Admissions,
-- ER visits and discharge summaries carry their diagnoses as text, ICD-11 codes
-- matched nothing, and a positive dengue NS1 or malaria smear -- the evidence
-- the IDSP L-form exists for -- never reached the worklist at all.
--
-- Everything that decides "is this notifiable, and is there already a row for
-- it" now lives here, in one place every caller shares:
--
--   notifiable_effective(tenant)    the national list, with this hospital's
--                                   state overlay applied
--   notifiable_detect(...)          one code -> at most one worklist row
--   notifiable_detect_text(...)     codes and disease names in free text
--   notifiable_detect_lab(order)    verified lab results, by notifiable_lab_rules
--
-- One row per patient, disease and episode (30 days): a disease seen in OPD,
-- then on admission, then confirmed by the lab is one report, raised to
-- lab-confirmed when the lab confirms it. A presumptive report already
-- submitted is reopened for the lab-confirmed (L) submission, keeping the
-- earlier acknowledgement in presumptive_ref.

-- ── Reference: ICD-11 codes and the plain names doctors write ─────────
ALTER TABLE public.cds_diagnosis_reference
    ADD COLUMN IF NOT EXISTS icd11_code TEXT,
    ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

-- The ICD-11 codes and the plain names live in the seed CSV
-- (medbrains-seed data/diagnosis_reference.csv), which every boot upserts.

-- ── The worklist row: what kind of case, from where, due when ─────────
ALTER TABLE public.notifiable_disease_reports
    ADD COLUMN IF NOT EXISTS case_class TEXT NOT NULL DEFAULT 'presumptive',
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lab_order_id UUID REFERENCES public.lab_orders(id),
    ADD COLUMN IF NOT EXISTS presumptive_ref TEXT,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifiable_reports_case_class_chk') THEN
        ALTER TABLE public.notifiable_disease_reports
            ADD CONSTRAINT notifiable_reports_case_class_chk
            CHECK (case_class IN ('presumptive', 'confirmed'));
    END IF;
END $$;

UPDATE public.notifiable_disease_reports
   SET source = COALESCE(source, 'opd_diagnosis'),
       due_at = COALESCE(due_at, detected_at + INTERVAL '24 hours');

CREATE INDEX IF NOT EXISTS idx_notifiable_reports_episode
    ON public.notifiable_disease_reports (tenant_id, patient_id, icd10_code, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifiable_reports_due
    ON public.notifiable_disease_reports (due_at)
    WHERE status = 'pending' AND escalated_at IS NULL;

-- ── The hospital's state overlay ──────────────────────────────────────
-- States notify more than the national list (scrub typhus, AES, Kyasanur
-- forest disease…) and occasionally less. A row here adds a disease
-- (is_notifiable) or takes a national one off this hospital's list (not).
CREATE TABLE IF NOT EXISTS public.notifiable_state_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    state_code TEXT,
    icd10_code TEXT NOT NULL,
    icd11_code TEXT,
    disease_name TEXT,
    is_notifiable BOOLEAN NOT NULL DEFAULT true,
    reporting_body TEXT,
    report_timeframe TEXT CHECK (report_timeframe IN ('24h', 'weekly')),
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    delete_reason TEXT,
    CONSTRAINT notifiable_overrides_added_disease_named
        CHECK (NOT is_notifiable OR disease_name IS NOT NULL
               OR icd10_code IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifiable_overrides_code
    ON public.notifiable_state_overrides (tenant_id, upper(icd10_code)) WHERE deleted_at IS NULL;

ALTER TABLE public.notifiable_state_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifiable_state_overrides FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_notifiable_state_overrides ON public.notifiable_state_overrides;
CREATE POLICY tenant_isolation_notifiable_state_overrides ON public.notifiable_state_overrides
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_notifiable_state_overrides ON public.notifiable_state_overrides;
CREATE TRIGGER set_updated_at_notifiable_state_overrides BEFORE UPDATE ON public.notifiable_state_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_notifiable_state_overrides_soft_delete ON public.notifiable_state_overrides;
CREATE TRIGGER trg_notifiable_state_overrides_soft_delete BEFORE DELETE ON public.notifiable_state_overrides
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Which lab results confirm which disease ───────────────────────────
-- Global reference, seeded here, read-only to the application. Patterns are
-- case-insensitive regular expressions over the parameter and test name
-- (analyte) and the reported value. Serology needs the IgM (or antigen): an
-- IgG is past infection or immunity, not a case. Lowest priority wins, so a
-- smear naming falciparum is reported as falciparum, not "malaria".
CREATE TABLE IF NOT EXISTS public.notifiable_lab_rules (
    id SERIAL PRIMARY KEY,
    priority INTEGER NOT NULL,
    analyte_pattern TEXT NOT NULL,
    positive_pattern TEXT NOT NULL,
    icd10_code TEXT NOT NULL,
    description TEXT NOT NULL
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notifiable_lab_rules FROM medbrains_app;

INSERT INTO public.notifiable_lab_rules (priority, analyte_pattern, positive_pattern, icd10_code, description)
SELECT * FROM (VALUES
  (10, '(malaria|plasmodium|\mmp\M|peripheral smear)', '(falciparum|\mp\.?\s?f\M|\mpf\M)', 'B50', 'Malaria test naming P. falciparum'),
  (11, '(malaria|plasmodium|\mmp\M|peripheral smear)', '(vivax|\mp\.?\s?v\M|\mpv\M)', 'B51', 'Malaria test naming P. vivax'),
  (12, '(malaria|plasmodium|\mmp\M)', '^\s*(positive|reactive|detected|seen|present)', 'B54', 'Malaria smear or RDT positive'),
  (20, 'dengue.*(ns1|igm)|(ns1|igm).*dengue', '^\s*(positive|reactive|detected)', 'A90', 'Dengue NS1 antigen or IgM positive'),
  (30, '(typhidot|typhi.*igm|igm.*typhi)', '^\s*(positive|reactive|detected)', 'A01.0', 'Typhoid IgM positive'),
  (31, 'culture', 'salmonella\s+(enterica\s+)?(serovar\s+)?typhi\M', 'A01.0', 'Culture grew Salmonella Typhi'),
  (32, 'culture', 'vibrio\s+cholerae', 'A00', 'Culture grew Vibrio cholerae'),
  (33, 'culture', 'corynebacterium\s+diphtheriae', 'A36', 'Culture grew C. diphtheriae'),
  (40, '(cbnaat|genexpert|xpert|truenat|\mafb\M|acid.?fast|\mmtb\M|mycobacterium)',
       '((mtb|mycobacterium( tuberculosis)?)\s+detected|^\s*(positive|detected|scanty)|\m[1-3]\s?\+)', 'A15', 'TB test detecting M. tuberculosis'),
  (50, 'leptospir.*(igm|mat)|(igm|mat).*leptospir', '^\s*(positive|reactive|detected)', 'A27', 'Leptospira IgM / MAT positive'),
  (51, 'chikungunya.*igm|igm.*chikungunya', '^\s*(positive|reactive|detected)', 'A92.0', 'Chikungunya IgM positive'),
  (52, '(japanese encephalitis|\mje\M).*igm|igm.*(japanese encephalitis|\mje\M)', '^\s*(positive|reactive|detected)', 'A83.0', 'JE IgM positive'),
  (53, 'measles.*igm|igm.*measles', '^\s*(positive|reactive|detected)', 'B05', 'Measles IgM positive'),
  (54, 'rubella.*igm|igm.*rubella', '^\s*(positive|reactive|detected)', 'B06', 'Rubella IgM positive'),
  (55, '(hav|hepatitis a).*igm|igm.*(hav|hepatitis a)', '^\s*(positive|reactive|detected)', 'B15', 'Hepatitis A IgM positive'),
  (56, '(hbc|hepatitis b core).*igm|igm.*(hbc|hepatitis b core)', '^\s*(positive|reactive|detected)', 'B16', 'Hepatitis B core IgM positive'),
  (57, '(sars.?cov.?2|covid)', '^\s*(positive|detected)', 'U07.1', 'SARS-CoV-2 detected'),
  (58, 'h1n1', '^\s*(positive|detected)', 'J09', 'Influenza A(H1N1) detected')
) AS v(priority, analyte_pattern, positive_pattern, icd10_code, description)
WHERE NOT EXISTS (SELECT 1 FROM public.notifiable_lab_rules);

-- ── The effective list: national, with this hospital's overlay ────────
CREATE OR REPLACE FUNCTION public.notifiable_effective(p_tenant UUID)
RETURNS TABLE (disease_code TEXT, icd11_code TEXT, disease_name TEXT, aliases TEXT[],
               reporting_body TEXT, report_timeframe TEXT, overridden BOOLEAN)
LANGUAGE sql STABLE AS $$
    SELECT r.icd10_code, r.icd11_code, r.name, r.aliases, r.reporting_body,
           r.report_timeframe, false
      FROM public.cds_diagnosis_reference r
     WHERE r.is_notifiable
       AND NOT EXISTS (SELECT 1 FROM public.notifiable_state_overrides o
                        WHERE o.tenant_id = p_tenant AND o.deleted_at IS NULL
                          AND upper(o.icd10_code) = r.icd10_code)
    UNION ALL
    SELECT upper(o.icd10_code), COALESCE(upper(o.icd11_code), r.icd11_code),
           COALESCE(o.disease_name, r.name), COALESCE(r.aliases, '{}'),
           COALESCE(o.reporting_body, r.reporting_body),
           COALESCE(o.report_timeframe, r.report_timeframe), true
      FROM public.notifiable_state_overrides o
      LEFT JOIN public.cds_diagnosis_reference r ON r.icd10_code = upper(o.icd10_code)
     WHERE o.tenant_id = p_tenant AND o.deleted_at IS NULL AND o.is_notifiable
$$;

-- ── One code -> at most one worklist row ──────────────────────────────
CREATE OR REPLACE FUNCTION public.notifiable_detect(
    p_tenant UUID, p_patient UUID, p_encounter UUID, p_code TEXT, p_system TEXT,
    p_case_class TEXT, p_source TEXT, p_detected_by UUID, p_lab_order UUID)
RETURNS TABLE (report_id UUID, disease_code TEXT, disease_name TEXT,
               reporting_body TEXT, outcome TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    code TEXT := upper(btrim(COALESCE(p_code, '')));
    d RECORD;
    existing RECORD;
    reopen BOOLEAN;
    window_ INTERVAL;
    rid UUID;
BEGIN
    IF code = '' THEN
        RETURN;
    END IF;
    SELECT e.* INTO d
      FROM public.notifiable_effective(p_tenant) e
     WHERE CASE WHEN p_system = 'icd11'
                THEN e.icd11_code IS NOT NULL AND (code = e.icd11_code OR code LIKE e.icd11_code || '%')
                ELSE code = e.disease_code OR code LIKE e.disease_code || '%' END
     ORDER BY length(CASE WHEN p_system = 'icd11' THEN e.icd11_code ELSE e.disease_code END) DESC
     LIMIT 1;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    window_ := CASE WHEN d.report_timeframe = 'weekly' THEN INTERVAL '7 days' ELSE INTERVAL '24 hours' END;

    -- Two paths reporting the same patient's disease at once must not both
    -- insert: serialise on patient + disease for the rest of the transaction.
    PERFORM pg_advisory_xact_lock(hashtextextended(
        p_tenant::text || COALESCE(p_patient::text, p_encounter::text, '') || d.disease_code, 0));

    SELECT r.* INTO existing
      FROM public.notifiable_disease_reports r
     WHERE r.tenant_id = p_tenant AND r.icd10_code = d.disease_code
       AND ((p_patient IS NOT NULL AND r.patient_id = p_patient
             AND r.detected_at > now() - INTERVAL '30 days')
            OR (p_encounter IS NOT NULL AND r.encounter_id = p_encounter))
     ORDER BY r.detected_at DESC
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
        IF p_case_class = 'confirmed' AND existing.case_class = 'presumptive' THEN
            reopen := existing.status <> 'pending';
            UPDATE public.notifiable_disease_reports
               SET case_class = 'confirmed',
                   confirmed_at = now(),
                   lab_order_id = COALESCE(p_lab_order, lab_order_id),
                   presumptive_ref = CASE WHEN reopen THEN report_ref ELSE presumptive_ref END,
                   report_ref = CASE WHEN reopen THEN NULL ELSE report_ref END,
                   submitted_at = CASE WHEN reopen THEN NULL ELSE submitted_at END,
                   submitted_by = CASE WHEN reopen THEN NULL ELSE submitted_by END,
                   status = 'pending',
                   due_at = CASE WHEN reopen THEN now() + window_ ELSE due_at END,
                   escalated_at = CASE WHEN reopen THEN NULL ELSE escalated_at END,
                   updated_at = now()
             WHERE id = existing.id;
            RETURN QUERY SELECT existing.id, d.disease_code, d.disease_name, d.reporting_body, 'upgraded'::text;
        ELSE
            RETURN QUERY SELECT existing.id, d.disease_code, d.disease_name, d.reporting_body, 'existing'::text;
        END IF;
        RETURN;
    END IF;

    INSERT INTO public.notifiable_disease_reports
        (tenant_id, patient_id, encounter_id, icd10_code, disease_name, reporting_body,
         detected_by, status, case_class, source, confirmed_at, lab_order_id, due_at)
    VALUES (p_tenant, p_patient, p_encounter, d.disease_code, d.disease_name, d.reporting_body,
            p_detected_by, 'pending', p_case_class, p_source,
            CASE WHEN p_case_class = 'confirmed' THEN now() END, p_lab_order, now() + window_)
    RETURNING id INTO rid;
    RETURN QUERY SELECT rid, d.disease_code, d.disease_name, d.reporting_body, 'created'::text;
END;
$$;

-- ── Codes and disease names in free text ──────────────────────────────
-- Admission, ER and discharge diagnoses are written, not coded. A code in
-- the text counts; so does a disease name, unless the words just before it
-- deny it ("no dengue", "r/o malaria", "negative for typhoid", "h/o TB").
CREATE OR REPLACE FUNCTION public.notifiable_detect_text(
    p_tenant UUID, p_patient UUID, p_encounter UUID, p_text TEXT, p_source TEXT,
    p_detected_by UUID)
RETURNS TABLE (report_id UUID, disease_code TEXT, disease_name TEXT,
               reporting_body TEXT, outcome TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    txt TEXT := COALESCE(p_text, '');
    m TEXT;
    e RECORD;
    pat TEXT;
    seen TEXT[] := '{}';
BEGIN
    IF btrim(txt) = '' THEN
        RETURN;
    END IF;
    FOR m IN SELECT DISTINCT (regexp_matches(upper(txt), '\m([A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?)\M', 'g'))[1] LOOP
        RETURN QUERY SELECT * FROM public.notifiable_detect(
            p_tenant, p_patient, p_encounter, m, 'icd10', 'presumptive', p_source, p_detected_by, NULL);
    END LOOP;
    FOR m IN SELECT DISTINCT (regexp_matches(upper(txt), '\m([1-9A-Z][A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?)\M', 'g'))[1] LOOP
        RETURN QUERY SELECT * FROM public.notifiable_detect(
            p_tenant, p_patient, p_encounter, m, 'icd11', 'presumptive', p_source, p_detected_by, NULL);
    END LOOP;
    -- Longest names first, and each match is blanked out of the text, so
    -- "vivax malaria" is reported as vivax and not again as "malaria".
    FOR e IN
        SELECT ef.disease_code, t.term
          FROM public.notifiable_effective(p_tenant) ef,
               unnest(ARRAY[ef.disease_name] || COALESCE(ef.aliases, '{}')) AS t(term)
         ORDER BY length(t.term) DESC
    LOOP
        pat := regexp_replace(lower(e.term), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
        CONTINUE WHEN NOT txt ~* ('\m' || pat || '\M');
        IF NOT txt ~* ('(^|\W)((no|not|without|excluded|negative for|ruled? out|rules out|r/o|h/o|history of)\W+|\?\s*)(\w+\W+){0,2}' || pat || '\M')
           AND NOT e.disease_code = ANY (seen) THEN
            seen := seen || e.disease_code;
            RETURN QUERY SELECT * FROM public.notifiable_detect(
                p_tenant, p_patient, p_encounter, e.disease_code, 'icd10', 'presumptive',
                p_source, p_detected_by, NULL);
        END IF;
        txt := regexp_replace(txt, '\m' || pat || '\M', ' ', 'gi');
    END LOOP;
END;
$$;

-- ── Verified lab results ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notifiable_detect_lab(
    p_tenant UUID, p_order UUID, p_detected_by UUID)
RETURNS TABLE (report_id UUID, disease_code TEXT, disease_name TEXT,
               reporting_body TEXT, outcome TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    o RECORD;
    res RECORD;
    rule_code TEXT;
BEGIN
    SELECT lo.patient_id, lo.encounter_id, COALESCE(t.name, '') || ' ' || COALESCE(t.code, '') AS test_label
      INTO o
      FROM public.lab_orders lo
      LEFT JOIN public.lab_test_catalog t ON t.id = lo.test_id AND t.tenant_id = lo.tenant_id
     WHERE lo.id = p_order AND lo.tenant_id = p_tenant;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    FOR res IN
        SELECT lower(lr.parameter_name || ' ' || o.test_label) AS analyte, btrim(lr.value) AS value
          FROM public.lab_results lr
         WHERE lr.order_id = p_order AND lr.tenant_id = p_tenant AND lr.deleted_at IS NULL
    LOOP
        -- A negative is never a case, however the rest of the value reads.
        CONTINUE WHEN res.value ~* '^\s*(not|non|no\M|negative|absent|nil)';
        SELECT r.icd10_code INTO rule_code
          FROM public.notifiable_lab_rules r
         WHERE res.analyte ~* r.analyte_pattern AND res.value ~* r.positive_pattern
         ORDER BY r.priority
         LIMIT 1;
        CONTINUE WHEN rule_code IS NULL;
        RETURN QUERY SELECT * FROM public.notifiable_detect(
            p_tenant, o.patient_id, o.encounter_id, rule_code, 'icd10', 'confirmed',
            'lab_result', p_detected_by, p_order);
    END LOOP;
END;
$$;
