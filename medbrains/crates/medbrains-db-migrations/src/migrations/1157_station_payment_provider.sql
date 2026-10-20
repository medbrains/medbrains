-- ====================================================================
-- Migration: 1157_station_payment_provider.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- MedBrains is the payments layer over any provider (#4884). A hospital
-- names its online provider in `tenant_settings` (payments/active_provider);
-- a counter may take payments through a different one — a pharmacy counter
-- on the pharmacy's own merchant account, say. NULL follows the hospital.
-- The code is checked by the server against its provider registry.

ALTER TABLE public.stations
    ADD COLUMN IF NOT EXISTS payment_provider text
        CHECK (payment_provider IS NULL OR payment_provider ~ '^[a-z][a-z0-9_]{1,31}$');

COMMENT ON COLUMN public.stations.payment_provider IS
    'Online payment provider this counter uses instead of the hospital''s; NULL follows the hospital.';
