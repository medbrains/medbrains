-- Migration: 0170_pharmacy_partial_dispense.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters pharmacy_orders and pharmacy_order_items, already tenant-policied.
-- Allow partial dispensing: a pharmacy order can be left "partially_dispensed"
-- (some line still has a balance) and the remainder dispensed later. The order
-- status is a text column with a CHECK constraint; extend it to include the
-- new value. Line-level progress is tracked in a new
-- pharmacy_order_items.quantity_dispensed column.

ALTER TABLE public.pharmacy_order_items
    ADD COLUMN IF NOT EXISTS quantity_dispensed integer DEFAULT 0 NOT NULL;

ALTER TABLE public.pharmacy_orders
    DROP CONSTRAINT IF EXISTS pharmacy_orders_status_check;

ALTER TABLE public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_status_check
    CHECK (status = ANY (ARRAY[
        'ordered'::text,
        'dispensed'::text,
        'partially_dispensed'::text,
        'cancelled'::text,
        'returned'::text
    ]));
