-- ====================================================================
-- Migration: 1458_mfa_last_totp_step.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The 30-second step of the last authenticator code a user signed in with.
-- A code is accepted for about 90 seconds; recording its step lets the server
-- refuse the same code, or an older one, a second time. NULL until the next
-- code is used.

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_totp_step BIGINT;
