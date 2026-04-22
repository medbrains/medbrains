-- 093_bedside_portal.sql — Bedside Portal Module
-- Patient-facing tablet: daily schedule, meds, vitals, meals, nurse requests, education, feedback

-- ═══════════════════════════════════════════════════════════
--  ENUMS
-- ═══════════════════════════════════════════════════════════

CREATE TYPE bedside_request_type AS ENUM (
    'nurse_call', 'pain_management', 'bathroom_assist',
    'water_food', 'blanket_pillow', 'position_change', 'other'
);

CREATE TYPE bedside_request_status AS ENUM (
    'pending', 'acknowledged', 'in_progress', 'completed', 'cancelled'
);

-- ═══════════════════════════════════════════════════════════
--  TABLE 1: bedside_sessions (track tablet sessions per bed)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bedside_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    admission_id    UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    bed_location    TEXT,
    device_id       TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bedside_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bedside_sessions
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bedside_sess_tenant ON bedside_sessions(tenant_id);
CREATE INDEX idx_bedside_sess_admission ON bedside_sessions(tenant_id, admission_id);
CREATE INDEX idx_bedside_sess_active ON bedside_sessions(tenant_id, is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════
--  TABLE 2: bedside_nurse_requests
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bedside_nurse_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    admission_id    UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    request_type    bedside_request_type NOT NULL,
    status          bedside_request_status NOT NULL DEFAULT 'pending',
    notes           TEXT,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bedside_nurse_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bedside_nurse_requests
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bedside_req_tenant ON bedside_nurse_requests(tenant_id);
CREATE INDEX idx_bedside_req_admission ON bedside_nurse_requests(tenant_id, admission_id);
CREATE INDEX idx_bedside_req_status ON bedside_nurse_requests(tenant_id, status);
CREATE INDEX idx_bedside_req_pending ON bedside_nurse_requests(tenant_id, status) WHERE status IN ('pending', 'acknowledged');
CREATE TRIGGER trg_bedside_req_updated_at
    BEFORE UPDATE ON bedside_nurse_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 3: bedside_education_videos
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bedside_education_videos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    title           TEXT NOT NULL,
    description     TEXT,
    video_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    category        TEXT NOT NULL,
    condition_codes JSONB,
    language        TEXT DEFAULT 'en',
    duration_seconds INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bedside_education_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bedside_education_videos
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bedside_vid_tenant ON bedside_education_videos(tenant_id);
CREATE INDEX idx_bedside_vid_category ON bedside_education_videos(tenant_id, category);
CREATE TRIGGER trg_bedside_vid_updated_at
    BEFORE UPDATE ON bedside_education_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 4: bedside_education_views (tracking)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bedside_education_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    video_id    UUID NOT NULL REFERENCES bedside_education_videos(id),
    patient_id  UUID NOT NULL REFERENCES patients(id),
    admission_id UUID NOT NULL,
    watched_seconds INTEGER DEFAULT 0,
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bedside_education_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bedside_education_views
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bedside_views_tenant ON bedside_education_views(tenant_id);
CREATE INDEX idx_bedside_views_patient ON bedside_education_views(tenant_id, patient_id);

-- ═══════════════════════════════════════════════════════════
--  TABLE 5: bedside_realtime_feedback
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bedside_realtime_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    admission_id    UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    pain_level      INTEGER CHECK (pain_level BETWEEN 0 AND 10),
    comfort_level   INTEGER CHECK (comfort_level BETWEEN 1 AND 5),
    cleanliness_level INTEGER CHECK (cleanliness_level BETWEEN 1 AND 5),
    noise_level     INTEGER CHECK (noise_level BETWEEN 1 AND 5),
    staff_response  INTEGER CHECK (staff_response BETWEEN 1 AND 5),
    comments        TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bedside_realtime_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bedside_realtime_feedback
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bedside_fb_tenant ON bedside_realtime_feedback(tenant_id);
CREATE INDEX idx_bedside_fb_admission ON bedside_realtime_feedback(tenant_id, admission_id);
CREATE INDEX idx_bedside_fb_time ON bedside_realtime_feedback(tenant_id, submitted_at DESC);
