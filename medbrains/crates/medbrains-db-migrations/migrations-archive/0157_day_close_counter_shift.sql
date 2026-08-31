-- Migration: 0157_day_close_counter_shift.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters existing tenant-policied day-close tables.
-- Day-close v2 (audit #291): per-counter, per-shift cash tally with a
-- denomination breakdown and card/UPI settlement reconciliation.
--
-- Counter is a free-text label (e.g. "OPD-1", "ER-CASH") rather than a
-- FK — there is no billing-counter master and one isn't warranted; the
-- desk supplies its label. Shift is likewise a free-text code.

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS counter_id text,
    ADD COLUMN IF NOT EXISTS shift text;

-- Per-counter / per-shift queries during tally and reporting.
CREATE INDEX IF NOT EXISTS idx_payments_counter_paid_at
    ON public.payments (tenant_id, counter_id, paid_at);

ALTER TABLE public.day_end_closes
    ADD COLUMN IF NOT EXISTS counter_id text,
    ADD COLUMN IF NOT EXISTS shift text,
    -- { "2000": 1, "500": 4, "100": 7, ... } note count by denomination.
    ADD COLUMN IF NOT EXISTS denominations jsonb,
    -- Card / UPI settlement-report figures and their variance vs system.
    ADD COLUMN IF NOT EXISTS actual_card numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_upi numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS card_difference numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS upi_difference numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS verification_notes text;
