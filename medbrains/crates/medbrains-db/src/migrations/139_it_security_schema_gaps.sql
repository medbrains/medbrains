-- ====================================================================
-- Migration: 139_it_security_schema_gaps.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: access_alerts, sensitive_patients, break_glass_events,
--             stock_disposal_requests, stock_disposal_items,
--             tat_benchmarks, tat_records, tat_alerts,
--             data_migrations, eod_digest_subscriptions, eod_digest_history,
--             data_quality_rules, data_quality_issues, data_quality_scores,
--             vulnerabilities, compliance_requirements, backup_history
-- Drops: none
-- ====================================================================
-- Schema for the it_security module. Surfaced by the smoke layer as
-- 17 endpoints returning 5xx because the handlers in routes/it_security.rs
-- + routes/security.rs reference these tables but no migration created
-- them. Shapes derived from packages/types/src/index.ts.
-- ====================================================================

-- ── access_alerts (clinical access monitor) ─────────────────────────

CREATE TABLE IF NOT EXISTS access_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    patient_id          UUID NOT NULL,
    user_id             UUID NOT NULL REFERENCES users(id),
    access_type         TEXT NOT NULL,
    module              TEXT,
    ip_address          TEXT,
    is_authorized       BOOLEAN,
    alert_sent          BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at     TIMESTAMPTZ,
    acknowledged_by     UUID REFERENCES users(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_alerts_tenant ON access_alerts(tenant_id, created_at DESC);
ALTER TABLE access_alerts FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('access_alerts');

-- ── sensitive_patients ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sensitive_patients (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    patient_id                  UUID NOT NULL,
    sensitivity_type            TEXT NOT NULL,
    reason                      TEXT,
    access_restricted_to        UUID[],
    alert_on_access             BOOLEAN NOT NULL DEFAULT true,
    notify_users                UUID[],
    created_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, patient_id)
);
ALTER TABLE sensitive_patients FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('sensitive_patients');

-- ── break_glass_events ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS break_glass_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    patient_id          UUID,
    reason              TEXT NOT NULL,
    justification       TEXT,
    modules_accessed    TEXT[] NOT NULL DEFAULT '{}',
    start_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time            TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    ip_address          TEXT,
    user_agent          TEXT,
    supervisor_id       UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_break_glass_active ON break_glass_events(tenant_id, is_active);
ALTER TABLE break_glass_events FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('break_glass_events');

-- ── stock_disposal_requests + items ────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_disposal_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    request_number      TEXT NOT NULL,
    store_id            UUID,
    disposal_type       TEXT NOT NULL,
    disposal_method     TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    requested_by        UUID NOT NULL REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    executed_by         UUID REFERENCES users(id),
    executed_at         TIMESTAMPTZ,
    total_value         NUMERIC(14,2),
    reason              TEXT,
    notes               TEXT,
    certificate_number  TEXT,
    witness_id          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, request_number)
);
ALTER TABLE stock_disposal_requests FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('stock_disposal_requests');

CREATE TABLE IF NOT EXISTS stock_disposal_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_id         UUID NOT NULL REFERENCES stock_disposal_requests(id) ON DELETE CASCADE,
    item_id             UUID,
    item_name           TEXT NOT NULL,
    item_code           TEXT,
    batch_number        TEXT,
    expiry_date         DATE,
    quantity            NUMERIC(12,3) NOT NULL,
    unit                TEXT NOT NULL,
    unit_cost           NUMERIC(12,2),
    total_cost          NUMERIC(14,2),
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disposal_items_disposal ON stock_disposal_items(disposal_id);

-- ── tat_benchmarks + tat_records + tat_alerts ──────────────────────

CREATE TABLE IF NOT EXISTS tat_benchmarks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    category            TEXT NOT NULL,
    sub_category        TEXT,
    benchmark_minutes   INT NOT NULL,
    warning_minutes     INT,
    critical_minutes    INT,
    department_id       UUID REFERENCES departments(id),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tat_benchmarks_tenant ON tat_benchmarks(tenant_id, category);
ALTER TABLE tat_benchmarks FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('tat_benchmarks');

CREATE TABLE IF NOT EXISTS tat_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    category            TEXT NOT NULL,
    sub_category        TEXT,
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    patient_id          UUID,
    department_id       UUID REFERENCES departments(id),
    start_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time            TIMESTAMPTZ,
    elapsed_minutes     INT,
    benchmark_minutes   INT,
    status              TEXT,
    breach_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tat_records_tenant ON tat_records(tenant_id, category, start_time DESC);
ALTER TABLE tat_records FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('tat_records');

CREATE TABLE IF NOT EXISTS tat_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    tat_record_id       UUID NOT NULL REFERENCES tat_records(id) ON DELETE CASCADE,
    alert_type          TEXT NOT NULL,
    notified_users      UUID[],
    acknowledged_at     TIMESTAMPTZ,
    acknowledged_by     UUID REFERENCES users(id),
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tat_alerts FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('tat_alerts');

-- ── data_migrations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_migrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    direction           TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    file_name           TEXT,
    file_path           TEXT,
    file_size_bytes     BIGINT,
    status              TEXT NOT NULL DEFAULT 'pending',
    total_records       INT,
    processed_records   INT,
    success_count       INT,
    error_count         INT,
    warning_count       INT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    initiated_by        UUID NOT NULL REFERENCES users(id),
    error_log           JSONB NOT NULL DEFAULT '[]',
    mapping_config      JSONB NOT NULL DEFAULT '{}',
    options             JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_data_migrations_tenant ON data_migrations(tenant_id, created_at DESC);
ALTER TABLE data_migrations FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('data_migrations');

-- ── eod_digest_subscriptions + history ─────────────────────────────

CREATE TABLE IF NOT EXISTS eod_digest_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    user_id                 UUID NOT NULL REFERENCES users(id),
    frequency               TEXT NOT NULL DEFAULT 'daily',
    delivery_time           TIME,
    delivery_days           INT[],
    modules                 TEXT[],
    include_summary         BOOLEAN NOT NULL DEFAULT true,
    include_alerts          BOOLEAN NOT NULL DEFAULT true,
    include_pending_tasks   BOOLEAN NOT NULL DEFAULT true,
    email_enabled           BOOLEAN NOT NULL DEFAULT true,
    push_enabled            BOOLEAN NOT NULL DEFAULT false,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);
ALTER TABLE eod_digest_subscriptions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('eod_digest_subscriptions');

CREATE TABLE IF NOT EXISTS eod_digest_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    digest_date         DATE NOT NULL,
    content             JSONB NOT NULL DEFAULT '{}',
    sent_at             TIMESTAMPTZ,
    delivery_status     TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eod_digest_history_user ON eod_digest_history(tenant_id, user_id, digest_date DESC);
ALTER TABLE eod_digest_history FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('eod_digest_history');

-- ── data_quality (rules, issues, scores) ───────────────────────────

CREATE TABLE IF NOT EXISTS data_quality_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    category            TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    field_name          TEXT,
    rule_name           TEXT NOT NULL,
    rule_expression     TEXT NOT NULL,
    severity            TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE data_quality_rules FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('data_quality_rules');

CREATE TABLE IF NOT EXISTS data_quality_issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    rule_id             UUID REFERENCES data_quality_rules(id) ON DELETE SET NULL,
    category            TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    entity_id           UUID,
    field_name          TEXT,
    issue_description   TEXT NOT NULL,
    severity            TEXT,
    current_value       TEXT,
    suggested_value     TEXT,
    is_resolved         BOOLEAN NOT NULL DEFAULT false,
    resolved_at         TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dq_issues_unresolved ON data_quality_issues(tenant_id, is_resolved, severity);
ALTER TABLE data_quality_issues FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('data_quality_issues');

CREATE TABLE IF NOT EXISTS data_quality_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    entity_type             TEXT NOT NULL,
    score_date              DATE NOT NULL,
    completeness_score      NUMERIC(5,2),
    accuracy_score          NUMERIC(5,2),
    timeliness_score        NUMERIC(5,2),
    consistency_score       NUMERIC(5,2),
    overall_score           NUMERIC(5,2),
    total_records           INT,
    issues_found            INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, entity_type, score_date)
);
ALTER TABLE data_quality_scores FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('data_quality_scores');

-- ── vulnerabilities + compliance_requirements + backup_history ─────

CREATE TABLE IF NOT EXISTS vulnerabilities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    cve_id                  TEXT,
    title                   TEXT NOT NULL,
    description             TEXT,
    severity                TEXT NOT NULL,
    affected_component      TEXT NOT NULL,
    discovered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovered_by           UUID REFERENCES users(id),
    remediation_status      TEXT,
    remediation_notes       TEXT,
    remediation_deadline    DATE,
    remediated_at           TIMESTAMPTZ,
    remediated_by           UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities(tenant_id, severity, remediation_status);
ALTER TABLE vulnerabilities FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('vulnerabilities');

CREATE TABLE IF NOT EXISTS compliance_requirements (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    framework                   TEXT NOT NULL,
    requirement_code            TEXT NOT NULL,
    requirement_title           TEXT NOT NULL,
    requirement_description     TEXT,
    category                    TEXT,
    is_mandatory                BOOLEAN NOT NULL DEFAULT true,
    compliance_status           TEXT,
    evidence_links              TEXT[],
    last_assessed_at            TIMESTAMPTZ,
    assessed_by                 UUID REFERENCES users(id),
    next_review_date            DATE,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, framework, requirement_code)
);
ALTER TABLE compliance_requirements FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('compliance_requirements');

CREATE TABLE IF NOT EXISTS backup_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenants(id),
    backup_type             TEXT NOT NULL,
    backup_name             TEXT NOT NULL,
    file_path               TEXT,
    file_size_bytes         BIGINT,
    status                  TEXT,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    verification_at         TIMESTAMPTZ,
    retention_days          INT,
    expires_at              TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_history_recent ON backup_history(started_at DESC);
-- backup_history is system-wide (tenant_id may be NULL); skip RLS — handled by route auth.

-- ── security_incidents column add: cert_in_reported (referenced) ───

ALTER TABLE security_incidents
    ADD COLUMN IF NOT EXISTS cert_in_reported BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cert_in_report_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cert_in_reference TEXT;
