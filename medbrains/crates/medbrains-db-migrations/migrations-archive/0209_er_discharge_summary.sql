-- ====================================================================
-- Migration: 0209_er_discharge_summary.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: er_discharge_summaries
-- Drops: none
-- ====================================================================
-- ER patients were discharged by setting er_visits.disposition +
-- disposition_notes (free text) — no structured discharge summary and
-- nothing printable to hand the patient. NABH/JCI require a structured
-- discharge: diagnosis, course, treatment, take-home meds, follow-up and
-- red-flag warning signs. This adds an ER discharge summary (one per
-- visit, draft → finalized) mirroring the IPD model, reusing the shared
-- discharge_summary_status enum. v1 fields are free text (ER is acute and
-- not encounter/diagnosis-backed); the printable is wired separately.

CREATE TABLE IF NOT EXISTS public.er_discharge_summaries (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL,
    er_visit_id            uuid NOT NULL REFERENCES public.er_visits(id) ON DELETE CASCADE,
    status                 public.discharge_summary_status NOT NULL DEFAULT 'draft',
    final_diagnosis        text,
    condition_at_discharge text,
    clinical_course        text,
    treatment_given        text,
    medications_on_discharge text,
    follow_up_instructions text,
    follow_up_date         date,
    warning_signs          text,
    prepared_by            uuid,
    verified_by            uuid,
    finalized_at           timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (er_visit_id)
);

ALTER TABLE public.er_discharge_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS er_discharge_summaries_tenant ON public.er_discharge_summaries;
CREATE POLICY er_discharge_summaries_tenant ON public.er_discharge_summaries
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_er_discharge_summaries_visit
    ON public.er_discharge_summaries (tenant_id, er_visit_id);

CREATE TRIGGER set_er_discharge_summaries_updated_at
    BEFORE UPDATE ON public.er_discharge_summaries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
