-- Global ingredient model for combination-chemistry checks (no tenant_id).
-- generic → active ingredient(s), and known dangerous ingredient pairs.
CREATE TABLE IF NOT EXISTS public.cds_drug_ingredient (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    generic_name text NOT NULL,
    ingredient text NOT NULL,
    CONSTRAINT uq_cds_drug_ingredient UNIQUE (generic_name, ingredient)
);

CREATE INDEX IF NOT EXISTS idx_cds_drug_ingredient_generic
    ON public.cds_drug_ingredient (generic_name);

CREATE TABLE IF NOT EXISTS public.cds_ingredient_incompatibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    ingredient_a text NOT NULL,
    ingredient_b text NOT NULL,
    severity text,
    mechanism text,
    CONSTRAINT uq_cds_ingredient_incompat UNIQUE (ingredient_a, ingredient_b)
);
