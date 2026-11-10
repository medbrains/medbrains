-- ====================================================================
-- Migration: 1396_medical_superintendent_role.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The medical superintendent: the clinical head who, with the quality
-- officer, approves switch changes on clinical flows such as discharge
-- (RFC-SOP-FLOWS §9.3). Alone in this file: a new enum value can't be used
-- in the transaction that adds it (see 0972).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'medical_superintendent';
