-- Home care referral from discharge (ticket #2966): at discharge, refer a patient to home-care
-- services (skilled nursing, wound care, physiotherapy, OT, speech) and track the referral through
-- acceptance / scheduling. Bridges discharge planning to the Home Care program. Tenant RLS.

CREATE TABLE IF NOT EXISTS home_care_referrals (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    uuid NOT NULL,
    referral_type text NOT NULL,
    reason        text,
    status        text NOT NULL DEFAULT 'pending',
    provider      text,
    referred_date date NOT NULL DEFAULT CURRENT_DATE,
    referred_by   uuid,
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_care_referral_type_check CHECK (referral_type = ANY (ARRAY[
        'nursing'::text, 'wound_care'::text, 'physiotherapy'::text, 'occupational'::text,
        'speech'::text, 'general'::text
    ])),
    CONSTRAINT home_care_referral_status_check CHECK (status = ANY (ARRAY[
        'pending'::text, 'accepted'::text, 'scheduled'::text, 'declined'::text, 'completed'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_care_referrals_patient
    ON home_care_referrals (tenant_id, patient_id, status);

ALTER TABLE home_care_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_care_referrals_tenant_isolation ON home_care_referrals
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_care_referrals_updated_at BEFORE UPDATE ON home_care_referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
