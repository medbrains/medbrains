-- ════════════════════════════════════════════════════════════════
--  0108_ipd_discharge_workflows.sql — post-discharge real-life flow
-- ════════════════════════════════════════════════════════════════
--
-- IPD today ends with a Discharge Summary doc and a Discharge TAT log.
-- Real hospitals have many touchpoints AFTER that: bill close, take-home
-- meds dispense, counseling, discharge card print, bed release event,
-- DAMA refusal flow, mortality review queue, post-discharge survey,
-- readmission tracking. Track 1A.bis.4 of master plan.
--
-- This migration adds 4 tables. Backend handlers + UI come in follow-ups.

-- ── Discharge workflow checklist ────────────────────────────────

CREATE TABLE IF NOT EXISTS ipd_discharge_workflows (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    admission_id             UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    -- Step completion timestamps. NULL until the step is checked off.
    discharge_ordered_at     TIMESTAMPTZ,
    bill_closed_at           TIMESTAMPTZ,
    bill_closed_by           UUID,
    rx_dispensed_at          TIMESTAMPTZ,
    rx_dispensed_by          UUID,
    counseling_done_at       TIMESTAMPTZ,
    counseling_done_by       UUID,
    counseling_topics        TEXT[],
    card_printed_at          TIMESTAMPTZ,
    card_printed_by          UUID,
    bed_released_at          TIMESTAMPTZ,
    bed_released_by          UUID,
    transport_arranged       BOOLEAN DEFAULT false,
    transport_notes          TEXT,
    follow_up_appt_id        UUID,
    -- Final step
    completed_at             TIMESTAMPTZ,
    completed_by             UUID,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (admission_id)
);

ALTER TABLE ipd_discharge_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_discharge_workflows_tenant ON ipd_discharge_workflows;
CREATE POLICY ipd_discharge_workflows_tenant ON ipd_discharge_workflows
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_discharge_workflows_admission
    ON ipd_discharge_workflows (admission_id);
CREATE INDEX IF NOT EXISTS idx_ipd_discharge_workflows_open
    ON ipd_discharge_workflows (tenant_id, discharge_ordered_at)
    WHERE completed_at IS NULL;

DROP TRIGGER IF EXISTS trg_ipd_discharge_workflows_updated_at ON ipd_discharge_workflows;
CREATE TRIGGER trg_ipd_discharge_workflows_updated_at
    BEFORE UPDATE ON ipd_discharge_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DAMA / LAMA records (Discharge / Leave Against Medical Advice) ──

CREATE TABLE IF NOT EXISTS ipd_dama_records (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    admission_id             UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    -- 'dama' (formal discharge against advice) vs 'lama' (left without
    -- formal discharge — i.e. absconded then signed). Different forms,
    -- same table because the data captured is identical.
    record_type              TEXT NOT NULL CHECK (record_type IN ('dama', 'lama')),
    declared_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    declared_by              UUID,                    -- attending physician
    patient_signed           BOOLEAN DEFAULT false,
    patient_signature_url    TEXT,                    -- PDF e-sig artifact
    relative_name            TEXT,
    relative_relation        TEXT,
    relative_signed          BOOLEAN DEFAULT false,
    relative_signature_url   TEXT,
    witness_name             TEXT,
    witness_signed           BOOLEAN DEFAULT false,
    witness_signature_url    TEXT,
    risks_explained          TEXT,                    -- free-text or list of code refs
    reason_for_leaving       TEXT,
    is_mlc_case              BOOLEAN DEFAULT false,
    mlc_notification_sent_at TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ipd_dama_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_dama_records_tenant ON ipd_dama_records;
CREATE POLICY ipd_dama_records_tenant ON ipd_dama_records
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_dama_admission
    ON ipd_dama_records (admission_id);

DROP TRIGGER IF EXISTS trg_ipd_dama_updated_at ON ipd_dama_records;
CREATE TRIGGER trg_ipd_dama_updated_at
    BEFORE UPDATE ON ipd_dama_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Post-discharge follow-up tracking ───────────────────────────

CREATE TABLE IF NOT EXISTS ipd_post_discharge_followups (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    admission_id             UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    patient_id               UUID NOT NULL REFERENCES patients(id),
    -- Survey
    survey_sent_at           TIMESTAMPTZ,
    survey_sent_via          TEXT,           -- 'sms' | 'email' | 'whatsapp' | 'paper'
    survey_responded_at      TIMESTAMPTZ,
    survey_score             INT,            -- e.g. NPS 0-10
    survey_comments          TEXT,
    -- Follow-up appointment
    followup_appt_id         UUID,
    followup_due_date        DATE,
    followup_attended        BOOLEAN,
    -- 30-day readmission watch — populated by daily cron
    readmitted_within_30d    BOOLEAN DEFAULT false,
    readmission_admission_id UUID REFERENCES admissions(id),
    readmission_reason       TEXT,
    -- Free-form notes for case manager
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (admission_id)
);

ALTER TABLE ipd_post_discharge_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_post_discharge_followups_tenant ON ipd_post_discharge_followups;
CREATE POLICY ipd_post_discharge_followups_tenant ON ipd_post_discharge_followups
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_post_discharge_patient
    ON ipd_post_discharge_followups (patient_id);
CREATE INDEX IF NOT EXISTS idx_ipd_post_discharge_due
    ON ipd_post_discharge_followups (followup_due_date)
    WHERE followup_due_date IS NOT NULL AND followup_attended IS NULL;

DROP TRIGGER IF EXISTS trg_ipd_post_discharge_updated_at ON ipd_post_discharge_followups;
CREATE TRIGGER trg_ipd_post_discharge_updated_at
    BEFORE UPDATE ON ipd_post_discharge_followups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Mortality / M&M review queue ────────────────────────────────

CREATE TABLE IF NOT EXISTS ipd_mortality_reviews (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    admission_id             UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    death_at                 TIMESTAMPTZ NOT NULL,
    cause_of_death           TEXT,                  -- ICD-10 root code allowed
    primary_dx               TEXT,
    is_mlc_case              BOOLEAN DEFAULT false,
    autopsy_required         BOOLEAN DEFAULT false,
    autopsy_done_at          TIMESTAMPTZ,
    -- M&M conference review (mandatory <72h per NABH)
    review_due_at            TIMESTAMPTZ NOT NULL,
    reviewed_at              TIMESTAMPTZ,
    reviewer_id              UUID,
    review_findings          TEXT,
    avoidable               BOOLEAN,                -- conference-determined
    contributory_factors     TEXT[],
    action_items             TEXT,
    -- Death summary doc / Form 4/4A
    death_summary_signed_at  TIMESTAMPTZ,
    civil_form_filed_at      TIMESTAMPTZ,           -- Form 4 (medical) / 4A (cause of death)
    body_released_at         TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (admission_id)
);

ALTER TABLE ipd_mortality_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ipd_mortality_reviews_tenant ON ipd_mortality_reviews;
CREATE POLICY ipd_mortality_reviews_tenant ON ipd_mortality_reviews
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ipd_mortality_review_due
    ON ipd_mortality_reviews (review_due_at)
    WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ipd_mortality_admission
    ON ipd_mortality_reviews (admission_id);

DROP TRIGGER IF EXISTS trg_ipd_mortality_updated_at ON ipd_mortality_reviews;
CREATE TRIGGER trg_ipd_mortality_updated_at
    BEFORE UPDATE ON ipd_mortality_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
