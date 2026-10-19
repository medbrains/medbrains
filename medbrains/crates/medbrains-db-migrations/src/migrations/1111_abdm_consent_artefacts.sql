-- ====================================================================
-- Migration: 1111_abdm_consent_artefacts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_consent_artefacts, abdm_health_transfers
-- Drops: none
-- ====================================================================
-- ABDM Milestone 2 — what the patient consented to share, and what was sent.
--
-- The consent manager notifies the HIP of every consent artefact naming it:
-- who may receive (the HIU), for what purpose, which HI types, which date
-- range, until when, and which care contexts. A health-information request
-- is answered only within an artefact that is GRANTED and unexpired, and
-- only with the care contexts and dates it names. Each answer is recorded as
-- a transfer: DHIS counts consented transfers, and DPDP asks the hospital to
-- prove every disclosure.

CREATE TABLE public.abdm_consent_artefacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    consent_id text NOT NULL,
    role text NOT NULL DEFAULT 'hip' CHECK (role IN ('hip', 'hiu')),
    patient_id uuid REFERENCES public.patients(id),
    abha_address text,
    hiu_id text,
    purpose_code text,
    purpose_text text,
    hi_types text[] NOT NULL DEFAULT '{}',
    date_from timestamptz,
    date_to timestamptz,
    data_erase_at timestamptz,
    care_context_refs text[] NOT NULL DEFAULT '{}',
    status text NOT NULL CHECK (status IN ('GRANTED', 'REVOKED', 'EXPIRED', 'DENIED')),
    signature text,
    notified_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT abdm_consent_artefacts_range CHECK (date_from IS NULL OR date_to IS NULL OR date_to >= date_from)
);

CREATE UNIQUE INDEX uq_abdm_consent_artefacts_consent
    ON public.abdm_consent_artefacts (tenant_id, role, consent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_abdm_consent_artefacts_patient
    ON public.abdm_consent_artefacts (tenant_id, patient_id, notified_at DESC);

ALTER TABLE public.abdm_consent_artefacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_consent_artefacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_consent_artefacts ON public.abdm_consent_artefacts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_consent_artefacts BEFORE UPDATE ON public.abdm_consent_artefacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_consent_artefacts_soft_delete BEFORE DELETE ON public.abdm_consent_artefacts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.abdm_health_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    consent_artefact_id uuid NOT NULL REFERENCES public.abdm_consent_artefacts(id),
    patient_id uuid REFERENCES public.patients(id),
    transaction_id text NOT NULL,
    data_push_url text NOT NULL,
    care_context_refs text[] NOT NULL DEFAULT '{}',
    entry_count integer NOT NULL DEFAULT 0 CHECK (entry_count >= 0),
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'transferred', 'failed', 'refused')),
    error text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    transferred_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_abdm_health_transfers_txn
    ON public.abdm_health_transfers (tenant_id, transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_abdm_health_transfers_patient
    ON public.abdm_health_transfers (tenant_id, patient_id, requested_at DESC);
CREATE INDEX idx_abdm_health_transfers_month
    ON public.abdm_health_transfers (tenant_id, requested_at DESC);

ALTER TABLE public.abdm_health_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_health_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_health_transfers ON public.abdm_health_transfers
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_health_transfers BEFORE UPDATE ON public.abdm_health_transfers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_health_transfers_soft_delete BEFORE DELETE ON public.abdm_health_transfers
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
