-- ====================================================================
-- Migration: 1390_cancer_registry_abstracts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: cancer_registry_abstracts
-- Drops: none
-- ====================================================================
-- NCDIR hospital-based cancer registry (HBCR) abstracts.
--
-- One abstract per staged cancer (`cancer_stagings`): the items of the HBCR
-- core form that the clinical record does not already hold, coded as the
-- NCDIR HBCR Procedure Manual 2025 sets out (item numbers in
-- medbrains-core `specialty::hbcr`). Identity, age, sex and address come from
-- the patient; site, histology and TNM from the staging. Status runs
-- draft → complete → submitted; the NCDIR registration the clerk gets back is
-- kept with who submitted it and when.

CREATE TABLE public.cancer_registry_abstracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    staging_id uuid NOT NULL REFERENCES public.cancer_stagings(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete', 'submitted')),
    hbcr_registration_no text,
    date_of_first_diagnosis date,
    case_registered_through smallint,
    referral_type text CHECK (referral_type IN ('self', 'other_facility', 'unknown')),
    method_of_diagnosis smallint,
    icdo3_topography text,
    icdo3_morphology text,
    icd10_code text,
    laterality smallint,
    sequence smallint,
    extent_of_disease smallint,
    staging_system smallint,
    prior_treatment smallint,
    intention smallint,
    ecog smallint,
    treatment_at_ri smallint,
    completed_by uuid REFERENCES public.users(id),
    completed_at timestamptz,
    submitted_by uuid REFERENCES public.users(id),
    submitted_at timestamptz,
    ncdir_reference text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_cancer_registry_abstracts_staging
    ON public.cancer_registry_abstracts (staging_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cancer_registry_abstracts_tenant_status
    ON public.cancer_registry_abstracts (tenant_id, status);
CREATE INDEX idx_cancer_registry_abstracts_patient ON public.cancer_registry_abstracts (patient_id);
CREATE INDEX idx_cancer_registry_abstracts_completed_by ON public.cancer_registry_abstracts (completed_by);
CREATE INDEX idx_cancer_registry_abstracts_submitted_by ON public.cancer_registry_abstracts (submitted_by);
CREATE INDEX idx_cancer_registry_abstracts_created_by ON public.cancer_registry_abstracts (created_by);

ALTER TABLE public.cancer_registry_abstracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancer_registry_abstracts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cancer_registry_abstracts ON public.cancer_registry_abstracts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_cancer_registry_abstracts BEFORE UPDATE ON public.cancer_registry_abstracts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_cancer_registry_abstracts_soft_delete BEFORE DELETE ON public.cancer_registry_abstracts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
