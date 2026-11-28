-- ====================================================================
-- Migration: 1480_plain_sequence_numbers.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A hospital wants plain UHIDs 1, 2, 3: an empty prefix and no zero
-- padding. pad_width now allows 0 (no padding) up to 10; it used to start
-- at 3. Every formatter pads to GREATEST(pad_width, length(n)), so 0 gives
-- the bare number, never the empty string lpad(n, 0, '0') would.
-- Widening only: every existing row (3..10) still passes.

ALTER TABLE public.sequences DROP CONSTRAINT IF EXISTS chk_sequences_pad_width;
ALTER TABLE public.sequences
    ADD CONSTRAINT chk_sequences_pad_width CHECK (pad_width BETWEEN 0 AND 10);
