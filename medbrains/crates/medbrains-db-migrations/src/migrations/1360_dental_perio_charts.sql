-- ====================================================================
-- Migration: 1360_dental_perio_charts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: dental_perio_charts
-- Drops: none
-- ====================================================================
-- Periodontal charts on dental exams.
--
-- One row is one full-mouth chart: for each tooth (FDI), probing depth,
-- recession and bleeding at six sites, mobility and furcation, as
-- `medbrains_core::specialty::perio::PerioTooth` validates them. The teeth
-- live together as one JSON document because a chart is read and compared
-- whole; the patient is kept beside the exam so earlier charts are found
-- without walking every exam.

CREATE TABLE public.dental_perio_charts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    exam_id uuid NOT NULL REFERENCES public.dental_exams(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    teeth jsonb NOT NULL CHECK (jsonb_typeof(teeth) = 'array'),
    notes text,
    recorded_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_dental_perio_charts_patient
    ON public.dental_perio_charts (tenant_id, patient_id, created_at DESC);
CREATE INDEX idx_dental_perio_charts_exam ON public.dental_perio_charts (exam_id);
CREATE INDEX idx_dental_perio_charts_recorded_by ON public.dental_perio_charts (recorded_by);

ALTER TABLE public.dental_perio_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_perio_charts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dental_perio_charts ON public.dental_perio_charts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_dental_perio_charts BEFORE UPDATE ON public.dental_perio_charts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_dental_perio_charts_soft_delete BEFORE DELETE ON public.dental_perio_charts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
