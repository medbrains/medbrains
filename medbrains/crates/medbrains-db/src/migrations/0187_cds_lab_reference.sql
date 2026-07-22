-- Migration: 0187_cds_lab_reference.sql
-- RLS-Posture: catalog
-- Global CDS lab reference: no tenant_id column, shared across tenants.
-- Global CDS lab reference (no tenant_id). Analyte reference ranges + critical
-- thresholds, seeded from the github-tracked lab_reference.csv. Used to
-- auto-detect critical lab values at result entry when the tenant has no
-- explicit critical_value_rule.
CREATE TABLE IF NOT EXISTS public.cds_lab_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    test text,
    analyte text NOT NULL UNIQUE,
    unit text,
    normal_low numeric(14, 4),
    normal_high numeric(14, 4),
    critical_low numeric(14, 4),
    critical_high numeric(14, 4),
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
