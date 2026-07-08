-- Handwritten case-sheet digitization (RFC-CASE-SHEET-DIGITIZATION). Scanned paper case sheets
-- are uploaded, parsed by an async on-prem MinerU+VLM worker into a structured, per-field draft
-- with confidence, then doctor-reviewed and committed to the EMR. This is the B2 ingestion
-- record; the worker polls status='parsing' and posts results back. Tenant RLS.

CREATE TABLE IF NOT EXISTS case_sheet_scans (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         uuid NOT NULL,
    encounter_id       uuid,
    scan_image_url     text NOT NULL,          -- S3 object key from the presign upload
    status             text NOT NULL DEFAULT 'uploaded',
    extracted_json     jsonb,                  -- [{ field, value, confidence, region_bbox }]
    overall_confidence numeric(5,2),
    parse_error        text,
    uploaded_by        uuid,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT case_sheet_scans_status_check CHECK (status = ANY (ARRAY[
        'uploaded'::text, 'parsing'::text, 'parsed'::text, 'reviewing'::text,
        'committed'::text, 'failed'::text, 'image_only'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_case_sheet_scans_status ON case_sheet_scans (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_case_sheet_scans_patient ON case_sheet_scans (tenant_id, patient_id);

ALTER TABLE case_sheet_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_sheet_scans_tenant_isolation ON case_sheet_scans
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER case_sheet_scans_updated_at BEFORE UPDATE ON case_sheet_scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
