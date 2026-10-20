-- ====================================================================
-- Migration: 1146_charge_source_registration.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Collect anywhere (#4885): the registration fee becomes a charge of its
-- own, so the front desk can collect it and revenue reports can name it.
-- Added, never used in this migration (an enum value cannot be used in the
-- transaction that adds it); 1147 uses it.

ALTER TYPE public.charge_source ADD VALUE IF NOT EXISTS 'registration';
