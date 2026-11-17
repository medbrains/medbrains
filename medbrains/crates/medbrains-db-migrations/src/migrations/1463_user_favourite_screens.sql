-- ====================================================================
-- Migration: 1463_user_favourite_screens.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: user_favourite_screens
-- Drops: none
-- ====================================================================
-- The screens a person starred, shown on the launcher and at the top of the
-- side panel. Replaces the per-browser localStorage list, which followed the
-- workstation rather than the person.
--
-- A row stores only a route path, never what the screen shows. The web app
-- hides a starred screen the person can no longer open and keeps the row, so
-- the star comes back with the access. Unstarring deletes the row: it is a
-- preference, not a record, so it carries no soft delete and no audit trigger.

CREATE TABLE public.user_favourite_screens (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    path text NOT NULL CHECK (path ~ '^/[A-Za-z0-9/_-]{0,199}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, path)
);

ALTER TABLE public.user_favourite_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favourite_screens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_favourite_screens ON public.user_favourite_screens
    USING (tenant_id = public.app_current_tenant())
    WITH CHECK (tenant_id = public.app_current_tenant());
