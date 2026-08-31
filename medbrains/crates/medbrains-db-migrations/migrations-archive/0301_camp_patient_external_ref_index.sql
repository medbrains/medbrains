-- Find a camp-registered patient by the record they came from.
--
-- Camp sync now matches on `attributes->'registration_context'->>'external_ref'`
-- so that a corrected form updates the patient it originally created rather
-- than forking a duplicate. That lookup runs once per patient event — 1,542 of
-- them in a single replay of one camp — and without an index each one is a
-- sequential scan of `patients`.
--
-- An expression index rather than a GIN index over the whole `attributes`
-- document: the query only ever asks this one question, and the narrow index
-- is a fraction of the size and is not invalidated by unrelated attribute
-- writes.
--
-- Partial on `is_active`, matching the WHERE clause in the lookup, which keeps
-- discharged and merged records out of the index entirely.

CREATE INDEX IF NOT EXISTS idx_patients_camp_external_ref
    ON patients (
        tenant_id,
        ((attributes -> 'registration_context' ->> 'external_ref'))
    )
    WHERE is_active = true
      AND attributes -> 'registration_context' ->> 'external_ref' IS NOT NULL;
