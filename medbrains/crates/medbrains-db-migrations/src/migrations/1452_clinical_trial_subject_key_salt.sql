-- ====================================================================
-- Migration: 1452_clinical_trial_subject_key_salt.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A secret per trial for the subject keys of its sponsor export.
--
-- The sponsor export (medbrains-research `trial_export`) names a participant
-- only as a subject key: HMAC-SHA256 of the patient (`deid::patient_key`)
-- under a key derived from a server-held secret, the tenant, the trial and this
-- salt (`trial_subject::trial_key`). The salt alone does not give the key. Unlike a research
-- export's salt, this one is kept for the life of the trial, because a sponsor
-- must match the same subject across every transfer of the same trial. It is
-- per trial, so two trials' exports cannot be joined on the key.
--
-- The salt never leaves the server: no SELECT that serves a screen reads it.
-- Existing trials get their own salt now; the default is volatile, so each
-- row gets a different one.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.clinical_trials
    ADD COLUMN IF NOT EXISTS subject_key_salt bytea NOT NULL
        DEFAULT (uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()));
