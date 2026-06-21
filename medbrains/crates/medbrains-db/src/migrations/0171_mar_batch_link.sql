-- eMAR batch traceability + consolidation onto the canonical table.
--
-- (1) Link each scheduled administration to the dispensed batch so a recall /
--     expiry can be traced from the bedside dose. Columns are nullable —
--     doses scheduled before dispense (or for non-batch-tracked drugs) simply
--     carry no batch until the pharmacy attaches one at dispense time.
ALTER TABLE public.ipd_medication_administration
    ADD COLUMN IF NOT EXISTS batch_stock_id uuid,
    ADD COLUMN IF NOT EXISTS batch_number text,
    ADD COLUMN IF NOT EXISTS batch_expiry date;

-- (2) Retire the orphan MAR table. `medication_administration_records` was
--     written only by the now-removed nurse_mar.rs path and read by nothing
--     else — the real ward MAR is `ipd_medication_administration`. Its only
--     constraints are its own outgoing FKs (to users/tenants), so CASCADE
--     cleanly drops it with no dependents.
DROP TABLE IF EXISTS public.medication_administration_records CASCADE;
