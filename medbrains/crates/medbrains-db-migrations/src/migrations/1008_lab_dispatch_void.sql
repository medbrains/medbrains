-- Let a mis-recorded report dispatch be voided — visibly, never silently.
--
-- `lab_report_dispatches` could be created and confirmed and nothing else. A
-- dispatch logged in error stood as a permanent assertion that a patient's
-- report went to a named recipient on a named date.
--
-- Voiding is deliberately NOT a delete, even though the table carries
-- `deleted_at`. Two very different mistakes look identical at the desk:
--
--   "I clicked the wrong button, nothing was sent"  — the record is wrong
--   "I posted it to the wrong address"              — the record is right,
--                                                     and it is a disclosure
--
-- A delete hides the second. So a voided row stays in the list, marked, with
-- the reason attached: whoever reviews disclosures later can see that a
-- dispatch was recorded and what was said about it. Erasing the evidence of a
-- possible PHI disclosure is the one outcome that must not be reachable from
-- a button labelled "cancel".
--
-- Voiding a dispatch the recipient has already CONFIRMED receiving is refused
-- in the handler: at that point it demonstrably happened, and marking it void
-- would falsify the record rather than correct it.

ALTER TABLE lab_report_dispatches
    ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
    ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS void_reason text;

COMMENT ON COLUMN lab_report_dispatches.void_reason IS
  'Why this dispatch record was voided. The row is kept and shown, not '
  'deleted: a dispatch to the wrong recipient is a disclosure, and erasing it '
  'would hide the incident rather than correct the record.';
