-- ====================================================================
-- Migration: 1065_ipd_nursing_safety.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Bedside safety gaps on the IPD ward (COMPLIANCE-GAP-2026-10 #6, #7):
--
-- 1. Chemotherapy may only be given by a nurse holding a chemotherapy-
--    administration certification (IPSG-3, hazardous-drug handling). HR
--    records it as an employee credential; the drug side is the WHO ATC
--    class L01 "Antineoplastic agents", which the catalogue already carries.
--    `is_cytotoxic` is derived from it, so the catalogue screen's ATC field
--    is the one place the flag is made.
-- 2. A restraint episode needs an observation every 30 minutes (MHCA 2017
--    s.97, NABH). `overdue_alerted_at` lets the escalation pass alert once per
--    missed window instead of every pass.
-- 3. High Morse / Braden scores flag the admission.
-- 4. Every admission gets an IP number from the per-tenant `sequences` row,
--    allocated by trigger so every path that inserts an admission (IPD, OPD
--    admit, emergency, simulator, seed) gets one.

ALTER TYPE public.credential_type ADD VALUE IF NOT EXISTS 'chemotherapy_administration';

ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS is_cytotoxic boolean
    GENERATED ALWAYS AS (COALESCE(atc_code, '') LIKE 'L01%') STORED;

COMMENT ON COLUMN public.pharmacy_catalog.is_cytotoxic IS
    'Antineoplastic (ATC L01). Administration requires a chemotherapy-certified nurse.';

ALTER TABLE public.ipd_clinical_documentations
    ADD COLUMN IF NOT EXISTS overdue_alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ipd_clinical_docs_open_restraint
    ON public.ipd_clinical_documentations (tenant_id, recorded_at)
    WHERE doc_type = 'restraint' AND is_resolved = false AND deleted_at IS NULL;

ALTER TABLE public.admissions
    ADD COLUMN IF NOT EXISTS admission_number text,
    ADD COLUMN IF NOT EXISTS is_fall_risk boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_pressure_injury_risk boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.admissions.is_fall_risk IS
    'Latest Morse fall scale was 45 or more.';
COMMENT ON COLUMN public.admissions.is_pressure_injury_risk IS
    'Latest Braden scale was 12 or less.';

-- One sequence row per tenant. A tenant created later gets its row from the
-- trigger's upsert on its first admission.
INSERT INTO public.sequences (tenant_id, seq_type, prefix, current_val, pad_width)
SELECT t.id, 'IP_NUMBER', 'IP-', 0, 6
  FROM public.tenants t
ON CONFLICT (tenant_id, seq_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_admission_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    seq record;
    num text;
BEGIN
    IF NEW.admission_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.sequences (tenant_id, seq_type, prefix, current_val, pad_width)
    VALUES (NEW.tenant_id, 'IP_NUMBER', 'IP-', 1, 6)
    ON CONFLICT (tenant_id, seq_type)
        DO UPDATE SET current_val = public.sequences.current_val + 1, updated_at = now(),
                      deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
    RETURNING prefix, current_val, pad_width INTO seq;
    num := seq.current_val::text;
    NEW.admission_number := seq.prefix || lpad(num, GREATEST(seq.pad_width, length(num)), '0');
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_admissions_assign_number ON public.admissions;
CREATE TRIGGER trg_admissions_assign_number
    BEFORE INSERT ON public.admissions
    FOR EACH ROW EXECUTE FUNCTION public.assign_admission_number();

-- Backfill in admission order, advancing each tenant's sequence past them.
WITH counts AS (
    SELECT tenant_id, count(*) AS cnt
      FROM public.admissions
     WHERE admission_number IS NULL
     GROUP BY tenant_id
), bumped AS (
    UPDATE public.sequences s
       SET current_val = s.current_val + c.cnt, updated_at = now()
      FROM counts c
     WHERE s.tenant_id = c.tenant_id AND s.seq_type = 'IP_NUMBER'
    RETURNING s.tenant_id, s.prefix, s.pad_width, s.current_val - c.cnt AS base
), numbered AS (
    SELECT a.id, b.prefix, b.pad_width,
           (b.base + row_number() OVER (PARTITION BY a.tenant_id
                                        ORDER BY a.admitted_at, a.id))::text AS n
      FROM public.admissions a
      JOIN bumped b ON b.tenant_id = a.tenant_id
     WHERE a.admission_number IS NULL
)
UPDATE public.admissions a
   SET admission_number = numbered.prefix
                          || lpad(numbered.n, GREATEST(numbered.pad_width, length(numbered.n)), '0')
  FROM numbered
 WHERE a.id = numbered.id;

ALTER TABLE public.admissions ALTER COLUMN admission_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admissions_tenant_admission_number
    ON public.admissions (tenant_id, admission_number);
