-- Global CDS drug reference (no tenant_id, like cds_diagnosis_reference).
-- Seeded from the github-tracked drug_formulary.csv. The CDS dose/renal/hepatic
-- checks COALESCE the tenant pharmacy_catalog row with this reference, so the
-- depth-layer fires on real drugs without each tenant re-entering the knowledge.
CREATE TABLE IF NOT EXISTS public.cds_drug_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    generic_name text NOT NULL UNIQUE,
    inn_name text,
    atc_code text,
    max_dose_per_day text,
    max_single_dose text,
    dose_per_kg text,
    renal_adjust_egfr_threshold numeric(6, 2),
    renal_adjust_rule text,
    hepatic_caution text,
    pregnancy_category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
