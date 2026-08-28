-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 0
-- Drops: none
-- The two pre-analytical facts a phlebotomist needs, which the catalogue never
-- carried: which tube, and whether the patient must fast.
--
-- Both are already modelled in Rust -- `OrderedTest.container` and
-- `InvestigationRequisitionPrintData.fasting_required` -- and the requisition
-- slip already tries to select them. The schema simply never caught up, so the
-- print query referenced columns that do not exist and failed for every order.
--
-- They belong on the test, not the order: a lipid profile needs a fasting
-- patient whoever ordered it, and a CBC needs a lavender EDTA tube on every
-- requisition ever written. Putting them on `lab_orders` would ask the person
-- placing the order to remember what the assay requires.
--
-- Drawing into the wrong tube is one of the commonest pre-analytical rejections
-- -- the additive is wrong for the assay, so the sample cannot be salvaged and
-- the patient is stuck again. A non-fasting lipid or glucose is the same waste
-- with a return visit attached.
--
-- Both are left NULL/false rather than guessed from `sample_type`. A container
-- inferred from "blood" would be a guess printed on a slip a phlebotomist
-- follows, and a wrong tube confidently stated is worse than a blank one.

ALTER TABLE public.lab_test_catalog
    ADD COLUMN IF NOT EXISTS container text,
    ADD COLUMN IF NOT EXISTS fasting_required boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS fasting_hours integer;

COMMENT ON COLUMN public.lab_test_catalog.container IS
  'Draw tube / container for this assay, e.g. "Lavender EDTA", "Grey fluoride oxalate". Printed on the requisition slip.';

COMMENT ON COLUMN public.lab_test_catalog.fasting_required IS
  'Patient must fast before collection. Aggregated with bool_or across a requisition: if any test needs it, the slip says fast.';

COMMENT ON COLUMN public.lab_test_catalog.fasting_hours IS
  'Hours of fasting required when fasting_required is true. NULL means unspecified, not zero.';
