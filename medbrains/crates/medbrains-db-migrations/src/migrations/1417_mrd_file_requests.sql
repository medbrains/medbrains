-- ====================================================================
-- Migration: 1417_mrd_file_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mrd_file_requests
-- Drops: none
-- ====================================================================
-- The paper file a patient waits for.
--
-- When an OPD patient registers, someone walks to the medical records room,
-- finds the physical file and carries it to the clinic. Nothing in the system
-- asked for it, so patients waited 30-60 minutes while the request travelled
-- by word of mouth. A file request is now written the moment an OPD visit is
-- created, whichever path creates it (walk-in registration, appointment
-- check-in on either route, anything later): an AFTER INSERT trigger on
-- `encounters`, so no path can forget. The runner's pick-up and delivery
-- scans write the existing `mrd_record_movements`; the request only tracks
-- the errand.
--
-- * One request per visit (`uq_mrd_file_requests_visit`), so a retried insert
--   or a second trigger fire never asks twice. A second visit the same day is
--   a second request: the file has to travel again.
-- * No physical file (no active or missing `mrd_medical_records` row) means
--   no request.
-- * A file already marked missing is requested as `not_found`, so the
--   supervisor is told at once instead of a runner searching for it.
-- * The night-before pull list writes `pull_list` rows for tomorrow's
--   appointments (`uq_mrd_file_requests_appointment`); the visit, when it is
--   created, takes over that row instead of asking again.
-- * Cancelling the visit (or the appointment) closes a request not yet picked
--   up; a picked file stays `picked` until a runner returns it to its shelf
--   (closed as `cancelled` / `returned_to_shelf`). After its
--   visit day, the MRD job closes a request that was never picked up as
--   `cancelled` / `day_ended` once its visit is over (completed or cancelled,
--   or it never had one), so yesterday's errands never crowd today's queue but
--   an evening clinic running past midnight keeps its file. A picked-up file
--   is never closed automatically: it is told to the supervisor as out
--   overnight, because someone has to return it.
-- * Due time: `tenant_settings` mrd / `file_request_due_minutes`, default 10,
--   clamped to 1..240 so a typo cannot switch escalation off.
--
-- A trigger failure never blocks registration: it warns (SQLSTATE only, never
-- the message, which can carry patient data) and the doctor's chip reads
-- "file not requested" rather than "no file".

CREATE TABLE public.mrd_file_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    medical_record_id uuid NOT NULL REFERENCES public.mrd_medical_records(id),
    encounter_id uuid REFERENCES public.encounters(id),
    appointment_id uuid REFERENCES public.appointments(id),
    source text NOT NULL CHECK (source IN ('visit', 'pull_list')),
    -- Where the file goes: the OPD and the doctor.
    department_id uuid REFERENCES public.departments(id),
    doctor_id uuid REFERENCES public.users(id),
    -- Where it was when asked for (rack / shelf / bin), kept as asked.
    location_label text,
    visit_date date NOT NULL,
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'picked', 'delivered', 'not_found', 'cancelled')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL,
    picked_at timestamptz,
    picked_by uuid REFERENCES public.users(id),
    delivered_at timestamptz,
    delivered_by uuid REFERENCES public.users(id),
    pick_movement_id uuid REFERENCES public.mrd_record_movements(id),
    escalated_at timestamptz,
    -- A picked file still with its runner after the visit day: told to the
    -- supervisor once, never closed automatically (someone must return it).
    overnight_flagged_at timestamptz,
    closed_reason text CHECK (closed_reason IS NULL OR closed_reason ~ '^[a-z_]{3,40}$'),
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT mrd_file_requests_has_origin
        CHECK (encounter_id IS NOT NULL OR appointment_id IS NOT NULL),
    CONSTRAINT mrd_file_requests_picked_has_who
        CHECK (status NOT IN ('picked', 'delivered') OR (picked_by IS NOT NULL AND picked_at IS NOT NULL)),
    CONSTRAINT mrd_file_requests_delivered_has_who
        CHECK (status <> 'delivered' OR (delivered_by IS NOT NULL AND delivered_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_mrd_file_requests_visit
    ON public.mrd_file_requests (tenant_id, encounter_id)
    WHERE encounter_id IS NOT NULL AND status <> 'cancelled' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_mrd_file_requests_appointment
    ON public.mrd_file_requests (tenant_id, appointment_id)
    WHERE appointment_id IS NOT NULL AND status <> 'cancelled' AND deleted_at IS NULL;
-- The runner's queue and the escalation pass: open rows by due time.
CREATE INDEX idx_mrd_file_requests_open
    ON public.mrd_file_requests (tenant_id, due_at)
    WHERE status IN ('requested', 'picked', 'not_found') AND deleted_at IS NULL;
CREATE INDEX idx_mrd_file_requests_patient
    ON public.mrd_file_requests (tenant_id, patient_id, visit_date);

ALTER TABLE public.mrd_file_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrd_file_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_mrd_file_requests ON public.mrd_file_requests
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER set_updated_at_mrd_file_requests BEFORE UPDATE ON public.mrd_file_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_mrd_file_requests_soft_delete BEFORE DELETE ON public.mrd_file_requests
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_mrd_file_requests AFTER INSERT OR UPDATE OR DELETE
    ON public.mrd_file_requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('mrd');

-- The patient's physical file: the newest volume that is still on the shelf
-- or known missing. Archived and destroyed files are not fetched.
CREATE OR REPLACE FUNCTION public.mrd_current_file(p_tenant uuid, p_patient uuid)
RETURNS TABLE (record_id uuid, record_status text, location_label text)
LANGUAGE sql STABLE AS $$
    SELECT r.id, r.status::text,
           COALESCE(NULLIF(concat_ws(' / ', s.building, s.floor, s.room,
                                     'Rack ' || s.rack, 'Shelf ' || s.shelf, 'Bin ' || s.bin), ''),
                    r.shelf_location)
      FROM public.mrd_medical_records r
      LEFT JOIN public.mrd_storage_locations s
             ON s.tenant_id = r.tenant_id AND s.code = r.shelf_location AND s.deleted_at IS NULL
     WHERE r.tenant_id = p_tenant AND r.patient_id = p_patient AND r.deleted_at IS NULL
       AND r.status IN ('active', 'missing')
     ORDER BY r.record_type = 'opd' DESC, r.volume_number DESC, r.created_at DESC
     LIMIT 1
$$;

-- Minutes from request to due, from the tenant's setting, safely: anything
-- but 1-3 digits falls back to 10, then the value is clamped to 1..240.
CREATE OR REPLACE FUNCTION public.mrd_file_request_due_minutes(p_tenant uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
    SELECT LEAST(GREATEST(COALESCE(
             (SELECT CASE WHEN (value #>> '{}') ~ '^[0-9]{1,3}$' THEN (value #>> '{}')::int END
                FROM public.tenant_settings
               WHERE tenant_id = p_tenant AND category = 'mrd'
                 AND key = 'file_request_due_minutes' AND deleted_at IS NULL
               LIMIT 1), 10), 1), 240)
$$;

-- Ask for the file of an OPD visit. Takes over today's pre-pulled request for
-- the patient: the visit's own appointment's whatever its state (a file
-- already fetched for this visit is this visit's), otherwise one still
-- waiting at the shelf (`requested` or `not_found`); else writes a new one.
-- Idempotent per visit. Another appointment's file already picked or
-- delivered is that errand's and is never taken over. Returns the request
-- id, or NULL when the patient has no physical file (or a concurrent insert
-- for the same visit won).
-- Takes the visit's row, so the trigger never reads back the row it was handed.
CREATE OR REPLACE FUNCTION public.mrd_request_file_for_visit(e public.encounters)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
    f record;
    due_mins integer;
    req uuid;
BEGIN
    SELECT id INTO req FROM public.mrd_file_requests
     WHERE tenant_id = e.tenant_id AND encounter_id = e.id
       AND status <> 'cancelled' AND deleted_at IS NULL;
    IF FOUND THEN
        RETURN req;
    END IF;
    SELECT * INTO f FROM public.mrd_current_file(e.tenant_id, e.patient_id);
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    due_mins := public.mrd_file_request_due_minutes(e.tenant_id);

    UPDATE public.mrd_file_requests
       SET encounter_id = e.id,
           department_id = COALESCE(e.department_id, department_id),
           doctor_id = COALESCE(e.doctor_id, doctor_id),
           due_at = LEAST(due_at, now() + make_interval(mins => due_mins))
     WHERE id = (SELECT pr.id FROM public.mrd_file_requests pr
                  LEFT JOIN public.appointments a
                         ON a.id = pr.appointment_id AND a.tenant_id = pr.tenant_id
                  WHERE pr.tenant_id = e.tenant_id AND pr.patient_id = e.patient_id
                    AND pr.source = 'pull_list' AND pr.encounter_id IS NULL
                    AND pr.visit_date = e.encounter_date
                    AND pr.deleted_at IS NULL
                    -- A waiting row is any appointment's; a picked or delivered
                    -- file only the visit's own appointment's (linked to it,
                    -- or, as check-in does before it links, checked in with
                    -- the visit's doctor).
                    AND (pr.status IN ('requested', 'not_found')
                         OR (pr.status IN ('picked', 'delivered')
                             AND (a.encounter_id = e.id
                                  OR (a.encounter_id IS NULL AND a.status = 'checked_in'
                                      AND a.doctor_id = e.doctor_id))))
                  -- The visit's own appointment first.
                  ORDER BY a.encounter_id = e.id DESC NULLS LAST,
                           (a.encounter_id IS NULL AND a.status = 'checked_in'
                            AND a.doctor_id = e.doctor_id) DESC NULLS LAST,
                           pr.due_at
                  LIMIT 1 FOR UPDATE OF pr)
    RETURNING id INTO req;
    IF req IS NOT NULL THEN
        RETURN req;
    END IF;

    INSERT INTO public.mrd_file_requests
        (tenant_id, patient_id, medical_record_id, encounter_id, source, department_id,
         doctor_id, location_label, visit_date, status, due_at, created_by)
    VALUES (e.tenant_id, e.patient_id, f.record_id, e.id, 'visit', e.department_id,
            e.doctor_id, f.location_label, e.encounter_date,
            CASE WHEN f.record_status = 'missing' THEN 'not_found' ELSE 'requested' END,
            now() + make_interval(mins => due_mins), e.created_by)
    ON CONFLICT DO NOTHING
    RETURNING id INTO req;
    RETURN req;
END $$;

-- Every OPD visit asks for its file. Camp, teleconsultation, back-dated and
-- test visits do not: a camp is held away from the records room, a
-- teleconsultation has no patient at the clinic, a back-dated entry records a
-- visit already over, and a dummy visit has no paper.
CREATE OR REPLACE FUNCTION public.mrd_file_request_on_visit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.mrd_request_file_for_visit(NEW);
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mrd_file_request_on_visit: no file request for encounter % (SQLSTATE %)',
        NEW.id, SQLSTATE;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_mrd_file_request_on_visit AFTER INSERT ON public.encounters
    FOR EACH ROW
    WHEN (NEW.encounter_type = 'opd' AND NOT NEW.is_dummy AND NOT NEW.is_retrospective
          AND COALESCE(NEW.visit_type, '') NOT IN ('camp', 'teleconsultation'))
    EXECUTE FUNCTION public.mrd_file_request_on_visit();

-- A cancelled visit (or a no-show) does not need its file. A file a runner
-- already picked up stays `picked`: it is in someone's hands, so it stays in
-- the queue (with "Return to shelf") and is flagged overnight if nobody does.
CREATE OR REPLACE FUNCTION public.mrd_file_request_on_visit_cancel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.mrd_file_requests
       SET status = 'cancelled', closed_reason = 'visit_cancelled'
     WHERE tenant_id = NEW.tenant_id AND encounter_id = NEW.id
       AND status IN ('requested', 'not_found') AND deleted_at IS NULL;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mrd_file_request_on_visit_cancel: request left open for encounter % (SQLSTATE %)',
        NEW.id, SQLSTATE;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_mrd_file_request_on_visit_cancel AFTER UPDATE OF status ON public.encounters
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.mrd_file_request_on_visit_cancel();

-- A cancelled appointment does not need its pre-pulled file.
CREATE OR REPLACE FUNCTION public.mrd_file_request_on_appointment_cancel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.mrd_file_requests
       SET status = 'cancelled', closed_reason = 'appointment_cancelled'
     WHERE tenant_id = NEW.tenant_id AND appointment_id = NEW.id AND encounter_id IS NULL
       AND status IN ('requested', 'not_found') AND deleted_at IS NULL;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mrd_file_request_on_appointment_cancel: request left open for appointment % (SQLSTATE %)',
        NEW.id, SQLSTATE;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_mrd_file_request_on_appointment_cancel AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status IN ('cancelled', 'no_show') AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.mrd_file_request_on_appointment_cancel();
