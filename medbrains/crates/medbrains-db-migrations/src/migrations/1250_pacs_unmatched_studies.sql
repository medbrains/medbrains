-- ====================================================================
-- Migration: 1250_pacs_unmatched_studies.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_unmatched_studies
-- Drops: none
-- ====================================================================
-- Studies the PACS holds that match no imaging order.
--
-- The sync files a study under the order whose accession number the
-- modality copied from the worklist. A walk-in X-ray taken without an order,
-- an accession typed wrong at the console, or a study from another site has
-- none — and until now was only logged, so its images were invisible in the
-- patient's record. It is now queued here, with the demographics the
-- modality wrote into it, for the radiology desk to match to an order (the
-- patient-safety act: a person confirms whose images these are) or to
-- dismiss with a reason (a phantom, a test, a duplicate). Nothing is matched
-- by name automatically: that is how images end up in the wrong record.

CREATE TABLE IF NOT EXISTS public.radiology_unmatched_studies (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    orthanc_id text NOT NULL,
    study_instance_uid text NOT NULL,
    accession_number text,
    -- As the modality wrote them (DICOM PatientID, PatientName, ...).
    dicom_patient_id text,
    dicom_patient_name text,
    dicom_birth_date date,
    dicom_sex text,
    modality text,
    study_date date,
    study_description text,
    instance_count integer NOT NULL DEFAULT 0,
    series_count integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'linked', 'dismissed')),
    linked_order_id uuid REFERENCES public.radiology_orders(id),
    -- Why it was linked despite a different patient ID, or dismissed.
    resolution_note text,
    resolved_by uuid REFERENCES public.users(id),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT radiology_unmatched_resolved CHECK (
        status = 'open'
        OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    ),
    CONSTRAINT radiology_unmatched_linked_order CHECK (
        (status = 'linked') = (linked_order_id IS NOT NULL)
    ),
    CONSTRAINT radiology_unmatched_dismiss_reason CHECK (
        status <> 'dismissed' OR btrim(COALESCE(resolution_note, '')) <> ''
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_radiology_unmatched_studies_uid
    ON public.radiology_unmatched_studies (tenant_id, study_instance_uid)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_radiology_unmatched_studies_open
    ON public.radiology_unmatched_studies (tenant_id, created_at DESC)
    WHERE status = 'open' AND deleted_at IS NULL;

ALTER TABLE public.radiology_unmatched_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radiology_unmatched_studies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_radiology_unmatched_studies ON public.radiology_unmatched_studies;
CREATE POLICY tenant_isolation_radiology_unmatched_studies ON public.radiology_unmatched_studies
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_radiology_unmatched_studies ON public.radiology_unmatched_studies;
CREATE TRIGGER set_updated_at_radiology_unmatched_studies BEFORE UPDATE ON public.radiology_unmatched_studies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_radiology_unmatched_studies_soft_delete ON public.radiology_unmatched_studies;
CREATE TRIGGER trg_radiology_unmatched_studies_soft_delete BEFORE DELETE ON public.radiology_unmatched_studies
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_radiology_unmatched_studies ON public.radiology_unmatched_studies;
CREATE TRIGGER audit_radiology_unmatched_studies
    AFTER INSERT OR DELETE OR UPDATE ON public.radiology_unmatched_studies
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('radiology');
