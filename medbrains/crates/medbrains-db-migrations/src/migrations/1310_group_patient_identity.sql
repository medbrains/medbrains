-- ====================================================================
-- Migration: 1310_group_patient_identity.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: group_patient_links, group_identity_candidates, patient_group_fingerprints
-- Drops: none
-- ====================================================================
-- One person, many hospitals in a group: records are LINKED to a
-- group-level person, never merged. Each hospital keeps its own patient and
-- UHID; a link only says "this record and that one are the same person".
--
-- group_patient_links          one row per linked record; `person_id` is the
--                              group-level person. Unlinking keeps the row.
-- group_identity_candidates    a probable match (Fellegi-Sunter score) waiting
--                              for a person to decide; never linked by itself.
-- patient_group_fingerprints   an Aadhaar number keyed with the GROUP (HMAC),
--                              so the same person at two hospitals matches
--                              without the number ever being stored. Only
--                              registrations from now on carry one: the
--                              number was never kept, so there is nothing to
--                              backfill from.
--
-- All three are visible to the hospitals the session may see
-- (`app_visible_tenants()`), which is the whole group only where management
-- set `hospital_groups.share_clinical_records` — the same switch the handlers
-- require before they link anything.

CREATE TABLE public.group_patient_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.hospital_groups(id),
    person_id uuid NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    match_method text NOT NULL
        CHECK (match_method IN ('abha', 'aadhaar', 'probabilistic', 'manual')),
    score double precision,
    linked_by uuid,
    linked_at timestamptz NOT NULL DEFAULT now(),
    unlinked_at timestamptz,
    unlinked_by uuid,
    unlink_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_group_patient_links_live
    ON public.group_patient_links (patient_id)
    WHERE unlinked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_group_patient_links_person
    ON public.group_patient_links (group_id, person_id)
    WHERE unlinked_at IS NULL AND deleted_at IS NULL;

CREATE TABLE public.group_identity_candidates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.hospital_groups(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    other_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    other_patient_id uuid NOT NULL REFERENCES public.patients(id),
    score double precision NOT NULL,
    band text NOT NULL CHECK (band IN ('likely', 'review')),
    reasons text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'linked', 'rejected')),
    found_by uuid,
    decided_by uuid,
    decided_at timestamptz,
    decision_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CHECK (patient_id <> other_patient_id)
);
-- One pair, once, whichever side found it.
CREATE UNIQUE INDEX uq_group_identity_candidates_pair
    ON public.group_identity_candidates
       (LEAST(patient_id, other_patient_id), GREATEST(patient_id, other_patient_id))
    WHERE deleted_at IS NULL;
CREATE INDEX idx_group_identity_candidates_queue
    ON public.group_identity_candidates (group_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE public.patient_group_fingerprints (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.hospital_groups(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    kind text NOT NULL CHECK (kind IN ('aadhaar')),
    fingerprint text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_patient_group_fingerprints
    ON public.patient_group_fingerprints (patient_id, kind)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_patient_group_fingerprints_lookup
    ON public.patient_group_fingerprints (group_id, kind, fingerprint)
    WHERE deleted_at IS NULL;

-- Every link, unlink and decision is on the audit trail.
ALTER TABLE public.group_patient_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_visible_group_patient_links ON public.group_patient_links
    USING (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group())
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group());
CREATE TRIGGER set_updated_at_group_patient_links BEFORE UPDATE ON public.group_patient_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_group_patient_links_soft_delete BEFORE DELETE ON public.group_patient_links
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_group_patient_links AFTER INSERT OR DELETE OR UPDATE ON public.group_patient_links
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

ALTER TABLE public.group_identity_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_visible_group_identity_candidates ON public.group_identity_candidates
    USING (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group())
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group());
CREATE TRIGGER set_updated_at_group_identity_candidates BEFORE UPDATE ON public.group_identity_candidates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_group_identity_candidates_soft_delete BEFORE DELETE ON public.group_identity_candidates
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_group_identity_candidates AFTER INSERT OR DELETE OR UPDATE ON public.group_identity_candidates
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

ALTER TABLE public.patient_group_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_visible_patient_group_fingerprints ON public.patient_group_fingerprints
    USING (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group())
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()) AND group_id = public.app_current_group());
CREATE TRIGGER set_updated_at_patient_group_fingerprints BEFORE UPDATE ON public.patient_group_fingerprints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_patient_group_fingerprints_soft_delete BEFORE DELETE ON public.patient_group_fingerprints
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_patient_group_fingerprints AFTER INSERT OR DELETE OR UPDATE ON public.patient_group_fingerprints
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');
