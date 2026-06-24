-- ====================================================================
-- Migration: 0205_email_verification.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: tenant_id
-- New-Tables: email_verification_tokens
-- Drops: none
-- ====================================================================
-- Email verification for self-service signup. The admin created at
-- onboarding gets a one-time verify link; clicking it flips
-- `users.email_verified`. Advisory — login is not blocked (a self-host admin
-- owns the box), but the unverified state is surfaced in the app.
--
-- The token table is a pre-auth CAPABILITY table: the unguessable token IS the
-- authorization, so it is intentionally NOT tenant-RLS'd (the public verify
-- endpoint has no tenant context). Only the SHA-256 hash is stored. The row
-- carries tenant_id/user_id so verification can set the right RLS context for
-- the `users` UPDATE.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
    ON public.email_verification_tokens (user_id, created_at DESC);
