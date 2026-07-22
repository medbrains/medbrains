-- ====================================================================
-- Migration: 0208_ipd_no_dues_certificate.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ipd_no_dues_certificates
-- Drops: none
-- ====================================================================
-- A No-Dues (financial clearance) certificate is the gate a real
-- hospital uses before a patient physically leaves the ward: billing
-- has reconciled every charge for the admission and the balance is
-- settled (or formally credited). It is issued once per admission,
-- records who cleared it and the billed/paid snapshot, and is printed
-- and handed to the patient/attender. Issuing is blocked while a
-- balance remains (mirrors billing.block_discharge_unsettled).

CREATE TABLE IF NOT EXISTS public.ipd_no_dues_certificates (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL,
    admission_id  uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
    total_billed  numeric(12,2) NOT NULL DEFAULT 0,
    total_paid    numeric(12,2) NOT NULL DEFAULT 0,
    balance       numeric(12,2) NOT NULL DEFAULT 0,
    issued_by     uuid NOT NULL,
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (admission_id)
);

ALTER TABLE public.ipd_no_dues_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_no_dues_certificates_tenant ON public.ipd_no_dues_certificates;
CREATE POLICY ipd_no_dues_certificates_tenant ON public.ipd_no_dues_certificates
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_no_dues_certificates_admission
    ON public.ipd_no_dues_certificates (admission_id);
