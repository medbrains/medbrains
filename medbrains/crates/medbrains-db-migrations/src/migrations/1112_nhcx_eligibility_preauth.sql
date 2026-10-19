-- ====================================================================
-- Migration: 1112_nhcx_eligibility_preauth.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_payer_queries
-- Drops: none
-- ====================================================================
-- NHCX eligibility and pre-authorisation.
--
-- An eligibility check is an insurance_verifications row: it waits as
-- 'pending' until the payer's on_check reply arrives, and the payer's answer
-- — in force or not, benefit lines with allowed and used amounts, coverage
-- period, errors — is parsed into nhcx_result. A pending check is never
-- read as "not covered".
--
-- A pre-authorisation carries the same exchange columns as a claim, plus the
-- stage it is at: IRDAI's Master Circular on Health Insurance (29 May 2024)
-- gives an insurer one hour to decide a cashless request and three hours to
-- grant final authorisation on a discharge request, so the stage picks the
-- clock.
--
-- A payer may ask for more before deciding (HCX communication/request). Each
-- question is an nhcx_payer_queries row on the pre-authorisation or claim it
-- concerns, answered from the desk with text and documents; the answer goes
-- back as an HCX Communication and is tracked like any other message.

ALTER TABLE public.insurance_verifications
    ADD COLUMN nhcx_correlation_id uuid,
    ADD COLUMN nhcx_api_call_id uuid,
    ADD COLUMN nhcx_workflow_id uuid,
    ADD COLUMN nhcx_recipient_code text,
    ADD COLUMN nhcx_status text,
    ADD COLUMN nhcx_disposition text,
    ADD COLUMN nhcx_submitted_at timestamptz,
    ADD COLUMN nhcx_response_at timestamptz,
    ADD COLUMN nhcx_result jsonb;

CREATE INDEX idx_insurance_verifications_nhcx_correlation_id
    ON public.insurance_verifications (nhcx_correlation_id)
    WHERE nhcx_correlation_id IS NOT NULL;

ALTER TABLE public.prior_auth_requests
    ADD COLUMN nhcx_workflow_id uuid,
    ADD COLUMN nhcx_status text,
    ADD COLUMN nhcx_disposition text,
    ADD COLUMN nhcx_submitted_at timestamptz,
    ADD COLUMN request_stage text NOT NULL DEFAULT 'initial'
        CHECK (request_stage IN ('initial', 'enhancement', 'discharge'));

CREATE TABLE public.nhcx_payer_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    prior_auth_id uuid REFERENCES public.prior_auth_requests(id),
    insurance_claim_id uuid REFERENCES public.insurance_claims(id),
    sender_code text NOT NULL,
    nhcx_correlation_id uuid NOT NULL,
    nhcx_workflow_id uuid,
    request_api_call_id uuid,
    question text NOT NULL,
    requested_items text[] NOT NULL DEFAULT '{}',
    received_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
    answer_text text,
    answer_document_ids uuid[] NOT NULL DEFAULT '{}',
    answered_by uuid REFERENCES public.users(id),
    answered_at timestamptz,
    nhcx_api_call_id uuid,
    nhcx_status text,
    nhcx_disposition text,
    nhcx_submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nhcx_payer_queries_one_subject CHECK (num_nonnulls(prior_auth_id, insurance_claim_id) = 1),
    CONSTRAINT nhcx_payer_queries_answered CHECK (status = 'open' OR (answer_text IS NOT NULL AND answered_at IS NOT NULL))
);

-- The gateway retries a callback it thinks was lost; one api call, one query.
CREATE UNIQUE INDEX uq_nhcx_payer_queries_api_call ON public.nhcx_payer_queries (tenant_id, request_api_call_id)
    WHERE request_api_call_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_payer_queries_prior_auth ON public.nhcx_payer_queries (tenant_id, prior_auth_id)
    WHERE prior_auth_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_nhcx_payer_queries_claim ON public.nhcx_payer_queries (tenant_id, insurance_claim_id)
    WHERE insurance_claim_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.nhcx_payer_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_payer_queries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_payer_queries ON public.nhcx_payer_queries
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_nhcx_payer_queries BEFORE UPDATE ON public.nhcx_payer_queries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_payer_queries_soft_delete BEFORE DELETE ON public.nhcx_payer_queries
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
