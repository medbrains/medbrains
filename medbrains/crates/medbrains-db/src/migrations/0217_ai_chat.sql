-- ====================================================================
-- Migration: 0217_ai_chat.sql
-- RLS-Posture: tenant-rls
-- Tenant-Column: tenant_id
-- New-Tables: ai_conversations, ai_messages
-- Drops: none
-- ====================================================================
-- Phase 1 of the AI Clinical Copilot (RFC-AI-CLINICAL-COPILOT): persist
-- assistant conversations + messages so a thread survives reloads and can be
-- listed/resumed. Tenant-scoped under RLS; owner-scoped in the handler.
-- Sharing (visibility != 'private'), rolling summaries, and message
-- embeddings are later phases and get their own migrations — not built yet.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    owner_user_id   uuid NOT NULL,
    title           text,
    -- Optional clinical grouping — a thread opened from a patient/encounter.
    patient_id      uuid,
    encounter_id    uuid,
    -- 'private' | 'shared' | 'group' | 'department' — only 'private' is
    -- enforced in Phase 1; sharing lands with its own migration + ReBAC gate.
    visibility      text NOT NULL DEFAULT 'private',
    model           text,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_conversations_tenant ON public.ai_conversations;
CREATE POLICY ai_conversations_tenant ON public.ai_conversations
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- The sidebar lists a user's own threads, newest first.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner
    ON public.ai_conversations (tenant_id, owner_user_id, last_message_at DESC)
    WHERE archived_at IS NULL;

CREATE TRIGGER set_ai_conversations_updated_at
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role            text NOT NULL,
    content         text NOT NULL DEFAULT '',
    token_count     integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_messages_tenant ON public.ai_messages;
CREATE POLICY ai_messages_tenant ON public.ai_messages
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON public.ai_messages (tenant_id, conversation_id, created_at);
