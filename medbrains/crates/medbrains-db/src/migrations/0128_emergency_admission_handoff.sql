-- ====================================================================
-- Migration: 0128_emergency_admission_handoff.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================

-- Preserve the ER visit reference on IPD admissions created from Emergency.
-- This lets admission, MRD, billing, and command-center reports trace the
-- handoff without relying only on free-text notes.

ALTER TABLE admissions
    ADD COLUMN IF NOT EXISTS er_visit_id uuid REFERENCES er_visits(id);

CREATE INDEX IF NOT EXISTS idx_admissions_er_visit
    ON admissions (tenant_id, er_visit_id)
    WHERE er_visit_id IS NOT NULL;
