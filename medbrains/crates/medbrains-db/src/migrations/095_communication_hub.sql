-- 091_communication_hub.sql — Communication Hub Module
-- Templates, messages, clinical messaging, critical alerts,
-- complaints/grievance, feedback surveys, escalation rules

-- ═══════════════════════════════════════════════════════════
--  ENUMS
-- ═══════════════════════════════════════════════════════════

CREATE TYPE comm_channel AS ENUM (
    'sms', 'whatsapp', 'email', 'push', 'ivr', 'portal'
);

CREATE TYPE comm_message_status AS ENUM (
    'queued', 'sent', 'delivered', 'failed', 'read'
);

CREATE TYPE comm_template_type AS ENUM (
    'appointment_reminder', 'lab_result', 'discharge_summary',
    'billing', 'medication_reminder', 'follow_up', 'generic', 'marketing'
);

CREATE TYPE comm_clinical_priority AS ENUM (
    'routine', 'urgent', 'critical', 'stat'
);

CREATE TYPE comm_alert_status AS ENUM (
    'triggered', 'acknowledged', 'escalated', 'resolved', 'expired'
);

CREATE TYPE comm_complaint_status AS ENUM (
    'open', 'assigned', 'in_progress', 'pending_review',
    'resolved', 'closed', 'reopened'
);

CREATE TYPE comm_complaint_source AS ENUM (
    'walk_in', 'phone', 'email', 'portal', 'kiosk', 'social_media', 'google_review'
);

CREATE TYPE comm_feedback_type AS ENUM (
    'bedside', 'post_discharge', 'nps', 'department', 'kiosk'
);

-- ═══════════════════════════════════════════════════════════
--  TABLE 1: comm_templates
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_templates (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    template_name         TEXT NOT NULL,
    template_code         TEXT NOT NULL,
    channel               comm_channel NOT NULL,
    template_type         comm_template_type NOT NULL,
    subject               TEXT,
    body_template         TEXT NOT NULL,
    placeholders          JSONB,
    language              TEXT DEFAULT 'en',
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval     BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by           UUID REFERENCES users(id),
    approved_at           TIMESTAMPTZ,
    external_template_id  TEXT,
    notes                 TEXT,
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, template_code)
);

ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_templates
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_tpl_tenant  ON comm_templates(tenant_id);
CREATE INDEX idx_comm_tpl_channel ON comm_templates(tenant_id, channel);
CREATE INDEX idx_comm_tpl_type    ON comm_templates(tenant_id, template_type);
CREATE TRIGGER trg_comm_templates_updated_at
    BEFORE UPDATE ON comm_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 2: comm_messages
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_messages (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    message_code          TEXT NOT NULL,
    template_id           UUID REFERENCES comm_templates(id),
    channel               comm_channel NOT NULL,
    status                comm_message_status NOT NULL DEFAULT 'queued',
    recipient_type        TEXT,
    recipient_id          UUID,
    recipient_name        TEXT,
    recipient_contact     TEXT NOT NULL,
    subject               TEXT,
    body                  TEXT NOT NULL,
    scheduled_at          TIMESTAMPTZ,
    sent_at               TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    read_at               TIMESTAMPTZ,
    failed_at             TIMESTAMPTZ,
    failure_reason        TEXT,
    external_message_id   TEXT,
    context_type          TEXT,
    context_id            UUID,
    retry_count           INTEGER DEFAULT 0,
    sent_by               UUID REFERENCES users(id),
    cost                  NUMERIC(10,4),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, message_code)
);

ALTER TABLE comm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_messages
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_msg_tenant  ON comm_messages(tenant_id);
CREATE INDEX idx_comm_msg_status  ON comm_messages(tenant_id, status);
CREATE INDEX idx_comm_msg_channel ON comm_messages(tenant_id, channel);
CREATE INDEX idx_comm_msg_created ON comm_messages(tenant_id, created_at DESC);
CREATE TRIGGER trg_comm_messages_updated_at
    BEFORE UPDATE ON comm_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 3: comm_clinical_messages
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_clinical_messages (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    message_code          TEXT NOT NULL,
    sender_id             UUID NOT NULL REFERENCES users(id),
    recipient_id          UUID NOT NULL REFERENCES users(id),
    recipient_department_id UUID REFERENCES departments(id),
    patient_id            UUID REFERENCES patients(id),
    priority              comm_clinical_priority NOT NULL DEFAULT 'routine',
    message_type          TEXT NOT NULL,
    subject               TEXT,
    body                  TEXT NOT NULL,
    sbar_data             JSONB,
    is_read               BOOLEAN NOT NULL DEFAULT FALSE,
    read_at               TIMESTAMPTZ,
    is_urgent             BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at       TIMESTAMPTZ,
    acknowledged_by       UUID REFERENCES users(id),
    parent_message_id     UUID REFERENCES comm_clinical_messages(id),
    attachments           JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, message_code)
);

ALTER TABLE comm_clinical_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_clinical_messages
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_clin_tenant    ON comm_clinical_messages(tenant_id);
CREATE INDEX idx_comm_clin_sender    ON comm_clinical_messages(tenant_id, sender_id);
CREATE INDEX idx_comm_clin_recipient ON comm_clinical_messages(tenant_id, recipient_id);
CREATE INDEX idx_comm_clin_patient   ON comm_clinical_messages(tenant_id, patient_id);
CREATE INDEX idx_comm_clin_priority  ON comm_clinical_messages(tenant_id, priority);
CREATE INDEX idx_comm_clin_created   ON comm_clinical_messages(tenant_id, created_at DESC);
CREATE TRIGGER trg_comm_clinical_updated_at
    BEFORE UPDATE ON comm_clinical_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 4: comm_critical_alerts
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_critical_alerts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    alert_code            TEXT NOT NULL,
    alert_source          TEXT NOT NULL,
    source_id             UUID,
    patient_id            UUID NOT NULL REFERENCES patients(id),
    department_id         UUID REFERENCES departments(id),
    priority              comm_clinical_priority NOT NULL DEFAULT 'critical',
    status                comm_alert_status NOT NULL DEFAULT 'triggered',
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL,
    alert_value           TEXT,
    normal_range          TEXT,
    triggered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at       TIMESTAMPTZ,
    acknowledged_by       UUID REFERENCES users(id),
    resolved_at           TIMESTAMPTZ,
    resolved_by           UUID REFERENCES users(id),
    resolution_notes      TEXT,
    escalation_level      INTEGER DEFAULT 0,
    escalated_at          TIMESTAMPTZ,
    escalated_to          UUID REFERENCES users(id),
    notification_log      JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, alert_code)
);

ALTER TABLE comm_critical_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_critical_alerts
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_alert_tenant  ON comm_critical_alerts(tenant_id);
CREATE INDEX idx_comm_alert_status  ON comm_critical_alerts(tenant_id, status);
CREATE INDEX idx_comm_alert_patient ON comm_critical_alerts(tenant_id, patient_id);
CREATE INDEX idx_comm_alert_source  ON comm_critical_alerts(tenant_id, alert_source);
CREATE INDEX idx_comm_alert_time    ON comm_critical_alerts(tenant_id, triggered_at DESC);
CREATE TRIGGER trg_comm_alerts_updated_at
    BEFORE UPDATE ON comm_critical_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 5: comm_complaints
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_complaints (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    complaint_code        TEXT NOT NULL,
    source                comm_complaint_source NOT NULL,
    status                comm_complaint_status NOT NULL DEFAULT 'open',
    patient_id            UUID REFERENCES patients(id),
    complainant_name      TEXT NOT NULL,
    complainant_phone     TEXT,
    complainant_email     TEXT,
    department_id         UUID REFERENCES departments(id),
    category              TEXT,
    subcategory           TEXT,
    subject               TEXT NOT NULL,
    description           TEXT NOT NULL,
    severity              TEXT DEFAULT 'medium',
    assigned_to           UUID REFERENCES users(id),
    assigned_at           TIMESTAMPTZ,
    sla_hours             INTEGER,
    sla_deadline          TIMESTAMPTZ,
    sla_breached          BOOLEAN NOT NULL DEFAULT FALSE,
    sla_breached_at       TIMESTAMPTZ,
    resolution_notes      TEXT,
    resolved_at           TIMESTAMPTZ,
    resolved_by           UUID REFERENCES users(id),
    closed_at             TIMESTAMPTZ,
    closed_by             UUID REFERENCES users(id),
    satisfaction_score    INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
    service_recovery_action TEXT,
    service_recovery_cost NUMERIC(12,2),
    escalation_level      INTEGER DEFAULT 0,
    escalation_history    JSONB,
    google_review_id      TEXT,
    external_reference    TEXT,
    attachments           JSONB,
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, complaint_code)
);

ALTER TABLE comm_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_complaints
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_cmp_tenant ON comm_complaints(tenant_id);
CREATE INDEX idx_comm_cmp_status ON comm_complaints(tenant_id, status);
CREATE INDEX idx_comm_cmp_source ON comm_complaints(tenant_id, source);
CREATE INDEX idx_comm_cmp_dept   ON comm_complaints(tenant_id, department_id);
CREATE INDEX idx_comm_cmp_sla    ON comm_complaints(tenant_id, sla_deadline) WHERE status NOT IN ('resolved', 'closed');
CREATE TRIGGER trg_comm_complaints_updated_at
    BEFORE UPDATE ON comm_complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 6: comm_feedback_surveys
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_feedback_surveys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    feedback_code         TEXT NOT NULL,
    feedback_type         comm_feedback_type NOT NULL,
    patient_id            UUID REFERENCES patients(id),
    department_id         UUID REFERENCES departments(id),
    doctor_id             UUID REFERENCES users(id),
    overall_rating        INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    nps_score             INTEGER CHECK (nps_score BETWEEN 0 AND 10),
    wait_time_rating      INTEGER CHECK (wait_time_rating BETWEEN 1 AND 5),
    staff_rating          INTEGER CHECK (staff_rating BETWEEN 1 AND 5),
    cleanliness_rating    INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
    food_rating           INTEGER CHECK (food_rating BETWEEN 1 AND 5),
    communication_rating  INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    discharge_rating      INTEGER CHECK (discharge_rating BETWEEN 1 AND 5),
    would_recommend       BOOLEAN,
    comments              TEXT,
    suggestions           TEXT,
    is_anonymous          BOOLEAN NOT NULL DEFAULT FALSE,
    channel               TEXT,
    survey_data           JSONB,
    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    waiting_time_minutes  INTEGER,
    collection_point      TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, feedback_code)
);

ALTER TABLE comm_feedback_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_feedback_surveys
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_fb_tenant ON comm_feedback_surveys(tenant_id);
CREATE INDEX idx_comm_fb_type   ON comm_feedback_surveys(tenant_id, feedback_type);
CREATE INDEX idx_comm_fb_dept   ON comm_feedback_surveys(tenant_id, department_id);
CREATE INDEX idx_comm_fb_date   ON comm_feedback_surveys(tenant_id, submitted_at DESC);

-- ═══════════════════════════════════════════════════════════
--  TABLE 7: comm_escalation_rules
-- ═══════════════════════════════════════════════════════════

CREATE TABLE comm_escalation_rules (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    rule_name             TEXT NOT NULL,
    rule_type             TEXT NOT NULL,
    department_id         UUID REFERENCES departments(id),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_condition     JSONB NOT NULL,
    escalation_chain      JSONB NOT NULL,
    max_escalation_level  INTEGER DEFAULT 3,
    notes                 TEXT,
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE comm_escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comm_escalation_rules
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_comm_esc_tenant ON comm_escalation_rules(tenant_id);
CREATE INDEX idx_comm_esc_type   ON comm_escalation_rules(tenant_id, rule_type);
CREATE TRIGGER trg_comm_escalation_updated_at
    BEFORE UPDATE ON comm_escalation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
