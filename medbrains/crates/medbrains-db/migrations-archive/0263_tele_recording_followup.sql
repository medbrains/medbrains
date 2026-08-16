-- Migration: 0263_tele_recording_followup.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters tele_consultations, already tenant-policied.
-- Telemedicine: recording consent + optional recording (ticket #2946) and follow-up linkage
-- (ticket #2947). Additive columns on tele_consultations — existing SELECT */RETURNING * handlers
-- ignore them, so no struct changes needed there.

ALTER TABLE tele_consultations
    ADD COLUMN IF NOT EXISTS recording_consent boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_recording       boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS recording_url       text,
    ADD COLUMN IF NOT EXISTS follow_up_of        uuid REFERENCES tele_consultations(id);
