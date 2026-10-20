-- ====================================================================
-- Migration: 1152_doctor_payout_statements.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: doctor_payout_statement_lines, doctor_payouts
-- Drops: none
-- ====================================================================
-- incentive_calculations becomes the payout statement: versioned (a dispute
-- or adjustment issues v2 and supersedes v1, never edits it), approved by
-- someone other than its preparer (maker-checker, enforced here as well as in
-- the handler), with the TDS computed on approval and written to
-- tds_deductions when it is paid.

UPDATE public.incentive_calculations SET status = 'draft' WHERE status IS NULL;
ALTER TABLE public.incentive_calculations
    ALTER COLUMN doctor_id DROP NOT NULL,
    ALTER COLUMN plan_id DROP NOT NULL,
    ALTER COLUMN status SET DEFAULT 'draft',
    ALTER COLUMN status SET NOT NULL,
    ADD COLUMN kind text NOT NULL DEFAULT 'monthly' CHECK (kind IN ('monthly', 'same_day', 'referral')),
    ADD COLUMN referral_doctor_id uuid REFERENCES public.lab_referral_doctors(id),
    ADD COLUMN agreement_id uuid REFERENCES public.doctor_incentive_assignments(id),
    ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
    ADD COLUMN supersedes_id uuid REFERENCES public.incentive_calculations(id),
    ADD COLUMN prepared_by uuid REFERENCES public.users(id),
    ADD COLUMN disputed_reason text,
    ADD COLUMN disputed_by uuid REFERENCES public.users(id),
    ADD COLUMN disputed_at timestamptz,
    ADD COLUMN adjustments_total numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN session_minimum_total numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN payee_pan text,
    ADD COLUMN financial_year text,
    ADD COLUMN tds_section text,
    ADD COLUMN tds_rate numeric(5,2),
    ADD COLUMN tds_base numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN tds_amount numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN tds_deduction_id uuid REFERENCES public.tds_deductions(id),
    ADD CONSTRAINT incentive_calculations_status CHECK
        (status IN ('draft', 'disputed', 'approved', 'paid', 'superseded', 'cancelled')),
    ADD CONSTRAINT incentive_calculations_payee CHECK (doctor_id IS NOT NULL OR referral_doctor_id IS NOT NULL),
    -- Maker-checker. A same-day settlement is the engine's arithmetic with no
    -- discretionary input, so the cashier who pays it also records it.
    ADD CONSTRAINT incentive_calculations_maker_checker CHECK
        (kind = 'same_day' OR approved_by IS NULL OR prepared_by IS NULL OR approved_by <> prepared_by),
    ADD CONSTRAINT incentive_calculations_dispute CHECK (status <> 'disputed' OR disputed_reason IS NOT NULL);
CREATE INDEX idx_incentive_calculations_status ON public.incentive_calculations (tenant_id, status, period_end DESC);
CREATE INDEX idx_incentive_calculations_pan_fy ON public.incentive_calculations (tenant_id, payee_pan, financial_year)
    WHERE payee_pan IS NOT NULL;
CREATE TRIGGER set_updated_at_incentive_calculations BEFORE UPDATE ON public.incentive_calculations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Which ledger rows a statement version carries. Append-only; v2 copies v1's
-- lines and adds its own.
CREATE TABLE public.doctor_payout_statement_lines (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    statement_id uuid NOT NULL REFERENCES public.incentive_calculations(id),
    accrual_id uuid NOT NULL REFERENCES public.doctor_payout_accruals(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    PRIMARY KEY (statement_id, accrual_id)
);
CREATE INDEX idx_doctor_payout_statement_lines_accrual ON public.doctor_payout_statement_lines (accrual_id);

ALTER TABLE public.doctor_payout_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payout_statement_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_payout_statement_lines ON public.doctor_payout_statement_lines
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_doctor_payout_statement_lines BEFORE UPDATE ON public.doctor_payout_statement_lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_doctor_payout_statement_lines_soft_delete BEFORE DELETE ON public.doctor_payout_statement_lines
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A payout attempt for an approved statement.
CREATE TABLE public.doctor_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    statement_id uuid NOT NULL REFERENCES public.incentive_calculations(id),
    run_id uuid NOT NULL,
    mode text NOT NULL CHECK (mode IN ('cash', 'bank', 'upi')),
    provider text NOT NULL CHECK (provider IN ('manual', 'bank_file', 'razorpayx')),
    amount numeric(14,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'reversed')),
    idempotency_key text NOT NULL,
    provider_ref text,
    utr text,
    warning text,
    failure_reason text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    paid_by uuid REFERENCES public.users(id),
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_payouts_paid CHECK (status <> 'paid' OR paid_at IS NOT NULL),
    CONSTRAINT doctor_payouts_failed CHECK (status <> 'failed' OR failure_reason IS NOT NULL)
);
CREATE UNIQUE INDEX uq_doctor_payouts_idempotency ON public.doctor_payouts (tenant_id, idempotency_key)
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_doctor_payouts_live ON public.doctor_payouts (statement_id)
    WHERE status IN ('pending', 'processing', 'paid') AND deleted_at IS NULL;
CREATE INDEX idx_doctor_payouts_run ON public.doctor_payouts (tenant_id, run_id);
CREATE INDEX idx_doctor_payouts_cash_day ON public.doctor_payouts (tenant_id, paid_at) WHERE mode = 'cash';

ALTER TABLE public.doctor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payouts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_payouts ON public.doctor_payouts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_doctor_payouts BEFORE UPDATE ON public.doctor_payouts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_doctor_payouts_soft_delete BEFORE DELETE ON public.doctor_payouts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
