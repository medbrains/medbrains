-- ====================================================================
-- Migration: 1074_anc_visit_oedema.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Oedema at each antenatal visit. With blood pressure of 140/90 or more and
-- proteinuria it is part of the pre-eclampsia picture the ANC visit screens
-- for (MoHFW / FOGSI ANC guidelines); until now the visit had nowhere to say it.

ALTER TABLE public.anc_visits
    ADD COLUMN IF NOT EXISTS oedema text
        CHECK (oedema IN ('none', 'pedal', 'generalised'));
