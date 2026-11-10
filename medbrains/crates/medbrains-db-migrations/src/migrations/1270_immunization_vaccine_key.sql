-- ====================================================================
-- Migration: 1270_immunization_vaccine_key.sql
-- RLS-Posture: tenant-scoped (existing table; policies unchanged)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Which schedule product a dose was recorded as.
--
-- The immunisation schedule counts a dose towards every series its product
-- covers (a hexavalent dose is DTP, Hib, hepatitis B and IPV). A dose
-- recorded from the schedule carries the product's key; one typed or read
-- off a card is matched by name, and an unmatched one is shown, not guessed.

ALTER TABLE public.patient_immunizations
    ADD COLUMN IF NOT EXISTS vaccine_key text;
