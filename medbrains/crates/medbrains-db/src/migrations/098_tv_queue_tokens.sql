-- 098_tv_queue_tokens.sql — Queue tokens for TV display system
-- Token generation with atomic sequences per department/day

-- ── Queue Tokens ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS queue_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    token_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    token_seq       INT NOT NULL,
    token_number    VARCHAR(20) NOT NULL,
    patient_id      UUID REFERENCES patients(id),
    department_id   UUID NOT NULL REFERENCES departments(id),
    doctor_id       UUID REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'no_show', 'cancelled')),
    priority        queue_priority NOT NULL DEFAULT 'normal',
    called_at       TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, department_id, token_date, token_seq)
);

CREATE INDEX idx_queue_tokens_tenant ON queue_tokens(tenant_id);
CREATE INDEX idx_queue_tokens_dept_date ON queue_tokens(department_id, token_date);
CREATE INDEX idx_queue_tokens_status ON queue_tokens(status) WHERE status IN ('waiting', 'called');
CREATE INDEX idx_queue_tokens_patient ON queue_tokens(patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE queue_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_tokens_tenant ON queue_tokens
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER trg_queue_tokens_updated_at BEFORE UPDATE ON queue_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TV Announcements ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tv_announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    message         TEXT NOT NULL,
    priority        VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (priority IN ('info', 'warning', 'emergency')),
    display_ids     UUID[],
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_announcements_tenant ON tv_announcements(tenant_id);
CREATE INDEX idx_tv_announcements_active ON tv_announcements(tenant_id, starts_at, ends_at)
    WHERE ends_at IS NULL;

ALTER TABLE tv_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tv_announcements_tenant ON tv_announcements
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER trg_tv_announcements_updated_at BEFORE UPDATE ON tv_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Token Sequence Helper Function ──────────────────────────

-- Atomic token sequence generation
CREATE OR REPLACE FUNCTION next_queue_token_seq(
    p_tenant_id UUID,
    p_department_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(token_seq), 0) + 1 INTO v_seq
    FROM queue_tokens
    WHERE tenant_id = p_tenant_id
      AND department_id = p_department_id
      AND token_date = p_date;
    RETURN v_seq;
END;
$$ LANGUAGE plpgsql;
