-- ====================================================================
-- Migration: 1032_mlc_injuries.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Injuries on a medico-legal case get a maker. `mlc_injuries` (0330) has fed
-- the injury-certificate print since it was created, but no screen ever
-- wrote a row, so the certificate always printed an empty injury list.
--
-- The MLC case page now records each injury with its site picked on the body
-- (kept in `location`, plus the FMA code and side), its type and size, and
-- the examining doctor's opinion of its nature (IPC 320 / BNS 116). A legal
-- record: entries are appended, never edited — RLS and the soft-delete
-- guardrail are already on the table.
ALTER TABLE mlc_injuries
    ADD COLUMN body_site_code text,
    ADD COLUMN body_site_laterality text
        CHECK (body_site_laterality IN ('left', 'right', 'bilateral', 'midline')),
    ADD COLUMN nature text NOT NULL DEFAULT 'undetermined' CHECK (nature IN (
        'simple', 'grievous', 'dangerous_to_life', 'undetermined')),
    ADD COLUMN recorded_by uuid REFERENCES users(id);

-- Injuries are numbered within their case (the certificate's "Injury 1, 2…").
CREATE UNIQUE INDEX IF NOT EXISTS uq_mlc_injuries_case_number
    ON mlc_injuries (mlc_case_id, injury_number) WHERE deleted_at IS NULL;
