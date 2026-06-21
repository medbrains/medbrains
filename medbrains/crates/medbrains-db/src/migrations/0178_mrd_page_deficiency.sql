-- MRD record deficiency & completion. A case-sheet page can be flagged
-- deficient (missing signature, incomplete form, illegible) with a reason and
-- audit, and a packet may not be filed as a complete legal record while any
-- page is deficient. Turns the read-only completeness analysis into an
-- actionable mark-deficient → resolve → file workflow.

ALTER TABLE public.mrd_case_sheet_pages
    ADD COLUMN IF NOT EXISTS deficiency_reason text,
    ADD COLUMN IF NOT EXISTS marked_deficient_by uuid,
    ADD COLUMN IF NOT EXISTS marked_deficient_at timestamptz;
