-- ====================================================================
-- Migration: 1418_sign_every_record.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: signature_reviews
-- Drops: none
-- ====================================================================
-- Every clinical record a paperless hospital signs can be signed
-- (medbrains-documents/src/signable.rs).
--
-- 1. signed_records takes every signable type, and the 17 newly signable
--    tables get `is_signed` and `signed_record_id`. Constraints are added NOT
--    VALID and validated apart, so no table is held under an exclusive lock
--    while its rows are checked; lock_timeout bounds every wait.
--
-- 2. Edit guards, so a signature always covers what the record now says:
--    - `signable_edit_guard` on each record. A change to a signed column
--      (every column the payload SQL reads, `deleted_at` included, so a
--      soft delete counts) takes the signature off (`is_signed` false,
--      `signed_record_id` NULL; the signature stays in `signed_records`) and
--      writes a `<type>.signature_cleared` audit row. On a finalized record
--      (finalized summary, closed MLC, voided certificate) a change to a
--      signed column, or a move out of the finalized state, is refused with
--      SQLSTATE MB409, answered 409.
--    - `signable_related_guard` on each related row a record's signature
--      covers: child rows the payload signs (prescription items, MLC
--      injuries) and parents whose fields it shows or whose column names
--      its author (the lab order's test, sample and validator; the
--      radiology order's body part, indication, contrast and pregnancy
--      check; the OT booking's side, site and procedure). An insert, edit or
--      delete takes the record's signature off the same way, and is refused
--      under a finalized record. A child whose record cannot be read (RLS)
--      is refused rather than passed.
--    - The legal amendment path (an MLC amendment, with its reason in the
--      hash-chained audit log) sets `medbrains.signable_amendment = 'on'` for
--      its transaction; only that lifts the finalized refusal. The signature
--      still comes off.
--    It lives in the database so every writer is held to it: handlers, HL7
--    ingest, jobs and offline sync alike. Arguments: record type, audit
--    action prefix, audit entity, the finalized column and value (empty when
--    the type has none), then the watched columns; a unit test in
--    signable/tests.rs checks they match the payload SQL.
--
--    Authorship: a lab result's author is its order's validator, a
--    radiology report's and a discharge summary's the verifying consultant
--    when one is named; those columns are watched too.
--
-- 3. `signature_reviews`: the review screen records that the signer opened the
--    record, with the hash of what they saw. Signing needs a review of the
--    same content by the same signer within 30 minutes, and the signature
--    carries `reviewed_at`.

SET LOCAL lock_timeout = '5s';

-- 1. Types and flags.
ALTER TABLE public.signed_records DROP CONSTRAINT IF EXISTS signed_records_record_type_check;
ALTER TABLE public.signed_records ADD CONSTRAINT signed_records_record_type_check
    CHECK (record_type = ANY (ARRAY['prescription', 'lab_report', 'radiology_report', 'discharge_summary', 'mlc_certificate', 'death_certificate', 'fitness_certificate', 'medical_leave_certificate', 'birth_certificate', 'consent_form', 'operative_note', 'progress_note', 'package_subscription', 'order_basket', 'invoice', 'refund', 'other', 'medication_administration', 'vitals', 'ot_safety_checklist', 'operation_note', 'anaesthesia_record', 'transfusion_record', 'bedside_transfusion', 'icu_flowsheet', 'dama_record', 'mlc_report', 'referral', 'transfer_note', 'medical_certificate', 'er_triage', 'er_discharge_summary'])) NOT VALID;
ALTER TABLE public.signed_records VALIDATE CONSTRAINT signed_records_record_type_check;

ALTER TABLE public.order_basket_signatures
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.order_basket_signatures DROP CONSTRAINT IF EXISTS order_basket_signatures_signed_record_id_fkey;
ALTER TABLE public.order_basket_signatures ADD CONSTRAINT order_basket_signatures_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.order_basket_signatures VALIDATE CONSTRAINT order_basket_signatures_signed_record_id_fkey;
ALTER TABLE public.ipd_medication_administration
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ipd_medication_administration DROP CONSTRAINT IF EXISTS ipd_medication_administration_signed_record_id_fkey;
ALTER TABLE public.ipd_medication_administration ADD CONSTRAINT ipd_medication_administration_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ipd_medication_administration VALIDATE CONSTRAINT ipd_medication_administration_signed_record_id_fkey;
ALTER TABLE public.vitals
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.vitals DROP CONSTRAINT IF EXISTS vitals_signed_record_id_fkey;
ALTER TABLE public.vitals ADD CONSTRAINT vitals_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.vitals VALIDATE CONSTRAINT vitals_signed_record_id_fkey;
ALTER TABLE public.ot_surgical_safety_checklists
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ot_surgical_safety_checklists DROP CONSTRAINT IF EXISTS ot_surgical_safety_checklists_signed_record_id_fkey;
ALTER TABLE public.ot_surgical_safety_checklists ADD CONSTRAINT ot_surgical_safety_checklists_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ot_surgical_safety_checklists VALIDATE CONSTRAINT ot_surgical_safety_checklists_signed_record_id_fkey;
ALTER TABLE public.ot_case_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ot_case_records DROP CONSTRAINT IF EXISTS ot_case_records_signed_record_id_fkey;
ALTER TABLE public.ot_case_records ADD CONSTRAINT ot_case_records_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ot_case_records VALIDATE CONSTRAINT ot_case_records_signed_record_id_fkey;
ALTER TABLE public.ot_anesthesia_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ot_anesthesia_records DROP CONSTRAINT IF EXISTS ot_anesthesia_records_signed_record_id_fkey;
ALTER TABLE public.ot_anesthesia_records ADD CONSTRAINT ot_anesthesia_records_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ot_anesthesia_records VALIDATE CONSTRAINT ot_anesthesia_records_signed_record_id_fkey;
ALTER TABLE public.transfusion_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.transfusion_records DROP CONSTRAINT IF EXISTS transfusion_records_signed_record_id_fkey;
ALTER TABLE public.transfusion_records ADD CONSTRAINT transfusion_records_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.transfusion_records VALIDATE CONSTRAINT transfusion_records_signed_record_id_fkey;
ALTER TABLE public.transfusions
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.transfusions DROP CONSTRAINT IF EXISTS transfusions_signed_record_id_fkey;
ALTER TABLE public.transfusions ADD CONSTRAINT transfusions_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.transfusions VALIDATE CONSTRAINT transfusions_signed_record_id_fkey;
ALTER TABLE public.icu_flowsheets
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.icu_flowsheets DROP CONSTRAINT IF EXISTS icu_flowsheets_signed_record_id_fkey;
ALTER TABLE public.icu_flowsheets ADD CONSTRAINT icu_flowsheets_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.icu_flowsheets VALIDATE CONSTRAINT icu_flowsheets_signed_record_id_fkey;
ALTER TABLE public.ipd_dama_records
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ipd_dama_records DROP CONSTRAINT IF EXISTS ipd_dama_records_signed_record_id_fkey;
ALTER TABLE public.ipd_dama_records ADD CONSTRAINT ipd_dama_records_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ipd_dama_records VALIDATE CONSTRAINT ipd_dama_records_signed_record_id_fkey;
ALTER TABLE public.ipd_death_summaries
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ipd_death_summaries DROP CONSTRAINT IF EXISTS ipd_death_summaries_signed_record_id_fkey;
ALTER TABLE public.ipd_death_summaries ADD CONSTRAINT ipd_death_summaries_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ipd_death_summaries VALIDATE CONSTRAINT ipd_death_summaries_signed_record_id_fkey;
ALTER TABLE public.mlc_cases
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.mlc_cases DROP CONSTRAINT IF EXISTS mlc_cases_signed_record_id_fkey;
ALTER TABLE public.mlc_cases ADD CONSTRAINT mlc_cases_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.mlc_cases VALIDATE CONSTRAINT mlc_cases_signed_record_id_fkey;
ALTER TABLE public.referrals
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_signed_record_id_fkey;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.referrals VALIDATE CONSTRAINT referrals_signed_record_id_fkey;
ALTER TABLE public.ipd_transfer_logs
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.ipd_transfer_logs DROP CONSTRAINT IF EXISTS ipd_transfer_logs_signed_record_id_fkey;
ALTER TABLE public.ipd_transfer_logs ADD CONSTRAINT ipd_transfer_logs_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.ipd_transfer_logs VALIDATE CONSTRAINT ipd_transfer_logs_signed_record_id_fkey;
ALTER TABLE public.medical_certificates
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.medical_certificates DROP CONSTRAINT IF EXISTS medical_certificates_signed_record_id_fkey;
ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.medical_certificates VALIDATE CONSTRAINT medical_certificates_signed_record_id_fkey;
ALTER TABLE public.er_triage_assessments
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.er_triage_assessments DROP CONSTRAINT IF EXISTS er_triage_assessments_signed_record_id_fkey;
ALTER TABLE public.er_triage_assessments ADD CONSTRAINT er_triage_assessments_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.er_triage_assessments VALIDATE CONSTRAINT er_triage_assessments_signed_record_id_fkey;
ALTER TABLE public.er_discharge_summaries
    ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signed_record_id uuid;
ALTER TABLE public.er_discharge_summaries DROP CONSTRAINT IF EXISTS er_discharge_summaries_signed_record_id_fkey;
ALTER TABLE public.er_discharge_summaries ADD CONSTRAINT er_discharge_summaries_signed_record_id_fkey
    FOREIGN KEY (signed_record_id) REFERENCES public.signed_records(id) NOT VALID;
ALTER TABLE public.er_discharge_summaries VALIDATE CONSTRAINT er_discharge_summaries_signed_record_id_fkey;

-- 2. Edit guards.
CREATE OR REPLACE FUNCTION public.signable_signature_cleared(
    p_tenant uuid, p_action text, p_entity text, p_id uuid, p_signed_record uuid
) RETURNS void
    LANGUAGE plpgsql
    SET search_path = public, pg_catalog
    AS $$
DECLARE
    v_user uuid;
BEGIN
    BEGIN
        v_user := NULLIF(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_user := NULL;
    END;
    INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (p_tenant, v_user, p_action || '.signature_cleared', p_entity, p_id,
            jsonb_build_object('signed_record_id', p_signed_record), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.signable_amending() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path = public, pg_catalog
    AS $$ SELECT COALESCE(current_setting('medbrains.signable_amendment', true), '') = 'on' $$;

CREATE OR REPLACE FUNCTION public.signable_edit_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_catalog
    AS $$
DECLARE
    v_old       jsonb := to_jsonb(OLD);
    v_new       jsonb := to_jsonb(NEW);
    v_final_col text := TG_ARGV[3];
    v_final_val text := TG_ARGV[4];
    v_edited    boolean := false;
BEGIN
    FOR i IN 5 .. TG_NARGS - 1 LOOP
        IF v_old -> TG_ARGV[i] IS DISTINCT FROM v_new -> TG_ARGV[i] THEN
            v_edited := true;
            EXIT;
        END IF;
    END LOOP;

    IF v_final_col <> '' AND v_old ->> v_final_col = v_final_val
       AND (v_edited OR v_new ->> v_final_col IS DISTINCT FROM v_final_val)
       AND NOT signable_amending() THEN
        RAISE EXCEPTION 'This % is % and can no longer be changed, except by an amendment.',
            replace(TG_ARGV[0], '_', ' '), replace(v_final_val, 'true', 'void')
            USING ERRCODE = 'MB409';
    END IF;

    -- An update that clears the signature itself (the discharge summary
    -- handler does, and audits it) is left alone.
    IF v_edited AND OLD.is_signed AND NEW.is_signed THEN
        NEW.is_signed := false;
        NEW.signed_record_id := NULL;
        PERFORM signable_signature_cleared(NEW.tenant_id, TG_ARGV[1], TG_ARGV[2], NEW.id,
                                           OLD.signed_record_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signable_related_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_catalog
    AS $$
DECLARE
    v_old        jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_new        jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_record_t   text := TG_ARGV[4];
    v_record_col text := TG_ARGV[5];
    v_key        text := TG_ARGV[6];
    v_final_col  text := TG_ARGV[7];
    v_final_val  text := TG_ARGV[8];
    v_edited     boolean := TG_OP <> 'UPDATE';
    v_value      uuid;
    v_found      boolean;
    rec          record;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        FOR i IN 9 .. TG_NARGS - 1 LOOP
            IF v_old -> TG_ARGV[i] IS DISTINCT FROM v_new -> TG_ARGV[i] THEN
                v_edited := true;
                EXIT;
            END IF;
        END LOOP;
    END IF;
    IF NOT v_edited THEN
        RETURN NULL;
    END IF;

    FOR v_value IN
        SELECT DISTINCT x FROM unnest(ARRAY[(v_old ->> v_key)::uuid, (v_new ->> v_key)::uuid]) AS x
         WHERE x IS NOT NULL
    LOOP
        v_found := false;
        FOR rec IN EXECUTE format(
            'SELECT id, tenant_id, is_signed, signed_record_id, to_jsonb(r) ->> %L AS final_value '
            'FROM %I r WHERE %I = $1 FOR UPDATE',
            v_final_col, v_record_t, v_record_col) USING v_value
        LOOP
            v_found := true;
            IF v_final_col <> '' AND rec.final_value = v_final_val AND NOT signable_amending() THEN
                RAISE EXCEPTION 'This % is % and can no longer be changed, except by an amendment.',
                    replace(TG_ARGV[0], '_', ' '), v_final_val
                    USING ERRCODE = 'MB409';
            END IF;
            IF rec.is_signed THEN
                EXECUTE format('UPDATE %I SET is_signed = false, signed_record_id = NULL WHERE id = $1',
                               v_record_t)
                  USING rec.id;
                PERFORM signable_signature_cleared(rec.tenant_id, TG_ARGV[2], TG_ARGV[3], rec.id,
                                                   rec.signed_record_id);
            END IF;
        END LOOP;
        -- A child whose record this session cannot see (RLS) must not pass
        -- unchecked: that would leave a signature over a changed child.
        IF NOT v_found AND v_record_col = 'id'
           AND COALESCE(current_setting('app.allow_physical_delete', true), '') <> 'true' THEN
            RAISE EXCEPTION 'The % this row belongs to cannot be read; refusing the change.',
                replace(TG_ARGV[0], '_', ' ')
                USING ERRCODE = 'MB409';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_signable_edit ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_signable_edit BEFORE UPDATE OF deleted_at, doctor_id, encounter_id, notes, patient_id ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('prescription', 'prescription', 'prescription', '', '', 'deleted_at', 'doctor_id', 'encounter_id', 'notes', 'patient_id');
DROP TRIGGER IF EXISTS trg_prescription_items_signable_prescription ON public.prescription_items;
CREATE TRIGGER trg_prescription_items_signable_prescription AFTER INSERT OR UPDATE OR DELETE ON public.prescription_items
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('prescription', 'prescription_items', 'prescription', 'prescription', 'prescriptions', 'id', 'prescription_id', '', '', 'catalog_item_id', 'deleted_at', 'dosage', 'drug_name', 'duration', 'end_date', 'frequency', 'instructions', 'prescription_id', 'quantity', 'route', 'time_slots');
DROP TRIGGER IF EXISTS trg_lab_results_signable_edit ON public.lab_results;
CREATE TRIGGER trg_lab_results_signable_edit BEFORE UPDATE OF critical_flag, deleted_at, entered_by, flag, is_abnormal, is_auto_validated, is_critical, method, normal_range, notes, numeric_value, order_id, parameter_name, reference_range, result_value, unit, value ON public.lab_results
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('lab_report', 'lab_report', 'lab_report', '', '', 'critical_flag', 'deleted_at', 'entered_by', 'flag', 'is_abnormal', 'is_auto_validated', 'is_critical', 'method', 'normal_range', 'notes', 'numeric_value', 'order_id', 'parameter_name', 'reference_range', 'result_value', 'unit', 'value');
DROP TRIGGER IF EXISTS trg_lab_orders_signable_lab_report ON public.lab_orders;
CREATE TRIGGER trg_lab_orders_signable_lab_report AFTER INSERT OR UPDATE OR DELETE ON public.lab_orders
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('lab_report', 'lab_orders', 'lab_report', 'lab_report', 'lab_results', 'order_id', 'id', '', '', 'patient_id', 'sample_barcode', 'test_id', 'verified_by');
DROP TRIGGER IF EXISTS trg_radiology_reports_signable_edit ON public.radiology_reports;
CREATE TRIGGER trg_radiology_reports_signable_edit BEFORE UPDATE OF deleted_at, findings, impression, is_critical, order_id, recommendations, reported_by, template_name, verified_by ON public.radiology_reports
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('radiology_report', 'radiology_report', 'radiology_report', '', '', 'deleted_at', 'findings', 'impression', 'is_critical', 'order_id', 'recommendations', 'reported_by', 'template_name', 'verified_by');
DROP TRIGGER IF EXISTS trg_radiology_orders_signable_radiology_report ON public.radiology_orders;
CREATE TRIGGER trg_radiology_orders_signable_radiology_report AFTER INSERT OR UPDATE OR DELETE ON public.radiology_orders
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('radiology_report', 'radiology_orders', 'radiology_report', 'radiology_report', 'radiology_reports', 'order_id', 'id', '', '', 'body_part', 'clinical_indication', 'contrast_required', 'modality_id', 'patient_id', 'pregnancy_checked');
DROP TRIGGER IF EXISTS trg_ipd_discharge_summaries_signable_edit ON public.ipd_discharge_summaries;
CREATE TRIGGER trg_ipd_discharge_summaries_signable_edit BEFORE UPDATE OF activity_restrictions, admission_id, condition_at_discharge, course_in_hospital, deleted_at, dietary_advice, emergency_contact_info, final_diagnosis, follow_up_date, follow_up_instructions, investigation_summary, medications_on_discharge, prepared_by, procedures_performed, status, template_id, treatment_given, verified_by, warning_signs ON public.ipd_discharge_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('discharge_summary', 'ipd.discharge_summary', 'ipd_discharge_summary', 'status', 'finalized', 'activity_restrictions', 'admission_id', 'condition_at_discharge', 'course_in_hospital', 'deleted_at', 'dietary_advice', 'emergency_contact_info', 'final_diagnosis', 'follow_up_date', 'follow_up_instructions', 'investigation_summary', 'medications_on_discharge', 'prepared_by', 'procedures_performed', 'template_id', 'treatment_given', 'verified_by', 'warning_signs');
DROP TRIGGER IF EXISTS trg_order_basket_signatures_signable_edit ON public.order_basket_signatures;
CREATE TRIGGER trg_order_basket_signatures_signable_edit BEFORE UPDATE OF created_order_ids, deleted_at, encounter_id, items_count, items_snapshot, override_reasons, patient_id, signed_at, signed_by, warnings_acknowledged ON public.order_basket_signatures
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('order_basket', 'order_basket', 'order_basket', '', '', 'created_order_ids', 'deleted_at', 'encounter_id', 'items_count', 'items_snapshot', 'override_reasons', 'patient_id', 'signed_at', 'signed_by', 'warnings_acknowledged');
DROP TRIGGER IF EXISTS trg_ipd_medication_administration_signable_edit ON public.ipd_medication_administration;
CREATE TRIGGER trg_ipd_medication_administration_signable_edit BEFORE UPDATE OF administered_at, administered_by, admission_id, barcode_verified, batch_expiry, batch_number, deleted_at, dose, double_checked_by, drug_name, frequency, hold_reason, is_high_alert, missed_reason, notes, prescription_item_id, prn_reason, refused_reason, route, scheduled_at, status, witnessed_by ON public.ipd_medication_administration
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('medication_administration', 'medication_administration', 'medication_administration', '', '', 'administered_at', 'administered_by', 'admission_id', 'barcode_verified', 'batch_expiry', 'batch_number', 'deleted_at', 'dose', 'double_checked_by', 'drug_name', 'frequency', 'hold_reason', 'is_high_alert', 'missed_reason', 'notes', 'prescription_item_id', 'prn_reason', 'refused_reason', 'route', 'scheduled_at', 'status', 'witnessed_by');
DROP TRIGGER IF EXISTS trg_vitals_signable_edit ON public.vitals;
CREATE TRIGGER trg_vitals_signable_edit BEFORE UPDATE OF bmi, bp_diastolic, bp_systolic, capillary_refill_seconds, consciousness, deleted_at, diastolic_bp, encounter_id, fio2_percent, head_circumference_cm, height_cm, is_retrospective, notes, oxygen_device, oxygen_flow_lpm, pain_score, patient_id, pulse, pulse_rate, recorded_at, recorded_by, respiratory_distress, respiratory_rate, spo2, systolic_bp, temperature, weight_kg ON public.vitals
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('vitals', 'vitals', 'vitals', '', '', 'bmi', 'bp_diastolic', 'bp_systolic', 'capillary_refill_seconds', 'consciousness', 'deleted_at', 'diastolic_bp', 'encounter_id', 'fio2_percent', 'head_circumference_cm', 'height_cm', 'is_retrospective', 'notes', 'oxygen_device', 'oxygen_flow_lpm', 'pain_score', 'patient_id', 'pulse', 'pulse_rate', 'recorded_at', 'recorded_by', 'respiratory_distress', 'respiratory_rate', 'spo2', 'systolic_bp', 'temperature', 'weight_kg');
DROP TRIGGER IF EXISTS trg_ot_surgical_safety_checklists_signable_edit ON public.ot_surgical_safety_checklists;
CREATE TRIGGER trg_ot_surgical_safety_checklists_signable_edit BEFORE UPDATE OF booking_id, completed, completed_at, completed_by, deleted_at, items, phase, verified_by ON public.ot_surgical_safety_checklists
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('ot_safety_checklist', 'ot_safety_checklist', 'ot_safety_checklist', '', '', 'booking_id', 'completed', 'completed_at', 'completed_by', 'deleted_at', 'items', 'phase', 'verified_by');
DROP TRIGGER IF EXISTS trg_ot_bookings_signable_ot_safety_checklist ON public.ot_bookings;
CREATE TRIGGER trg_ot_bookings_signable_ot_safety_checklist AFTER INSERT OR UPDATE OR DELETE ON public.ot_bookings
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('ot_safety_checklist', 'ot_bookings', 'ot_safety_checklist', 'ot_safety_checklist', 'ot_surgical_safety_checklists', 'booking_id', 'id', '', '', 'laterality', 'patient_id', 'procedure_code', 'procedure_name', 'surgical_site');
DROP TRIGGER IF EXISTS trg_ot_case_records_signable_edit ON public.ot_case_records;
CREATE TRIGGER trg_ot_case_records_signable_edit BEFORE UPDATE OF blood_loss_ml, booking_id, closure_time, complications, count_discrepancy_action, deleted_at, drains, findings, implants, incision_time, instrument_count_correct_after, instrument_count_correct_before, notes, patient_in_time, patient_out_time, procedure_performed, specimens, sponge_count_correct, surgeon_id, technique ON public.ot_case_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('operation_note', 'operation_note', 'operation_note', '', '', 'blood_loss_ml', 'booking_id', 'closure_time', 'complications', 'count_discrepancy_action', 'deleted_at', 'drains', 'findings', 'implants', 'incision_time', 'instrument_count_correct_after', 'instrument_count_correct_before', 'notes', 'patient_in_time', 'patient_out_time', 'procedure_performed', 'specimens', 'sponge_count_correct', 'surgeon_id', 'technique');
DROP TRIGGER IF EXISTS trg_ot_bookings_signable_operation_note ON public.ot_bookings;
CREATE TRIGGER trg_ot_bookings_signable_operation_note AFTER INSERT OR UPDATE OR DELETE ON public.ot_bookings
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('operation_note', 'ot_bookings', 'operation_note', 'operation_note', 'ot_case_records', 'booking_id', 'id', '', '', 'laterality', 'patient_id', 'procedure_code', 'procedure_name', 'surgical_site');
DROP TRIGGER IF EXISTS trg_ot_anesthesia_records_signable_edit ON public.ot_anesthesia_records;
CREATE TRIGGER trg_ot_anesthesia_records_signable_edit BEFORE UPDATE OF adverse_events, airway_details, anesthesia_type, anesthetist_id, asa_class, blood_products, booking_id, complications, deleted_at, drugs_administered, extubation_time, fasting_override_reason, fluids_given, induction_time, intubation_time, monitoring_events, notes ON public.ot_anesthesia_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('anaesthesia_record', 'anaesthesia_record', 'anaesthesia_record', '', '', 'adverse_events', 'airway_details', 'anesthesia_type', 'anesthetist_id', 'asa_class', 'blood_products', 'booking_id', 'complications', 'deleted_at', 'drugs_administered', 'extubation_time', 'fasting_override_reason', 'fluids_given', 'induction_time', 'intubation_time', 'monitoring_events', 'notes');
DROP TRIGGER IF EXISTS trg_ot_bookings_signable_anaesthesia_record ON public.ot_bookings;
CREATE TRIGGER trg_ot_bookings_signable_anaesthesia_record AFTER INSERT OR UPDATE OR DELETE ON public.ot_bookings
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('anaesthesia_record', 'ot_bookings', 'anaesthesia_record', 'anaesthesia_record', 'ot_anesthesia_records', 'booking_id', 'id', '', '', 'laterality', 'patient_id', 'procedure_code', 'procedure_name', 'surgical_site');
DROP TRIGGER IF EXISTS trg_transfusion_records_signable_edit ON public.transfusion_records;
CREATE TRIGGER trg_transfusion_records_signable_edit BEFORE UPDATE OF administered_by, completed_at, component_id, crossmatch_id, deleted_at, emergency_reason, emergency_release, has_reaction, notes, patient_id, patient_verified_by, product_verified_by, reaction_details, reaction_severity, reaction_type, started_at, verified_by, volume_transfused_ml ON public.transfusion_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('transfusion_record', 'transfusion_record', 'transfusion_record', '', '', 'administered_by', 'completed_at', 'component_id', 'crossmatch_id', 'deleted_at', 'emergency_reason', 'emergency_release', 'has_reaction', 'notes', 'patient_id', 'patient_verified_by', 'product_verified_by', 'reaction_details', 'reaction_severity', 'reaction_type', 'started_at', 'verified_by', 'volume_transfused_ml');
DROP TRIGGER IF EXISTS trg_transfusions_signable_edit ON public.transfusions;
CREATE TRIGGER trg_transfusions_signable_edit BEFORE UPDATE OF action_taken, admission_id, adverse_reaction, bag_number, blood_group, completed_by_id, consent_on_file, crossmatch_compatible, deleted_at, expiry_date, patient_verified_by_id, product_type, product_verified_by_id, reaction_time, reaction_type, rh_factor, started_by_id, total_volume_infused_ml, transfusion_date, transfusion_end_time, transfusion_start_time, volume_ml, wristband_uhid ON public.transfusions
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('bedside_transfusion', 'bedside_transfusion', 'bedside_transfusion', '', '', 'action_taken', 'admission_id', 'adverse_reaction', 'bag_number', 'blood_group', 'completed_by_id', 'consent_on_file', 'crossmatch_compatible', 'deleted_at', 'expiry_date', 'patient_verified_by_id', 'product_type', 'product_verified_by_id', 'reaction_time', 'reaction_type', 'rh_factor', 'started_by_id', 'total_volume_infused_ml', 'transfusion_date', 'transfusion_end_time', 'transfusion_start_time', 'volume_ml', 'wristband_uhid');
DROP TRIGGER IF EXISTS trg_icu_flowsheets_signable_edit ON public.icu_flowsheets;
CREATE TRIGGER trg_icu_flowsheets_signable_edit BEFORE UPDATE OF admission_id, cvp, deleted_at, diastolic_bp, drain_ml, heart_rate, infusions, intake_ml, mean_arterial_bp, notes, output_ml, recorded_at, recorded_by, respiratory_rate, spo2, systolic_bp, temperature, urine_ml ON public.icu_flowsheets
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('icu_flowsheet', 'icu_flowsheet', 'icu_flowsheet', '', '', 'admission_id', 'cvp', 'deleted_at', 'diastolic_bp', 'drain_ml', 'heart_rate', 'infusions', 'intake_ml', 'mean_arterial_bp', 'notes', 'output_ml', 'recorded_at', 'recorded_by', 'respiratory_rate', 'spo2', 'systolic_bp', 'temperature', 'urine_ml');
DROP TRIGGER IF EXISTS trg_ipd_dama_records_signable_edit ON public.ipd_dama_records;
CREATE TRIGGER trg_ipd_dama_records_signable_edit BEFORE UPDATE OF admission_id, declared_at, declared_by, deleted_at, is_mlc_case, notes, patient_signature_url, patient_signed, reason_for_leaving, record_type, relative_name, relative_relation, relative_signature_url, relative_signed, risks_explained, witness_name, witness_signature_url, witness_signed ON public.ipd_dama_records
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('dama_record', 'dama_record', 'dama_record', '', '', 'admission_id', 'declared_at', 'declared_by', 'deleted_at', 'is_mlc_case', 'notes', 'patient_signature_url', 'patient_signed', 'reason_for_leaving', 'record_type', 'relative_name', 'relative_relation', 'relative_signature_url', 'relative_signed', 'risks_explained', 'witness_name', 'witness_signature_url', 'witness_signed');
DROP TRIGGER IF EXISTS trg_ipd_death_summaries_signable_edit ON public.ipd_death_summaries;
CREATE TRIGGER trg_ipd_death_summaries_signable_edit BEFORE UPDATE OF admission_id, autopsy_requested, cause_of_death_primary, cause_of_death_secondary, cause_of_death_tertiary, cause_of_death_underlying, certifying_doctor_id, date_of_death, deleted_at, duration_of_illness, form_type, is_medico_legal, manner_of_death, notes, patient_id, time_of_death, witness_name ON public.ipd_death_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('death_certificate', 'death_certificate', 'death_certificate', '', '', 'admission_id', 'autopsy_requested', 'cause_of_death_primary', 'cause_of_death_secondary', 'cause_of_death_tertiary', 'cause_of_death_underlying', 'certifying_doctor_id', 'date_of_death', 'deleted_at', 'duration_of_illness', 'form_type', 'is_medico_legal', 'manner_of_death', 'notes', 'patient_id', 'time_of_death', 'witness_name');
DROP TRIGGER IF EXISTS trg_mlc_cases_signable_edit ON public.mlc_cases;
CREATE TRIGGER trg_mlc_cases_signable_edit BEFORE UPDATE OF admission_id, alleged_history, brought_by, case_type, cause_of_death, condition_on_arrival, date_time_of_incident, deleted_at, er_visit_id, examination_findings, examined_at, examining_doctor_id, fir_number, history_of_incident, informant_contact, informant_name, informant_relation, is_death_case, is_pocso, medical_opinion, mlc_number, nature_of_case, opinion, patient_condition_at_discharge, patient_id, place_of_incident, police_dd_number, police_officer_name, police_officer_rank, police_station, registration_date, registration_time, samples_handed_to, status, treatment_given, weapon_used ON public.mlc_cases
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('mlc_report', 'mlc_report', 'mlc_report', 'status', 'closed', 'admission_id', 'alleged_history', 'brought_by', 'case_type', 'cause_of_death', 'condition_on_arrival', 'date_time_of_incident', 'deleted_at', 'er_visit_id', 'examination_findings', 'examined_at', 'examining_doctor_id', 'fir_number', 'history_of_incident', 'informant_contact', 'informant_name', 'informant_relation', 'is_death_case', 'is_pocso', 'medical_opinion', 'mlc_number', 'nature_of_case', 'opinion', 'patient_condition_at_discharge', 'patient_id', 'place_of_incident', 'police_dd_number', 'police_officer_name', 'police_officer_rank', 'police_station', 'registration_date', 'registration_time', 'samples_handed_to', 'treatment_given', 'weapon_used');
DROP TRIGGER IF EXISTS trg_mlc_injuries_signable_mlc_report ON public.mlc_injuries;
CREATE TRIGGER trg_mlc_injuries_signable_mlc_report AFTER INSERT OR UPDATE OR DELETE ON public.mlc_injuries
    FOR EACH ROW EXECUTE FUNCTION public.signable_related_guard('mlc_report', 'mlc_injuries', 'mlc_report', 'mlc_report', 'mlc_cases', 'id', 'mlc_case_id', 'status', 'closed', 'body_site_code', 'body_site_laterality', 'deleted_at', 'description', 'injury_number', 'injury_type', 'location', 'mlc_case_id', 'nature', 'probable_age', 'probable_weapon', 'size_cm');
DROP TRIGGER IF EXISTS trg_referrals_signable_edit ON public.referrals;
CREATE TRIGGER trg_referrals_signable_edit BEFORE UPDATE OF clinical_notes, deleted_at, encounter_id, from_department_id, from_doctor_id, patient_id, reason, to_department_id, to_doctor_id, urgency ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('referral', 'referral', 'referral', '', '', 'clinical_notes', 'deleted_at', 'encounter_id', 'from_department_id', 'from_doctor_id', 'patient_id', 'reason', 'to_department_id', 'to_doctor_id', 'urgency');
DROP TRIGGER IF EXISTS trg_ipd_transfer_logs_signable_edit ON public.ipd_transfer_logs;
CREATE TRIGGER trg_ipd_transfer_logs_signable_edit BEFORE UPDATE OF admission_id, clinical_summary, deleted_at, from_bed_id, from_ward_id, notes, reason, to_bed_id, to_ward_id, transfer_type, transferred_at, transferred_by ON public.ipd_transfer_logs
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('transfer_note', 'transfer_note', 'transfer_note', '', '', 'admission_id', 'clinical_summary', 'deleted_at', 'from_bed_id', 'from_ward_id', 'notes', 'reason', 'to_bed_id', 'to_ward_id', 'transfer_type', 'transferred_at', 'transferred_by');
DROP TRIGGER IF EXISTS trg_medical_certificates_signable_edit ON public.medical_certificates;
CREATE TRIGGER trg_medical_certificates_signable_edit BEFORE UPDATE OF body, certificate_number, certificate_type, deleted_at, diagnosis, doctor_id, encounter_id, is_void, issued_date, patient_id, remarks, valid_from, valid_to ON public.medical_certificates
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('medical_certificate', 'medical_certificate', 'medical_certificate', 'is_void', 'true', 'body', 'certificate_number', 'certificate_type', 'deleted_at', 'diagnosis', 'doctor_id', 'encounter_id', 'issued_date', 'patient_id', 'remarks', 'valid_from', 'valid_to');
DROP TRIGGER IF EXISTS trg_er_triage_assessments_signable_edit ON public.er_triage_assessments;
CREATE TRIGGER trg_er_triage_assessments_signable_edit BEFORE UPDATE OF allergies, assessed_at, assessed_by, blood_pressure_diastolic, blood_pressure_systolic, chief_complaint, deleted_at, disability_assessment, er_visit_id, gcs_eye, gcs_motor, gcs_score, gcs_verbal, is_pregnant, notes, pain_score, presenting_symptoms, pulse_rate, respiratory_rate, score, spo2, triage_level, triage_system ON public.er_triage_assessments
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('er_triage', 'er_triage', 'er_triage', '', '', 'allergies', 'assessed_at', 'assessed_by', 'blood_pressure_diastolic', 'blood_pressure_systolic', 'chief_complaint', 'deleted_at', 'disability_assessment', 'er_visit_id', 'gcs_eye', 'gcs_motor', 'gcs_score', 'gcs_verbal', 'is_pregnant', 'notes', 'pain_score', 'presenting_symptoms', 'pulse_rate', 'respiratory_rate', 'score', 'spo2', 'triage_level', 'triage_system');
DROP TRIGGER IF EXISTS trg_er_discharge_summaries_signable_edit ON public.er_discharge_summaries;
CREATE TRIGGER trg_er_discharge_summaries_signable_edit BEFORE UPDATE OF clinical_course, condition_at_discharge, er_visit_id, final_diagnosis, follow_up_date, follow_up_instructions, medications_on_discharge, prepared_by, status, treatment_given, verified_by, warning_signs ON public.er_discharge_summaries
    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('er_discharge_summary', 'er_discharge_summary', 'er_discharge_summary', 'status', 'finalized', 'clinical_course', 'condition_at_discharge', 'er_visit_id', 'final_diagnosis', 'follow_up_date', 'follow_up_instructions', 'medications_on_discharge', 'prepared_by', 'treatment_given', 'verified_by', 'warning_signs');

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
