-- ====================================================================
-- Migration: 1088_dental_treatment_plan.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: dental_treatment_items
-- Drops: none
-- ====================================================================
-- A dental treatment plan is a list of procedures, tooth by tooth, each
-- planned, done or cancelled. Doing one bills it to the visit, once.
-- Chart findings were insert-only; they can now be corrected or removed,
-- and a removal is kept (soft delete), as with every clinical record.

CREATE TABLE public.dental_treatment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    exam_id uuid NOT NULL REFERENCES public.dental_exams(id),
    tooth_number text,
    procedure text NOT NULL CHECK (length(trim(procedure)) > 0),
    charge_code text,
    price numeric(12,2) NOT NULL CHECK (price >= 0),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'cancelled')),
    done_at timestamptz,
    done_by uuid REFERENCES public.users(id),
    invoice_id uuid,
    notes text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_dental_treatment_items_exam ON public.dental_treatment_items (tenant_id, exam_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.dental_treatment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_treatment_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dental_treatment_items ON public.dental_treatment_items
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_dental_treatment_items BEFORE UPDATE ON public.dental_treatment_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_dental_treatment_items_soft_delete BEFORE DELETE ON public.dental_treatment_items
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.dental_chart_entries
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid,
    ADD COLUMN IF NOT EXISTS delete_reason text;
DROP TRIGGER IF EXISTS trg_dental_chart_entries_soft_delete ON public.dental_chart_entries;
CREATE TRIGGER trg_dental_chart_entries_soft_delete BEFORE DELETE ON public.dental_chart_entries
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
