-- ====================================================================
-- Migration: 1113_abdm_consent_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_consent_requests
-- Drops: none
-- ====================================================================
-- ABDM Milestone 3 — this hospital as a Health Information User (HIU).
--
-- A doctor asks, through the patient's consent manager, to see the patient's
-- records held by other facilities: for what purpose (ABDM's purpose codes),
-- which record types, which dates, and until when the copies may be kept
-- (`dataEraseAt`). The patient grants or denies it in their PHR app; a grant
-- arrives as one consent artefact per HIP, kept in `abdm_consent_artefacts`
-- with role 'hiu'. Each artefact carries the Fidelius key pair the HIPs
-- encrypt to — the private key sealed, never in the clear — and the
-- transaction its records arrive under.
--
-- The requester is named with their HPR ID: ABDM shows the patient who asks.

CREATE TABLE public.abdm_consent_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    requested_by uuid NOT NULL REFERENCES public.users(id),
    requester_name text NOT NULL,
    requester_hpr_id text NOT NULL,
    abha_address text NOT NULL,
    hiu_id text NOT NULL,
    purpose_code text NOT NULL
        CHECK (purpose_code IN ('CAREMGT', 'BTG', 'PUBHLTH', 'HPAYMT', 'DSRCH', 'PATRQT')),
    hi_types text[] NOT NULL
        CHECK (cardinality(hi_types) > 0 AND hi_types <@ ARRAY['OPConsultation', 'Prescription',
            'DiagnosticReport', 'DischargeSummary', 'ImmunizationRecord', 'HealthDocumentRecord',
            'WellnessRecord', 'Invoice']::text[]),
    date_from timestamptz NOT NULL,
    date_to timestamptz NOT NULL,
    data_erase_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'awaiting_patient', 'granted', 'denied', 'revoked',
                          'expired', 'failed')),
    gateway_request_id uuid,
    consent_request_id text,
    error text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    status_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT abdm_consent_requests_range CHECK (date_to >= date_from),
    CONSTRAINT abdm_consent_requests_erase CHECK (data_erase_at > requested_at)
);

CREATE UNIQUE INDEX uq_abdm_consent_requests_gateway
    ON public.abdm_consent_requests (tenant_id, gateway_request_id)
    WHERE gateway_request_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_abdm_consent_requests_consent_request
    ON public.abdm_consent_requests (tenant_id, consent_request_id)
    WHERE consent_request_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_abdm_consent_requests_patient
    ON public.abdm_consent_requests (tenant_id, patient_id, requested_at DESC);
CREATE INDEX idx_abdm_consent_requests_month
    ON public.abdm_consent_requests (tenant_id, requested_at DESC);

ALTER TABLE public.abdm_consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_consent_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_consent_requests ON public.abdm_consent_requests
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_consent_requests BEFORE UPDATE ON public.abdm_consent_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_consent_requests_soft_delete BEFORE DELETE ON public.abdm_consent_requests
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- HIU artefacts: which request they answer, which HIP holds the records, the
-- gateway requests that fetched them and asked for the data, the transaction
-- the data arrives under, and our Fidelius key material (sealed; cleared when
-- the transfer completes or the consent ends).
ALTER TABLE public.abdm_consent_artefacts
    ADD COLUMN IF NOT EXISTS consent_request_id uuid REFERENCES public.abdm_consent_requests(id),
    ADD COLUMN IF NOT EXISTS hip_id text,
    ADD COLUMN IF NOT EXISTS hip_name text,
    ADD COLUMN IF NOT EXISTS fetch_request_id uuid,
    ADD COLUMN IF NOT EXISTS hi_request_id uuid,
    ADD COLUMN IF NOT EXISTS transaction_id text,
    ADD COLUMN IF NOT EXISTS key_material_sealed text,
    ADD COLUMN IF NOT EXISTS hi_status text;

CREATE INDEX IF NOT EXISTS idx_abdm_consent_artefacts_request
    ON public.abdm_consent_artefacts (tenant_id, consent_request_id)
    WHERE consent_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abdm_consent_artefacts_hi_request
    ON public.abdm_consent_artefacts (tenant_id, hi_request_id)
    WHERE hi_request_id IS NOT NULL;
