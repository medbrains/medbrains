-- ====================================================================
-- Migration: 0129_pharmacy_order_item_batch_fk.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters: pharmacy_order_items
-- ====================================================================
-- Pharmacy dispense records store the FEFO-selected pharmacy batch on
-- pharmacy_order_items.batch_stock_id. The existing cross-module FK
-- pointed at generic inventory batch_stock, which rejects valid
-- pharmacy_batches rows during dispense and POS billing.

ALTER TABLE public.pharmacy_order_items
    DROP CONSTRAINT IF EXISTS pharmacy_order_items_batch_stock_id_fkey;

ALTER TABLE public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_batch_stock_id_fkey
    FOREIGN KEY (batch_stock_id) REFERENCES public.pharmacy_batches(id);
