-- 088_audit_trail.sql
-- Centralized audit trail: auto-logging triggers, access log, enhanced audit_log

-- ── Enhance audit_log table ────────────────────────────────

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS session_id UUID,
    ADD COLUMN IF NOT EXISTS module TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Drop the NOT NULL on hash — triggers can't compute app-level hashes
ALTER TABLE audit_log ALTER COLUMN hash DROP NOT NULL;

-- Additional indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_module
    ON audit_log(tenant_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log(tenant_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type
    ON audit_log(tenant_id, entity_type, created_at DESC);

-- ── Access log (READ tracking) ─────────────────────────────

CREATE TABLE access_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    patient_id  UUID REFERENCES patients(id),
    action      TEXT NOT NULL DEFAULT 'view',
    ip_address  TEXT,
    user_agent  TEXT,
    module      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON access_log
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_access_log_tenant ON access_log(tenant_id, created_at DESC);
CREATE INDEX idx_access_log_patient ON access_log(tenant_id, patient_id, created_at DESC);
CREATE INDEX idx_access_log_user ON access_log(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_access_log_entity ON access_log(entity_type, entity_id);

-- ── Generic audit trigger function ─────────────────────────
-- Attach to any tenant-scoped table to auto-log changes to audit_log.
-- Uses session variables set by the application:
--   app.tenant_id  — tenant UUID (already set by RLS middleware)
--   app.user_id    — current user UUID (set by request middleware)
--   app.ip_address — client IP (set by request middleware)

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_ip TEXT;
    v_action TEXT;
    v_entity_id UUID;
    v_old JSONB;
    v_new JSONB;
BEGIN
    -- Read session variables (set by app middleware)
    v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    v_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
    v_ip := NULLIF(current_setting('app.ip_address', true), '');

    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_entity_id := NEW.id;
        v_old := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_entity_id := NEW.id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        -- Skip if nothing actually changed (e.g., only updated_at)
        IF v_old - 'updated_at' = v_new - 'updated_at' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_entity_id := OLD.id;
        v_old := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Only log if we have a tenant context
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO audit_log (
            tenant_id, user_id, action, entity_type, entity_id,
            old_values, new_values, ip_address, module
        ) VALUES (
            v_tenant_id, v_user_id, v_action, TG_TABLE_NAME, v_entity_id,
            v_old, v_new, v_ip, TG_ARGV[0]
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Attach audit triggers to critical tables ───────────────
-- Module argument passed as TG_ARGV[0] for categorization

-- Patient Management
CREATE TRIGGER audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('patients');

CREATE TRIGGER audit_patient_addresses
    AFTER INSERT OR UPDATE OR DELETE ON patient_addresses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('patients');

CREATE TRIGGER audit_patient_contacts
    AFTER INSERT OR UPDATE OR DELETE ON patient_contacts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('patients');

CREATE TRIGGER audit_patient_allergies
    AFTER INSERT OR UPDATE OR DELETE ON patient_allergies
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('patients');

-- OPD / Encounters
CREATE TRIGGER audit_encounters
    AFTER INSERT OR UPDATE OR DELETE ON encounters
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('opd');

CREATE TRIGGER audit_consultations
    AFTER INSERT OR UPDATE OR DELETE ON consultations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('opd');

CREATE TRIGGER audit_diagnoses
    AFTER INSERT OR UPDATE OR DELETE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('opd');

CREATE TRIGGER audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('opd');

-- Prescriptions & Pharmacy
CREATE TRIGGER audit_prescriptions
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

CREATE TRIGGER audit_prescription_items
    AFTER INSERT OR UPDATE OR DELETE ON prescription_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

CREATE TRIGGER audit_pharmacy_orders
    AFTER INSERT OR UPDATE OR DELETE ON pharmacy_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');

-- Lab
CREATE TRIGGER audit_lab_orders
    AFTER INSERT OR UPDATE OR DELETE ON lab_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('lab');

CREATE TRIGGER audit_lab_results
    AFTER INSERT OR UPDATE OR DELETE ON lab_results
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('lab');

-- IPD / Admissions
CREATE TRIGGER audit_admissions
    AFTER INSERT OR UPDATE OR DELETE ON admissions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('ipd');

CREATE TRIGGER audit_nursing_tasks
    AFTER INSERT OR UPDATE OR DELETE ON nursing_tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('ipd');

-- Billing
CREATE TRIGGER audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('billing');

CREATE TRIGGER audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('billing');

-- Radiology
CREATE TRIGGER audit_radiology_orders
    AFTER INSERT OR UPDATE OR DELETE ON radiology_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('radiology');

-- Blood Bank
CREATE TRIGGER audit_blood_donations
    AFTER INSERT OR UPDATE OR DELETE ON blood_donations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('blood_bank');

-- Emergency
CREATE TRIGGER audit_er_visits
    AFTER INSERT OR UPDATE OR DELETE ON er_visits
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('emergency');

-- Vitals
CREATE TRIGGER audit_vitals
    AFTER INSERT OR UPDATE OR DELETE ON vitals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('clinical');

-- Users & Roles (admin)
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('admin');

CREATE TRIGGER audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('admin');

-- Consent
CREATE TRIGGER audit_patient_consents
    AFTER INSERT OR UPDATE OR DELETE ON patient_consents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('consent');
