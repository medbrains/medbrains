-- 087_command_center.sql
-- Command Center: transport requests, department alert thresholds, active alerts

-- ── Enums ──────────────────────────────────────────────────

CREATE TYPE transport_mode AS ENUM (
    'wheelchair', 'stretcher', 'walking', 'porter', 'ambulance'
);

CREATE TYPE transport_status AS ENUM (
    'requested', 'assigned', 'in_transit', 'completed', 'cancelled'
);

-- ── Transport Requests ─────────────────────────────────────

CREATE TABLE transport_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    patient_id      UUID REFERENCES patients(id),
    admission_id    UUID REFERENCES admissions(id),
    from_location_id UUID REFERENCES locations(id),
    to_location_id  UUID REFERENCES locations(id),
    transport_mode  transport_mode NOT NULL,
    status          transport_status NOT NULL DEFAULT 'requested',
    priority        VARCHAR(20) NOT NULL DEFAULT 'routine',
    requested_by    UUID NOT NULL REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_at     TIMESTAMPTZ,
    picked_up_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE transport_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transport_requests
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_transport_requests_tenant ON transport_requests(tenant_id);
CREATE INDEX idx_transport_requests_status ON transport_requests(tenant_id, status)
    WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_transport_requests_assigned ON transport_requests(assigned_to)
    WHERE status IN ('assigned', 'in_transit');
CREATE INDEX idx_transport_requests_date ON transport_requests(tenant_id, requested_at DESC);

CREATE TRIGGER set_transport_requests_updated_at
    BEFORE UPDATE ON transport_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Department Alert Thresholds ────────────────────────────

CREATE TABLE department_alert_thresholds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    department_id       UUID NOT NULL REFERENCES departments(id),
    metric_code         VARCHAR(50) NOT NULL,
    warning_threshold   NUMERIC,
    critical_threshold  NUMERIC,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, department_id, metric_code)
);

ALTER TABLE department_alert_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_alert_thresholds
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_dept_alert_thresholds_tenant ON department_alert_thresholds(tenant_id);
CREATE INDEX idx_dept_alert_thresholds_dept ON department_alert_thresholds(tenant_id, department_id)
    WHERE is_active = true;

CREATE TRIGGER set_dept_alert_thresholds_updated_at
    BEFORE UPDATE ON department_alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Department Alerts ──────────────────────────────────────

CREATE TABLE department_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    department_id   UUID NOT NULL REFERENCES departments(id),
    threshold_id    UUID REFERENCES department_alert_thresholds(id),
    alert_level     VARCHAR(20) NOT NULL,
    metric_code     VARCHAR(50) NOT NULL,
    current_value   NUMERIC NOT NULL,
    threshold_value NUMERIC NOT NULL,
    message         TEXT NOT NULL,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE department_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_alerts
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_dept_alerts_tenant ON department_alerts(tenant_id);
CREATE INDEX idx_dept_alerts_active ON department_alerts(tenant_id, department_id)
    WHERE acknowledged_at IS NULL AND resolved_at IS NULL;
CREATE INDEX idx_dept_alerts_created ON department_alerts(tenant_id, created_at DESC);
