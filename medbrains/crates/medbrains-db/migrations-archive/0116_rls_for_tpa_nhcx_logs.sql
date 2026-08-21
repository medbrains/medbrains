-- ====================================================================
-- Migration: 0116_rls_for_tpa_nhcx_logs.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
--
-- Forward-only RLS patch for tenant-bearing tables introduced in 0101
-- and 0102. Do not edit already-applied migrations; sqlx::migrate!()
-- verifies their checksums in deployed environments.

SELECT apply_tenant_rls('bank_transaction_claim_allocations');
SELECT apply_tenant_rls('nhcx_callback_log');
