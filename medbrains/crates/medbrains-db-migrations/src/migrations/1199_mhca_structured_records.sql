-- ====================================================================
-- Migration: 1199_mhca_structured_records.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: psych_admissions, psych_nominated_representatives, psych_advance_directives, psych_directive_challenges, psych_screenings
-- Drops: psych_patients.nominated_rep_name, psych_patients.nominated_rep_relation, psych_patients.nominated_rep_contact, psych_patients.advance_directive_text
-- ====================================================================
-- Mental Healthcare Act 2017, as structured records instead of free text.
--
--   psych_admissions        one legal episode: s.86 independent, s.87 minor,
--                           s.89 supported (<=30 d), s.90 supported beyond
--                           30 d, s.94 emergency (<=72 h) — with the two
--                           examinations, the time limits and the Board
--                           report each section requires.
--   psych_nominated_representatives  s.14 — who, on what basis, and their
--                           written consent; one active at a time.
--   psych_advance_directives s.5 — wishes, refusals, representative
--                           preferences. s.10 obliges the team to follow it;
--   psych_directive_challenges s.11 is the only way not to: an application
--                           to the Board on the five statutory grounds.
--   psych_screenings        PHQ-9 / GAD-7 item by item; a positive PHQ-9
--                           item 9 opens a suicide-risk review that stays
--                           pending until a clinician completes it.
--
-- Restraint gains what s.97 asks for: the psychiatrist who authorised it,
-- the method, the last-resort attestation, and when the nominated
-- representative was told (s.97(5): within 24 hours).
--
-- ABDM: psychiatric care contexts are not shared through the HIE-CM unless
-- the hospital allows it (tenant_settings abdm/mental_health_sharing, off
-- unless set) AND the patient has consented to that category.

-- 1. s.90 is its own legal status, not a longer s.89.
ALTER TYPE public.psych_admission_category ADD VALUE IF NOT EXISTS 'supported_extended';

-- 2. Admission episodes.
CREATE TABLE public.psych_admissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    psych_patient_id uuid NOT NULL REFERENCES public.psych_patients(id),
    category public.psych_admission_category NOT NULL,
    admitted_at timestamptz NOT NULL DEFAULT now(),
    applicant text NOT NULL CHECK (applicant IN ('self', 'nominated_representative', 'medical_practitioner')),
    criteria text[] NOT NULL DEFAULT '{}'::text[]
        CHECK (criteria <@ ARRAY['self_harm', 'harm_to_others', 'unable_to_self_care', 'property_damage']::text[]),
    least_restrictive_certified boolean NOT NULL DEFAULT false,
    needs_high_support boolean NOT NULL DEFAULT false,
    capacity_note text,
    examiner1_id uuid REFERENCES public.users(id),
    examiner1_role text CHECK (examiner1_role IN ('psychiatrist', 'mental_health_professional', 'medical_practitioner')),
    examiner1_examined_at timestamptz,
    examiner2_id uuid REFERENCES public.users(id),
    examiner2_role text CHECK (examiner2_role IN ('psychiatrist', 'mental_health_professional', 'medical_practitioner')),
    examiner2_examined_at timestamptz,
    extension_number integer NOT NULL DEFAULT 0 CHECK (extension_number >= 0),
    -- Null for s.86: an independent patient may leave at will (s.88).
    period_ends_at timestamptz,
    minor_safeguards_confirmed boolean NOT NULL DEFAULT false,
    board_report_due_at timestamptz,
    board_reported_at timestamptz,
    board_reference text,
    board_decision_due_at timestamptz,
    board_decision text CHECK (board_decision IN ('permitted', 'discharge_ordered')),
    board_decided_at timestamptz,
    discharged_at timestamptz,
    discharge_note text,
    admitted_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_psych_admissions_patient ON public.psych_admissions (psych_patient_id);
CREATE INDEX idx_psych_admissions_tenant_open ON public.psych_admissions (tenant_id)
    WHERE discharged_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_psych_admissions_examiner1 ON public.psych_admissions (examiner1_id);
CREATE INDEX idx_psych_admissions_examiner2 ON public.psych_admissions (examiner2_id);
CREATE INDEX idx_psych_admissions_admitted_by ON public.psych_admissions (admitted_by);

-- 3. Nominated representatives (s.14).
CREATE TABLE public.psych_nominated_representatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    psych_patient_id uuid NOT NULL REFERENCES public.psych_patients(id),
    full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
    relationship text,
    phone text,
    address text,
    basis text NOT NULL CHECK (basis IN (
        'appointed_by_patient', 'advance_directive', 'relative', 'care_giver',
        'board_appointed', 'temporary_ngo', 'legal_guardian', 'recorded_before_structure')),
    written_consent_received boolean NOT NULL DEFAULT false,
    appointment_document_ref text,
    appointed_on date,
    revoked_at timestamptz,
    revoke_reason text,
    recorded_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_psych_nominated_rep_active ON public.psych_nominated_representatives (psych_patient_id)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_psych_nominated_rep_recorded_by ON public.psych_nominated_representatives (recorded_by);

-- 4. Advance directives (s.5) and Board challenges to them (s.11).
CREATE TABLE public.psych_advance_directives (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    psych_patient_id uuid NOT NULL REFERENCES public.psych_patients(id),
    made_on date,
    made_by text NOT NULL CHECK (made_by IN ('patient', 'legal_guardian', 'recorded_before_structure')),
    treatment_wishes text,
    treatment_refusals text,
    representative_preferences text,
    document_ref text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'modified_by_board', 'cancelled_by_board')),
    revoked_at timestamptz,
    recorded_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT psych_advance_directive_has_content CHECK (
        coalesce(treatment_wishes, treatment_refusals, representative_preferences) IS NOT NULL)
);
CREATE UNIQUE INDEX uq_psych_advance_directive_active ON public.psych_advance_directives (psych_patient_id)
    WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_psych_advance_directives_recorded_by ON public.psych_advance_directives (recorded_by);

CREATE TABLE public.psych_directive_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    advance_directive_id uuid NOT NULL REFERENCES public.psych_advance_directives(id),
    applicant_role text NOT NULL CHECK (applicant_role IN ('mental_health_professional', 'relative', 'care_giver')),
    grounds text[] NOT NULL CHECK (cardinality(grounds) > 0 AND grounds <@ ARRAY[
        'not_free_will', 'not_intended_for_circumstances', 'not_well_informed',
        'lacked_capacity', 'contrary_to_law']::text[]),
    details text NOT NULL CHECK (length(btrim(details)) > 0),
    status text NOT NULL DEFAULT 'pending_board'
        CHECK (status IN ('pending_board', 'upheld', 'modified', 'cancelled')),
    board_reference text,
    decided_at timestamptz,
    decision_note text,
    filed_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_psych_directive_challenges_directive ON public.psych_directive_challenges (advance_directive_id);
CREATE INDEX idx_psych_directive_challenges_filed_by ON public.psych_directive_challenges (filed_by);

-- 5. PHQ-9 / GAD-7, item by item.
CREATE TABLE public.psych_screenings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    psych_patient_id uuid NOT NULL REFERENCES public.psych_patients(id),
    instrument text NOT NULL CHECK (instrument IN ('phq9', 'gad7')),
    answers smallint[] NOT NULL,
    total integer NOT NULL,
    severity text NOT NULL,
    item9_positive boolean NOT NULL DEFAULT false,
    administered_by uuid NOT NULL REFERENCES public.users(id),
    administered_at timestamptz NOT NULL DEFAULT now(),
    safety_review_status text NOT NULL DEFAULT 'not_required'
        CHECK (safety_review_status IN ('not_required', 'pending', 'completed')),
    safety_reviewed_by uuid REFERENCES public.users(id),
    safety_reviewed_at timestamptz,
    safety_review_outcome text,
    safety_review_note text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT psych_screenings_item_count CHECK (
        (instrument = 'phq9' AND cardinality(answers) = 9)
        OR (instrument = 'gad7' AND cardinality(answers) = 7)),
    CONSTRAINT psych_screenings_item_range CHECK (0 <= ALL (answers) AND 3 >= ALL (answers)),
    CONSTRAINT psych_screenings_item9_reviewed CHECK (NOT item9_positive OR safety_review_status <> 'not_required')
);
CREATE INDEX idx_psych_screenings_patient ON public.psych_screenings (psych_patient_id, administered_at);
CREATE INDEX idx_psych_screenings_pending ON public.psych_screenings (tenant_id)
    WHERE safety_review_status = 'pending' AND deleted_at IS NULL;
CREATE INDEX idx_psych_screenings_administered_by ON public.psych_screenings (administered_by);
CREATE INDEX idx_psych_screenings_reviewed_by ON public.psych_screenings (safety_reviewed_by);

-- RLS, updated_at and the soft-delete guardrail for each new table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psych_admissions', 'psych_nominated_representatives',
                           'psych_advance_directives', 'psych_directive_challenges',
                           'psych_screenings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation_%s ON public.%I '
                   'USING (tenant_id::text = current_setting(''app.tenant_id'', true)) '
                   'WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_soft_delete BEFORE DELETE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t, t);
  END LOOP;
END $$;

-- 6. Restraint: what s.97 requires on the record.
ALTER TABLE public.psych_seclusion_restraint
    ADD COLUMN authorised_by uuid REFERENCES public.users(id),
    ADD COLUMN method text,
    ADD COLUMN last_resort_confirmed boolean NOT NULL DEFAULT false,
    ADD COLUMN nominated_rep_informed_at timestamptz,
    ADD COLUMN nominated_rep_informed_by uuid REFERENCES public.users(id);
CREATE INDEX idx_psych_restraint_authorised_by ON public.psych_seclusion_restraint (authorised_by);
CREATE INDEX idx_psych_restraint_rep_informed_by ON public.psych_seclusion_restraint (nominated_rep_informed_by);

-- 6b. ECT for a minor needs the guardian's consent and the Board's prior
--     permission (s.95(2)); the permission's reference is kept with the session.
ALTER TABLE public.psych_ect_register ADD COLUMN board_permission_ref text;

-- 7. The patient's consent to share mental-health records through ABDM.
ALTER TABLE public.psych_patients
    ADD COLUMN abdm_mh_share_consented_at timestamptz,
    ADD COLUMN abdm_mh_share_consented_by uuid REFERENCES public.users(id);
CREATE INDEX idx_psych_patients_abdm_consent_by ON public.psych_patients (abdm_mh_share_consented_by);

-- 8. Move the free-text fields into their structured homes, then drop them.
INSERT INTO public.psych_nominated_representatives
    (tenant_id, psych_patient_id, full_name, relationship, phone, basis)
SELECT tenant_id, id, nominated_rep_name, nominated_rep_relation, nominated_rep_contact,
       'recorded_before_structure'
  FROM public.psych_patients
 WHERE nominated_rep_name IS NOT NULL AND length(btrim(nominated_rep_name)) > 0
   AND deleted_at IS NULL;

INSERT INTO public.psych_advance_directives
    (tenant_id, psych_patient_id, made_by, treatment_wishes)
SELECT tenant_id, id, 'recorded_before_structure', advance_directive_text
  FROM public.psych_patients
 WHERE advance_directive_text IS NOT NULL AND length(btrim(advance_directive_text)) > 0
   AND deleted_at IS NULL;

ALTER TABLE public.psych_patients
    DROP COLUMN nominated_rep_name,
    DROP COLUMN nominated_rep_relation,
    DROP COLUMN nominated_rep_contact,
    DROP COLUMN advance_directive_text;

-- 9. ABDM: is this care context mental-health care, and may it be shared?
--    A context is mental-health care when its visit carries a mental-health
--    coded diagnosis or took place in a psychiatry department.
CREATE OR REPLACE FUNCTION public.abdm_mental_health_context(p_encounter uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_encounter IS NOT NULL AND (
    EXISTS (SELECT 1 FROM diagnoses d
             WHERE d.encounter_id = p_encounter AND d.deleted_at IS NULL
               AND public.is_mental_health_code(d.icd_system, d.icd_code))
    OR EXISTS (SELECT 1 FROM encounters e JOIN departments dp ON dp.id = e.department_id
                WHERE e.id = p_encounter AND upper(dp.code) LIKE 'PSYCH%')
  );
$$;

CREATE OR REPLACE FUNCTION public.abdm_mental_health_shareable(
  p_tenant uuid, p_patient uuid, p_encounter uuid
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT public.abdm_mental_health_context(p_encounter)
      OR (
        COALESCE((SELECT s.value = 'true'::jsonb FROM tenant_settings s
                   WHERE s.tenant_id = p_tenant AND s.category = 'abdm'
                     AND s.key = 'mental_health_sharing' AND s.deleted_at IS NULL), false)
        AND EXISTS (SELECT 1 FROM psych_patients pp
                     WHERE pp.patient_id = p_patient AND pp.deleted_at IS NULL
                       AND pp.abdm_mh_share_consented_at IS NOT NULL)
      );
$$;
