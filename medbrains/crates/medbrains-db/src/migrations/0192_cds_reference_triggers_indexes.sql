-- DB lifecycle ownership for the global CDS reference tables. These were
-- created with an `updated_at` column but no BEFORE UPDATE trigger, so the
-- seed loaders had to set `updated_at = now()` by hand on every upsert. Attach
-- the canonical `update_updated_at()` trigger (CREATE OR REPLACE — PG16) so the
-- DB owns the lifecycle; the seed clauses drop the manual bump.
CREATE OR REPLACE TRIGGER trg_cds_diagnosis_reference_updated_at
    BEFORE UPDATE ON public.cds_diagnosis_reference
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER trg_cds_drug_reference_updated_at
    BEFORE UPDATE ON public.cds_drug_reference
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER trg_cds_lab_reference_updated_at
    BEFORE UPDATE ON public.cds_lab_reference
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER trg_cds_drug_ingredient_updated_at
    BEFORE UPDATE ON public.cds_drug_ingredient
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER trg_cds_ingredient_incompatibility_updated_at
    BEFORE UPDATE ON public.cds_ingredient_incompatibility
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Functional indexes for the case-insensitive lookups that run on every result
-- entry / prescribing check. The existing UNIQUE on raw `analyte`/`generic_name`
-- can't serve a `lower(...)` predicate, so these were sequential scans.
CREATE INDEX IF NOT EXISTS idx_cds_lab_reference_lower_analyte
    ON public.cds_lab_reference (lower(analyte));
CREATE INDEX IF NOT EXISTS idx_cds_lab_reference_lower_test
    ON public.cds_lab_reference (lower(test));
CREATE INDEX IF NOT EXISTS idx_cds_drug_reference_lower_generic
    ON public.cds_drug_reference (lower(generic_name));
-- Partial index for the NLEM-generics list (small, hot, read on every substitution).
CREATE INDEX IF NOT EXISTS idx_cds_drug_reference_nlem
    ON public.cds_drug_reference (generic_name) WHERE is_nlem;
