-- ====================================================================
-- Migration: 1030_coded_body_site.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Where on the body, as a code as well as words. The body-site picker
-- (BodyParts3D via human-atlas) yields a Foundational Model of Anatomy
-- concept id ("FMA24474") and a side; the existing text column keeps the
-- words a chart prints, and stays the only value when a site is typed.
-- SNOMED CT body-structure mapping comes later (it needs the UMLS crosswalk).
ALTER TABLE wound_assessments
    ADD COLUMN body_site_code text,
    ADD COLUMN body_site_laterality text
        CHECK (body_site_laterality IN ('left', 'right', 'bilateral', 'midline'));

ALTER TABLE pain_score_entries
    ADD COLUMN location_code text,
    ADD COLUMN location_laterality text
        CHECK (location_laterality IN ('left', 'right', 'bilateral', 'midline'));
