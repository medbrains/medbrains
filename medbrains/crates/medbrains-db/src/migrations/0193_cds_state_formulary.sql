-- Per-state government free/subsidised medicine schemes (TNMSC, Rajasthan MNDY,
-- Delhi/Kerala/Maharashtra etc.) mapped to essential generics. Global reference
-- (no tenant_id, like the other cds_* tables), seeded from a github-tracked CSV.
-- Lets a facility surface "free under <state> scheme" against a prescribed drug.
CREATE TABLE IF NOT EXISTS public.cds_state_formulary (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    state_code text NOT NULL,
    state_name text NOT NULL,
    scheme_name text NOT NULL,
    generic_name text NOT NULL,
    coverage text NOT NULL DEFAULT 'free',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (state_code, generic_name)
);

-- Lookups are by state, and by generic for the point-of-care "is this free?" check.
CREATE INDEX IF NOT EXISTS idx_cds_state_formulary_state
    ON public.cds_state_formulary (state_code);
CREATE INDEX IF NOT EXISTS idx_cds_state_formulary_lower_generic
    ON public.cds_state_formulary (lower(generic_name));

CREATE OR REPLACE TRIGGER trg_cds_state_formulary_updated_at
    BEFORE UPDATE ON public.cds_state_formulary
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
