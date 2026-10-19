-- ====================================================================
-- Migration: 1076_staff_role.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A signed-in member of staff whose job here is not yet known: what a new
-- single-sign-on account gets when no directory group names its role. It
-- opens the dashboard and nothing else, so an administrator assigns the real
-- role. Before this, the alternatives were refusing the login outright or a
-- default role — and one hospital's default was an administrator's.
-- Alone in this file: a new enum value can't be used in the transaction that
-- adds it (see 0972).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';
