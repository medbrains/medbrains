-- Read-access logging. The audit_log captures writes; for DPDP/HIPAA a
-- paperless record must also log who *viewed / downloaded* a patient's
-- records. This is the read-access trail, surfaced for transparency and
-- breach investigation.

CREATE TABLE IF NOT EXISTS public.patient_record_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    accessed_by uuid NOT NULL,
    access_type text NOT NULL,               -- documents_viewed | document_downloaded | chart_viewed | exported
    accessed_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

ALTER TABLE public.patient_record_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_patient_record_access_log ON public.patient_record_access_log;
CREATE POLICY tenant_isolation_patient_record_access_log ON public.patient_record_access_log
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE INDEX IF NOT EXISTS idx_patient_record_access_log_patient
    ON public.patient_record_access_log USING btree (tenant_id, patient_id, accessed_at DESC);
