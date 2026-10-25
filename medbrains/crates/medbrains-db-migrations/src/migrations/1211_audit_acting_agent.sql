-- ====================================================================
-- Migration: 1211_audit_acting_agent.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Who acted, when it was not the person the session belongs to.
--
-- The assistant reads the chart with the clinician's authority (it can never
-- exceed it), but until now the audit row for a read the AI made was
-- indistinguishable from a click by the clinician. RFC-AUTHZ-2026-001 §2A.5:
-- "If impersonation is logged as the impersonated user, the audit trail is
-- fiction." `user_id` stays the principal (accountable); `acting_agent`
-- records the actor: {kind, agent, model, run_id, conversation_id}.
--
-- The default reads the transaction-local `app.acting_agent` GUC, which the
-- request context sets while an AI call is in flight, so rows written by
-- handlers and by the generic audit trigger carry the actor too. NULL means a
-- person acted directly.

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS acting_agent JSONB
    DEFAULT (NULLIF(current_setting('app.acting_agent', true), ''))::jsonb;

ALTER TABLE access_log
    ADD COLUMN IF NOT EXISTS acting_agent JSONB
    DEFAULT (NULLIF(current_setting('app.acting_agent', true), ''))::jsonb;
