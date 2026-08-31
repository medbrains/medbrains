-- ====================================================================
-- Migration: 0203_custom_domain.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Custom domains — let a hospital serve MedBrains on its own domain
-- (e.g. hms.apollo.com). The Pingora edge terminates the domain's TLS and
-- forwards the original Host (X-Forwarded-Host); the app resolves that host to
-- a tenant via this column for pre-auth branding + SSO scoping on the login
-- page, before any JWT exists.
--
-- The `tenants` table is the global registry (not tenant-scoped), so this is
-- RLS not-applicable. Uniqueness is case-insensitive and ignores NULLs, so a
-- domain maps to at most one tenant.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_custom_domain_key
    ON public.tenants (lower(custom_domain))
    WHERE custom_domain IS NOT NULL;
