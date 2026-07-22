-- Migration: 0227_doctor_registration_revoked.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters doctor_profiles, already tenant-policied.
-- Credential gate: a REVOKED medical registration (regulator struck off / suspended) is
-- stricter than an expired one — it must HARD-block regulated acts (prescribe, operate)
-- with no override. Expired stays a soft gate (override + audit). Adds the revoked flag.

ALTER TABLE doctor_profiles
    ADD COLUMN IF NOT EXISTS registration_revoked boolean NOT NULL DEFAULT false;
