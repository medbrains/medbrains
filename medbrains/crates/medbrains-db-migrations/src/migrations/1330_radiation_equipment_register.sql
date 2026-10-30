-- ====================================================================
-- Migration: 1330_radiation_equipment_register.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiation_equipment
-- Drops: none
-- ====================================================================
-- The AERB side of each X-ray, CT, fluoroscopy or mammography unit.
--
-- A unit may be used only under an AERB licence, obtained through eLORA,
-- with a Radiological Safety Officer nominated for CT and cath labs and
-- periodic quality-assurance tests by an approved agency. The unit itself is
-- already in the biomedical register (bme_equipment: make, model, serial,
-- location); this adds what the regulator asks about it and when each
-- lapses, so the radiology screen can say what is expired or due.
-- One row per unit.

CREATE TABLE IF NOT EXISTS public.radiation_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    bme_equipment_id uuid NOT NULL REFERENCES public.bme_equipment(id),
    modality_id uuid REFERENCES public.radiology_modalities(id),
    aerb_licence_number text,
    elora_id text,
    licence_valid_until date,
    rso_user_id uuid REFERENCES public.users(id),
    qa_agency text,
    last_qa_date date,
    qa_due_date date,
    notes text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT radiation_equipment_qa_order
        CHECK (last_qa_date IS NULL OR qa_due_date IS NULL OR qa_due_date >= last_qa_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_radiation_equipment_unit
    ON public.radiation_equipment (tenant_id, bme_equipment_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.radiation_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radiation_equipment FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_radiation_equipment ON public.radiation_equipment;
CREATE POLICY tenant_isolation_radiation_equipment ON public.radiation_equipment
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_radiation_equipment ON public.radiation_equipment;
CREATE TRIGGER set_updated_at_radiation_equipment BEFORE UPDATE ON public.radiation_equipment
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_radiation_equipment_soft_delete ON public.radiation_equipment;
CREATE TRIGGER trg_radiation_equipment_soft_delete BEFORE DELETE ON public.radiation_equipment
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_radiation_equipment ON public.radiation_equipment;
CREATE TRIGGER audit_radiation_equipment
    AFTER INSERT OR DELETE OR UPDATE ON public.radiation_equipment
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('radiology');

-- A staff badge reading is summed per person per year; find them fast.
CREATE INDEX IF NOT EXISTS idx_radiology_dosimetry_staff_period
    ON public.radiology_dosimetry_records (tenant_id, staff_id, monitoring_period_end)
    WHERE deleted_at IS NULL;
