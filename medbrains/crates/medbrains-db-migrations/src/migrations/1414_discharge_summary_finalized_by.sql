-- ====================================================================
-- Migration: 1414_discharge_summary_finalized_by.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Record who finalized a discharge summary.
--
-- A finalized summary is the prescription behind Schedule H/H1 discharge
-- medicines (medbrains-pharmacy discharge_rx), so the pharmacy must know the
-- person who signed it off was a doctor. Finalizing needs only the
-- `ipd.discharge_summary.finalize` permission, which a custom role (a clerk,
-- the MRD) may hold; the pharmacy rule checks this column against
-- doctor_profiles. Existing finalized rows are left NULL on purpose: who
-- finalized them was never recorded, so they do not back H/H1 medicines.

ALTER TABLE ipd_discharge_summaries
    ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES users(id);
