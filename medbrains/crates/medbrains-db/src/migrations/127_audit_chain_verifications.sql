-- ====================================================================
-- Migration: 127_audit_chain_verifications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: audit_chain_verifications
-- Drops: none
-- ====================================================================
-- Output table for the hourly verify-chain CronJob (RFC-INFRA-2026-002
-- Phase 2). Each row records the result of a single tenant's chain
-- verification pass: rows checked, head hash, broken-at row id (if any),
-- duration. The job emits Prometheus metric audit_chain_break_total
-- {tenant=...} on any non-valid result and pages oncall via Alertmanager.
-- ====================================================================

CREATE TABLE audit_chain_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    rows_checked    BIGINT NOT NULL DEFAULT 0,
    head_hash       TEXT,
    broken_at       UUID REFERENCES audit_log(id),
    valid           BOOLEAN NOT NULL,
    duration_ms     INTEGER,
    triggered_by    TEXT NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual' | 'pre-deploy' | 'post-deploy'
    notes           TEXT
);

CREATE INDEX idx_audit_chain_verifications_tenant_started
    ON audit_chain_verifications(tenant_id, started_at DESC);

CREATE INDEX idx_audit_chain_verifications_invalid
    ON audit_chain_verifications(tenant_id, started_at DESC) WHERE valid = false;

SELECT apply_tenant_rls('audit_chain_verifications');
