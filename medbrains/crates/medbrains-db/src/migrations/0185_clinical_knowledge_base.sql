-- Clinical Knowledge Base (CKB) — foundation.
-- Global diagnosis reference (national IDSP notifiable list + common OPD dx,
-- seeded from a github-tracked CSV) and the tenant statutory-report worklist.

-- ── Global diagnosis reference (no tenant_id, like icd10_codes) ──
CREATE TABLE IF NOT EXISTS public.cds_diagnosis_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    icd10_code text NOT NULL UNIQUE,
    name text NOT NULL,
    department text,
    is_notifiable boolean NOT NULL DEFAULT false,
    reporting_body text,
    report_timeframe text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cds_diag_ref_notifiable
    ON public.cds_diagnosis_reference (is_notifiable) WHERE is_notifiable;

-- ── Tenant statutory notifiable-disease report worklist + audit ──
CREATE TABLE IF NOT EXISTS public.notifiable_disease_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    patient_id uuid,
    encounter_id uuid,
    icd10_code text NOT NULL,
    disease_name text NOT NULL,
    reporting_body text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    detected_by uuid,
    status text NOT NULL DEFAULT 'pending',
    report_ref text,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifiable_reports_status_chk CHECK (status IN ('pending', 'submitted', 'exempted'))
);

-- One report per encounter + disease (idempotent alert hook).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifiable_reports_enc_code
    ON public.notifiable_disease_reports (tenant_id, encounter_id, icd10_code)
    WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifiable_reports_pending
    ON public.notifiable_disease_reports (tenant_id, status, detected_at DESC);

ALTER TABLE public.notifiable_disease_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notifiable_reports ON public.notifiable_disease_reports;
CREATE POLICY tenant_isolation_notifiable_reports ON public.notifiable_disease_reports
    USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
