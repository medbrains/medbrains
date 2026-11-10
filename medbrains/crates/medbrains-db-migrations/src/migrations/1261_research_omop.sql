-- ====================================================================
-- Migration: 1261_research_omop.sql
-- RLS-Posture: catalog
-- Tenant-Column: N/A
-- New-Tables: omop_concept_map
-- Drops: none
-- ====================================================================
-- Research exports in OMOP CDM v5.4 (medbrains-research `omop`).
--
-- A study may ask for its extract as an OMOP CDM v5.4 bundle (person,
-- observation_period, visit_occurrence, condition_occurrence, measurement,
-- drug_exposure, location, cdm_source) instead of flat CSV. Same request,
-- same second approver, same de-identification.
--
-- `omop_concept_map` holds OMOP concept ids for source codes, loaded from an
-- OHDSI Athena download by `scripts/load_omop_concepts.py` — licence-free
-- vocabularies only (ICD10, LOINC, ATC, RxNorm, RxNorm Extension, UCUM); the
-- loader refuses any other. Identical for every hospital, so no row level
-- security, like the SNOMED store. When it is empty, or a code is missing,
-- the export keeps the source code with concept id 0, as OMOP prescribes.

CREATE TABLE IF NOT EXISTS public.omop_concept_map (
    vocabulary_id text NOT NULL
        CHECK (vocabulary_id IN ('ICD10', 'LOINC', 'ATC', 'RxNorm', 'RxNorm Extension', 'UCUM')),
    concept_code text NOT NULL,
    source_concept_id bigint NOT NULL,
    standard_concept_id bigint,
    vocabulary_version text,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (vocabulary_id, concept_code)
);

ALTER TABLE public.research_exports DROP CONSTRAINT IF EXISTS research_exports_dataset_check;
ALTER TABLE public.research_exports ADD CONSTRAINT research_exports_dataset_check
    CHECK (dataset IN ('visits', 'diagnoses', 'admissions', 'labs', 'medicines', 'vitals', 'omop'));
