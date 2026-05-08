-- ════════════════════════════════════════════════════════════════
--  0107_ipd_discharge_tat_logs.sql — discharge TAT tracking
-- ════════════════════════════════════════════════════════════════
--
-- The `care_view.rs` route LEFT JOINs `ipd_discharge_tat_logs` to
-- show discharge-process timing per admission. The table was
-- referenced in code but never created — runtime threw
-- `relation "ipd_discharge_tat_logs" does not exist`.
--
-- Captures NABH indicator 65 (Average Discharge Time) data:
--   discharge_ordered_at → discharge_initiated_at → patient_released_at
--
-- One row per admission, written when discharge begins.

CREATE TABLE IF NOT EXISTS ipd_discharge_tat_logs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    admission_id             UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    discharge_ordered_at     TIMESTAMPTZ,
    discharge_initiated_at   TIMESTAMPTZ,
    bill_finalized_at        TIMESTAMPTZ,
    pharmacy_cleared_at      TIMESTAMPTZ,
    discharge_summary_signed_at TIMESTAMPTZ,
    patient_released_at      TIMESTAMPTZ,
    total_minutes            INT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (admission_id)
);

ALTER TABLE ipd_discharge_tat_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_discharge_tat_logs_tenant ON ipd_discharge_tat_logs;
CREATE POLICY ipd_discharge_tat_logs_tenant ON ipd_discharge_tat_logs
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_discharge_tat_admission
    ON ipd_discharge_tat_logs (admission_id);
CREATE INDEX IF NOT EXISTS idx_ipd_discharge_tat_initiated
    ON ipd_discharge_tat_logs (discharge_initiated_at)
    WHERE discharge_initiated_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ipd_discharge_tat_updated_at ON ipd_discharge_tat_logs;
CREATE TRIGGER trg_ipd_discharge_tat_updated_at
    BEFORE UPDATE ON ipd_discharge_tat_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
