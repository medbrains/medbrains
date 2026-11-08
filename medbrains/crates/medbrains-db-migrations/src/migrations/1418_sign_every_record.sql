-- ====================================================================
-- Migration: 1418_sign_every_record.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: signature_reviews
-- Drops: none
-- ====================================================================
-- Every clinical record a paperless hospital signs can be signed
-- (medbrains-documents/src/signable.rs). Three things here:
--
-- 1. The 17 newly signable tables get `is_signed` and `signed_record_id`,
--    the pair `mark_source_signed` sets, as the four signable before had.
--
-- 2. One edit guard on every signable table, `signable_edit_guard`. An update
--    that changes a signed field of a signed record takes the signature off
--    (`is_signed` false, `signed_record_id` NULL; the signature itself stays in
--    `signed_records` as history) and writes a `<type>.signature_cleared` audit
--    row: the rule #5244 set for discharge summaries, for every type. An update
--    that changes a signed field of a finalized record (a finalized summary, a
--    closed MLC, a voided certificate) is refused with SQLSTATE MB409, which
--    the server answers as 409. It lives in the database so every writer is
--    held to it: handlers, HL7 ingest, jobs and offline sync alike.
--    Arguments: record type; the column that marks a finalized record and its
--    value (empty when the type has none); then the table's signed columns,
--    the ones its payload SQL reads (a unit test in signable.rs checks the two
--    lists agree). A change to a joined table (a prescription item, an MLC
--    injury) does not take the signature off; the public check still reads
--    it as changed.
--
-- 3. `signature_reviews`: the review screen records that the signer opened the
--    record, with the hash of what they saw; the signature carries
--    `reviewed_at`, the last time its signer reviewed that exact content.

-- 1. signed_records takes every signable type (the old names stay: rows
--    signed under them exist), and the newly signable tables get the flags.
ALTER TABLE public.signed_records DROP CONSTRAINT IF EXISTS signed_records_record_type_check;
ALTER TABLE public.signed_records ADD CONSTRAINT signed_records_record_type_check
    CHECK (record_type = ANY (ARRAY['prescription', 'lab_report', 'radiology_report', 'discharge_summary', 'mlc_certificate', 'death_certificate', 'fitness_certificate', 'medical_leave_certificate', 'birth_certificate', 'consent_form', 'operative_note', 'progress_note', 'package_subscription', 'order_basket', 'invoice', 'refund', 'other', 'medication_administration', 'vitals', 'ot_safety_checklist', 'operation_note', 'anaesthesia_record', 'transfusion_record', 'bedside_transfusion', 'icu_flowsheet', 'dama_record', 'mlc_report', 'referral', 'transfer_note', 'medical_certificate', 'er_triage', 'er_discharge_summary']));

ALTER TABLE public.order_basket_signatures
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ipd_medication_administration
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.vitals
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ot_surgical_safety_checklists
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ot_case_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ot_anesthesia_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.transfusion_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.transfusions
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.icu_flowsheets
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ipd_dama_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ipd_death_summaries
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.mlc_cases
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.referrals
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.ipd_transfer_logs
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.medical_certificates
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.er_triage_assessments
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);
ALTER TABLE public.er_discharge_summaries
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid REFERENCES public.signed_records(id);

-- 2. The edit guard.
CREATE OR REPLACE FUNCTION public.signable_edit_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_old    jsonb := to_jsonb(OLD);
    v_new    jsonb := to_jsonb(NEW);
    v_user   uuid;
    v_edited boolean := false;
BEGIN
    FOR i IN 3 .. TG_NARGS - 1 LOOP
        IF v_old -> TG_ARGV[i] IS DISTINCT FROM v_new -> TG_ARGV[i] THEN
            v_edited := true;
            EXIT;
        END IF;
    END LOOP;
    IF NOT v_edited THEN
        RETURN NEW;
    END IF;

    IF TG_ARGV[1] <> '' AND v_old ->> TG_ARGV[1] = TG_ARGV[2] THEN
        RAISE EXCEPTION 'This % is % and can no longer be edited.',
            replace(TG_ARGV[0], '_', ' '), TG_ARGV[2]
            USING ERRCODE = 'MB409';
    END IF;

    -- An update that clears the signature itself (the discharge summary
    -- handler does, and audits it) is left alone.
    IF OLD.is_signed AND NEW.is_signed THEN
        NEW.is_signed := false;
        NEW.signed_record_id := NULL;
        BEGIN
            v_user := NULLIF(current_setting('app.user_id', true), '')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_user := NULL;
        END;
        INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id,
                                      old_values, new_values)
        VALUES (NEW.tenant_id, v_user, TG_ARGV[0] || '.signature_cleared', TG_ARGV[0], NEW.id,
                jsonb_build_object('signed_record_id', OLD.signed_record_id), NULL);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_signable_edit ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_signable_edit BEFORE UPDATE ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('prescription', '', '', 'doctor_id', 'encounter_id', 'notes', 'patient_id');
DROP TRIGGER IF EXISTS trg_lab_results_signable_edit ON public.lab_results;
CREATE TRIGGER trg_lab_results_signable_edit BEFORE UPDATE ON public.lab_results
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('lab_report', '', '', 'critical_flag', 'entered_by', 'flag', 'is_abnormal', 'is_auto_validated', 'is_critical', 'method', 'normal_range', 'notes', 'numeric_value', 'order_id', 'parameter_name', 'reference_range', 'result_value', 'unit', 'value');
DROP TRIGGER IF EXISTS trg_radiology_reports_signable_edit ON public.radiology_reports;
CREATE TRIGGER trg_radiology_reports_signable_edit BEFORE UPDATE ON public.radiology_reports
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('radiology_report', '', '', 'findings', 'impression', 'is_critical', 'order_id', 'recommendations', 'reported_by', 'template_name');
DROP TRIGGER IF EXISTS trg_ipd_discharge_summaries_signable_edit ON public.ipd_discharge_summaries;
CREATE TRIGGER trg_ipd_discharge_summaries_signable_edit BEFORE UPDATE ON public.ipd_discharge_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('discharge_summary', 'status', 'finalized', 'activity_restrictions', 'admission_id', 'condition_at_discharge', 'course_in_hospital', 'dietary_advice', 'emergency_contact_info', 'final_diagnosis', 'follow_up_date', 'follow_up_instructions', 'investigation_summary', 'medications_on_discharge', 'prepared_by', 'procedures_performed', 'template_id', 'treatment_given', 'warning_signs');
DROP TRIGGER IF EXISTS trg_order_basket_signatures_signable_edit ON public.order_basket_signatures;
CREATE TRIGGER trg_order_basket_signatures_signable_edit BEFORE UPDATE ON public.order_basket_signatures
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('order_basket', '', '', 'created_order_ids', 'encounter_id', 'items_count', 'items_snapshot', 'override_reasons', 'patient_id', 'signed_at', 'signed_by', 'warnings_acknowledged');
DROP TRIGGER IF EXISTS trg_ipd_medication_administration_signable_edit ON public.ipd_medication_administration;
CREATE TRIGGER trg_ipd_medication_administration_signable_edit BEFORE UPDATE ON public.ipd_medication_administration
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('medication_administration', '', '', 'administered_at', 'administered_by', 'admission_id', 'barcode_verified', 'batch_expiry', 'batch_number', 'dose', 'double_checked_by', 'drug_name', 'frequency', 'hold_reason', 'is_high_alert', 'missed_reason', 'notes', 'prescription_item_id', 'prn_reason', 'refused_reason', 'route', 'scheduled_at', 'status', 'witnessed_by');
DROP TRIGGER IF EXISTS trg_vitals_signable_edit ON public.vitals;
CREATE TRIGGER trg_vitals_signable_edit BEFORE UPDATE ON public.vitals
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('vitals', '', '', 'bmi', 'bp_diastolic', 'bp_systolic', 'capillary_refill_seconds', 'consciousness', 'diastolic_bp', 'encounter_id', 'fio2_percent', 'head_circumference_cm', 'height_cm', 'is_retrospective', 'notes', 'oxygen_device', 'oxygen_flow_lpm', 'pain_score', 'pulse', 'pulse_rate', 'recorded_at', 'recorded_by', 'respiratory_distress', 'respiratory_rate', 'spo2', 'systolic_bp', 'temperature', 'weight_kg');
DROP TRIGGER IF EXISTS trg_ot_surgical_safety_checklists_signable_edit ON public.ot_surgical_safety_checklists;
CREATE TRIGGER trg_ot_surgical_safety_checklists_signable_edit BEFORE UPDATE ON public.ot_surgical_safety_checklists
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('ot_safety_checklist', '', '', 'booking_id', 'completed', 'completed_at', 'completed_by', 'items', 'phase', 'verified_by');
DROP TRIGGER IF EXISTS trg_ot_case_records_signable_edit ON public.ot_case_records;
CREATE TRIGGER trg_ot_case_records_signable_edit BEFORE UPDATE ON public.ot_case_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('operation_note', '', '', 'blood_loss_ml', 'booking_id', 'closure_time', 'complications', 'count_discrepancy_action', 'drains', 'findings', 'implants', 'incision_time', 'instrument_count_correct_after', 'instrument_count_correct_before', 'notes', 'patient_in_time', 'patient_out_time', 'procedure_performed', 'specimens', 'sponge_count_correct', 'surgeon_id', 'technique');
DROP TRIGGER IF EXISTS trg_ot_anesthesia_records_signable_edit ON public.ot_anesthesia_records;
CREATE TRIGGER trg_ot_anesthesia_records_signable_edit BEFORE UPDATE ON public.ot_anesthesia_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('anaesthesia_record', '', '', 'adverse_events', 'airway_details', 'anesthesia_type', 'anesthetist_id', 'asa_class', 'blood_products', 'booking_id', 'complications', 'drugs_administered', 'extubation_time', 'fasting_override_reason', 'fluids_given', 'induction_time', 'intubation_time', 'monitoring_events', 'notes');
DROP TRIGGER IF EXISTS trg_transfusion_records_signable_edit ON public.transfusion_records;
CREATE TRIGGER trg_transfusion_records_signable_edit BEFORE UPDATE ON public.transfusion_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('transfusion_record', '', '', 'administered_by', 'completed_at', 'component_id', 'crossmatch_id', 'emergency_reason', 'emergency_release', 'has_reaction', 'notes', 'patient_id', 'patient_verified_by', 'product_verified_by', 'reaction_details', 'reaction_severity', 'reaction_type', 'started_at', 'verified_by', 'volume_transfused_ml');
DROP TRIGGER IF EXISTS trg_transfusions_signable_edit ON public.transfusions;
CREATE TRIGGER trg_transfusions_signable_edit BEFORE UPDATE ON public.transfusions
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('bedside_transfusion', '', '', 'action_taken', 'admission_id', 'adverse_reaction', 'bag_number', 'blood_group', 'completed_by_id', 'consent_on_file', 'crossmatch_compatible', 'expiry_date', 'patient_verified_by_id', 'product_type', 'product_verified_by_id', 'reaction_time', 'reaction_type', 'rh_factor', 'started_by_id', 'total_volume_infused_ml', 'transfusion_date', 'transfusion_end_time', 'transfusion_start_time', 'volume_ml', 'wristband_uhid');
DROP TRIGGER IF EXISTS trg_icu_flowsheets_signable_edit ON public.icu_flowsheets;
CREATE TRIGGER trg_icu_flowsheets_signable_edit BEFORE UPDATE ON public.icu_flowsheets
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('icu_flowsheet', '', '', 'admission_id', 'cvp', 'diastolic_bp', 'drain_ml', 'heart_rate', 'infusions', 'intake_ml', 'mean_arterial_bp', 'notes', 'output_ml', 'recorded_at', 'recorded_by', 'respiratory_rate', 'spo2', 'systolic_bp', 'temperature', 'urine_ml');
DROP TRIGGER IF EXISTS trg_ipd_dama_records_signable_edit ON public.ipd_dama_records;
CREATE TRIGGER trg_ipd_dama_records_signable_edit BEFORE UPDATE ON public.ipd_dama_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('dama_record', '', '', 'admission_id', 'declared_at', 'declared_by', 'is_mlc_case', 'notes', 'patient_signature_url', 'patient_signed', 'reason_for_leaving', 'record_type', 'relative_name', 'relative_relation', 'relative_signature_url', 'relative_signed', 'risks_explained', 'witness_name', 'witness_signature_url', 'witness_signed');
DROP TRIGGER IF EXISTS trg_ipd_death_summaries_signable_edit ON public.ipd_death_summaries;
CREATE TRIGGER trg_ipd_death_summaries_signable_edit BEFORE UPDATE ON public.ipd_death_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('death_certificate', '', '', 'admission_id', 'autopsy_requested', 'cause_of_death_primary', 'cause_of_death_secondary', 'cause_of_death_tertiary', 'cause_of_death_underlying', 'certifying_doctor_id', 'date_of_death', 'duration_of_illness', 'form_type', 'is_medico_legal', 'manner_of_death', 'notes', 'patient_id', 'time_of_death', 'witness_name');
DROP TRIGGER IF EXISTS trg_mlc_cases_signable_edit ON public.mlc_cases;
CREATE TRIGGER trg_mlc_cases_signable_edit BEFORE UPDATE ON public.mlc_cases
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('mlc_report', 'status', 'closed', 'admission_id', 'alleged_history', 'brought_by', 'case_type', 'cause_of_death', 'condition_on_arrival', 'date_time_of_incident', 'er_visit_id', 'examination_findings', 'examined_at', 'examining_doctor_id', 'fir_number', 'history_of_incident', 'informant_contact', 'informant_name', 'informant_relation', 'is_death_case', 'is_pocso', 'medical_opinion', 'mlc_number', 'nature_of_case', 'opinion', 'patient_condition_at_discharge', 'patient_id', 'place_of_incident', 'police_dd_number', 'police_officer_name', 'police_officer_rank', 'police_station', 'registration_date', 'registration_time', 'samples_handed_to', 'treatment_given', 'weapon_used');
DROP TRIGGER IF EXISTS trg_referrals_signable_edit ON public.referrals;
CREATE TRIGGER trg_referrals_signable_edit BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('referral', '', '', 'clinical_notes', 'encounter_id', 'from_department_id', 'from_doctor_id', 'patient_id', 'reason', 'to_department_id', 'to_doctor_id', 'urgency');
DROP TRIGGER IF EXISTS trg_ipd_transfer_logs_signable_edit ON public.ipd_transfer_logs;
CREATE TRIGGER trg_ipd_transfer_logs_signable_edit BEFORE UPDATE ON public.ipd_transfer_logs
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('transfer_note', '', '', 'admission_id', 'clinical_summary', 'from_bed_id', 'from_ward_id', 'notes', 'reason', 'to_bed_id', 'to_ward_id', 'transfer_type', 'transferred_at', 'transferred_by');
DROP TRIGGER IF EXISTS trg_medical_certificates_signable_edit ON public.medical_certificates;
CREATE TRIGGER trg_medical_certificates_signable_edit BEFORE UPDATE ON public.medical_certificates
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('medical_certificate', 'is_void', 'true', 'body', 'certificate_number', 'certificate_type', 'diagnosis', 'doctor_id', 'encounter_id', 'issued_date', 'patient_id', 'remarks', 'valid_from', 'valid_to');
DROP TRIGGER IF EXISTS trg_er_triage_assessments_signable_edit ON public.er_triage_assessments;
CREATE TRIGGER trg_er_triage_assessments_signable_edit BEFORE UPDATE ON public.er_triage_assessments
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('er_triage', '', '', 'allergies', 'assessed_at', 'assessed_by', 'blood_pressure_diastolic', 'blood_pressure_systolic', 'chief_complaint', 'disability_assessment', 'er_visit_id', 'gcs_eye', 'gcs_motor', 'gcs_score', 'gcs_verbal', 'is_pregnant', 'notes', 'pain_score', 'presenting_symptoms', 'pulse_rate', 'respiratory_rate', 'score', 'spo2', 'triage_level', 'triage_system');
DROP TRIGGER IF EXISTS trg_er_discharge_summaries_signable_edit ON public.er_discharge_summaries;
CREATE TRIGGER trg_er_discharge_summaries_signable_edit BEFORE UPDATE ON public.er_discharge_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('er_discharge_summary', 'status', 'finalized', 'clinical_course', 'condition_at_discharge', 'er_visit_id', 'final_diagnosis', 'follow_up_date', 'follow_up_instructions', 'medications_on_discharge', 'prepared_by', 'treatment_given', 'warning_signs');

-- 3. Who opened a record to sign it, and what they saw.
CREATE TABLE public.signature_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    record_type text NOT NULL CHECK (record_type ~ '^[a-z_]{3,40}$'),
    record_id uuid NOT NULL,
    reviewer_id uuid NOT NULL REFERENCES public.users(id),
    -- SHA-256 of the canonical payload the reviewer was shown.
    payload_hash bytea NOT NULL CHECK (length(payload_hash) = 32),
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_signature_reviews_record
    ON public.signature_reviews (tenant_id, record_type, record_id, reviewer_id, reviewed_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.signature_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_signature_reviews ON public.signature_reviews
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_signature_reviews_soft_delete BEFORE DELETE ON public.signature_reviews
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.signed_records
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
