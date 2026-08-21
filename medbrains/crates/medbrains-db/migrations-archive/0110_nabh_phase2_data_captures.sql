-- ════════════════════════════════════════════════════════════════
--  0110_nabh_phase2_data_captures.sql
--  NABH 5th Edition Phase 2 — minimum data captures for the 27
--  indicators currently uncovered. Plan section 8 audit blocker.
--
--  Tables (NABH chapter ↔ indicator mapping in comments):
--    nabh_falls_register                — COP-12, IPSG-6
--    nabh_pressure_ulcer_assessments    — COP-11 (Braden score)
--    nabh_sentinel_event_register       — PSQ-3 / PSQ-6 (never events)
--    nabh_blood_transfusion_reactions   — MOM-7, IPSG-3
--    nabh_code_blue_activations         — AOP-9 (rapid response)
--    nabh_equipment_downtime_log        — HIC-7, FMS (BME)
--    nabh_fire_safety_drills            — FMS-2
--    nabh_bmw_disposal_log              — FMS-4 (BMW Rules 2016)
--
--  All tenant-scoped, RLS-policied, audit-triggered.
-- ════════════════════════════════════════════════════════════════

-- ── COP-12 / IPSG-6: Patient falls register ────────────────────

CREATE TABLE IF NOT EXISTS nabh_falls_register (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    patient_id               UUID NOT NULL REFERENCES patients(id),
    admission_id             UUID REFERENCES admissions(id) ON DELETE SET NULL,
    fall_at                  TIMESTAMPTZ NOT NULL,
    location                 TEXT NOT NULL,                  -- ward / bathroom / corridor / other
    location_detail          TEXT,                           -- bed number, room, etc.
    fall_type                TEXT NOT NULL,                  -- 'witnessed' | 'unwitnessed' | 'assisted'
    contributing_factors     TEXT[],                         -- wet floor, footwear, sedation, etc.
    risk_assessment_done     BOOLEAN DEFAULT false,
    risk_assessment_id       UUID,                           -- → fall_risk_assessments
    morse_score              INT,                            -- 0-125
    injury_level             TEXT NOT NULL,                  -- 'none' | 'minor' | 'moderate' | 'major' | 'death'
    injury_description       TEXT,
    immediate_action         TEXT,
    notified_physician       BOOLEAN DEFAULT false,
    notified_physician_at    TIMESTAMPTZ,
    notified_family          BOOLEAN DEFAULT false,
    notified_family_at       TIMESTAMPTZ,
    incident_id              UUID,                           -- → quality_incidents (sentinel link)
    rca_required             BOOLEAN DEFAULT false,
    rca_id                   UUID,                           -- → rca_reports
    reported_by              UUID NOT NULL,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_falls_register ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_falls_register_tenant ON nabh_falls_register;
CREATE POLICY nabh_falls_register_tenant ON nabh_falls_register
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_falls_patient
    ON nabh_falls_register (patient_id, fall_at DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_falls_tenant_period
    ON nabh_falls_register (tenant_id, fall_at);
CREATE INDEX IF NOT EXISTS idx_nabh_falls_open_rca
    ON nabh_falls_register (tenant_id)
    WHERE rca_required = true AND rca_id IS NULL;

DROP TRIGGER IF EXISTS trg_nabh_falls_updated_at ON nabh_falls_register;
CREATE TRIGGER trg_nabh_falls_updated_at
    BEFORE UPDATE ON nabh_falls_register
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── COP-11: Pressure ulcer (Braden) assessment + incidence ─────

CREATE TABLE IF NOT EXISTS nabh_pressure_ulcer_assessments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    patient_id               UUID NOT NULL REFERENCES patients(id),
    admission_id             UUID REFERENCES admissions(id) ON DELETE CASCADE,
    assessed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    assessed_by              UUID NOT NULL,
    -- Braden Scale subscores (each 1-4 except friction which is 1-3)
    sensory_perception       INT NOT NULL CHECK (sensory_perception BETWEEN 1 AND 4),
    moisture                 INT NOT NULL CHECK (moisture BETWEEN 1 AND 4),
    activity                 INT NOT NULL CHECK (activity BETWEEN 1 AND 4),
    mobility                 INT NOT NULL CHECK (mobility BETWEEN 1 AND 4),
    nutrition                INT NOT NULL CHECK (nutrition BETWEEN 1 AND 4),
    friction_shear           INT NOT NULL CHECK (friction_shear BETWEEN 1 AND 3),
    braden_total             INT GENERATED ALWAYS AS (
        sensory_perception + moisture + activity + mobility + nutrition + friction_shear
    ) STORED,
    risk_level               TEXT NOT NULL,                  -- 'no risk' | 'mild' | 'moderate' | 'high' | 'severe'
    -- If a pressure injury is observed at assessment
    injury_present           BOOLEAN DEFAULT false,
    injury_stage             TEXT,                           -- 'stage_1' .. 'stage_4' | 'unstageable' | 'deep_tissue'
    injury_location          TEXT,                           -- sacrum, heel, etc.
    injury_acquired          TEXT,                           -- 'present_on_admission' | 'hospital_acquired'
    injury_description       TEXT,
    -- Prevention bundle
    repositioning_plan       TEXT,
    nutritional_plan         TEXT,
    skin_care_plan           TEXT,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_pressure_ulcer_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_pressure_ulcer_tenant ON nabh_pressure_ulcer_assessments;
CREATE POLICY nabh_pressure_ulcer_tenant ON nabh_pressure_ulcer_assessments
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_pu_patient
    ON nabh_pressure_ulcer_assessments (patient_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_pu_hospital_acquired
    ON nabh_pressure_ulcer_assessments (tenant_id, assessed_at)
    WHERE injury_present = true AND injury_acquired = 'hospital_acquired';

DROP TRIGGER IF EXISTS trg_nabh_pu_updated_at ON nabh_pressure_ulcer_assessments;
CREATE TRIGGER trg_nabh_pu_updated_at
    BEFORE UPDATE ON nabh_pressure_ulcer_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── PSQ-6: Sentinel events / never events register ─────────────

CREATE TABLE IF NOT EXISTS nabh_sentinel_event_register (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    event_at                 TIMESTAMPTZ NOT NULL,
    -- 28 NQF "Never Events" + JCI Sentinel categories
    event_category           TEXT NOT NULL,                  -- 'wrong_site_surgery' | 'retained_foreign_object' | 'medication_error' | 'patient_suicide' | etc.
    event_subtype            TEXT,
    severity                 TEXT NOT NULL,                  -- 'death' | 'permanent_harm' | 'temporary_harm' | 'no_harm_near_miss'
    patient_id               UUID REFERENCES patients(id),
    admission_id             UUID REFERENCES admissions(id) ON DELETE SET NULL,
    location                 TEXT,
    description              TEXT NOT NULL,
    immediate_actions        TEXT,
    -- Reportability
    reportable_to_authority  BOOLEAN DEFAULT false,
    reported_to_authority_at TIMESTAMPTZ,
    authority_reference      TEXT,                           -- DCG&I / state DPH / NABH ref
    reportable_to_nqf        BOOLEAN DEFAULT false,
    -- RCA + CAPA linkage (required <72h per NABH)
    rca_required             BOOLEAN DEFAULT true,
    rca_id                   UUID,                           -- → rca_reports
    rca_due_at               TIMESTAMPTZ,
    rca_completed_at         TIMESTAMPTZ,
    capa_id                  UUID,                           -- → quality_capa
    -- Follow-up
    review_status            TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'investigating' | 'closed'
    closed_at                TIMESTAMPTZ,
    reported_by              UUID NOT NULL,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_sentinel_event_register ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_sentinel_tenant ON nabh_sentinel_event_register;
CREATE POLICY nabh_sentinel_tenant ON nabh_sentinel_event_register
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_sentinel_open
    ON nabh_sentinel_event_register (tenant_id, event_at DESC)
    WHERE review_status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_nabh_sentinel_rca_due
    ON nabh_sentinel_event_register (rca_due_at)
    WHERE rca_required = true AND rca_completed_at IS NULL;

DROP TRIGGER IF EXISTS trg_nabh_sentinel_updated_at ON nabh_sentinel_event_register;
CREATE TRIGGER trg_nabh_sentinel_updated_at
    BEFORE UPDATE ON nabh_sentinel_event_register
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── MOM-7 / IPSG-3: Blood transfusion reactions ────────────────

CREATE TABLE IF NOT EXISTS nabh_blood_transfusion_reactions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    patient_id               UUID NOT NULL REFERENCES patients(id),
    admission_id             UUID REFERENCES admissions(id) ON DELETE SET NULL,
    transfusion_id           UUID,                           -- → blood_transfusion_log
    blood_unit_id            UUID,                           -- → blood_units
    component_type           TEXT,                           -- 'whole_blood' | 'prbc' | 'platelets' | 'ffp' | 'cryoprecipitate'
    -- Reaction
    reaction_at              TIMESTAMPTZ NOT NULL,
    onset_minutes            INT,                            -- minutes from transfusion start
    reaction_type            TEXT NOT NULL,                  -- 'febrile_non_hemolytic' | 'allergic' | 'anaphylaxis' | 'acute_hemolytic' | 'delayed_hemolytic' | 'trali' | 'taco' | 'sepsis' | 'gvhd' | 'other'
    severity                 TEXT NOT NULL,                  -- 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'death'
    symptoms                 TEXT[],                         -- fever, rigors, dyspnea, etc.
    vitals_at_reaction       JSONB,                          -- bp/hr/temp/rr/spo2 snapshot
    -- Management
    transfusion_stopped_at   TIMESTAMPTZ,
    management               TEXT,
    outcome                  TEXT,                           -- 'recovered' | 'recovered_with_sequelae' | 'death' | 'ongoing'
    -- Reporting (Hemovigilance Programme of India / NACO)
    reported_to_blood_bank   BOOLEAN DEFAULT false,
    reported_to_blood_bank_at TIMESTAMPTZ,
    haemovigilance_ref       TEXT,
    cdsco_reported_at        TIMESTAMPTZ,
    -- Investigation
    sample_sent_for_workup   BOOLEAN DEFAULT false,
    investigation_findings   TEXT,
    reported_by              UUID NOT NULL,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_blood_transfusion_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_btr_tenant ON nabh_blood_transfusion_reactions;
CREATE POLICY nabh_btr_tenant ON nabh_blood_transfusion_reactions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_btr_patient
    ON nabh_blood_transfusion_reactions (patient_id, reaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_btr_pending_report
    ON nabh_blood_transfusion_reactions (tenant_id)
    WHERE reported_to_blood_bank = false;

DROP TRIGGER IF EXISTS trg_nabh_btr_updated_at ON nabh_blood_transfusion_reactions;
CREATE TRIGGER trg_nabh_btr_updated_at
    BEFORE UPDATE ON nabh_blood_transfusion_reactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AOP-9: Code Blue / rapid response activations ─────────────

CREATE TABLE IF NOT EXISTS nabh_code_blue_activations (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    activated_at             TIMESTAMPTZ NOT NULL,
    activated_by             UUID NOT NULL,
    location                 TEXT NOT NULL,
    location_detail          TEXT,
    patient_id               UUID REFERENCES patients(id),
    admission_id             UUID REFERENCES admissions(id) ON DELETE SET NULL,
    -- Response timing
    team_arrived_at          TIMESTAMPTZ,
    response_seconds         INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (team_arrived_at - activated_at))::INT
    ) STORED,
    -- Cause and event
    reason                   TEXT NOT NULL,                  -- 'cardiac_arrest' | 'respiratory_arrest' | 'altered_consciousness' | 'severe_hypotension' | etc.
    initial_rhythm           TEXT,                           -- 'vfib' | 'vtach_pulseless' | 'asystole' | 'pea' | 'other'
    cpr_started_at           TIMESTAMPTZ,
    cpr_duration_minutes     INT,
    defibrillation_count     INT DEFAULT 0,
    drugs_administered       JSONB,                          -- [{drug, dose, time}]
    -- Outcome
    rosc_achieved            BOOLEAN,                        -- return of spontaneous circulation
    rosc_at                  TIMESTAMPTZ,
    outcome                  TEXT NOT NULL,                  -- 'survived_intact' | 'survived_with_disability' | 'death_at_event' | 'death_within_24h' | 'transferred_icu'
    transferred_to           TEXT,
    -- Quality review
    debrief_completed        BOOLEAN DEFAULT false,
    debrief_at               TIMESTAMPTZ,
    learning_points          TEXT,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_code_blue_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_code_blue_tenant ON nabh_code_blue_activations;
CREATE POLICY nabh_code_blue_tenant ON nabh_code_blue_activations
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_code_blue_period
    ON nabh_code_blue_activations (tenant_id, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_code_blue_pending_debrief
    ON nabh_code_blue_activations (tenant_id)
    WHERE debrief_completed = false;

DROP TRIGGER IF EXISTS trg_nabh_code_blue_updated_at ON nabh_code_blue_activations;
CREATE TRIGGER trg_nabh_code_blue_updated_at
    BEFORE UPDATE ON nabh_code_blue_activations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── HIC-7 / FMS: Equipment downtime log (BME) ──────────────────

CREATE TABLE IF NOT EXISTS nabh_equipment_downtime_log (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    equipment_id             UUID,                           -- → equipment master (when present)
    equipment_name           TEXT NOT NULL,
    equipment_serial         TEXT,
    equipment_category       TEXT,                           -- 'imaging' | 'lab_analyzer' | 'sterilizer' | 'ventilator' | 'monitor' | 'other'
    location                 TEXT,
    downtime_start           TIMESTAMPTZ NOT NULL,
    downtime_end             TIMESTAMPTZ,
    downtime_minutes         INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (downtime_end - downtime_start))::INT / 60
    ) STORED,
    reason                   TEXT NOT NULL,                  -- 'breakdown' | 'preventive_maintenance' | 'calibration' | 'qa_failure' | 'parts_unavailable'
    impact_level             TEXT NOT NULL,                  -- 'low' | 'medium' | 'high' | 'critical'
    impact_summary           TEXT,                           -- procedures cancelled, patients affected, etc.
    -- Resolution
    reported_to_bme          BOOLEAN DEFAULT false,
    reported_to_bme_at       TIMESTAMPTZ,
    workorder_ref            TEXT,
    vendor_engaged           BOOLEAN DEFAULT false,
    vendor_arrived_at        TIMESTAMPTZ,
    resolved_by              UUID,
    resolution_summary       TEXT,
    parts_replaced           TEXT,
    cost                     NUMERIC(12, 2),
    -- QA after resolution
    qa_passed_at             TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_equipment_downtime_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_eq_downtime_tenant ON nabh_equipment_downtime_log;
CREATE POLICY nabh_eq_downtime_tenant ON nabh_equipment_downtime_log
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_eq_downtime_period
    ON nabh_equipment_downtime_log (tenant_id, downtime_start DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_eq_downtime_open
    ON nabh_equipment_downtime_log (tenant_id, equipment_name)
    WHERE downtime_end IS NULL;

DROP TRIGGER IF EXISTS trg_nabh_eq_downtime_updated_at ON nabh_equipment_downtime_log;
CREATE TRIGGER trg_nabh_eq_downtime_updated_at
    BEFORE UPDATE ON nabh_equipment_downtime_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FMS-2: Fire safety drills ──────────────────────────────────

CREATE TABLE IF NOT EXISTS nabh_fire_safety_drills (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    drill_at                 TIMESTAMPTZ NOT NULL,
    drill_type               TEXT NOT NULL,                  -- 'announced' | 'unannounced' | 'tabletop' | 'live'
    location                 TEXT NOT NULL,
    scenario                 TEXT,                           -- mock fire description
    -- Participation
    participants_count       INT,
    participating_departments TEXT[],
    incident_commander       UUID,
    -- Timing metrics
    alarm_at                 TIMESTAMPTZ,
    evacuation_started_at    TIMESTAMPTZ,
    evacuation_completed_at  TIMESTAMPTZ,
    evacuation_seconds       INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (evacuation_completed_at - evacuation_started_at))::INT
    ) STORED,
    fire_brigade_arrived_at  TIMESTAMPTZ,
    -- Findings
    issues_observed          TEXT[],
    corrective_actions       TEXT,
    corrective_action_owner  UUID,
    corrective_action_due    DATE,
    corrective_actions_done  BOOLEAN DEFAULT false,
    -- Compliance proof
    photo_urls               TEXT[],
    report_url               TEXT,                           -- PDF/A signed report
    conducted_by             UUID NOT NULL,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_fire_safety_drills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_fire_drills_tenant ON nabh_fire_safety_drills;
CREATE POLICY nabh_fire_drills_tenant ON nabh_fire_safety_drills
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_fire_drills_period
    ON nabh_fire_safety_drills (tenant_id, drill_at DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_fire_drills_open_capa
    ON nabh_fire_safety_drills (corrective_action_due)
    WHERE corrective_actions_done = false;

DROP TRIGGER IF EXISTS trg_nabh_fire_drills_updated_at ON nabh_fire_safety_drills;
CREATE TRIGGER trg_nabh_fire_drills_updated_at
    BEFORE UPDATE ON nabh_fire_safety_drills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FMS-4 / BMW Rules 2016: Biomedical waste disposal log ──────

CREATE TABLE IF NOT EXISTS nabh_bmw_disposal_log (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    disposal_date            DATE NOT NULL,
    -- BMW Rules 2016 colour-coded categories
    waste_category           TEXT NOT NULL,                  -- 'yellow' | 'red' | 'blue' | 'white' | 'black' (general)
    waste_subtype            TEXT,                           -- yellow.human_anatomical / red.contaminated_recyclable / blue.glassware / white.sharps
    quantity_kg              NUMERIC(10, 3) NOT NULL,
    source_department        TEXT,
    -- 2024 amendment: barcoded bag tracking
    bag_count                INT,
    barcode_refs             TEXT[],
    -- Storage / handover
    stored_at                TIMESTAMPTZ NOT NULL,
    handed_over_at           TIMESTAMPTZ NOT NULL,
    storage_hours            INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (handed_over_at - stored_at))::INT / 3600
    ) STORED,                                                -- BMW rules: max 48h
    -- Disposal
    disposal_agency          TEXT NOT NULL,
    disposal_agency_licence  TEXT,
    disposal_method          TEXT NOT NULL,                  -- 'incineration' | 'autoclave' | 'microwave' | 'deep_burial' | 'sanitary_landfill' | 'plasma_pyrolysis'
    disposal_certificate_url TEXT,
    cpcb_quarterly_ref       TEXT,                           -- CPCB return reference
    -- Sign-off
    handed_over_by           UUID NOT NULL,
    received_by_agency       TEXT,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nabh_bmw_disposal_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nabh_bmw_disposal_tenant ON nabh_bmw_disposal_log;
CREATE POLICY nabh_bmw_disposal_tenant ON nabh_bmw_disposal_log
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_nabh_bmw_period
    ON nabh_bmw_disposal_log (tenant_id, disposal_date DESC);
CREATE INDEX IF NOT EXISTS idx_nabh_bmw_category
    ON nabh_bmw_disposal_log (tenant_id, waste_category, disposal_date);
-- Surface 48-hour storage breaches via app query (no time-based predicate
-- in index — postgres index predicates must be IMMUTABLE).

DROP TRIGGER IF EXISTS trg_nabh_bmw_updated_at ON nabh_bmw_disposal_log;
CREATE TRIGGER trg_nabh_bmw_updated_at
    BEFORE UPDATE ON nabh_bmw_disposal_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════
--  End of 0110_nabh_phase2_data_captures.sql
-- ════════════════════════════════════════════════════════════════
