-- ====================================================================
-- Migration: 1052_encounter_type_home_health.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A home visit is a visit of its own (RFCs/RFC-MODULE-clinical-notes.md,
-- home care): its notes are written and signed on its case sheet as the
-- clinic's and the ward's are. The value is added alone — Postgres does
-- not let a transaction use an enum value it has just added — and used by
-- 1053.

ALTER TYPE encounter_type ADD VALUE IF NOT EXISTS 'home_health';
