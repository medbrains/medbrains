-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Tell the patient they have to fast.
--
-- `lab_test_catalog.fasting_required` and `fasting_hours` have existed since
-- the catalogue did. The importer writes them, the API returns them, the Rust
-- type carries them -- and not one of the 82 seeded tests has ever had them
-- set. "Fasting Blood Sugar" came back from the API as
-- `fasting_required: false`.
--
-- The consequence is entirely on the patient. They are sent for an FBS, nobody
-- tells them not to eat, they arrive having had breakfast, and either the
-- sample is drawn and the result is clinically meaningless, or they are turned
-- away and come back tomorrow. Neither shows up as a system fault.
--
-- ## What is set, and what deliberately is not
--
-- Only tests whose fasting requirement is not a matter of local protocol:
--
--   FBS         8h   a fasting glucose is fasting by definition; 8 hours is
--                    the usual floor, and the name says the rest
--   lipids     12h   triglycerides are the fraction food actually moves, and
--                    the panel is drawn together, so the whole profile
--                    carries the requirement
--
-- Left alone on purpose, because asserting fasting for them would be wrong:
--
--   PPBS             post-prandial is measured *after* eating. It needs a
--                    timed return, not an empty stomach, and modelling that
--                    is a scheduled follow-up rather than a flag
--   RBS              random is the point of it
--   HbA1c            reflects months of glycaemia; food on the day is
--                    irrelevant, and telling a patient to fast for it is a
--                    missed breakfast for nothing
--
-- Only rows the hospital has not already configured are touched, so a
-- laboratory that has set its own protocol keeps it. `is_dummy`-style seed
-- guards are unnecessary here: the WHERE clause is the guard.

UPDATE lab_test_catalog
   SET fasting_required = true,
       fasting_hours = 8,
       updated_at = now()
 WHERE code = 'FBS'
   AND deleted_at IS NULL
   AND COALESCE(fasting_required, false) = false
   AND fasting_hours IS NULL;

UPDATE lab_test_catalog
   SET fasting_required = true,
       fasting_hours = 12,
       updated_at = now()
 WHERE code IN ('PROF_LIPID', 'TG', 'CHOL', 'LDL', 'HDL', 'VLDL')
   AND deleted_at IS NULL
   AND COALESCE(fasting_required, false) = false
   AND fasting_hours IS NULL;
