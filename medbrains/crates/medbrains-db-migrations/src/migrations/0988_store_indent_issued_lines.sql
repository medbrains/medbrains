-- ====================================================================
-- Migration: 0988_store_indent_issued_lines.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================

-- Store indents move stock.
--
-- `issue_store_indent` and `receive_store_indent` used to be a status UPDATE
-- and nothing else: a storekeeper could move a hundred strips from central to
-- their store, click through to `received`, and both stores' counts were
-- unchanged. The screen was green and the shelf was wrong.
--
-- Issue now decrements the source FEFO, and receive credits the destination.
-- Which batches were taken has to survive the gap between the two — they are
-- separate acts by separate people, possibly days apart — so it is recorded
-- here, the same way `pharmacy_transfer_requests.dispatched_lines` records it
-- for the sibling flow that always did this correctly.
ALTER TABLE public.pharmacy_store_indents
    ADD COLUMN IF NOT EXISTS issued_lines jsonb DEFAULT '[]'::jsonb NOT NULL;
