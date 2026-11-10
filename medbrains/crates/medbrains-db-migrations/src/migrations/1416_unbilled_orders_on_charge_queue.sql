-- ====================================================================
-- Migration: 1416_unbilled_orders_on_charge_queue.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Revenue leakage, first check: lab tests verified, imaging reported and
-- procedures completed that carry no charge on any bill.
--
-- Until now only the discharge final-bill checklist caught them, so an
-- outpatient or a day-care patient was never caught and an inpatient only at
-- the very end. The unbilled-orders detector (medbrains-billing `leakage`,
-- daily and on demand) puts each one on the existing charge attention queue
-- (migration 1411) with reason `unbilled_order`; the desk posts the charge or
-- dismisses it with a reason, the same as any other queued charge.
--
-- The queue gains what a leakage row needs:
--   department_id  the ordering or performing department, for the desk's view
--   service_at     when the service was done, so the row's age is the age of
--                  the leak, not of the detection
-- and created_by may be empty: the daily pass acts for the hospital, not for a
-- person, and the screen shows it as "System". A person's own action still has
-- to say who.

ALTER TABLE public.charge_attention_items
    ADD COLUMN department_id uuid REFERENCES public.departments(id),
    ADD COLUMN service_at timestamptz,
    ALTER COLUMN created_by DROP NOT NULL,
    ADD CONSTRAINT charge_attention_only_detector_unattributed
        CHECK (created_by IS NOT NULL OR reason = 'unbilled_order');

-- The detector's "already on the queue" probe: any live row for the order,
-- whatever its status, so a dismissed order is never raised again.
CREATE INDEX idx_charge_attention_source
    ON public.charge_attention_items (tenant_id, source_module, source_entity_id)
    WHERE deleted_at IS NULL;
