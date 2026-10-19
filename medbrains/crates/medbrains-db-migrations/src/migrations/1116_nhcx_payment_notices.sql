-- ====================================================================
-- Migration: 1116_nhcx_payment_notices.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_payment_notices, nhcx_payment_allocations
-- Drops: none
-- ====================================================================
-- NHCX payment notices (paymentnotice/request, NRCeS NHCX IG 6.5.0).
--
-- A payer tells the hospital it has paid with a TaskBundle carrying a
-- PaymentNotice and a PaymentReconciliation: one bank transfer (UTR in
-- paymentIdentifier) covering one or more claims, each detail line giving a
-- claim's approved amount and the TDS withheld from it. The notice is one
-- nhcx_payment_notices row per payer api call — a retried delivery files
-- nothing new — and one nhcx_payment_allocations row per claim it pays.
--
-- An allocation is posted the way insurer money already settles: the claim's
-- settled_amount rises by the gross (paid + TDS, since TDS is the insurer
-- discharging the claim to the tax department), the claim becomes 'settled'
-- or 'partially_settled', and the TDS is a tds_deductions row on the claim's
-- invoice. Insurer money never enters invoices.paid_amount — the claim
-- money trigger already takes the insurer's share off what the patient owes.
-- When the bank statement shows the transfer, auto-match finds the notice
-- by its UTR and matches the credit without settling the claim twice.
--
-- A detail naming no claim this payer was sent stays 'unmatched' until
-- finance posts it to the right claim; an amount that is not what the payer
-- approved is flagged for follow-up, never silently accepted.

CREATE TABLE public.nhcx_payment_notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    sender_code text NOT NULL,
    request_api_call_id uuid NOT NULL,
    nhcx_correlation_id uuid NOT NULL,
    nhcx_workflow_id uuid,
    payment_reference text,
    payment_date date,
    paid_amount numeric(14,2) NOT NULL,
    tds_amount numeric(14,2) NOT NULL DEFAULT 0,
    notice_identifier text,
    disposition text,
    payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    -- The acknowledgement (paymentnotice/on_request), tracked like any send.
    nhcx_api_call_id uuid,
    nhcx_status text,
    nhcx_disposition text,
    nhcx_submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

-- The gateway retries a callback it thinks was lost; one api call, one notice.
CREATE UNIQUE INDEX uq_nhcx_payment_notices_api_call
    ON public.nhcx_payment_notices (tenant_id, request_api_call_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nhcx_payment_notices_reference
    ON public.nhcx_payment_notices (tenant_id, payment_reference)
    WHERE payment_reference IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_payment_notices_received
    ON public.nhcx_payment_notices (tenant_id, received_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.nhcx_payment_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    notice_id uuid NOT NULL REFERENCES public.nhcx_payment_notices(id),
    -- How the payer named the claim (PaymentReconciliation.detail.identifier).
    claim_reference text,
    insurance_claim_id uuid REFERENCES public.insurance_claims(id),
    gross_amount numeric(14,2) NOT NULL CHECK (gross_amount >= 0),
    tds_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
    net_amount numeric(14,2) NOT NULL,
    -- The claim's approved amount when the payment was posted.
    approved_amount numeric(14,2),
    is_mismatch boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('posted', 'unmatched')),
    tds_deduction_id uuid REFERENCES public.tds_deductions(id),
    bank_transaction_id uuid REFERENCES public.bank_transactions(id),
    posted_at timestamptz,
    posted_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nhcx_payment_allocations_net CHECK (net_amount = gross_amount - tds_amount),
    CONSTRAINT nhcx_payment_allocations_posted CHECK (
        status = 'unmatched' OR (insurance_claim_id IS NOT NULL AND posted_at IS NOT NULL))
);

CREATE INDEX idx_nhcx_payment_allocations_notice
    ON public.nhcx_payment_allocations (tenant_id, notice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nhcx_payment_allocations_claim
    ON public.nhcx_payment_allocations (tenant_id, insurance_claim_id)
    WHERE insurance_claim_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_payment_allocations_open
    ON public.nhcx_payment_allocations (tenant_id, created_at DESC)
    WHERE (status = 'unmatched' OR is_mismatch) AND deleted_at IS NULL;

ALTER TABLE public.nhcx_payment_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_payment_notices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_payment_notices ON public.nhcx_payment_notices
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_nhcx_payment_notices BEFORE UPDATE ON public.nhcx_payment_notices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_payment_notices_soft_delete BEFORE DELETE ON public.nhcx_payment_notices
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.nhcx_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_payment_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_payment_allocations ON public.nhcx_payment_allocations
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_nhcx_payment_allocations BEFORE UPDATE ON public.nhcx_payment_allocations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_payment_allocations_soft_delete BEFORE DELETE ON public.nhcx_payment_allocations
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
