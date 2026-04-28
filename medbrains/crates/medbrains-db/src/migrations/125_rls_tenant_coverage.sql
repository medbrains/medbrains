-- ====================================================================
-- Migration: 125_rls_tenant_coverage.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Closes the 8 tenant_id-bearing tables that were missing RLS coverage,
-- as detected by `make check-rls` against the tree at RFC-INFRA-2026-002
-- Phase 1 start.
--
-- Two postures here:
--   1. Standard tenant-scoped (tenant_id NOT NULL):
--      - doctor_rotation_schedules
--      - job_queue
--      - pharmacy_pos_sale_items
--      - user_hospital_assignments
--   2. tenant_id NULLABLE with NULL = global / cross-tenant:
--      - group_kpi_snapshots          (NULL = aggregated across tenants)
--      - master_occupations           (NULL = global default catalog row)
--      - master_relations             (NULL = global default catalog row)
--      - master_religions             (NULL = global default catalog row)
--
-- After this migration `make check-rls` should report zero gaps.
-- ====================================================================

-- ── Standard tenant-scoped (4 tables) ────────────────────────────

SELECT apply_tenant_rls('doctor_rotation_schedules');
SELECT apply_tenant_rls('job_queue');
SELECT apply_tenant_rls('pharmacy_pos_sale_items');
SELECT apply_tenant_rls('user_hospital_assignments');

-- ── Global-default pattern (4 tables) ────────────────────────────
-- These tables intentionally have nullable tenant_id where NULL rows
-- are visible to all tenants. The helper allows that semantics.

SELECT apply_tenant_rls_with_global('group_kpi_snapshots');
SELECT apply_tenant_rls_with_global('master_occupations');
SELECT apply_tenant_rls_with_global('master_relations');
SELECT apply_tenant_rls_with_global('master_religions');
