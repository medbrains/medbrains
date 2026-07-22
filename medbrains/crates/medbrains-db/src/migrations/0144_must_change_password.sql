-- Migration: 0144_must_change_password.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Adds a column to users, which already carries the tenant policy.
-- Force password rotation on seeded/provisioned accounts (audit P0 #2).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
