-- ====================================================================
-- Migration: 1104_abdm_hfr_hpr.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ABDM Milestone 4 — the National Healthcare Provider Registry. Columns only,
-- on facilities, doctor_profiles and abdm_hfr_registrations, which already
-- carry tenant RLS and the soft-delete guardrail.
--
-- HFR (Health Facility Registry): NHA issues one facility ID per physical
-- facility, not per hospital group. A tenant with two campuses holds two HFR
-- IDs, and every FHIR bundle names the facility it came from, so the ID lives
-- on `facilities`. DHIS incentives need >= 10 beds with an IPD, which is why
-- the bed count and IPD flag the registry knows are kept beside it.
--
--   not_registered  nothing recorded
--   submitted       registration sent to HFR, awaiting NHA approval
--   registered      an HFR ID is recorded but not yet confirmed by HFR
--   verified        HFR search confirmed the ID (hfr_checked_at says when)
--
-- HPR (Healthcare Professionals Registry): each doctor's 14-digit HPR ID,
-- stored hyphenated (NN-NNNN-NNNN-NNNN) as NRCeS profiles print it, on the
-- clinician profile, with the moment HPR confirmed it.

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS hfr_facility_id text,
    ADD COLUMN IF NOT EXISTS hfr_status text NOT NULL DEFAULT 'not_registered',
    ADD COLUMN IF NOT EXISTS hfr_bed_count integer,
    ADD COLUMN IF NOT EXISTS hfr_ipd boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS hfr_checked_at timestamptz;

DO $$ BEGIN
    ALTER TABLE public.facilities ADD CONSTRAINT facilities_hfr_status_check
        CHECK (hfr_status IN ('not_registered', 'submitted', 'registered', 'verified'));
    ALTER TABLE public.facilities ADD CONSTRAINT facilities_hfr_bed_count_check
        CHECK (hfr_bed_count IS NULL OR hfr_bed_count >= 0);
    ALTER TABLE public.facilities ADD CONSTRAINT facilities_hfr_id_format
        CHECK (hfr_facility_id IS NULL OR hfr_facility_id ~ '^IN[0-9A-Z]{10}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_facilities_hfr_facility_id
    ON public.facilities (tenant_id, hfr_facility_id)
    WHERE hfr_facility_id IS NOT NULL AND deleted_at IS NULL;

-- The tenant-level ID predates per-campus registration: it belongs to the
-- main campus (the oldest live top-level main hospital).
UPDATE public.facilities f
   SET hfr_facility_id = upper(btrim(t.abdm_facility_id)),
       hfr_status = CASE WHEN t.abdm_facility_active THEN 'verified' ELSE 'registered' END
  FROM public.tenants t
 WHERE f.tenant_id = t.id
   AND f.hfr_facility_id IS NULL
   AND upper(btrim(t.abdm_facility_id)) ~ '^IN[0-9A-Z]{10}$'
   AND f.id = (
       SELECT m.id FROM public.facilities m
        WHERE m.tenant_id = t.id AND m.deleted_at IS NULL
          AND m.parent_id IS NULL AND m.facility_type = 'main_hospital'
        ORDER BY m.created_at, m.id
        LIMIT 1);

ALTER TABLE public.abdm_hfr_registrations
    ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id);

CREATE INDEX IF NOT EXISTS idx_abdm_hfr_registrations_facility
    ON public.abdm_hfr_registrations (tenant_id, facility_id, submitted_at DESC);

ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS hpr_id text,
    ADD COLUMN IF NOT EXISTS hpr_verified_at timestamptz;

DO $$ BEGIN
    ALTER TABLE public.doctor_profiles ADD CONSTRAINT doctor_profiles_hpr_id_format
        CHECK (hpr_id IS NULL OR hpr_id ~ '^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$');
    ALTER TABLE public.doctor_profiles ADD CONSTRAINT doctor_profiles_hpr_verified_needs_id
        CHECK (hpr_verified_at IS NULL OR hpr_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_profiles_hpr_id
    ON public.doctor_profiles (tenant_id, hpr_id)
    WHERE hpr_id IS NOT NULL AND deleted_at IS NULL;
