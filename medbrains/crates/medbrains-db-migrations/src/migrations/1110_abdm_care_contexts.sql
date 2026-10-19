-- ====================================================================
-- Migration: 1110_abdm_care_contexts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_care_contexts, abdm_link_requests
-- Drops: none
-- ====================================================================
-- ABDM Milestone 2 — this hospital as a Health Information Provider (HIP).
--
-- A care context is one finished clinical record a patient can pull into
-- their ABHA: a closed OP consultation, a signed prescription, a verified lab
-- report, a signed discharge summary. It is captured here the moment the
-- record is finalised, whichever screen or job finalised it, so no save path
-- can forget to.
--
-- DHIS (Digital Health Incentive Scheme) pays per *linked* record: category 1
-- (diagnostic report, discharge summary) and category 2 (everything else).
-- The category follows from the HI types; the month is the month it was
-- linked, in IST, which is how NHA counts it.
--
--   not_linked  captured, not yet sent to ABDM (why not: see last_error)
--   linking     sent; waiting for ABDM's callback
--   linked      ABDM confirmed the link
--   failed      ABDM refused or the call failed; retry from the chart

CREATE TABLE public.abdm_care_contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    facility_id uuid REFERENCES public.facilities(id),
    source_kind text NOT NULL
        CHECK (source_kind IN ('opd_consult', 'prescription', 'lab_report', 'discharge_summary')),
    source_id uuid NOT NULL,
    encounter_id uuid,
    reference_number text NOT NULL,
    display text NOT NULL,
    hi_types text[] NOT NULL
        CHECK (hi_types <> '{}' AND hi_types <@ ARRAY['OPConsultation', 'Prescription',
            'DiagnosticReport', 'DischargeSummary', 'ImmunizationRecord',
            'HealthDocumentRecord', 'WellnessRecord', 'Invoice']::text[]),
    record_date date NOT NULL,
    link_status text NOT NULL DEFAULT 'not_linked'
        CHECK (link_status IN ('not_linked', 'linking', 'linked', 'failed')),
    linked_at timestamptz,
    linked_via text CHECK (linked_via IN ('hip_initiated', 'user_initiated')),
    abdm_request_id uuid,
    last_error text,
    dhis_category smallint GENERATED ALWAYS AS (
        CASE WHEN hi_types && ARRAY['DiagnosticReport', 'DischargeSummary']::text[]
             THEN 1 ELSE 2 END) STORED,
    dhis_month date GENERATED ALWAYS AS (
        date_trunc('month', timezone('Asia/Kolkata', linked_at))::date) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT abdm_care_contexts_linked_has_time
        CHECK (link_status <> 'linked' OR (linked_at IS NOT NULL AND linked_via IS NOT NULL))
);

CREATE UNIQUE INDEX uq_abdm_care_contexts_reference
    ON public.abdm_care_contexts (tenant_id, reference_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_abdm_care_contexts_source
    ON public.abdm_care_contexts (tenant_id, source_kind, source_id);
CREATE INDEX idx_abdm_care_contexts_patient
    ON public.abdm_care_contexts (tenant_id, patient_id, record_date DESC);
CREATE INDEX idx_abdm_care_contexts_status
    ON public.abdm_care_contexts (tenant_id, link_status, updated_at DESC);
CREATE INDEX idx_abdm_care_contexts_request
    ON public.abdm_care_contexts (tenant_id, abdm_request_id) WHERE abdm_request_id IS NOT NULL;
CREATE INDEX idx_abdm_care_contexts_dhis
    ON public.abdm_care_contexts (tenant_id, dhis_month, dhis_category) WHERE link_status = 'linked';

ALTER TABLE public.abdm_care_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_care_contexts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_care_contexts ON public.abdm_care_contexts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_care_contexts BEFORE UPDATE ON public.abdm_care_contexts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_care_contexts_soft_delete BEFORE DELETE ON public.abdm_care_contexts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A patient's PHR app asking to link care contexts (user-initiated linking).
-- The OTP the hospital sends to the registered mobile is kept only as a hash.
CREATE TABLE public.abdm_link_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    transaction_id text NOT NULL,
    link_ref_number uuid NOT NULL DEFAULT gen_random_uuid(),
    abha_address text,
    care_context_refs text[] NOT NULL CHECK (care_context_refs <> '{}'),
    otp_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'refused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_abdm_link_requests_ref
    ON public.abdm_link_requests (tenant_id, link_ref_number);
CREATE INDEX idx_abdm_link_requests_txn
    ON public.abdm_link_requests (tenant_id, transaction_id);

ALTER TABLE public.abdm_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_link_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_link_requests ON public.abdm_link_requests
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_link_requests BEFORE UPDATE ON public.abdm_link_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_link_requests_soft_delete BEFORE DELETE ON public.abdm_link_requests
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- The gateway names the HIP by its HFR facility ID; the callback has no
-- tenant yet. Returns at most two rows so the caller can refuse an ID two
-- hospitals both claim, and nothing but the two ids.
CREATE OR REPLACE FUNCTION public.app_abdm_hip_tenant(p_hip_id text)
RETURNS TABLE (tenant_id uuid, facility_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT f.tenant_id, f.id FROM public.facilities f
     WHERE f.hfr_facility_id = upper(btrim(p_hip_id)) AND f.deleted_at IS NULL
     LIMIT 2
$$;

COMMENT ON FUNCTION public.app_abdm_hip_tenant(text) IS
    'ABDM callbacks: the tenant and campus an HFR facility ID (X-HIP-ID) belongs to.';

-- Capture one finalised record. Idempotent per source. The campus is the
-- tenant's main campus (records carry no campus yet; see medbrains-fhir-api
-- ENCOUNTER_SELECT). When the patient already holds a verified ABHA, linking
-- is queued on the outbox in the same transaction.
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
        ELSE ARRAY['DischargeSummary'] END;
    v_prefix text := CASE p_kind
        WHEN 'opd_consult' THEN 'OPC' WHEN 'prescription' THEN 'RX'
        WHEN 'lab_report' THEN 'DR' ELSE 'DS' END;
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

    IF v_id IS NOT NULL AND EXISTS (
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
    END IF;
END $$;

-- Capturing a care context must never block the clinical save it rides on:
-- a failure is raised as a warning (server log) and the record can still be
-- linked later from the chart.
CREATE OR REPLACE FUNCTION public.trg_abdm_care_context_capture()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        IF TG_TABLE_NAME = 'encounters' THEN
            PERFORM public.abdm_capture_care_context(NEW.tenant_id, NEW.patient_id,
                'opd_consult', NEW.id, NEW.id, NEW.encounter_date,
                'OP consultation, ' || to_char(NEW.encounter_date, 'DD Mon YYYY'));
        ELSIF TG_TABLE_NAME = 'prescriptions' THEN
            PERFORM public.abdm_capture_care_context(NEW.tenant_id,
                COALESCE(NEW.patient_id,
                    (SELECT e.patient_id FROM public.encounters e WHERE e.id = NEW.encounter_id)),
                'prescription', NEW.id, NEW.encounter_id, NEW.created_at::date,
                'Prescription, ' || to_char(NEW.created_at, 'DD Mon YYYY'));
        ELSIF TG_TABLE_NAME = 'lab_orders' THEN
            PERFORM public.abdm_capture_care_context(NEW.tenant_id, NEW.patient_id,
                'lab_report', NEW.id, NEW.encounter_id,
                COALESCE(NEW.verified_at, now())::date,
                COALESCE((SELECT c.name FROM public.lab_test_catalog c WHERE c.id = NEW.test_id),
                         'Lab report')
                    || ', ' || to_char(COALESCE(NEW.verified_at, now()), 'DD Mon YYYY'));
        ELSE
            PERFORM public.abdm_capture_care_context(a.tenant_id, a.patient_id,
                'discharge_summary', NEW.id, a.encounter_id,
                COALESCE(NEW.finalized_at, now())::date,
                'Discharge summary, ' || to_char(COALESCE(NEW.finalized_at, now()), 'DD Mon YYYY'))
              FROM public.admissions a WHERE a.id = NEW.admission_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'abdm care context capture failed for %.%: %', TG_TABLE_NAME, NEW.id, SQLERRM;
    END;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_encounters_abdm_care_context
    AFTER INSERT OR UPDATE OF status ON public.encounters
    FOR EACH ROW WHEN (NEW.status = 'completed' AND NEW.encounter_type = 'opd' AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.trg_abdm_care_context_capture();
CREATE TRIGGER trg_prescriptions_abdm_care_context
    AFTER INSERT OR UPDATE OF is_signed ON public.prescriptions
    FOR EACH ROW WHEN (NEW.is_signed AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.trg_abdm_care_context_capture();
CREATE TRIGGER trg_lab_orders_abdm_care_context
    AFTER INSERT OR UPDATE OF status ON public.lab_orders
    FOR EACH ROW WHEN (NEW.status = 'verified')
    EXECUTE FUNCTION public.trg_abdm_care_context_capture();
CREATE TRIGGER trg_discharge_summaries_abdm_care_context
    AFTER INSERT OR UPDATE OF status ON public.ipd_discharge_summaries
    FOR EACH ROW WHEN (NEW.status = 'finalized' AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.trg_abdm_care_context_capture();

-- Records finalised in the last year become discoverable too; nothing is
-- queued for them (the backfill runs before any ABHA could be verified here).
INSERT INTO public.abdm_care_contexts
    (tenant_id, patient_id, source_kind, source_id, encounter_id, reference_number,
     display, hi_types, record_date)
SELECT e.tenant_id, e.patient_id, 'opd_consult', e.id, e.id, 'OPC-' || e.id::text,
       'OP consultation, ' || to_char(e.encounter_date, 'DD Mon YYYY'),
       ARRAY['OPConsultation'], e.encounter_date
  FROM public.encounters e
 WHERE e.status = 'completed' AND e.encounter_type = 'opd' AND e.deleted_at IS NULL
   AND e.encounter_date > CURRENT_DATE - 365
UNION ALL
SELECT p.tenant_id, COALESCE(p.patient_id, e.patient_id), 'prescription', p.id, p.encounter_id,
       'RX-' || p.id::text, 'Prescription, ' || to_char(p.created_at, 'DD Mon YYYY'),
       ARRAY['Prescription'], p.created_at::date
  FROM public.prescriptions p JOIN public.encounters e ON e.id = p.encounter_id
 WHERE p.is_signed AND p.deleted_at IS NULL AND p.created_at > now() - interval '365 days'
UNION ALL
SELECT o.tenant_id, o.patient_id, 'lab_report', o.id, o.encounter_id, 'DR-' || o.id::text,
       COALESCE(c.name, 'Lab report') || ', ' || to_char(o.verified_at, 'DD Mon YYYY'),
       ARRAY['DiagnosticReport'], o.verified_at::date
  FROM public.lab_orders o LEFT JOIN public.lab_test_catalog c ON c.id = o.test_id
 WHERE o.status = 'verified' AND o.verified_at > now() - interval '365 days'
UNION ALL
SELECT a.tenant_id, a.patient_id, 'discharge_summary', s.id, a.encounter_id, 'DS-' || s.id::text,
       'Discharge summary, ' || to_char(s.finalized_at, 'DD Mon YYYY'),
       ARRAY['DischargeSummary'], s.finalized_at::date
  FROM public.ipd_discharge_summaries s JOIN public.admissions a ON a.id = s.admission_id
 WHERE s.status = 'finalized' AND s.deleted_at IS NULL AND s.finalized_at > now() - interval '365 days'
ON CONFLICT DO NOTHING;
