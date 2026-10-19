-- ====================================================================
-- Migration: 1115_nhcx_claim_tasks.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_tasks
-- Drops: none
-- ====================================================================
-- NHCX final claims and the Tasks around them (NRCeS NHCX IG 6.5.0).
--
-- A final claim (Claim.use = claim) goes from the final bill: each line with
-- its code, quantity and amount. The lines sent are kept on the claim
-- (nhcx_claim_items) so the payer's ClaimResponse — which names lines only by
-- sequence — reads back as "this line, this much deducted, for this reason".
-- The adjudication is parsed into nhcx_adjudication: submitted, approved and
-- deducted amounts, overall and per line, with the payer's reasons.
--
-- A pre-authorisation answered on the claim leaves its preAuthRef in
-- nhcx_pre_auth_ref; the final claim quotes it back to the payer.
--
-- Status checks, searches, cancellations and reprocess requests are HCX
-- Tasks. Each is an nhcx_tasks row with its own correlation id, so asking
-- where a claim stands never overwrites the claim's own exchange ids, and the
-- payer's reply is matched to the Task first and applied to its subject.
--
-- A claim the payer agrees to cancel is 'cancelled' (receivables ageing
-- already excludes that status; the check constraint never allowed it).

ALTER TABLE public.insurance_claims
    ADD COLUMN nhcx_use text CHECK (nhcx_use IN ('claim', 'preauthorization')),
    ADD COLUMN nhcx_pre_auth_ref text,
    ADD COLUMN nhcx_claim_items jsonb,
    ADD COLUMN nhcx_adjudication jsonb,
    ADD COLUMN nhcx_adjudicated_at timestamptz;

ALTER TABLE public.insurance_claims DROP CONSTRAINT insurance_claims_status_check;
ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_status_check CHECK (status IN (
    'initiated', 'pre_auth_requested', 'pre_auth_approved', 'pre_auth_rejected',
    'claim_submitted', 'claim_approved', 'claim_rejected', 'settled', 'partially_settled',
    'cancelled'));

CREATE INDEX idx_insurance_claims_nhcx_workflow_id ON public.insurance_claims (tenant_id, nhcx_workflow_id)
    WHERE nhcx_workflow_id IS NOT NULL;

CREATE TABLE public.nhcx_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    kind text NOT NULL CHECK (kind IN ('status', 'search', 'cancel', 'reprocess')),
    insurance_claim_id uuid REFERENCES public.insurance_claims(id),
    prior_auth_id uuid REFERENCES public.prior_auth_requests(id),
    recipient_code text NOT NULL,
    -- What was asked: a search's date range and claim number, a cancel or
    -- reprocess reason.
    request jsonb NOT NULL DEFAULT '{}',
    nhcx_correlation_id uuid NOT NULL,
    nhcx_api_call_id uuid NOT NULL,
    nhcx_workflow_id uuid,
    nhcx_status text,
    nhcx_disposition text,
    nhcx_submitted_at timestamptz,
    nhcx_response_at timestamptz,
    -- The payer's answer, parsed: Task status, outcome, the claim responses found.
    result jsonb,
    requested_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nhcx_tasks_subject CHECK (
        (kind = 'search' AND num_nonnulls(insurance_claim_id, prior_auth_id) = 0)
        OR (kind = 'status' AND num_nonnulls(insurance_claim_id, prior_auth_id) = 1)
        OR (kind IN ('cancel', 'reprocess') AND insurance_claim_id IS NOT NULL AND prior_auth_id IS NULL))
);

CREATE UNIQUE INDEX uq_nhcx_tasks_correlation ON public.nhcx_tasks (tenant_id, nhcx_correlation_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_nhcx_tasks_claim ON public.nhcx_tasks (tenant_id, insurance_claim_id, created_at DESC)
    WHERE insurance_claim_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_tasks_prior_auth ON public.nhcx_tasks (tenant_id, prior_auth_id, created_at DESC)
    WHERE prior_auth_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_tasks_kind ON public.nhcx_tasks (tenant_id, kind, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.nhcx_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_tasks ON public.nhcx_tasks
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_nhcx_tasks BEFORE UPDATE ON public.nhcx_tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_tasks_soft_delete BEFORE DELETE ON public.nhcx_tasks
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
