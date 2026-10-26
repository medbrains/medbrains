-- ====================================================================
-- Migration: 1255_growth_measurements.sql
-- RLS-Posture: tenant-scoped (existing tables; policies unchanged)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- What a child's growth chart needs that was not recorded.
--
-- Head circumference is one of the five WHO growth indicators under five
-- and had nowhere to go at a visit; birth records held it, vitals did not.
--
-- Gestation at birth corrects a preterm child's age on the charts until
-- two years. It was recorded only on ICU neonatal and antenatal records,
-- neither of which follows the child, so it lives on the patient.

ALTER TABLE public.vitals
    ADD COLUMN IF NOT EXISTS head_circumference_cm numeric(4,1)
        CHECK (head_circumference_cm > 0 AND head_circumference_cm < 80);

ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS birth_gestation_weeks numeric(3,1)
        CHECK (birth_gestation_weeks BETWEEN 22 AND 44);
