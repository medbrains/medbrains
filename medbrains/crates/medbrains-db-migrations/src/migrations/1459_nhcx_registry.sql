-- ====================================================================
-- Migration: 1459_nhcx_registry.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_patient_policies
-- Drops: none
-- ====================================================================
-- The NHCX participant registry (#5706, docs.abdm.gov.in "Finding
-- participants and policies", "Fetching a recipient certificate").
--
-- nhcx_participants gains where a row came from. `registry` rows are filled
-- by `/fetch/participants/list` (Settings -> NHCX -> Payer directory ->
-- Refresh from NHCX); `manual` rows are typed in by an administrator and are
-- the fallback. `entity_type` is the list the row was asked for (`Gov` or
-- `Pvt`): the registry rows do not say it themselves. `cert_fetched_at` is
-- when `encryption_cert` last came from `/fetch/certs`; the outbox fetches
-- again after a day, and at once when the payer could not decrypt.
--
-- nhcx_patient_policies holds the last `/participant/get/policies` answer per
-- patient (Registration and Claims -> Find NHCX policies). `processing_id`
-- is who a message about that policy is addressed to; `payer_id` is the
-- insurer the bundle names. Derived data, replaced whole on each lookup, so
-- no soft delete.

ALTER TABLE public.nhcx_participants
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'registry')),
    ADD COLUMN IF NOT EXISTS entity_type text CHECK (entity_type IN ('Gov', 'Pvt')),
    ADD COLUMN IF NOT EXISTS cert_fetched_at timestamptz;

CREATE TABLE public.nhcx_patient_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    -- `AbhaNumber` or `MemberId`: which identifier found it.
    identifier_type text NOT NULL CHECK (identifier_type IN ('AbhaNumber', 'MemberId')),
    payer_id text,
    processing_id text NOT NULL CHECK (btrim(processing_id) <> ''),
    member_id text,
    product_id text,
    product_name text,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    fetched_by uuid REFERENCES public.users(id)
);

CREATE INDEX idx_nhcx_patient_policies_patient
    ON public.nhcx_patient_policies (tenant_id, patient_id);

ALTER TABLE public.nhcx_patient_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_patient_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_patient_policies ON public.nhcx_patient_policies
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
