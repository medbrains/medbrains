-- Newborn identity safety (NABH / infant-abduction & mismatch prevention). Every newborn must be
-- unambiguously linked to its mother and carry a matching ID band, and that link must be verifiable at
-- the bedside before feeding, handover and discharge. Today newborn_records.mother_id is never set on
-- creation (always NULL) and there is no band number. This adds the band; the mother link is now
-- resolved and stored server-side from the labor -> maternity registration chain.

ALTER TABLE newborn_records
    ADD COLUMN IF NOT EXISTS id_band_number text;
