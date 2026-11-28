-- ====================================================================
-- Migration: 1475_opd_number.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A hospital may keep its own OPD number beside the UHID: the number its
-- front desk has always written on the card. Off unless the hospital turns it
-- on (tenant_settings category opd_number: mode off|manual|auto, scope
-- visit|patient, prefix, start). Per patient it lives here; per visit it is
-- the encounter_number every print and the HL7 feed already read.
--
-- One running series per hospital: the unique key is the number after the
-- prefix, so "OP-12" and "12" are the same number and cannot both be in use,
-- and the same index answers "highest number used" without a scan. Soft-
-- deleted rows give their number back.

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS opd_number text;

CREATE UNIQUE INDEX IF NOT EXISTS patients_opd_number_unique
    ON public.patients (tenant_id, ((substring(opd_number FROM '([0-9]+)$'))::bigint))
    WHERE opd_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS encounters_opd_number_unique
    ON public.encounters (tenant_id, ((substring(encounter_number FROM '([0-9]+)$'))::bigint))
    WHERE encounter_number IS NOT NULL AND deleted_at IS NULL;

-- The day the number was issued in the paper register: today for a new
-- patient, earlier for an old record being entered (when the hospital allows
-- it). Its own column: created_at stays the real entry time.
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS opd_date date;
