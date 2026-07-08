-- Blinded/unblinded randomization (ticket #2988): a patient's treatment-arm assignment. The arm
-- is stored but concealed — the list endpoint only returns it once the record is unblinded (for a
-- documented reason). The randomization/IWRS algorithm is external; this stores + guards the arm.
-- Tenant RLS.

CREATE TABLE IF NOT EXISTS trial_randomizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trial_id            uuid NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    patient_id          uuid NOT NULL,
    arm                 text NOT NULL,
    randomization_code  text,
    is_unblinded        boolean NOT NULL DEFAULT false,
    unblinded_by        uuid,
    unblinded_at        timestamptz,
    unblind_reason      text,
    randomized_by       uuid,
    randomized_at       timestamptz NOT NULL DEFAULT now(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trial_randomization_unique UNIQUE (tenant_id, trial_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_trial_randomizations_trial
    ON trial_randomizations (tenant_id, trial_id, randomized_at DESC);

ALTER TABLE trial_randomizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_randomizations_tenant_isolation ON trial_randomizations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER trial_randomizations_updated_at BEFORE UPDATE ON trial_randomizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
