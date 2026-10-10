-- ====================================================================
-- Migration: 1057_delivery_runner_role.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The person who takes medicines to a patient's home and hands them over
-- against the patient's one-time code. Alone in this file: a new enum value
-- can't be used in the transaction that adds it (see 0972).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'delivery_runner';
