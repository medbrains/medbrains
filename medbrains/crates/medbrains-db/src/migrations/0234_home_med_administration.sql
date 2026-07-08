-- Home Healthcare / Hospital-at-Home: medication administration tracking (IV antibiotics,
-- infusions) given at the patient's home by a visiting nurse. A home eMAR — each dose is
-- scheduled, then recorded as administered / missed / held with the site and notes. Tenant RLS.
-- Ticket #2979.

CREATE TABLE IF NOT EXISTS home_med_administrations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          uuid NOT NULL,
    drug_name           text NOT NULL,
    dose                text NOT NULL,
    route               text,
    is_infusion         boolean NOT NULL DEFAULT false,
    infusion_rate       text,
    scheduled_at        timestamptz NOT NULL,
    administered_at     timestamptz,
    administered_by     uuid,
    administration_site text,
    status              text NOT NULL DEFAULT 'scheduled',
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_med_admin_status_check CHECK (status = ANY (ARRAY[
        'scheduled'::text, 'administered'::text, 'missed'::text, 'held'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_med_patient
    ON home_med_administrations (tenant_id, patient_id, scheduled_at);

ALTER TABLE home_med_administrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_med_administrations_tenant_isolation ON home_med_administrations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_med_administrations_updated_at BEFORE UPDATE ON home_med_administrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
