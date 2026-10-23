-- ====================================================================
-- Migration: 1198_mental_health_restriction.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Mental Healthcare Act 2017 s.23: information about a person's mental
-- health care is confidential. `psych_patients.is_restricted` defaulted to
-- true and nothing read it — the psychiatry list returned every enrolled
-- patient in the tenant to anyone holding the module permission, and a
-- schizophrenia diagnosis showed on the timeline, the diagnosis list, the
-- lab requisition and in the assistant's context for everyone who could
-- open the chart.
--
-- One rule, written once, used by every query that can carry mental-health
-- content (so a list filters in the same query instead of checking rows one
-- by one):
--
--   mental-health content about a patient is withheld from a viewer unless
--     the viewer may see every restricted record (bypass role, or holds
--       specialty.psychiatry.restricted.view — decided in Rust, passed in),
--     or the patient's psychiatric record is not restricted,
--     or the viewer is its treating psychiatrist,
--     or the viewer is in an active break-glass session for the patient
--       that names psychiatry.
--
-- A patient with no psychiatric record is treated as restricted: a
-- depression diagnosis made in general OPD is no less confidential.
-- Functions are SECURITY INVOKER, so tenant RLS still applies inside them.

-- 1. Which codes are mental-health content: ICD-10 chapter V (F00-F99) and
--    ICD-11 chapter 06 (6A00-6E8Z). SNOMED-only codings are not caught —
--    there is no concept hierarchy in the database to subsume them under
--    74732009 |Mental disorder|.
CREATE OR REPLACE FUNCTION public.is_mental_health_code(p_system text, p_code text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_code IS NOT NULL AND CASE COALESCE(p_system, 'icd10')
    WHEN 'icd10' THEN upper(btrim(p_code)) ~ '^F[0-9]{2}'
    WHEN 'icd11' THEN upper(btrim(p_code)) ~ '^6[A-E][0-9]'
    ELSE false
  END;
$$;

-- 2. An active break-glass session by this viewer on this patient whose
--    requested modules name psychiatry. A general break-glass into the
--    chart does not open the psychiatric record: the reason has to say so.
CREATE OR REPLACE FUNCTION public.mental_health_break_glass_active(p_patient uuid, p_viewer uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM break_glass_events b
     WHERE b.patient_id = p_patient AND b.user_id = p_viewer
       AND b.is_active AND b.end_time IS NULL AND b.expires_at > now()
       AND b.deleted_at IS NULL
       AND 'psychiatry' = ANY (b.requested_modules)
  );
$$;

-- 3. The rule itself.
CREATE OR REPLACE FUNCTION public.mental_health_withheld(
  p_patient uuid, p_viewer uuid, p_can_all boolean
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT p_can_all
     AND NOT EXISTS (
       SELECT 1 FROM psych_patients pp
        WHERE pp.patient_id = p_patient AND pp.deleted_at IS NULL
          AND (NOT pp.is_restricted OR pp.treating_psychiatrist_id = p_viewer)
     )
     AND NOT public.mental_health_break_glass_active(p_patient, p_viewer);
$$;

-- 4. For a diagnosis row: withheld when it is mental-health content, the
--    viewer did not record it themselves, and the rule above withholds it.
CREATE OR REPLACE FUNCTION public.mental_health_diagnosis_withheld(
  p_system text, p_code text, p_recorded_by uuid,
  p_patient uuid, p_viewer uuid, p_can_all boolean
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.is_mental_health_code(p_system, p_code)
     AND p_recorded_by IS DISTINCT FROM p_viewer
     AND public.mental_health_withheld(p_patient, p_viewer, p_can_all);
$$;

-- 5. ECT requires informed consent (MHCA 2017). The column
--    defaulted to true, so a row inserted without the field claimed consent.
ALTER TABLE public.psych_ect_register ALTER COLUMN consent_obtained SET DEFAULT false;
