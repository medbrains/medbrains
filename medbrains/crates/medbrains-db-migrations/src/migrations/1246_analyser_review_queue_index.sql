-- ====================================================================
-- Migration: 1246_analyser_review_queue_index.sql
-- RLS-Posture: tenant-scoped (existing table; policies unchanged)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The analyser review queue's index. A separate migration because an enum
-- value cannot be used in the transaction that added it (1245).

CREATE INDEX IF NOT EXISTS idx_device_messages_needs_review
    ON public.device_messages (tenant_id, created_at DESC)
    WHERE processing_status = 'needs_review' AND deleted_at IS NULL;
