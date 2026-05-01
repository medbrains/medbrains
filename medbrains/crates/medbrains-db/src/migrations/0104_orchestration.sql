-- ════════════════════════════════════════════════════════════════
--  0104_orchestration.sql — async job queue + cron scheduler
-- ════════════════════════════════════════════════════════════════
--
-- Adds the two tables polled by the orchestration background loops in
-- `crates/medbrains-server/src/orchestration/{jobs,scheduler}.rs`:
--
--   * job_queue       — pending/running async jobs (pipelines, connectors,
--                        notifications). Pulled by worker pool with
--                        FOR UPDATE SKIP LOCKED.
--   * scheduled_jobs  — cron-driven pipelines. Tick loop enqueues into
--                        job_queue when next_run_at ≤ now().
--
-- FK targets: tenants (0001_core), users (0003_auth),
--             integration_pipelines / integration_executions / connectors
--             (0009_integration).
--
-- Without this migration the orchestration loops detect SQLSTATE 42P01
-- (undefined_table) and bail cleanly with a one-shot WARN. Apply this
-- migration to enable async pipelines + cron triggers.

-- ── job_queue ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    job_type        TEXT NOT NULL,
    pipeline_id     UUID REFERENCES integration_pipelines(id),
    execution_id    UUID REFERENCES integration_executions(id),
    connector_id    UUID REFERENCES connectors(id),
    payload         JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead_letter')),
    priority        INT NOT NULL DEFAULT 5,
    max_retries     INT NOT NULL DEFAULT 3,
    retry_count     INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    locked_by       TEXT,
    locked_at       TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    correlation_id  UUID DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_queue_tenant ON job_queue
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_job_queue_pending ON job_queue (status, priority, created_at)
    WHERE status = 'pending';
CREATE INDEX idx_job_queue_retry ON job_queue (next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_job_queue_tenant ON job_queue (tenant_id, status);
CREATE INDEX idx_job_queue_correlation ON job_queue (correlation_id);

-- ── scheduled_jobs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    pipeline_id     UUID NOT NULL REFERENCES integration_pipelines(id),
    name            TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    input_data      JSONB NOT NULL DEFAULT '{}',
    next_run_at     TIMESTAMPTZ NOT NULL,
    last_run_at     TIMESTAMPTZ,
    last_status     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_jobs_tenant ON scheduled_jobs
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_scheduled_jobs_next ON scheduled_jobs (next_run_at)
    WHERE is_active = true;
CREATE INDEX idx_scheduled_jobs_tenant ON scheduled_jobs (tenant_id, is_active);

CREATE TRIGGER trg_scheduled_jobs_updated_at
    BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
