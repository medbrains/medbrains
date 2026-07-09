-- Surgical count safety (AORN / NABH retained-surgical-item prevention). A surgical case may not be
-- closed with an incorrect or unverified sponge / instrument count — a retained item is a "never event".
-- The final counts are already recorded on the case record; this adds a documented reconciliation-action
-- field so that closure can be blocked server-side unless the final counts are correct OR the team has
-- documented what was done about a discrepancy (recount, intra-operative X-ray, item retrieved/left in
-- situ with surgeon sign-off).

ALTER TABLE ot_case_records
    ADD COLUMN IF NOT EXISTS count_discrepancy_action text;
