-- ====================================================================
-- Migration: 0121_signed_record_payload_snapshots.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ALTERs: signed_records, ipd_discharge_summaries
-- ====================================================================
-- Digital signing hardening:
-- 1. Store the exact canonical payload snapshot used for the signature.
--    This lets auditors verify what was signed even if the source record is
--    later amended.
-- 2. Bring IPD discharge summaries into the common signable-record contract
--    (`is_signed`, `signed_record_id`) used by prescriptions/lab/radiology.

ALTER TABLE public.signed_records
    ADD COLUMN IF NOT EXISTS payload_snapshot jsonb;

ALTER TABLE public.ipd_discharge_summaries
    ADD COLUMN IF NOT EXISTS is_signed boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;

CREATE INDEX IF NOT EXISTS idx_ipd_discharge_summaries_unsigned
    ON public.ipd_discharge_summaries (tenant_id, prepared_by)
    WHERE is_signed = false;
