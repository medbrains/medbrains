-- ====================================================================
-- Migration: 1114_abdm_received_records.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_received_records
-- Drops: none
-- ====================================================================
-- ABDM Milestone 3 — the records other facilities sent us under a consent.
--
-- One row per decrypted FHIR bundle, checksum verified, inside the consent's
-- scope (its care contexts and record types). A copy may be kept only until
-- the consent's `dataEraseAt`, and not a moment after the patient revokes it
-- or it expires: the bundle is then erased (set NULL, `purged_at` stamped)
-- while the row stays, so the hospital can still show what it once held and
-- DHIS can count the transfer. A purge is never a soft delete — the clinical
-- content itself is gone.

CREATE TABLE public.abdm_received_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    consent_request_id uuid NOT NULL REFERENCES public.abdm_consent_requests(id),
    consent_artefact_id uuid NOT NULL REFERENCES public.abdm_consent_artefacts(id),
    care_context_reference text NOT NULL,
    hi_type text,
    source_hip_id text NOT NULL,
    source_hip_name text,
    transaction_id text NOT NULL,
    checksum text NOT NULL,
    bundle jsonb,
    received_at timestamptz NOT NULL DEFAULT now(),
    erase_at timestamptz NOT NULL,
    purged_at timestamptz,
    purge_reason text CHECK (purge_reason IN ('revoked', 'expired', 'erased')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT abdm_received_records_purge CHECK ((bundle IS NULL) = (purged_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_abdm_received_records_entry
    ON public.abdm_received_records (tenant_id, consent_artefact_id, care_context_reference, checksum)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_abdm_received_records_patient
    ON public.abdm_received_records (tenant_id, patient_id, received_at DESC);
CREATE INDEX idx_abdm_received_records_erase
    ON public.abdm_received_records (tenant_id, erase_at) WHERE purged_at IS NULL;

ALTER TABLE public.abdm_received_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_received_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_received_records ON public.abdm_received_records
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_received_records BEFORE UPDATE ON public.abdm_received_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_received_records_soft_delete BEFORE DELETE ON public.abdm_received_records
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- The data push names no hospital in a header: it reaches the `dataPushUrl`
-- we sent, which carries the artefact's id. This finds that artefact's
-- hospital before any tenant context exists, as `app_abdm_hip_tenant` does
-- for X-HIP-ID.
CREATE OR REPLACE FUNCTION public.app_abdm_hiu_artefact_tenant(p_artefact uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT a.tenant_id FROM public.abdm_consent_artefacts a
     WHERE a.id = p_artefact AND a.role = 'hiu' AND a.deleted_at IS NULL
$$;

COMMENT ON FUNCTION public.app_abdm_hiu_artefact_tenant(uuid) IS
    'ABDM data push: the tenant an HIU consent artefact (named in dataPushUrl) belongs to.';
