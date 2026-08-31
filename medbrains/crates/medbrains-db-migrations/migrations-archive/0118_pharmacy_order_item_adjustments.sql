-- ====================================================================
-- Migration: 0118_pharmacy_order_item_adjustments.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters: pharmacy_order_items
-- ====================================================================
-- Pharmacy pre-dispense changes must remain auditable. Removing a line
-- before dispense now marks it as removed instead of deleting the row,
-- while active order flows filter removed_at IS NULL.

ALTER TABLE public.pharmacy_order_items
    ADD COLUMN IF NOT EXISTS removed_at timestamptz,
    ADD COLUMN IF NOT EXISTS removed_by uuid,
    ADD COLUMN IF NOT EXISTS remove_reason text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pharmacy_order_items_removed_by_fkey'
    ) THEN
        ALTER TABLE public.pharmacy_order_items
            ADD CONSTRAINT pharmacy_order_items_removed_by_fkey
            FOREIGN KEY (removed_by) REFERENCES public.users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_active_order
    ON public.pharmacy_order_items (tenant_id, order_id)
    WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_removed
    ON public.pharmacy_order_items (tenant_id, removed_at)
    WHERE removed_at IS NOT NULL;
