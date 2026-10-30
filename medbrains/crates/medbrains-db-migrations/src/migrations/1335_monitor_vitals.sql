-- ====================================================================
-- Migration: 1335_monitor_vitals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: device_vital_readings
-- Drops: none
-- ====================================================================
-- Bedside monitor readings into the nursing chart.
--
-- Patient monitors (Philips, GE, Mindray, Nihon Kohden) send HL7 v2 ORU
-- messages, and nothing took them: device ingest routed only lab results.
-- A monitor is bound to a bed (`device_instances.bed_location_id`); a reading
-- belongs to whoever is admitted to that bed. Each reading is a draft until
-- a nurse confirms it -- only then is it written to `vitals`, through the same
-- path as a hand-charted reading, so it is scored (NEWS2/PEWS/MEOWS) and can
-- escalate. Readings that cannot be tied to one admission are held, with the
-- reason. A monitor sends every few seconds; one normal reading per 15
-- minutes is kept, and every abnormal one.

ALTER TABLE public.device_instances
    ADD COLUMN IF NOT EXISTS bed_location_id uuid REFERENCES public.locations(id);

-- Who produced a charted reading: typed in, or a confirmed monitor reading.
ALTER TABLE public.vitals
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'device'));

CREATE TABLE public.device_vital_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    device_instance_id uuid NOT NULL REFERENCES public.device_instances(id),
    device_message_id uuid REFERENCES public.device_messages(id),
    -- Null only when held: the reading could not be tied to an admission.
    encounter_id uuid REFERENCES public.encounters(id),
    patient_id uuid REFERENCES public.patients(id),
    observed_at timestamptz NOT NULL,
    temperature numeric(4,1),
    pulse integer,
    systolic_bp integer,
    diastolic_bp integer,
    respiratory_rate integer,
    spo2 integer,
    is_abnormal boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'discarded', 'held')),
    held_reason text,
    vital_id uuid REFERENCES public.vitals(id),
    reviewed_by uuid REFERENCES public.users(id),
    reviewed_at timestamptz,
    discard_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_vital_readings_bound CHECK (status = 'held' OR encounter_id IS NOT NULL),
    CONSTRAINT device_vital_readings_confirmed CHECK (status <> 'confirmed' OR vital_id IS NOT NULL)
);

CREATE INDEX idx_device_vital_readings_encounter
    ON public.device_vital_readings (tenant_id, encounter_id, observed_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_device_vital_readings_device
    ON public.device_vital_readings (device_instance_id, observed_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.device_vital_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_vital_readings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_device_vital_readings ON public.device_vital_readings
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_device_vital_readings BEFORE UPDATE ON public.device_vital_readings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_device_vital_readings_soft_delete BEFORE DELETE ON public.device_vital_readings
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_device_vital_readings
    AFTER INSERT OR DELETE OR UPDATE ON public.device_vital_readings
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');
