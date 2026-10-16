-- ====================================================================
-- Migration: 1078_dialysis_machines_dialyzers.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: dialysis_machines, dialyzers, dialysis_slots
-- Drops: none
-- ====================================================================
-- A dialysis unit's machines, the dialyzers it reprocesses, and the shifts
-- each machine is booked for. Sessions recorded a free-text machine number
-- and dialyzer type, so nothing stopped a dialyzer being used past its limit,
-- used on another patient, or a seropositive patient being put on a machine
-- shared with seronegative ones.
--
-- * A dialyzer belongs to one patient for its whole life and counts its uses
--   up to the limit set when it was issued; a seropositive patient's dialyzer
--   is single-use. Reprocessing records total cell volume (TCV); below 80% of
--   the first measurement the dialyzer is discarded (AAMI RD47 practice).
-- * A machine is dedicated to a serology (none / HBsAg / HCV / HIV) and only
--   takes patients of that serology. One booking per machine per shift.

CREATE TABLE IF NOT EXISTS public.dialysis_machines (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code        text NOT NULL,
    name        text NOT NULL,
    serology    text NOT NULL DEFAULT 'none' CHECK (serology IN ('none', 'hbsag', 'hcv', 'hiv')),
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
    location    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz,
    deleted_by  uuid,
    delete_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dialysis_machines_code
    ON public.dialysis_machines (tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.dialyzers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    patient_id     uuid NOT NULL REFERENCES public.patients(id),
    -- The label on the dialyzer, as written or barcoded.
    label          text NOT NULL,
    model          text,
    serology       text NOT NULL CHECK (serology IN ('none', 'hbsag', 'hcv', 'hiv')),
    max_uses       integer NOT NULL CHECK (max_uses BETWEEN 1 AND 20),
    uses           integer NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
    baseline_tcv_ml numeric(6,1) CHECK (baseline_tcv_ml > 0),
    last_tcv_ml    numeric(6,1) CHECK (last_tcv_ml > 0),
    status         text NOT NULL DEFAULT 'in_use' CHECK (status IN ('in_use', 'discarded')),
    discard_reason text,
    issued_by      uuid NOT NULL REFERENCES public.users(id),
    issued_at      timestamptz NOT NULL DEFAULT now(),
    discarded_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    deleted_by     uuid,
    delete_reason  text,
    CHECK (serology = 'none' OR max_uses = 1),
    CHECK (status = 'in_use' OR discard_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dialyzers_label
    ON public.dialyzers (tenant_id, label) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dialyzers_patient
    ON public.dialyzers (tenant_id, patient_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.dialysis_slots (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    machine_id  uuid NOT NULL REFERENCES public.dialysis_machines(id),
    patient_id  uuid NOT NULL REFERENCES public.patients(id),
    slot_date   date NOT NULL,
    shift       text NOT NULL CHECK (shift IN ('morning', 'afternoon', 'evening', 'night')),
    serology    text NOT NULL CHECK (serology IN ('none', 'hbsag', 'hcv', 'hiv')),
    status      text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
    booked_by   uuid NOT NULL REFERENCES public.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz,
    deleted_by  uuid,
    delete_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dialysis_slots_machine_shift
    ON public.dialysis_slots (tenant_id, machine_id, slot_date, shift)
    WHERE status <> 'cancelled' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dialysis_slots_date
    ON public.dialysis_slots (tenant_id, slot_date) WHERE deleted_at IS NULL;

ALTER TABLE public.dialysis_sessions
    ADD COLUMN IF NOT EXISTS machine_id  uuid REFERENCES public.dialysis_machines(id),
    ADD COLUMN IF NOT EXISTS dialyzer_id uuid REFERENCES public.dialyzers(id),
    ADD COLUMN IF NOT EXISTS slot_id     uuid REFERENCES public.dialysis_slots(id),
    -- Which use of the dialyzer this session was: 1 for a new one.
    ADD COLUMN IF NOT EXISTS dialyzer_use integer;

DROP TRIGGER IF EXISTS trg_dialysis_machines_updated_at ON public.dialysis_machines;
CREATE TRIGGER trg_dialysis_machines_updated_at BEFORE UPDATE ON public.dialysis_machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_dialysis_machines_soft_delete ON public.dialysis_machines;
CREATE TRIGGER trg_dialysis_machines_soft_delete BEFORE DELETE ON public.dialysis_machines
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_dialysis_machines ON public.dialysis_machines;
CREATE TRIGGER audit_dialysis_machines AFTER INSERT OR DELETE OR UPDATE ON public.dialysis_machines
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('specialty');
ALTER TABLE public.dialysis_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialysis_machines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dialysis_machines ON public.dialysis_machines;
CREATE POLICY tenant_isolation_dialysis_machines ON public.dialysis_machines
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

DROP TRIGGER IF EXISTS trg_dialyzers_updated_at ON public.dialyzers;
CREATE TRIGGER trg_dialyzers_updated_at BEFORE UPDATE ON public.dialyzers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_dialyzers_soft_delete ON public.dialyzers;
CREATE TRIGGER trg_dialyzers_soft_delete BEFORE DELETE ON public.dialyzers
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_dialyzers ON public.dialyzers;
CREATE TRIGGER audit_dialyzers AFTER INSERT OR DELETE OR UPDATE ON public.dialyzers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('specialty');
ALTER TABLE public.dialyzers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialyzers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dialyzers ON public.dialyzers;
CREATE POLICY tenant_isolation_dialyzers ON public.dialyzers
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

DROP TRIGGER IF EXISTS trg_dialysis_slots_updated_at ON public.dialysis_slots;
CREATE TRIGGER trg_dialysis_slots_updated_at BEFORE UPDATE ON public.dialysis_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_dialysis_slots_soft_delete ON public.dialysis_slots;
CREATE TRIGGER trg_dialysis_slots_soft_delete BEFORE DELETE ON public.dialysis_slots
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_dialysis_slots ON public.dialysis_slots;
CREATE TRIGGER audit_dialysis_slots AFTER INSERT OR DELETE OR UPDATE ON public.dialysis_slots
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('specialty');
ALTER TABLE public.dialysis_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialysis_slots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dialysis_slots ON public.dialysis_slots;
CREATE POLICY tenant_isolation_dialysis_slots ON public.dialysis_slots
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
