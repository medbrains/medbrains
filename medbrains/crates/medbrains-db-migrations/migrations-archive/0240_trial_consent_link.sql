-- Migration: 0240_trial_consent_link.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters consent_records, already tenant-policied.
-- Trial informed consent (ticket #2985): link a consent_record to the clinical trial the patient
-- is consenting to join. Reuses the existing versioned e-consent module wholesale —
-- consent_templates carry the version, consent_records carry the signatures / revocation — this
-- migration only adds the trial association.

ALTER TABLE consent_records
    ADD COLUMN IF NOT EXISTS trial_id uuid REFERENCES clinical_trials(id);

CREATE INDEX IF NOT EXISTS idx_consent_records_trial
    ON consent_records (tenant_id, trial_id) WHERE trial_id IS NOT NULL;
