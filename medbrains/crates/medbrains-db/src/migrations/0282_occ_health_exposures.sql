-- Migration: 0282_occ_health_exposures.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Occupational blood & body-fluid / sharps exposure reporting (NABH HR, BMW Rules 2016, national
-- needlestick-injury guidelines). A needlestick or mucocutaneous exposure to a source patient's blood
-- is a time-critical staff-safety event: HIV post-exposure prophylaxis (PEP) is most effective within
-- 2 hours and must start within 72, so the source serostatus and the PEP decision have to be captured
-- immediately. The generic injury report can't hold this, and the needlestick-rate KPI had no backing
-- capture — this table records each exposure, its source risk, and the PEP decision.

CREATE TABLE IF NOT EXISTS occ_health_exposures (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id       uuid NOT NULL,                 -- exposed staff member
    exposure_at       timestamptz NOT NULL,
    exposure_type     text NOT NULL,                 -- needlestick | sharps_cut | mucocutaneous | other
    device            text,                          -- hollow-bore needle, suture needle, scalpel, ...
    body_site         text,
    source_patient_id uuid,                           -- null when the source is unknown
    source_known      boolean NOT NULL DEFAULT false,
    source_hiv        text NOT NULL DEFAULT 'unknown',  -- positive | negative | unknown
    source_hbv        text NOT NULL DEFAULT 'unknown',
    source_hcv        text NOT NULL DEFAULT 'unknown',
    first_aid_done    boolean NOT NULL DEFAULT false,
    pep_recommended   boolean NOT NULL DEFAULT false,   -- computed server-side from source risk + route
    pep_started       boolean NOT NULL DEFAULT false,
    pep_details       text,
    notes             text,
    reported_by       uuid,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT occ_exposure_type_check
        CHECK (exposure_type IN ('needlestick', 'sharps_cut', 'mucocutaneous', 'other')),
    CONSTRAINT occ_exposure_hiv_check CHECK (source_hiv IN ('positive', 'negative', 'unknown')),
    CONSTRAINT occ_exposure_hbv_check CHECK (source_hbv IN ('positive', 'negative', 'unknown')),
    CONSTRAINT occ_exposure_hcv_check CHECK (source_hcv IN ('positive', 'negative', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_occ_health_exposures_tenant
    ON occ_health_exposures (tenant_id, exposure_at DESC);

ALTER TABLE occ_health_exposures ENABLE ROW LEVEL SECURITY;
CREATE POLICY occ_health_exposures_tenant_isolation ON occ_health_exposures
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
