-- Age/sex-specific normal ranges on the CDS lab reference, so result entry can
-- flag against the patient's own band (a child's normal Hb differs from an
-- adult's). normal_low/high stay as the Adult-M default.
ALTER TABLE public.cds_lab_reference
    ADD COLUMN IF NOT EXISTS neonate_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS neonate_high numeric(14, 4),
    ADD COLUMN IF NOT EXISTS infant_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS infant_high numeric(14, 4),
    ADD COLUMN IF NOT EXISTS child_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS child_high numeric(14, 4),
    ADD COLUMN IF NOT EXISTS adult_m_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS adult_m_high numeric(14, 4),
    ADD COLUMN IF NOT EXISTS adult_f_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS adult_f_high numeric(14, 4);
