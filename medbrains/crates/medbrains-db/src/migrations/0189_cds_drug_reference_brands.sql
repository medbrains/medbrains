-- Migration: 0189_cds_drug_reference_brands.sql
-- RLS-Posture: catalog
-- Alters the global cds_drug_reference; no tenant_id involved.
-- Brand names + NLEM / government-essential flag on the CDS drug reference.
ALTER TABLE public.cds_drug_reference
    ADD COLUMN IF NOT EXISTS brands text,
    ADD COLUMN IF NOT EXISTS is_nlem boolean NOT NULL DEFAULT false;
