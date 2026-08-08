-- ====================================================================
-- Migration: 0290_token_referral_return.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Send-and-return between queues, and requeueing a no-show.
--
-- Two things a camp exposes that a fixed OPD hides, because in a camp one
-- person walks between stations in a single visit:
--
-- 1. Send and return. A doctor sends a patient to lab or vitals mid-consult.
--    Today that mints an independent lab token and the trail ends there: when
--    the lab is done, the patient is on their own to rejoin the doctor, and
--    rejoining means the back of a queue they already waited in. Recording who
--    referred them lets the lab's "completed" put them straight back in front
--    of that same doctor.
--
--    `referred_from_*` is deliberately (module, scope, scope_id) rather than a
--    token id: the return goes to a *queue*, and the doctor's original token
--    may since have been completed. `returned_from_label` is display only —
--    "Back from Laboratory" on the board — so the doctor knows why this patient
--    reappeared ahead of the rest.
--
-- 2. Requeue. `no_show` is terminal. Someone who missed their call and comes
--    back has no way in other than a fresh token with a new number, which
--    invalidates the slip in their hand. Requeue reuses the token and moves
--    only its place in line.
--
-- Neither adds a column to the hot board query, and neither changes ORDER BY:
-- position is expressed in `seq`, which the board already sorts by. `number` is
-- stored, not derived, so moving a token in the queue never changes the number
-- printed on the patient's slip.
-- ============================================================

ALTER TABLE public.tokens
    -- The queue that sent them here, so completion knows where to send them back.
    ADD COLUMN IF NOT EXISTS referred_from_module   text,
    ADD COLUMN IF NOT EXISTS referred_from_scope    text,
    ADD COLUMN IF NOT EXISTS referred_from_scope_id uuid,
    -- Display only: "Back from Laboratory" on the receiving board.
    ADD COLUMN IF NOT EXISTS returned_from_label    text,
    ADD COLUMN IF NOT EXISTS returned_at            timestamp with time zone;

-- Completing a referred token has to find the referring queue. Partial, because
-- the overwhelming majority of tokens are not referrals.
CREATE INDEX IF NOT EXISTS idx_tokens_referred_from
    ON public.tokens (tenant_id, referred_from_module, referred_from_scope_id, token_date)
    WHERE referred_from_module IS NOT NULL;
