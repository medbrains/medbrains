-- ====================================================================
-- Migration: 1183_nhcx_wire_conformance.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_correlation_aliases
-- Drops: none
-- ====================================================================
-- NHCX envelope and callback conformance (NHA nhcx-package, Oct 2026).
--
-- x-hcx-workflow_id is a step code ("12" a new pre-auth, "24" a query,
-- "33" a settled payment, "PC01" a cancellation), not a UUID. Every column
-- that held it becomes text; an inbound "24" used to fail to parse and was
-- dropped, so nothing could key on it.
--
-- The payer's answer is read into nhcx_decision — received, approved,
-- partially approved, rejected, queried, cancelled, error or unknown — on
-- the claim and the pre-authorisation, so a query is never shown as an
-- approval and a rejection is never left "in review".
--
-- A retried send goes out under fresh ids (NHCX retires a correlation id
-- that failed). nhcx_correlation_aliases maps each retry's correlation id
-- to the one the record carries, so a payer answering a retry still finds
-- its record.
--
-- nhcx_settings.callback_ip_allowlist, when set, refuses callbacks from
-- anywhere else (NHA publishes the gateway's three outbound addresses).
-- nhcx_callback_log keeps the inbound step code and the gateway JWT's jti,
-- unique per hospital, so a replayed token is refused.

ALTER TABLE public.insurance_claims
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text,
    ADD COLUMN nhcx_decision text;
ALTER TABLE public.insurance_verifications
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text;
ALTER TABLE public.prior_auth_requests
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text,
    ADD COLUMN nhcx_decision text;
ALTER TABLE public.nhcx_payer_queries
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text;
ALTER TABLE public.nhcx_tasks
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text;
ALTER TABLE public.nhcx_payment_notices
    ALTER COLUMN nhcx_workflow_id TYPE text USING nhcx_workflow_id::text;

ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_nhcx_decision_check
    CHECK (nhcx_decision IN ('received', 'approved', 'partially_approved', 'rejected',
                             'queried', 'cancelled', 'error', 'unknown'));
ALTER TABLE public.prior_auth_requests ADD CONSTRAINT prior_auth_requests_nhcx_decision_check
    CHECK (nhcx_decision IN ('received', 'approved', 'partially_approved', 'rejected',
                             'queried', 'cancelled', 'error', 'unknown'));

ALTER TABLE public.nhcx_settings
    ADD COLUMN callback_ip_allowlist text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.nhcx_callback_log
    ADD COLUMN workflow_code text,
    ADD COLUMN gateway_jti text;
CREATE UNIQUE INDEX uq_nhcx_callback_log_jti ON public.nhcx_callback_log (tenant_id, gateway_jti)
    WHERE gateway_jti IS NOT NULL;

CREATE TABLE public.nhcx_correlation_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    correlation_id uuid NOT NULL,
    canonical_correlation_id uuid NOT NULL,
    outbox_event_id uuid,
    attempt integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_nhcx_correlation_aliases ON public.nhcx_correlation_aliases
    (tenant_id, correlation_id) WHERE deleted_at IS NULL;

ALTER TABLE public.nhcx_correlation_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_correlation_aliases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_correlation_aliases ON public.nhcx_correlation_aliases
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_nhcx_correlation_aliases BEFORE UPDATE
    ON public.nhcx_correlation_aliases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_correlation_aliases_soft_delete BEFORE DELETE
    ON public.nhcx_correlation_aliases FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Only the settled notice (33) carries money. An initiated (30) or
-- processed (31) notice — or a repeat of a settled one — is filed as
-- 'advice': seen on the payments screen, never posted to the claim.
ALTER TABLE public.nhcx_payment_allocations DROP CONSTRAINT nhcx_payment_allocations_status_check;
ALTER TABLE public.nhcx_payment_allocations ADD CONSTRAINT nhcx_payment_allocations_status_check
    CHECK (status IN ('posted', 'unmatched', 'advice'));
ALTER TABLE public.nhcx_payment_allocations DROP CONSTRAINT nhcx_payment_allocations_posted;
ALTER TABLE public.nhcx_payment_allocations ADD CONSTRAINT nhcx_payment_allocations_posted CHECK (
    status <> 'posted' OR (insurance_claim_id IS NOT NULL AND posted_at IS NOT NULL));

-- A status enquiry's correlation id is the api call id of the message it
-- asks about, so two enquiries about one claim share it; the latest answers.
DROP INDEX public.uq_nhcx_tasks_correlation;
CREATE INDEX idx_nhcx_tasks_correlation ON public.nhcx_tasks (tenant_id, nhcx_correlation_id, created_at DESC)
    WHERE deleted_at IS NULL;
