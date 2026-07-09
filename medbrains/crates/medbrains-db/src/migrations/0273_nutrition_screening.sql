-- MUST (Malnutrition Universal Screening Tool) nutritional screening. NABH requires every inpatient to
-- be screened for malnutrition risk at admission (within 24h), because malnutrition worsens outcomes,
-- delays healing and is easily missed. MUST sums three steps — BMI, unplanned weight loss, and an
-- acute-disease effect — into a 0-6 score banded low/medium/high, driving a dietitian referral. BMI and
-- the step scores are computed server-side from height/weight so the risk band can't be mis-added.

CREATE TABLE IF NOT EXISTS nutrition_screenings (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id               uuid NOT NULL,
    admission_id             uuid,
    height_cm                double precision NOT NULL,
    weight_kg                double precision NOT NULL,
    bmi                      double precision NOT NULL,
    -- Unplanned weight loss over 3-6 months, as a percentage of body weight.
    weight_loss_percent      double precision NOT NULL DEFAULT 0,
    -- Acutely ill AND no / likely no nutritional intake for > 5 days.
    acute_disease_no_intake  boolean NOT NULL DEFAULT false,
    bmi_score                integer NOT NULL,
    weight_loss_score        integer NOT NULL,
    acute_score              integer NOT NULL,
    total_score              integer NOT NULL,
    risk                     text NOT NULL,   -- low | medium | high
    notes                    text,
    assessed_by              uuid,
    created_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT nutrition_screening_risk_check CHECK (risk IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_nutrition_screening_patient
    ON nutrition_screenings (tenant_id, patient_id, created_at DESC);

ALTER TABLE nutrition_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_screenings_tenant_isolation ON nutrition_screenings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
