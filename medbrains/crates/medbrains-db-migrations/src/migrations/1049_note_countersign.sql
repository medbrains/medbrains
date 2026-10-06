-- ====================================================================
-- Migration: 1049_note_countersign.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A resident's note is countersigned by their consultant before it is the
-- final record (RFCs/RFC-MODULE-clinical-notes.md, phase 3b). Who
-- countersigns whom is the resident's supervisor (users.supervisor_id,
-- set in Admin -> Users); the note keeps who was asked, the outcome and,
-- when returned, why.
ALTER TABLE clinical_notes
    ADD COLUMN IF NOT EXISTS cosigner_id uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS cosign_status text
        CHECK (cosign_status IN ('pending', 'countersigned', 'returned')),
    ADD COLUMN IF NOT EXISTS cosigned_at timestamptz,
    ADD COLUMN IF NOT EXISTS cosign_comment text;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_cosign_pending
    ON clinical_notes (tenant_id, cosigner_id)
    WHERE cosign_status = 'pending' AND deleted_at IS NULL;
