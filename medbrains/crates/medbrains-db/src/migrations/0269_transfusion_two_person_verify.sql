-- Migration: 0269_transfusion_two_person_verify.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters transfusion_records, already tenant-policied.
-- NABH/AABB bedside transfusion safety: two qualified staff must INDEPENDENTLY verify the patient
-- identity and the blood unit at the bedside before a transfusion. The record only carried a single
-- verifier; add the two independent verifiers so the check can be enforced.

ALTER TABLE transfusion_records
    ADD COLUMN IF NOT EXISTS patient_verified_by uuid,
    ADD COLUMN IF NOT EXISTS product_verified_by uuid;
