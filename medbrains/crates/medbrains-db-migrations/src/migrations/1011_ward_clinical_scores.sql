-- Ward assessment scores belong in the table that already records them.
--
-- `icu_scores` is a general clinical-assessment record that happens to be
-- named for where it started: admission_id, score_type, score_value,
-- score_details for the inputs, scored_by and scored_at. It has a working
-- handler and a working screen, and its enum already carries sofa, gcs and
-- cam_icu.
--
-- Care View re-implements those same three as calculators that compute a
-- number and discard it, alongside seventeen more with no recorded form
-- anywhere. That is the gap this closes: not a new table, a wider vocabulary
-- for the one that works.
--
-- It matters because these scores ARE the record. An Aldrete is the evidence
-- a patient was fit to leave recovery. NEWS2 exists to show deterioration
-- over time and cannot trend if nothing is stored. NABH expects the
-- assessment documented, not recomputed from memory.
--
-- ADD VALUE IF NOT EXISTS is idempotent, so re-running is safe. Postgres
-- cannot add enum values inside a transaction that then uses them, but a
-- migration that only adds them is fine.

ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'aldrete';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'news2';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'meows';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'pews';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'qsofa';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'cpot';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'curb65';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'child_pugh';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'meld';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'ciwa_ar';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'wells_pe';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'wells_dvt';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'cha2ds2_vasc';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'has_bled';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'glasgow_blatchford';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'must_nutrition';
ALTER TYPE public.icu_score_type ADD VALUE IF NOT EXISTS 'hypoglycaemia';
