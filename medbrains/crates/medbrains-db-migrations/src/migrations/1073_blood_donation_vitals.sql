-- ====================================================================
-- Migration: 1073_blood_donation_vitals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Donor vitals measured at the couch before each collection. The D&C Rules
-- (Schedule F Part XII-B) let a donor be bled only with blood pressure
-- 100–180 / 50–100 mmHg, a regular pulse of 60–100 and no fever; the
-- collection check refuses outside those. Stored per donation, as numbers,
-- like weight and haemoglobin. blood_donors.blood_pressure (text) is left
-- as it is: nothing writes it, and it is read only where nothing newer exists.

ALTER TABLE public.blood_donations
    ADD COLUMN IF NOT EXISTS systolic_bp   integer CHECK (systolic_bp BETWEEN 50 AND 300),
    ADD COLUMN IF NOT EXISTS diastolic_bp  integer CHECK (diastolic_bp BETWEEN 20 AND 200),
    ADD COLUMN IF NOT EXISTS pulse         integer CHECK (pulse BETWEEN 20 AND 300),
    ADD COLUMN IF NOT EXISTS temperature_c double precision CHECK (temperature_c BETWEEN 30 AND 45);
