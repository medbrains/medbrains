-- ====================================================================
-- Migration: 1355_hl7_adt_feed.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: hl7_adt_destinations
-- Drops: none
-- ====================================================================
-- An HL7 v2 ADT feed for the hospital's other systems (PACS/RIS, LIS,
-- billing, dietary): who is admitted, moved, discharged or registered.
--
-- Each destination says where (MLLP host and port on the hospital network)
-- and which triggers it wants. The database queues them, so no admit,
-- transfer, discharge, registration or demographic edit can forget to:
--
--   A01 admit                admissions insert
--   A02 transfer             admissions: bed or ward changed while admitted
--   A03 discharge            admissions: admitted -> discharged/absconded/deceased
--   A11 cancel admit         admissions: soft-deleted
--   A13 cancel discharge     admissions: discharged -> admitted
--   A04 register (OPD / ER)  encounters insert
--   A08 update demographics  patients: name, birth date, sex, phone, address
--
-- One outbox event per destination (`hl7.adt.send`); the handler builds the
-- message from the record as it stands when it sends, and an outage is
-- retried by the outbox.

CREATE TABLE public.hl7_adt_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL CHECK (length(btrim(name)) >= 2),
    host text NOT NULL CHECK (length(btrim(host)) >= 1),
    port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
    events text[] NOT NULL
        CHECK (cardinality(events) > 0
               AND events <@ ARRAY['A01', 'A02', 'A03', 'A04', 'A08', 'A11', 'A13']),
    sending_facility text,
    receiving_application text NOT NULL DEFAULT '',
    receiving_facility text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_hl7_adt_destinations_tenant
    ON public.hl7_adt_destinations (tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.hl7_adt_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_hl7_adt_destinations ON public.hl7_adt_destinations
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_hl7_adt_destinations BEFORE UPDATE ON public.hl7_adt_destinations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_hl7_adt_destinations_soft_delete BEFORE DELETE ON public.hl7_adt_destinations
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_hl7_adt_destinations AFTER INSERT OR DELETE OR UPDATE ON public.hl7_adt_destinations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('integration');

-- Queue `event` to every active destination of `tenant` that wants it.
-- SECURITY DEFINER: the trigger fires inside clinical writes whose role may
-- not read the destinations or write the outbox directly.
CREATE OR REPLACE FUNCTION public.hl7_adt_queue(p_tenant uuid, p_event text, p_payload jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
    SELECT p_tenant, 'hl7_adt_destination', d.id, 'hl7.adt.send',
           p_payload || jsonb_build_object('destination_id', d.id, 'event', p_event)
      FROM public.hl7_adt_destinations d
     WHERE d.tenant_id = p_tenant AND d.is_active AND d.deleted_at IS NULL
       AND p_event = ANY (d.events)
$$;

CREATE OR REPLACE FUNCTION public.hl7_adt_from_admission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ev text;
    payload jsonb := jsonb_build_object('patient_id', NEW.patient_id, 'admission_id', NEW.id,
                                        'encounter_id', NEW.encounter_id);
    out_states public.admission_status[] := ARRAY['discharged', 'absconded', 'deceased']::public.admission_status[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        ev := CASE WHEN NEW.status = 'admitted' THEN 'A01' END;
    ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        ev := 'A11';
    ELSIF NEW.deleted_at IS NOT NULL THEN
        ev := NULL;
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = ANY (out_states)
          AND NOT (OLD.status = ANY (out_states)) THEN
        ev := 'A03';
    ELSIF OLD.status = ANY (out_states) AND NEW.status = 'admitted' THEN
        ev := 'A13';
    ELSIF (OLD.bed_id IS DISTINCT FROM NEW.bed_id OR OLD.ward_id IS DISTINCT FROM NEW.ward_id)
          AND NOT (NEW.status = ANY (out_states)) THEN
        ev := 'A02';
        payload := payload || jsonb_build_object('prior_bed_id', OLD.bed_id,
                                                 'prior_ward_id', OLD.ward_id);
    END IF;
    IF ev IS NOT NULL THEN
        PERFORM public.hl7_adt_queue(NEW.tenant_id, ev, payload);
    END IF;
    RETURN NULL;
END
$$;
CREATE TRIGGER trg_admissions_hl7_adt AFTER INSERT OR UPDATE ON public.admissions
    FOR EACH ROW EXECUTE FUNCTION public.hl7_adt_from_admission();

CREATE OR REPLACE FUNCTION public.hl7_adt_from_encounter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.encounter_type IN ('opd', 'emergency') THEN
        PERFORM public.hl7_adt_queue(NEW.tenant_id, 'A04',
            jsonb_build_object('patient_id', NEW.patient_id, 'encounter_id', NEW.id));
    END IF;
    RETURN NULL;
END
$$;
CREATE TRIGGER trg_encounters_hl7_adt AFTER INSERT ON public.encounters
    FOR EACH ROW EXECUTE FUNCTION public.hl7_adt_from_encounter();

CREATE OR REPLACE FUNCTION public.hl7_adt_from_patient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.first_name, OLD.middle_name, OLD.last_name, OLD.date_of_birth, OLD.gender,
        OLD.phone, OLD.address)
       IS DISTINCT FROM
       (NEW.first_name, NEW.middle_name, NEW.last_name, NEW.date_of_birth, NEW.gender,
        NEW.phone, NEW.address) THEN
        PERFORM public.hl7_adt_queue(NEW.tenant_id, 'A08',
            jsonb_build_object('patient_id', NEW.id));
    END IF;
    RETURN NULL;
END
$$;
CREATE TRIGGER trg_patients_hl7_adt AFTER UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.hl7_adt_from_patient();
