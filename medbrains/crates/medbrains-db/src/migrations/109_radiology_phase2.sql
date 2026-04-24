-- 109_radiology_phase2.sql — PACS/DICOM integration, share links, AERB dosimetry

-- ══════════════════════════════════════════════════════════
--  DICOM Study Metadata (synced from PACS / Orthanc)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radiology_dicom_studies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    order_id        UUID REFERENCES radiology_orders(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    study_instance_uid TEXT NOT NULL,
    accession_number   TEXT,
    modality        TEXT NOT NULL,
    study_date      DATE,
    study_description  TEXT,
    referring_physician TEXT,
    instance_count  INTEGER NOT NULL DEFAULT 0,
    series_count    INTEGER NOT NULL DEFAULT 0,
    orthanc_id      TEXT,
    pacs_url        TEXT,
    viewer_url      TEXT,
    file_size_bytes BIGINT,
    dicom_metadata  JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, study_instance_uid)
);

ALTER TABLE radiology_dicom_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY radiology_dicom_studies_tenant ON radiology_dicom_studies
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_dicom_studies_patient ON radiology_dicom_studies(patient_id, study_date DESC);
CREATE INDEX idx_dicom_studies_order ON radiology_dicom_studies(order_id);

CREATE TRIGGER trg_dicom_studies_updated_at BEFORE UPDATE ON radiology_dicom_studies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  Shareable Viewer Links
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radiology_share_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    study_id        UUID NOT NULL REFERENCES radiology_dicom_studies(id),
    token           TEXT NOT NULL UNIQUE,
    recipient_name  TEXT,
    recipient_email TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    accessed_count  INTEGER NOT NULL DEFAULT 0,
    last_accessed   TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE radiology_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY radiology_share_links_tenant ON radiology_share_links
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_share_links_token ON radiology_share_links(token);
CREATE INDEX idx_share_links_study ON radiology_share_links(study_id);

-- ══════════════════════════════════════════════════════════
--  AERB Personnel Dosimetry Records
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radiology_dosimetry_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    staff_id        UUID NOT NULL REFERENCES users(id),
    badge_number    TEXT NOT NULL,
    monitoring_period_start DATE NOT NULL,
    monitoring_period_end   DATE NOT NULL,
    dose_value      NUMERIC(10,4) NOT NULL,
    dose_unit       TEXT NOT NULL DEFAULT 'mSv',
    annual_limit    NUMERIC(10,4) NOT NULL DEFAULT 20.0,
    is_compliant    BOOLEAN NOT NULL DEFAULT true,
    exceeded_action TEXT,
    notes           TEXT,
    recorded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE radiology_dosimetry_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY radiology_dosimetry_records_tenant ON radiology_dosimetry_records
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_dosimetry_staff ON radiology_dosimetry_records(staff_id, monitoring_period_end DESC);

CREATE TRIGGER trg_dosimetry_updated_at BEFORE UPDATE ON radiology_dosimetry_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  Link orders to PACS
-- ══════════════════════════════════════════════════════════

ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS pacs_study_uid TEXT;
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS orthanc_id TEXT;
