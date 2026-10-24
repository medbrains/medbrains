-- ====================================================================
-- Migration: 1205_abdm_hi_types_and_sms_link.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: patient_immunizations, abdm_sms_links
-- Drops: none
-- ====================================================================
-- ABDM M2/M3 P1 certification:
--
-- The four HI types the hospital did not share (HIP_INIT_SHARE_CARECONTEXT,
-- and the HIU side's HIU_FLOW_111–113): each is built as its NRCeS
-- profile asks; immunisations and vitals become care contexts the way the
-- first four do (migration 1110), documents and bills once validated (below):
--   ImmunizationRecord   — a vaccine given or recorded here
--                          (`patient_immunizations`, new: nothing recorded
--                          immunisations before, so the chart gets a maker);
--   WellnessRecord       — a visit's vital signs and body measurements,
--                          one care context per visit (`vitals`);
--   HealthDocumentRecord — a clinical document uploaded to the chart: a
--                          report, prescription, discharge summary or
--                          referral letter, PDF or image (`patient_documents`;
--                          ID proofs, insurance cards and photos never go);
--   Invoice              — an issued bill (`invoices`).
--
-- New data on a care context already linked and announced (a second set
-- of vitals in the visit) announces it again (`link/context/notify`).
--
-- The deep-link SMS (HIP_INIT_NOTIFY_HIECM, `link/patient/links/sms/notify2`):
-- when a record is captured for a patient with a mobile and no ABHA here,
-- ABDM is asked — once per patient — to text them a link to the ABHA app,
-- and staff can send it again from the chart. `abdm_sms_links` holds each
-- request and ABDM's answer at `/api/v3/patients/sms/on-notify`.

-- ── Immunisations ───────────────────────────────────────────────────────
-- Lot numbers are recorded for traceability (Drugs and Cosmetics Act batch
-- recall; an adverse event is traced to a lot). A dose given elsewhere and
-- read off the patient's card is recorded as such, never as given here.
CREATE TABLE public.patient_immunizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    encounter_id uuid REFERENCES public.encounters(id),
    vaccine_name text NOT NULL CHECK (length(btrim(vaccine_name)) > 0),
    -- SNOMED CT code of the vaccine product, when known.
    vaccine_code text,
    dose_number integer CHECK (dose_number BETWEEN 1 AND 20),
    administered_on date NOT NULL,
    lot_number text,
    manufacturer text,
    route text CHECK (route IN ('intramuscular', 'subcutaneous', 'intradermal', 'oral', 'intranasal')),
    site text,
    given_elsewhere boolean NOT NULL DEFAULT false,
    notes text,
    recorded_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text,
    CHECK (deleted_at IS NULL OR length(btrim(coalesce(delete_reason, ''))) > 0)
);

CREATE INDEX idx_patient_immunizations_patient
    ON public.patient_immunizations (tenant_id, patient_id, administered_on DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.patient_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_immunizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_patient_immunizations ON public.patient_immunizations
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_patient_immunizations BEFORE UPDATE ON public.patient_immunizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_patient_immunizations_soft_delete BEFORE DELETE ON public.patient_immunizations
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── The deep-link SMS ───────────────────────────────────────────────────
CREATE TABLE public.abdm_sms_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    -- The last four digits only: enough for staff to say which mobile.
    phone_last4 text NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
    request_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
    error text,
    -- NULL when the capture of a record sent it, not a member of staff.
    requested_by uuid REFERENCES public.users(id),
    answered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_abdm_sms_links_request ON public.abdm_sms_links (tenant_id, request_id);
CREATE INDEX idx_abdm_sms_links_patient
    ON public.abdm_sms_links (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.abdm_sms_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_sms_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_sms_links ON public.abdm_sms_links
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_sms_links BEFORE UPDATE ON public.abdm_sms_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_sms_links_soft_delete BEFORE DELETE ON public.abdm_sms_links
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Care contexts for the four types ────────────────────────────────────
ALTER TABLE public.abdm_care_contexts
    DROP CONSTRAINT abdm_care_contexts_source_kind_check,
    ADD CONSTRAINT abdm_care_contexts_source_kind_check
        CHECK (source_kind IN ('opd_consult', 'prescription', 'lab_report', 'discharge_summary',
                               'immunization', 'wellness', 'health_document', 'invoice'));

CREATE OR REPLACE FUNCTION public.abdm_capture_care_context(
    p_tenant uuid, p_patient uuid, p_kind text, p_source uuid,
    p_encounter uuid, p_date date, p_display text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
    v_hi text[] := CASE p_kind
        WHEN 'opd_consult' THEN ARRAY['OPConsultation']
        WHEN 'prescription' THEN ARRAY['Prescription']
        WHEN 'lab_report' THEN ARRAY['DiagnosticReport']
        WHEN 'immunization' THEN ARRAY['ImmunizationRecord']
        WHEN 'wellness' THEN ARRAY['WellnessRecord']
        WHEN 'health_document' THEN ARRAY['HealthDocumentRecord']
        WHEN 'invoice' THEN ARRAY['Invoice']
        ELSE ARRAY['DischargeSummary'] END;
    v_prefix text := CASE p_kind
        WHEN 'opd_consult' THEN 'OPC' WHEN 'prescription' THEN 'RX'
        WHEN 'lab_report' THEN 'DR' WHEN 'immunization' THEN 'IMM'
        WHEN 'wellness' THEN 'WR' WHEN 'health_document' THEN 'HD'
        WHEN 'invoice' THEN 'INV' ELSE 'DS' END;
BEGIN
    IF p_patient IS NULL THEN
        RETURN;
    END IF;
    INSERT INTO public.abdm_care_contexts
        (tenant_id, patient_id, facility_id, source_kind, source_id, encounter_id,
         reference_number, display, hi_types, record_date)
    SELECT p_tenant, p_patient, mc.id, p_kind, p_source, p_encounter,
           v_prefix || '-' || p_source::text, p_display, v_hi, p_date
      FROM (SELECT NULL) one
      LEFT JOIN LATERAL (
          SELECT f.id FROM public.facilities f
           WHERE f.tenant_id = p_tenant AND f.deleted_at IS NULL AND f.parent_id IS NULL
           ORDER BY (f.hfr_facility_id IS NOT NULL) DESC,
                    (f.facility_type = 'main_hospital') DESC, f.created_at
           LIMIT 1) mc ON true
    ON CONFLICT (tenant_id, source_kind, source_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        -- New data on a record already linked and announced (another set of
        -- vitals in the visit): tell the patient's app again.
        UPDATE public.abdm_care_contexts
           SET notified_at = NULL, notify_request_id = NULL, notify_attempts = 0
         WHERE tenant_id = p_tenant AND source_kind = p_kind AND source_id = p_source
           AND link_status = 'linked' AND notified_at IS NOT NULL AND deleted_at IS NULL
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            INSERT INTO public.outbox_events
                (tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key)
            VALUES (p_tenant, 'abdm_care_context', v_id, 'abdm.care_context.notify',
                    jsonb_build_object('care_context_id', v_id),
                    'ccn:' || v_id::text || ':' || txid_current()::text)
            ON CONFLICT (tenant_id, event_type, idempotency_key)
                WHERE idempotency_key IS NOT NULL DO NOTHING;
        END IF;
        RETURN;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.patient_abha_links l
         WHERE l.tenant_id = p_tenant AND l.patient_id = p_patient
           AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL AND l.unlinked_at IS NULL)
    THEN
        INSERT INTO public.outbox_events
            (tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key)
        VALUES (p_tenant, 'abdm_care_context', v_id, 'abdm.care_context.link',
                jsonb_build_object('care_context_id', v_id), 'cc:' || v_id::text)
        ON CONFLICT (tenant_id, event_type, idempotency_key)
            WHERE idempotency_key IS NOT NULL DO NOTHING;
    ELSIF EXISTS (
        SELECT 1 FROM public.patients p
         WHERE p.id = p_patient AND p.tenant_id = p_tenant
           AND length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 10)
    THEN
        -- No ABHA here: once per patient, ABDM texts them the ABHA app link.
        INSERT INTO public.outbox_events
            (tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key)
        VALUES (p_tenant, 'patient', p_patient, 'abdm.patient.sms_link',
                jsonb_build_object('patient_id', p_patient), 'sms:' || p_patient::text)
        ON CONFLICT (tenant_id, event_type, idempotency_key)
            WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_abdm_hi_type_capture()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        IF TG_TABLE_NAME = 'patient_immunizations' THEN
            PERFORM public.abdm_capture_care_context(NEW.tenant_id, NEW.patient_id,
                'immunization', NEW.id, NEW.encounter_id, NEW.administered_on,
                NEW.vaccine_name || ', ' || to_char(NEW.administered_on, 'DD Mon YYYY'));
        ELSE
            PERFORM public.abdm_capture_care_context(NEW.tenant_id,
                COALESCE(NEW.patient_id,
                    (SELECT e.patient_id FROM public.encounters e WHERE e.id = NEW.encounter_id)),
                'wellness', NEW.encounter_id, NEW.encounter_id, NEW.recorded_at::date,
                'Vital signs, ' || to_char(NEW.recorded_at, 'DD Mon YYYY'));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'abdm care context capture failed for %.%: %', TG_TABLE_NAME, NEW.id, SQLERRM;
    END;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_patient_immunizations_abdm_care_context
    AFTER INSERT ON public.patient_immunizations
    FOR EACH ROW WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.trg_abdm_hi_type_capture();
CREATE TRIGGER trg_vitals_abdm_care_context
    AFTER INSERT ON public.vitals
    FOR EACH ROW WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.trg_abdm_hi_type_capture();
-- HealthDocumentRecord and Invoice are built and checked (conformance
-- tests) but not yet captured automatically: the HL7 validator run offline
-- could not resolve their MIME-type and currency codes (BCP 13, ISO 4217)
-- and the online terminology server timed out. The triggers for
-- `patient_documents` (report, prescription, discharge summary, referral
-- letter; PDF/JPEG/PNG) and issued `invoices` follow once a validator run
-- with terminology confirms them.
