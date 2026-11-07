-- ====================================================================
-- Migration: 1406_identity_link_by_email.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Whether a provider's verified email may find an existing local account.
--
-- Off unless an administrator turns it on for a provider they trust to own
-- its addresses. The OS's own Kanidm stays off: anyone who may make a person
-- there can give it any address, and Kanidm calls every primary address
-- verified, so its accounts are linked by subject only (Admin, Users, Link to
-- sign-in). Whatever this says, an email never claims an administrator's
-- account; the server refuses that in code.
--
-- sso_provider_for_login returns the whole row, so it carries the column.

ALTER TABLE public.identity_providers
    ADD COLUMN IF NOT EXISTS link_by_email boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.identity_providers.link_by_email IS
    'A verified email from this provider may find an existing local account. Off by default; never for administrators.';
