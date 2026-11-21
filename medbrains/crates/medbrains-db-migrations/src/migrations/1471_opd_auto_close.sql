-- ====================================================================
-- Migration: 1471_opd_auto_close.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Doctors at small clinics see the patient and never press "complete", so
-- the visit stays open and the board stays full all day. A hospital can now
-- have OPD close a started visit on its own N minutes after the doctor called
-- the patient in (tenant_settings opd.auto_close_after_minutes, off unless
-- set). close_reason says the visit was closed that way, so every screen that
-- shows it closed can say "Closed automatically"; NULL is a person closing it.

ALTER TABLE public.encounters
    ADD COLUMN IF NOT EXISTS close_reason text
        CHECK (close_reason IN ('auto_inactivity'));
