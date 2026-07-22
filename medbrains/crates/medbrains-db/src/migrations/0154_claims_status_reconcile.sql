-- Migration: 0154_claims_status_reconcile.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters and backfills existing tenant-policied claim tables.
-- Reconcile insurance_claims.status drift (#280) and separate the
-- NHCX gateway transport status from the claim lifecycle.
ALTER TABLE public.insurance_claims
    ADD COLUMN IF NOT EXISTS nhcx_status text;

-- Legacy secondary-claim writer used 'submitted'.
UPDATE public.insurance_claims
SET status = 'claim_submitted'
WHERE status = 'submitted';

-- The NHCX callback used to clobber status with raw gateway strings
-- (response_received, request.queued, ...). Preserve them in
-- nhcx_status and restore a sane lifecycle state — a claim the
-- gateway responded about was at least submitted.
UPDATE public.insurance_claims
SET nhcx_status = status,
    status = 'claim_submitted'
WHERE status NOT IN ('initiated', 'pre_auth_requested', 'pre_auth_approved',
                     'pre_auth_rejected', 'claim_submitted', 'claim_approved',
                     'claim_rejected', 'settled', 'partially_settled');

-- Tighten to the pure TypeScript contract and validate everything.
ALTER TABLE public.insurance_claims
    DROP CONSTRAINT IF EXISTS insurance_claims_status_check;
ALTER TABLE public.insurance_claims
    ADD CONSTRAINT insurance_claims_status_check
    CHECK (status IN ('initiated', 'pre_auth_requested', 'pre_auth_approved',
                      'pre_auth_rejected', 'claim_submitted', 'claim_approved',
                      'claim_rejected', 'settled', 'partially_settled'));
