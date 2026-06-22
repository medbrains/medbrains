-- Release of Information (ROI). External parties (patient, insurer, court,
-- police, employer) request a patient's medical records; the MRD officer
-- reviews and approves/denies; every view/download is access-logged. Core
-- MRD operational + DPDP/HIPAA audit requirement for a paperless record.

CREATE TABLE IF NOT EXISTS public.roi_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    requester_type text NOT NULL,            -- patient | insurer | court | police | employer | other
    requester_name text NOT NULL,
    requester_contact text,
    purpose text,
    record_scope text NOT NULL DEFAULT 'full',  -- full | date_range | specific
    date_from date,
    date_to date,
    scope_notes text,
    status text NOT NULL DEFAULT 'pending',
    authorization_obtained boolean NOT NULL DEFAULT false,
    expiry_date date,
    requested_by uuid,
    requested_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by uuid,
    reviewed_at timestamptz,
    decision_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT roi_requests_status_check CHECK (status = ANY (ARRAY[
        'pending'::text, 'approved'::text, 'denied'::text, 'released'::text, 'expired'::text
    ])),
    CONSTRAINT roi_requests_requester_check CHECK (requester_type = ANY (ARRAY[
        'patient'::text, 'insurer'::text, 'court'::text, 'police'::text, 'employer'::text, 'other'::text
    ]))
);

ALTER TABLE public.roi_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_roi_requests ON public.roi_requests;
CREATE POLICY tenant_isolation_roi_requests ON public.roi_requests
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));
CREATE INDEX IF NOT EXISTS idx_roi_requests_status
    ON public.roi_requests USING btree (tenant_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_requests_patient
    ON public.roi_requests USING btree (tenant_id, patient_id);

CREATE TABLE IF NOT EXISTS public.roi_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    roi_request_id uuid NOT NULL,
    accessed_by uuid NOT NULL,
    action text NOT NULL,                    -- viewed | downloaded | released
    accessed_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

ALTER TABLE public.roi_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_roi_access_log ON public.roi_access_log;
CREATE POLICY tenant_isolation_roi_access_log ON public.roi_access_log
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));
CREATE INDEX IF NOT EXISTS idx_roi_access_log_request
    ON public.roi_access_log USING btree (tenant_id, roi_request_id, accessed_at DESC);
