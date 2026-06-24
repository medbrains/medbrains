-- ====================================================================
-- Migration: 0206_user_invitations.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: tenant_id
-- New-Tables: user_invitations
-- Drops: none
-- ====================================================================
-- Team invites — an admin invites a colleague by email; they follow a link to
-- set their own password and the account is created (email already proven by
-- the invite, so email_verified = true on accept).
--
-- Like the email-verification table, this is a pre-auth CAPABILITY table: the
-- unguessable token IS the authorization, so it is NOT tenant-RLS'd (the public
-- accept endpoint has no tenant context). Only the SHA-256 hash is stored. The
-- admin list/revoke endpoints filter by tenant_id explicitly. `role` holds a
-- `user_role` enum value (or a custom role code), cast/validated on accept.

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    full_name text,
    token_hash text NOT NULL UNIQUE,
    invited_by uuid,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant
    ON public.user_invitations (tenant_id, created_at DESC);
