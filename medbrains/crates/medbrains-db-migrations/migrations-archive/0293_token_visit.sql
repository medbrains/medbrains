-- ====================================================================
-- Migration: 0293_token_visit.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Group a visit's tokens so one number can carry a patient across departments.
--
-- A patient walking OPD -> lab -> pharmacy collects three unrelated tokens
-- (R-014, L-003, P-021), each numbered from its own department sequence and
-- linked to its own source record — a patient row, a lab order, an invoice.
-- Nothing says they are one visit. The only shared key is patient_id plus
-- token_date, and that is wrong twice over: it merges a morning OPD visit with
-- an evening ER visit, and it cannot be known at issue time whether an earlier
-- token belongs to the same journey or a different one.
--
-- Not a foreign key to `encounters`, though that is the visit entity: the
-- registration token is minted when the patient record is created, before any
-- encounter exists. A visit key that could not include the first token of the
-- visit would defeat the purpose. The id is minted at first contact instead and
-- carried forward; an encounter created later for the same visit links to it.
--
-- Nothing about call order changes. `seq` still orders every board and
-- `call_next`; this only lets `number` — a stored column, not a derived one —
-- be shared across the visit's tokens.
-- ====================================================================

ALTER TABLE public.tokens
    ADD COLUMN IF NOT EXISTS visit_id uuid;

-- Issue-time lookup: "does this visit already have a number to reuse?".
-- Partial, because tokens issued outside a visit stay the overwhelming majority
-- until every caller passes one.
CREATE INDEX IF NOT EXISTS idx_tokens_visit
    ON public.tokens (tenant_id, visit_id, created_at)
    WHERE visit_id IS NOT NULL;
