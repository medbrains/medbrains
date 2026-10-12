-- ====================================================================
-- Migration: 1060_marketing_and_display_roles.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Two built-in roles the admin's role list offered and the database
-- refused: creating a Marketing Executive or a Wall Display user failed
-- with "invalid input value for enum user_role". Alone in this file: a new
-- enum value can't be used in the transaction that adds it (see 0972).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'marketing_executive';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'display_device';
