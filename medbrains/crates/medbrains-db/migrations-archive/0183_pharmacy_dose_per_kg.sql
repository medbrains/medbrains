-- Migration: 0183_pharmacy_dose_per_kg.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Adds columns to pharmacy_catalog, already tenant-policied.
-- Weight-based (mg/kg/day) dosing reference for paediatric dose checking.
-- Free-text like max_dose_per_day, e.g. "15 mg" meaning 15 mg/kg/day.
ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS dose_per_kg text;
