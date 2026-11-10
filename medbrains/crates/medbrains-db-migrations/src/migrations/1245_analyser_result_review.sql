-- ====================================================================
-- Migration: 1245_analyser_result_review.sql
-- RLS-Posture: tenant-scoped (existing tables; policies unchanged)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Analyser results that cannot be matched with certainty are held for a
-- technologist instead of being guessed.
--
-- A message with no barcode used to attach to the patient's most recent
-- pending order, and every unmatched message was left as `mapped` with no
-- screen that listed it. `needs_review` is the queue the lab's analyser
-- review screen reads; `reviewed_*` record who resolved a held message and
-- how.
--
-- `lab_results.analyser_status` keeps the analyser's result status (HL7
-- table 0085 / ASTM): P preliminary, F final, C correction. A later final
-- replaces a preliminary; a correction replaces either; a final that
-- disagrees with a final is held. NULL means the value was typed in.

ALTER TYPE public.device_message_status ADD VALUE IF NOT EXISTS 'needs_review';

ALTER TABLE public.device_messages
    ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.lab_results
    ADD COLUMN IF NOT EXISTS analyser_status text
        CHECK (analyser_status IN ('P', 'F', 'C'));
