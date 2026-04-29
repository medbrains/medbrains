-- ====================================================================
-- Migration: 137_nurse_activities.sql
-- RLS-Posture: tenant-scoped
-- New-Tables: nurse_profiles, nurse_shift_assignments,
--             medication_administration_records,
--             vitals_capture_schedules, intake_output_entries,
--             restraint_monitoring_events, pain_score_entries,
--             wound_assessments, fall_risk_assessments,
--             shift_handoffs, code_blue_events,
--             equipment_checks
-- ====================================================================
-- Per RFCs/sprints/SPRINT-nurse-activities.md.
-- Bedside nursing workflows: MAR, vitals scheduling, I-O,
-- restraints, pain, wound, fall, handoff (SBAR), code blue.
-- ====================================================================

-- ── 1. nurse_profiles ───────────────────────────────────────────────

CREATE TABLE nurse_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_number  TEXT,
    specialty       TEXT,
    shift_pattern   TEXT,                              -- day | night | rotating
    employment_type TEXT,                              -- full_time | contract | locum
    is_charge_nurse BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);

CREATE TRIGGER nurse_profiles_updated
    BEFORE UPDATE ON nurse_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE nurse_profiles FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('nurse_profiles');

-- ── 2. nurse_shift_assignments ──────────────────────────────────────

CREATE TABLE nurse_shift_assignments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nurse_user_id           UUID NOT NULL REFERENCES users(id),
    ward_id                 UUID,
    shift_date              DATE NOT NULL,
    shift_type              TEXT NOT NULL CHECK (shift_type IN ('day', 'evening', 'night')),
    patient_ids             UUID[] NOT NULL DEFAULT '{}',
    primary_assigned        BOOLEAN NOT NULL DEFAULT TRUE,
    charge_nurse_user_id    UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nurse_shift_assignments_today_idx
    ON nurse_shift_assignments (tenant_id, nurse_user_id, shift_date DESC);

ALTER TABLE nurse_shift_assignments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('nurse_shift_assignments');

-- ── 3. medication_administration_records (MAR) ─────────────────────

CREATE TABLE medication_administration_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prescription_id         UUID NOT NULL,
    patient_id              UUID NOT NULL,
    encounter_id            UUID,
    scheduled_at            TIMESTAMPTZ NOT NULL,
    administered_at         TIMESTAMPTZ,
    administered_by         UUID REFERENCES users(id),
    dose_index              INT NOT NULL DEFAULT 1,
    status                  TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'administered', 'held', 'refused', 'missed')),
    dose_administered       TEXT,
    route                   TEXT,
    hold_reason             TEXT,
    refusal_reason          TEXT,
    wristband_scan_at       TIMESTAMPTZ,
    drug_scan_at            TIMESTAMPTZ,
    witness_user_id         UUID REFERENCES users(id),
    is_prn                  BOOLEAN NOT NULL DEFAULT FALSE,
    prn_indication          TEXT,
    prn_requested_at        TIMESTAMPTZ,
    signed_record_id        UUID,
    late_minutes            INT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mar_pending_due_idx
    ON medication_administration_records (tenant_id, scheduled_at)
    WHERE status = 'pending';
CREATE INDEX mar_patient_recent_idx
    ON medication_administration_records (tenant_id, patient_id, scheduled_at DESC);
CREATE INDEX mar_administrator_idx
    ON medication_administration_records (tenant_id, administered_by, administered_at DESC)
    WHERE administered_by IS NOT NULL;

CREATE TRIGGER mar_updated
    BEFORE UPDATE ON medication_administration_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE medication_administration_records FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('medication_administration_records');

-- ── 4. vitals_capture_schedules ────────────────────────────────────

CREATE TABLE vitals_capture_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id        UUID NOT NULL,
    frequency_minutes   INT NOT NULL CHECK (frequency_minutes BETWEEN 15 AND 1440),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    next_due_at         TIMESTAMPTZ NOT NULL,
    last_captured_at    TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vitals_schedule_due_idx
    ON vitals_capture_schedules (tenant_id, next_due_at)
    WHERE ended_at IS NULL;

ALTER TABLE vitals_capture_schedules FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('vitals_capture_schedules');

-- ── 5. intake_output_entries ────────────────────────────────────────

CREATE TABLE intake_output_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id    UUID NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by     UUID NOT NULL REFERENCES users(id),
    category        TEXT NOT NULL CHECK (category IN (
        'oral', 'iv', 'tube', 'blood', 'tpn',
        'urine', 'stool', 'emesis', 'drain', 'other'
    )),
    direction       TEXT NOT NULL CHECK (direction IN ('intake', 'output')),
    volume_ml       INT NOT NULL CHECK (volume_ml > 0),
    notes           TEXT
);
CREATE INDEX io_entries_encounter_idx
    ON intake_output_entries (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE intake_output_entries FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('intake_output_entries');

-- ── 6. restraint_monitoring_events ─────────────────────────────────

CREATE TABLE restraint_monitoring_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    restraint_order_id      UUID NOT NULL,
    encounter_id            UUID NOT NULL,
    monitored_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    monitored_by            UUID NOT NULL REFERENCES users(id),
    skin_intact             BOOLEAN NOT NULL,
    circulation_normal      BOOLEAN NOT NULL,
    distress_observed       BOOLEAN NOT NULL DEFAULT FALSE,
    continue_restraint      BOOLEAN NOT NULL,
    witness_user_id         UUID REFERENCES users(id),
    notes                   TEXT
);
CREATE INDEX restraint_monitoring_idx
    ON restraint_monitoring_events (tenant_id, restraint_order_id, monitored_at DESC);

ALTER TABLE restraint_monitoring_events FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('restraint_monitoring_events');

-- ── 7. pain_score_entries ──────────────────────────────────────────

CREATE TABLE pain_score_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id        UUID NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by         UUID NOT NULL REFERENCES users(id),
    scale               TEXT NOT NULL CHECK (scale IN (
        'numeric', 'wong_baker', 'flacc', 'bps', 'cpot', 'comfort'
    )),
    score               INT NOT NULL CHECK (score >= 0 AND score <= 30),
    location            TEXT,
    character           TEXT,
    intervention_taken  TEXT,
    recheck_due_at      TIMESTAMPTZ,
    notes               TEXT
);
CREATE INDEX pain_score_encounter_idx
    ON pain_score_entries (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE pain_score_entries FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pain_score_entries');

-- ── 8. wound_assessments ───────────────────────────────────────────

CREATE TABLE wound_assessments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id                UUID NOT NULL,
    body_site                   TEXT NOT NULL,
    classification              TEXT,                  -- pressure | surgical | trauma | burn
    stage                       TEXT,                  -- 1-4 + unstageable + DTI for pressure
    length_cm                   NUMERIC(6,2),
    width_cm                    NUMERIC(6,2),
    depth_cm                    NUMERIC(6,2),
    exudate                     TEXT,
    odor                        TEXT,
    photo_urls                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    dressing_type               TEXT,
    dressing_changed_at         TIMESTAMPTZ,
    dressing_change_due_at      TIMESTAMPTZ,
    recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by                 UUID NOT NULL REFERENCES users(id),
    notes                       TEXT
);
CREATE INDEX wound_assessments_encounter_idx
    ON wound_assessments (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE wound_assessments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('wound_assessments');

-- ── 9. fall_risk_assessments ───────────────────────────────────────

CREATE TABLE fall_risk_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id    UUID NOT NULL,
    scale           TEXT NOT NULL CHECK (scale IN ('morse', 'hendrich', 'stratify')),
    score           INT NOT NULL CHECK (score >= 0),
    risk_level      TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    interventions   JSONB NOT NULL DEFAULT '[]'::jsonb,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by     UUID NOT NULL REFERENCES users(id)
);
CREATE INDEX fall_risk_encounter_idx
    ON fall_risk_assessments (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE fall_risk_assessments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('fall_risk_assessments');

-- ── 10. shift_handoffs (SBAR) ──────────────────────────────────────

CREATE TABLE shift_handoffs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id            UUID NOT NULL,
    outgoing_nurse_id       UUID NOT NULL REFERENCES users(id),
    incoming_nurse_id       UUID NOT NULL REFERENCES users(id),
    outgoing_signed_at      TIMESTAMPTZ,
    incoming_signed_at      TIMESTAMPTZ,
    situation               TEXT,
    background              TEXT,
    assessment              TEXT,
    recommendation          TEXT,
    alerts                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (outgoing_nurse_id <> incoming_nurse_id)
);
CREATE INDEX shift_handoffs_encounter_idx
    ON shift_handoffs (tenant_id, encounter_id, created_at DESC);

ALTER TABLE shift_handoffs FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('shift_handoffs');

-- ── 11. code_blue_events ───────────────────────────────────────────

CREATE TABLE code_blue_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL,
    encounter_id        UUID,
    location            TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    leader_user_id      UUID REFERENCES users(id),
    outcome             TEXT CHECK (outcome IN
        ('rosc', 'transferred', 'expired', 'stable')),
    recorder_user_id    UUID REFERENCES users(id),
    medications         JSONB NOT NULL DEFAULT '[]'::jsonb,
    shocks              JSONB NOT NULL DEFAULT '[]'::jsonb,
    ecg_rhythm_log      JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes               TEXT
);
CREATE INDEX code_blue_active_idx
    ON code_blue_events (tenant_id, started_at DESC)
    WHERE ended_at IS NULL;

ALTER TABLE code_blue_events FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('code_blue_events');

-- ── 12. equipment_checks ───────────────────────────────────────────

CREATE TABLE equipment_checks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id                 UUID,
    checklist_template_id       UUID,
    checked_by                  UUID NOT NULL REFERENCES users(id),
    checked_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    items                       JSONB NOT NULL DEFAULT '[]'::jsonb,
    all_passed                  BOOLEAN NOT NULL,
    next_check_due_at           TIMESTAMPTZ
);
CREATE INDEX equipment_checks_due_idx
    ON equipment_checks (tenant_id, next_check_due_at)
    WHERE next_check_due_at IS NOT NULL;

ALTER TABLE equipment_checks FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('equipment_checks');

-- ── Worker grants ───────────────────────────────────────────────────

GRANT SELECT ON nurse_profiles, nurse_shift_assignments,
                medication_administration_records,
                vitals_capture_schedules, intake_output_entries,
                restraint_monitoring_events, pain_score_entries,
                wound_assessments, fall_risk_assessments,
                shift_handoffs, code_blue_events, equipment_checks
                TO medbrains_outbox_worker;
