-- ====================================================================
-- Migration: 1075_pharmacy_returns_day_close.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_day_closes
-- Drops: none
-- ====================================================================
-- Counter returns and the business day.
--
-- 1. Every counter sale and return belongs to a cash drawer and a business
--    day (the tenant-local date the drawer opened). A day is closed once per
--    counter: totals by tender, counted cash against expected, variance with
--    a reason. A closed day takes no new sale, return or void.
-- 2. A return is a GST credit note (`pharmacy_credit_notes`, customer_return)
--    against the original sale and invoice, refunded to the tenders the sale
--    was paid with. A return after the window records who overrode it and why.
-- 3. What a drawer should hold is computed in one place,
--    `pharmacy_drawer_expected_cash`, used by drawer close and day close.

-- ── tenant-local dates ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tenant_local_date(p_tenant uuid, p_at timestamptz)
RETURNS date LANGUAGE sql STABLE AS $$
    SELECT (p_at AT TIME ZONE COALESCE(
        (SELECT t.timezone FROM public.tenants t WHERE t.id = p_tenant), 'UTC'))::date
$$;

-- ── the business day on drawers, sales and returns ─────────────────────────

ALTER TABLE public.pharmacy_cash_drawers
    ADD COLUMN IF NOT EXISTS business_date date,
    ADD COLUMN IF NOT EXISTS day_close_id uuid;

UPDATE public.pharmacy_cash_drawers
   SET business_date = public.tenant_local_date(tenant_id, opened_at)
 WHERE business_date IS NULL;

ALTER TABLE public.pharmacy_cash_drawers ALTER COLUMN business_date SET NOT NULL;

CREATE OR REPLACE FUNCTION public.pharmacy_cash_drawer_business_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.business_date IS NULL THEN
        NEW.business_date := public.tenant_local_date(NEW.tenant_id, NEW.opened_at);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pharmacy_cash_drawers_business_date ON public.pharmacy_cash_drawers;
CREATE TRIGGER trg_pharmacy_cash_drawers_business_date
    BEFORE INSERT ON public.pharmacy_cash_drawers
    FOR EACH ROW EXECUTE FUNCTION public.pharmacy_cash_drawer_business_date();

CREATE INDEX IF NOT EXISTS idx_pharmacy_cash_drawers_counter_day
    ON public.pharmacy_cash_drawers (tenant_id, pharmacy_location_id, business_date)
    WHERE deleted_at IS NULL;

ALTER TABLE public.pharmacy_pos_sales
    ADD COLUMN IF NOT EXISTS cash_drawer_id uuid REFERENCES public.pharmacy_cash_drawers(id),
    ADD COLUMN IF NOT EXISTS business_date date;

UPDATE public.pharmacy_pos_sales
   SET business_date = public.tenant_local_date(tenant_id, created_at)
 WHERE business_date IS NULL;

ALTER TABLE public.pharmacy_credit_notes
    ADD COLUMN IF NOT EXISTS cash_drawer_id uuid REFERENCES public.pharmacy_cash_drawers(id),
    ADD COLUMN IF NOT EXISTS business_date date,
    ADD COLUMN IF NOT EXISTS refund_tenders jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS window_override_reason text,
    ADD COLUMN IF NOT EXISTS window_override_by uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_credit_notes_pos_sale
    ON public.pharmacy_credit_notes (tenant_id, original_pos_sale_id)
    WHERE deleted_at IS NULL AND original_pos_sale_id IS NOT NULL;

-- A return is audited at the row: who refunded what, and any override.
DROP TRIGGER IF EXISTS audit_pharmacy_credit_notes ON public.pharmacy_credit_notes;
CREATE TRIGGER audit_pharmacy_credit_notes
    AFTER INSERT OR DELETE OR UPDATE ON public.pharmacy_credit_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

-- ── what a drawer should hold ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pharmacy_drawer_expected_cash(p_drawer uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT d.opening_float
         + COALESCE((SELECT SUM(t.amount) FROM public.pharmacy_payment_transactions t
                      WHERE t.tenant_id = d.tenant_id AND t.shift_id = d.id::text
                        AND t.payment_mode = 'cash' AND t.deleted_at IS NULL), 0)
         - COALESCE((SELECT SUM(v.amount) FROM public.pharmacy_petty_cash_vouchers v
                      WHERE v.tenant_id = d.tenant_id AND v.cash_drawer_id = d.id
                        AND v.status IN ('approved', 'reimbursed') AND v.deleted_at IS NULL), 0)
         + COALESCE((SELECT SUM(m.amount) FROM public.pharmacy_cash_float_movements m
                      WHERE m.tenant_id = d.tenant_id AND m.destination_drawer_id = d.id
                        AND m.deleted_at IS NULL), 0)
         - COALESCE((SELECT SUM(m.amount) FROM public.pharmacy_cash_float_movements m
                      WHERE m.tenant_id = d.tenant_id AND m.source_drawer_id = d.id
                        AND m.deleted_at IS NULL), 0)
      FROM public.pharmacy_cash_drawers d
     WHERE d.id = p_drawer
$$;

-- ── the day close ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pharmacy_day_closes (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pharmacy_location_id  uuid NOT NULL,
    business_date         date NOT NULL,
    status                text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'reopened')),
    -- The Z-report as it stood at close: totals by tender, counts, floats.
    totals                jsonb NOT NULL DEFAULT '{}'::jsonb,
    expected_cash         numeric(12,2) NOT NULL,
    counted_cash          numeric(12,2) NOT NULL CHECK (counted_cash >= 0),
    -- {"500": 3, "100": 7, ...}: notes and coins counted.
    denominations         jsonb NOT NULL DEFAULT '{}'::jsonb,
    variance              numeric(12,2) GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
    variance_reason       text,
    petty_cash_total      numeric(12,2) NOT NULL DEFAULT 0,
    float_carried_forward numeric(12,2) NOT NULL DEFAULT 0
        CHECK (float_carried_forward >= 0 AND float_carried_forward <= counted_cash),
    closed_by             uuid NOT NULL REFERENCES public.users(id),
    closed_at             timestamptz NOT NULL DEFAULT now(),
    reopened_by           uuid REFERENCES public.users(id),
    reopened_at           timestamptz,
    reopen_reason         text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    deleted_by            uuid,
    delete_reason         text,
    CHECK (status = 'closed' OR (reopened_by IS NOT NULL AND length(btrim(reopen_reason)) >= 5))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_day_closes_counter_day
    ON public.pharmacy_day_closes (tenant_id, pharmacy_location_id, business_date)
    WHERE deleted_at IS NULL;

ALTER TABLE public.pharmacy_cash_drawers DROP CONSTRAINT IF EXISTS pharmacy_cash_drawers_day_close_fk;
ALTER TABLE public.pharmacy_cash_drawers
    ADD CONSTRAINT pharmacy_cash_drawers_day_close_fk
    FOREIGN KEY (day_close_id) REFERENCES public.pharmacy_day_closes(id);

DROP TRIGGER IF EXISTS trg_pharmacy_day_closes_updated_at ON public.pharmacy_day_closes;
CREATE TRIGGER trg_pharmacy_day_closes_updated_at
    BEFORE UPDATE ON public.pharmacy_day_closes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_pharmacy_day_closes_soft_delete ON public.pharmacy_day_closes;
CREATE TRIGGER trg_pharmacy_day_closes_soft_delete
    BEFORE DELETE ON public.pharmacy_day_closes
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_pharmacy_day_closes ON public.pharmacy_day_closes;
CREATE TRIGGER audit_pharmacy_day_closes
    AFTER INSERT OR DELETE OR UPDATE ON public.pharmacy_day_closes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

ALTER TABLE public.pharmacy_day_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_day_closes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_pharmacy_day_closes ON public.pharmacy_day_closes;
CREATE POLICY tenant_isolation_pharmacy_day_closes ON public.pharmacy_day_closes
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- Days worked before day close existed, with every drawer already shut, count
-- as closed: otherwise every counter would refuse to sell the morning after
-- this ships. A day with a drawer still open stays open — it was never counted.
INSERT INTO public.pharmacy_day_closes
    (tenant_id, pharmacy_location_id, business_date, totals, expected_cash, counted_cash,
     closed_by, closed_at)
SELECT d.tenant_id, d.pharmacy_location_id, d.business_date,
       jsonb_build_object('migrated', true),
       COALESCE(SUM(d.expected_close_amount), 0),
       GREATEST(COALESCE(SUM(d.actual_close_amount), 0), 0),
       (array_agg(d.cashier_user_id ORDER BY d.opened_at))[1],
       COALESCE(MAX(d.closed_at), now())
  FROM public.pharmacy_cash_drawers d
 WHERE d.deleted_at IS NULL
   AND d.business_date < public.tenant_local_date(d.tenant_id, now())
 GROUP BY d.tenant_id, d.pharmacy_location_id, d.business_date
HAVING bool_and(d.status <> 'open')
ON CONFLICT DO NOTHING;

UPDATE public.pharmacy_cash_drawers d
   SET day_close_id = c.id
  FROM public.pharmacy_day_closes c
 WHERE d.day_close_id IS NULL AND c.tenant_id = d.tenant_id
   AND c.pharmacy_location_id = d.pharmacy_location_id
   AND c.business_date = d.business_date AND c.deleted_at IS NULL;
