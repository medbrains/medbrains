-- ====================================================================
-- Migration: 1091_api_key_rate_limit.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Each API key carries its own request budget per minute. A partner's
-- runaway sync loop slows itself down with 429s instead of slowing the
-- hospital; the count is the key's own usage log, so it holds across every
-- server process.

ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 600
        CHECK (rate_limit_per_minute BETWEEN 1 AND 6000);
