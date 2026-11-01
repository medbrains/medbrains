-- ====================================================================
-- Migration: 1395_hr_holidays.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: hr_holidays
-- Drops: none
-- ====================================================================
-- HR leave rules, phase 2.
--
-- hr_holidays: the hospital's holiday list, kept on HR → Holidays. Leave
-- days are counted on the server as working days — weekly offs (the
-- `hr.weekly_offs` tenant setting) and national/regional holidays are not
-- counted; a restricted (optional) holiday is a working day. Employees carry
-- no campus, so a holiday is hospital-wide: one per date.
--
-- leave_requests.balance_deducted: what final approval drew from the leave
-- balance. Cancelling gives back exactly this, so leave approved before this
-- rule, leave pulled from an HRMS and loss of pay (all NULL) give back
-- nothing, and the HRMS sync can add MedBrains' own draws on top of the
-- balance it pulls instead of erasing them.

CREATE TABLE public.hr_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    holiday_date date NOT NULL,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    kind text NOT NULL CHECK (kind IN ('national', 'regional', 'restricted')),
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_hr_holidays_date
    ON public.hr_holidays (tenant_id, holiday_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_hr_holidays_created_by ON public.hr_holidays (created_by);

ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_holidays FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_hr_holidays ON public.hr_holidays
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_hr_holidays BEFORE UPDATE ON public.hr_holidays
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_hr_holidays_soft_delete BEFORE DELETE ON public.hr_holidays
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.leave_requests
    ADD COLUMN balance_deducted numeric(4,1) CHECK (balance_deducted > 0);
