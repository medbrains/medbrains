-- ====================================================================
-- Migration: 1212_ai_pseudonym_map.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- What the AI saw, and how to read it back.
--
-- Every text sent to a model is pseudonymised first: names, phones, UHID,
-- ABHA, Aadhaar, policy and card numbers become stable placeholders such as
-- [PATIENT_1] (medbrains_core::ai_redact). ai_messages now stores the
-- redacted text — the prompt as the model received it — and this column keeps
-- the placeholder → original mapping for the conversation, so later turns
-- reuse the same placeholders and the server can re-hydrate answers for the
-- authorised user. The mapping never leaves the server and is never sent to a
-- model. Tenant RLS on ai_conversations covers it.

ALTER TABLE ai_conversations
    ADD COLUMN IF NOT EXISTS pseudonym_map JSONB NOT NULL DEFAULT '{}'::jsonb;
