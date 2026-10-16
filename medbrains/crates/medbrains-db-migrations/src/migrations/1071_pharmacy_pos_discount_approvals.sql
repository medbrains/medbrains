-- ====================================================================
-- Migration: 1071_pharmacy_pos_discount_approvals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_pos_discount_approvals
-- Drops: none
-- ====================================================================
-- A counter discount above the hospital's limit
-- (`tenant_settings` pharmacy.pos_discount_limit_percent) is sold only with
-- a reason and an approver holding pharmacy.pos.discount_approve. This is
-- the record of each one: who, how much, why — for the cashier audit.

CREATE TABLE IF NOT EXISTS public.pharmacy_pos_discount_approvals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pos_sale_id      uuid NOT NULL REFERENCES public.pharmacy_pos_sales(id),
    -- Discount off MRP across the bill, price cuts and bill discount together.
    discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    discount_amount  numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
    limit_percent    numeric(5,2) NOT NULL CHECK (limit_percent >= 0),
    reason           text NOT NULL CHECK (length(btrim(reason)) >= 5),
    approved_by      uuid NOT NULL REFERENCES public.users(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    deleted_by       uuid,
    delete_reason    text
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_pos_discount_approvals_sale
    ON public.pharmacy_pos_discount_approvals (tenant_id, pos_sale_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_pos_discount_approvals_approver
    ON public.pharmacy_pos_discount_approvals (tenant_id, approved_by, created_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_pharmacy_pos_discount_approvals_updated_at
    ON public.pharmacy_pos_discount_approvals;
CREATE TRIGGER trg_pharmacy_pos_discount_approvals_updated_at
    BEFORE UPDATE ON public.pharmacy_pos_discount_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_pharmacy_pos_discount_approvals_soft_delete
    ON public.pharmacy_pos_discount_approvals;
CREATE TRIGGER trg_pharmacy_pos_discount_approvals_soft_delete
    BEFORE DELETE ON public.pharmacy_pos_discount_approvals
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_pharmacy_pos_discount_approvals
    ON public.pharmacy_pos_discount_approvals;
CREATE TRIGGER audit_pharmacy_pos_discount_approvals
    AFTER INSERT OR DELETE OR UPDATE ON public.pharmacy_pos_discount_approvals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

ALTER TABLE public.pharmacy_pos_discount_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_pos_discount_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_pharmacy_pos_discount_approvals
    ON public.pharmacy_pos_discount_approvals;
CREATE POLICY tenant_isolation_pharmacy_pos_discount_approvals
    ON public.pharmacy_pos_discount_approvals
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- Counter cash lands in a drawer: a cash tender carries its drawer in
-- shift_id, so a cash-up can count what the drawer should hold.
CREATE INDEX IF NOT EXISTS idx_pharmacy_payment_transactions_shift
    ON public.pharmacy_payment_transactions (tenant_id, shift_id)
    WHERE deleted_at IS NULL AND shift_id IS NOT NULL;
