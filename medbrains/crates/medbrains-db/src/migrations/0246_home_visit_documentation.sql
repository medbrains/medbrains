-- Migration: 0246_home_visit_documentation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters home_visits, created with the tenant policy in 0245.
-- Home visit documentation (ticket #2968): what the nurse records during the visit — vitals, a
-- wound-photo URL (image uploaded to object storage elsewhere; we store the reference), and the
-- patient's medication compliance. 1:1 with a visit, so these are columns on home_visits.

ALTER TABLE home_visits
    ADD COLUMN IF NOT EXISTS vitals                jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS wound_photo_url       text,
    ADD COLUMN IF NOT EXISTS medication_compliance text,
    ADD COLUMN IF NOT EXISTS documented_at         timestamptz,
    ADD COLUMN IF NOT EXISTS documented_by         uuid;
