-- ====================================================================
-- Migration: 1217_ai_message_parts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- An assistant answer is more than its text: the charts and tables it showed,
-- the steps it took, the sources it cited, what the guard removed and why, and
-- what it cost. Reopening a conversation showed only the text.
--
-- `parts` keeps those pieces with the message, in the same form as `content`
-- (identifiers as the conversation's placeholders, read back through its map)
-- and under the same retention: the job that blanks expired content clears
-- this too. Raw tool results and patient-level rows are never kept here; a
-- table built from one stores only what to fetch again, under the user's
-- permissions at the time it is viewed.

ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS parts jsonb;
