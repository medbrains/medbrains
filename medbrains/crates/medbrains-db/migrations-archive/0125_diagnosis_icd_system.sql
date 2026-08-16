-- RLS-Posture: tenant-scoped
-- Track which ICD revision a diagnosis code belongs to.
-- Existing rows are preserved as ICD-10; new OPD coding can explicitly use ICD-11.

ALTER TABLE public.diagnoses
    ADD COLUMN IF NOT EXISTS icd_system varchar(16) NOT NULL DEFAULT 'icd10';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'diagnoses_icd_system_check'
          AND conrelid = 'public.diagnoses'::regclass
    ) THEN
        ALTER TABLE public.diagnoses
            ADD CONSTRAINT diagnoses_icd_system_check
            CHECK (icd_system IN ('icd10', 'icd11', 'snomed'));
    END IF;
END
$$;
