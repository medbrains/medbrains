-- ====================================================================
-- Migration: 143_enum_sequence_fixes.sql
-- RLS-Posture: inherits per-table (no new tables)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Two outliers from the smoke layer's 5xx report:
--
-- 1. analytics/ipd/census handler queries `discharge_type = 'death'`
--    but the enum (defined in 002_phase1_modules.sql) only has
--    'deceased'. Add 'death' as an alias so the handler doesn't 5xx.
--    Long-term the handler should use 'deceased' but that's a code
--    change — schema-side compat is safer.
--
-- 2. Migration 084 seeded the JOURNAL_ENTRY sequence row for tenants
--    that existed AT THAT TIME. Tenants created after 084 (including
--    the seed fixture) don't have a row → billing journal-entry POST
--    handler returns 'JOURNAL_ENTRY sequence not configured'. Re-run
--    the same INSERT here so any current tenant is covered.
-- ====================================================================

-- ── 1. discharge_type enum: add 'death' alias ──────────────────────

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'discharge_type' AND e.enumlabel = 'death'
    ) THEN
        ALTER TYPE discharge_type ADD VALUE 'death';
    END IF;
END $$;

-- ── 2. JOURNAL_ENTRY sequence backfill ─────────────────────────────

INSERT INTO sequences (tenant_id, seq_type, prefix, pad_width, current_val)
SELECT t.id, 'JOURNAL_ENTRY', 'JE', 6, 0
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM sequences s
     WHERE s.tenant_id = t.id AND s.seq_type = 'JOURNAL_ENTRY'
);
