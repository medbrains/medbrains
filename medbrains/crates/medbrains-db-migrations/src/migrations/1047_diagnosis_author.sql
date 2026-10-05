-- ====================================================================
-- Migration: 1047_diagnosis_author.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A diagnosis said when it was made but not by whom, and an edit left no
-- trace of who changed it (RFCs/RFC-MODULE-clinical-notes.md, phase 1c).
-- Existing rows keep an empty author rather than a guessed one: the audit
-- log's trigger never saw the application user, so there is nobody to
-- attribute them to.
ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS updated_at  timestamptz;
