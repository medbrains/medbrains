-- ====================================================================
-- Migration: 128_audit_hash_canonical.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Phase 2.5 of RFC-INFRA-2026-002 — fixes the legacy issue where audit_log
-- hash chains were un-verifiable because Postgres JSONB normalizes JSON
-- on write (sorts keys, strips whitespace) but the original AuditLogger
-- hashed the JSON string before normalization.
--
-- Fix: store the canonical hash-input bytes alongside the hash itself.
-- Going forward verify-chain reads from `hash_input_canonical` to
-- recompute and compare, sidestepping JSONB normalization entirely.
--
-- Legacy rows (where hash_input_canonical IS NULL) are flagged as
-- "unverifiable-legacy" in the verifier rather than "broken". Operators
-- can then differentiate between actual chain breaks and the well-known
-- pre-Phase-2.5 condition.
-- ====================================================================

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS hash_input_canonical TEXT;

-- Backfill marker column so verify-chain knows which rows pre-date this fix.
COMMENT ON COLUMN audit_log.hash_input_canonical IS
    'Exact hash-input bytes used to compute `hash`. NULL for legacy rows '
    'written before migration 128 (RFC-INFRA-2026-002 Phase 2.5).';

-- No index — column is read by verify only when checking that specific row.
