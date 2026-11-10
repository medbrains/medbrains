-- ====================================================================
-- Migration: 1260_nikshay_notification.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nikshay_notifications
-- Drops: none
-- ====================================================================
-- TB notification to Ni-kshay.
--
-- TB has been notifiable since 2012, and the March 2018 gazette made a
-- hospital that diagnoses or treats a TB patient and does not notify liable
-- under IPC 269/270. Detection (1230) already opens a worklist row for every
-- TB diagnosis and every positive smear, CBNAAT or TrueNat. What the hospital
-- could not do is fill the notification: the MoHFW format for hospitals
-- (D.O. Z-28015/2/2012-TB, Annexure II) asks for the site of disease, the
-- patient type, the basis of diagnosis, the treatment start, weight and
-- regimen -- none of which a diagnosis code carries.
--
-- One row per TB worklist row holds those fields. The patient's name, age,
-- sex, address and phone are read from the patient at the time the sheet is
-- made, never copied here. The Ni-kshay ID, once given, is the worklist row's
-- report_ref, so submission, escalation and the audit trail stay one path.

-- The hospital's Health Establishment code for TB notification.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nikshay_he_code TEXT;

CREATE TABLE IF NOT EXISTS public.nikshay_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    report_id UUID NOT NULL REFERENCES public.notifiable_disease_reports(id),
    -- Pulmonary (with or without other sites) or extra-pulmonary only.
    site TEXT CHECK (site IN ('P', 'EP')),
    ep_site TEXT,
    patient_type TEXT CHECK (patient_type IN ('new', 'recurrent', 'treatment_change')),
    basis TEXT CHECK (basis IN ('smear', 'culture', 'pcr', 'lpa', 'fnac',
                                'histopathology', 'clinical', 'xray')),
    diagnosed_on DATE,
    treatment_started_on DATE,
    weight_kg NUMERIC(5, 1) CHECK (weight_kg > 0 AND weight_kg < 400),
    -- Drugs and dosages in mg, as the regimen is written (H/R/Z/E ...).
    regimen TEXT,
    notifying_doctor_id UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    delete_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nikshay_notifications_report
    ON public.nikshay_notifications (report_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nikshay_notifications_tenant
    ON public.nikshay_notifications (tenant_id);

ALTER TABLE public.nikshay_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nikshay_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nikshay_notifications ON public.nikshay_notifications;
CREATE POLICY tenant_isolation_nikshay_notifications ON public.nikshay_notifications
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_nikshay_notifications ON public.nikshay_notifications;
CREATE TRIGGER set_updated_at_nikshay_notifications BEFORE UPDATE ON public.nikshay_notifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_nikshay_notifications_soft_delete ON public.nikshay_notifications;
CREATE TRIGGER trg_nikshay_notifications_soft_delete BEFORE DELETE ON public.nikshay_notifications
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
