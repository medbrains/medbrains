-- Migration: 0286_device_push_tokens.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Expo push tokens (RFC-NOTIFICATION-SYSTEM, P4).
--
-- One row per (user, device) push registration. The mobile apps register their
-- Expo push token here; the notification listener sends a push via the Expo
-- Push API for backgrounded devices when a notification is created.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL,
    user_id      uuid NOT NULL,
    expo_token   text NOT NULL,
    platform     text,                                  -- ios | android
    surface      text,                                  -- Mobile-Doctor, Mobile-Nurse, ...
    revoked      boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, expo_token)
);

-- Fast lookup of a user's live tokens at send time.
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
    ON public.device_push_tokens (tenant_id, user_id)
    WHERE revoked = false;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_device_push_tokens ON public.device_push_tokens
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
