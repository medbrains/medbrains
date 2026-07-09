-- Medication reconciliation (IPSG.6 / NABH MOM). At every care transition — admission, transfer,
-- discharge — the patient's existing medications must be compared against current orders so nothing is
-- unintentionally omitted, duplicated or continued when it should stop. The safety rule: a
-- reconciliation cannot be marked complete until EVERY listed medication has an explicit decision
-- (continue / modify / stop / hold). Un-reconciled medications are the classic cause of transition-of-
-- care harm, so the completion gate is enforced server-side.

CREATE TABLE IF NOT EXISTS medication_reconciliations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       uuid NOT NULL,
    admission_id     uuid,
    transition_type  text NOT NULL,   -- admission | transfer | discharge
    status           text NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
    notes            text,
    reconciled_by    uuid,
    reconciled_at    timestamptz,
    created_by       uuid,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT med_recon_transition_check
        CHECK (transition_type IN ('admission', 'transfer', 'discharge')),
    CONSTRAINT med_recon_status_check
        CHECK (status IN ('in_progress', 'completed'))
);

CREATE TABLE IF NOT EXISTS medication_reconciliation_items (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reconciliation_id uuid NOT NULL REFERENCES medication_reconciliations(id) ON DELETE CASCADE,
    drug_name         text NOT NULL,
    dose              text,
    frequency         text,
    route             text,
    source            text NOT NULL DEFAULT 'home',   -- home | opd | transfer | other
    decision          text,   -- continue | modify | stop | hold  (NULL = pending)
    decision_reason   text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT med_recon_item_source_check
        CHECK (source IN ('home', 'opd', 'transfer', 'other')),
    CONSTRAINT med_recon_item_decision_check
        CHECK (decision IS NULL OR decision IN ('continue', 'modify', 'stop', 'hold'))
);

CREATE INDEX IF NOT EXISTS idx_med_recon_patient
    ON medication_reconciliations (tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_recon_item_recon
    ON medication_reconciliation_items (tenant_id, reconciliation_id);

ALTER TABLE medication_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY medication_reconciliations_tenant_isolation ON medication_reconciliations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE medication_reconciliation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY medication_reconciliation_items_tenant_isolation ON medication_reconciliation_items
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
