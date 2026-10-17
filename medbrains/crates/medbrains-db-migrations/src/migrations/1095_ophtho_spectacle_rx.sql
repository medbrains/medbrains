-- Eye OPD workup and spectacle prescription (#231).
-- `visual_acuity_*` stays the unaided distance acuity; best-corrected and near
-- acuity, the near addition, pupillary distance and the lens advised are what
-- a spectacle prescription needs and the exam never recorded. A signed exam
-- carries who signed it; its refraction is then fixed.
ALTER TABLE ophtho_exams
    ADD COLUMN IF NOT EXISTS bcva_od text,
    ADD COLUMN IF NOT EXISTS bcva_os text,
    ADD COLUMN IF NOT EXISTS near_va_od text,
    ADD COLUMN IF NOT EXISTS near_va_os text,
    ADD COLUMN IF NOT EXISTS add_od numeric(4,2),
    ADD COLUMN IF NOT EXISTS add_os numeric(4,2),
    ADD COLUMN IF NOT EXISTS pd_mm numeric(4,1),
    ADD COLUMN IF NOT EXISTS lens_type text,
    ADD COLUMN IF NOT EXISTS lens_advice text,
    ADD COLUMN IF NOT EXISTS review_after_months smallint,
    ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS signed_at timestamptz;

DO $$ BEGIN
    ALTER TABLE ophtho_exams ADD CONSTRAINT ophtho_exams_lens_type_check
        CHECK (lens_type IS NULL OR lens_type IN ('single_vision', 'bifocal', 'progressive', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ophtho_exams_encounter ON ophtho_exams (encounter_id);
