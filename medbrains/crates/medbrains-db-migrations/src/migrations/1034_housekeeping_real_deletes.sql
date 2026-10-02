-- ====================================================================
-- Migration: 1034_housekeeping_real_deletes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: soft-delete guardrail triggers on six housekeeping tables
-- ====================================================================
-- The soft-delete guardrail turns every DELETE into an UPDATE. On clinical
-- and master data that is the point; on these six tables it defeats the
-- only delete they get:
--
--   refresh_tokens, outbox_events, outbox_dlq, job_queue, camp_sync_events
--     — the nightly retention purge (services/retention.rs) "deleted"
--       revoked tokens and settled events, and every row stayed, forever:
--       a purge that purged nothing.
--   widget_templates
--     — the boot-time catalogue sync clears and re-inserts the system
--       templates; each boot left a full set of dead rows (8,533 of 8,540
--       on dev).
--
-- None of these rows has clinical meaning, and nothing restores them. With
-- the trigger gone the next purge / boot removes what they match, including
-- the rows the guardrail kept — no bulk delete here, so RLS on the migrating
-- role does not matter.
DROP TRIGGER IF EXISTS trg_refresh_tokens_soft_delete_71ef94b0 ON public.refresh_tokens;
DROP TRIGGER IF EXISTS trg_outbox_events_soft_delete_6c927db9 ON public.outbox_events;
DROP TRIGGER IF EXISTS trg_outbox_dlq_soft_delete_fa2fec5f ON public.outbox_dlq;
DROP TRIGGER IF EXISTS trg_job_queue_soft_delete_acee3fd3 ON public.job_queue;
DROP TRIGGER IF EXISTS trg_camp_sync_events_soft_delete_d3912e41 ON public.camp_sync_events;
DROP TRIGGER IF EXISTS trg_widget_templates_soft_delete_5ae4362d ON public.widget_templates;
