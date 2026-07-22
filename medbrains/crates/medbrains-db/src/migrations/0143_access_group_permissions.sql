-- Migration: 0143_access_group_permissions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Adds a column to access_groups, which already carries the tenant policy.
-- Access groups can now carry global permission grants in addition to
-- SpiceDB/ReBAC resource-scope membership.

ALTER TABLE public.access_groups
    ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE public.access_groups
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;
