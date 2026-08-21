-- ====================================================================
-- Migration: 0210_er_visit_encounter.sql
-- RLS-Posture: tenant-scoped
-- Adds a column to er_visits, which already carries the tenant-scoped policy.
-- Tenant-Column: tenant_id (on er_visits)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ER visits were not encounter-backed: create_visit billed the
-- consultation with encounter_id = NULL (a patient-only invoice) and
-- consumables billed against the er_visit id, so an ER visit's charges
-- fragmented across several invoices. Give each ER visit a real
-- `encounter` (encounter_type='emergency') and record it here, so the
-- consultation, consumables and orders all land on one bill — the same
-- way OPD/IPD encounters work. Nullable: pre-existing visits keep NULL.

ALTER TABLE public.er_visits
    ADD COLUMN IF NOT EXISTS encounter_id uuid;

CREATE INDEX IF NOT EXISTS idx_er_visits_encounter
    ON public.er_visits (tenant_id, encounter_id);
