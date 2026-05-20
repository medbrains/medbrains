-- Align print-data document routes with the current database schema.
-- These fields are printable document contract fields referenced by existing
-- routes; keeping them in schema avoids runtime 500s when a document has no row
-- and should simply return 404/empty data.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS aebas_unit_code text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nabh_certificate_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nabh_valid_until date;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nabl_accredited boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nabl_certificate_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nmc_registration_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pcpndt_registration_number text NOT NULL DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pcpndt_valid_until text NOT NULL DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pcpndt_authority text NOT NULL DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS peso_license_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS peso_valid_until text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tan text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pan text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS hospital_code text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS municipal_area text;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_joining date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blood_group text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_url text;

UPDATE public.users
SET registration_number = medical_registration_number
WHERE registration_number IS NULL AND medical_registration_number IS NOT NULL;

UPDATE public.users
SET employee_code = username
WHERE employee_code IS NULL AND username IS NOT NULL;

UPDATE public.users
SET name = full_name
WHERE name IS NULL AND full_name IS NOT NULL;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS abha_address text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS attending_doctor_id uuid;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS primary_diagnosis text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS provisional_diagnosis text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS final_diagnosis text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS discharge_type text;

UPDATE public.admissions
SET attending_doctor_id = admitting_doctor
WHERE attending_doctor_id IS NULL AND admitting_doctor IS NOT NULL;

UPDATE public.admissions
SET primary_diagnosis = provisional_diagnosis
WHERE primary_diagnosis IS NULL AND provisional_diagnosis IS NOT NULL;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_date timestamptz;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS service_code text;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS admission_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'bill';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

UPDATE public.invoices
SET invoice_date = issued_at
WHERE invoice_date IS NULL AND issued_at IS NOT NULL;

UPDATE public.invoice_items
SET service_code = COALESCE(service_code, charge_code),
    category = COALESCE(category, source_module, source::text, 'Other')
WHERE service_code IS NULL OR category IS NULL;

ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS encounter_number text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS chief_complaints text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS examination_findings text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS advice text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS follow_up_instructions text;
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS referral_notes text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS sample_type text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS sample_id text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS report_date timestamptz;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS accession_number text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS order_date timestamptz;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS collection_date timestamptz;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS ordering_doctor_id uuid;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS verified_by_id uuid;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS performed_by_id uuid;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS clinical_history text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS interpretation text;
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS comments text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS reference_range text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS result_value text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS is_abnormal boolean NOT NULL DEFAULT false;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS critical_flag text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.quality_indicators ADD COLUMN IF NOT EXISTS indicator_code text;
ALTER TABLE public.quality_indicators ADD COLUMN IF NOT EXISTS indicator_name text;
ALTER TABLE public.quality_indicators ADD COLUMN IF NOT EXISTS benchmark double precision;
ALTER TABLE public.quality_indicators ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS po_date date;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS deceased_name text;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS age_at_death text;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS certifying_doctor text;
ALTER TABLE public.death_records ADD COLUMN IF NOT EXISTS period text;

UPDATE public.quality_indicators
SET indicator_code = code
WHERE indicator_code IS NULL AND code IS NOT NULL;

UPDATE public.quality_indicators
SET indicator_name = name
WHERE indicator_name IS NULL AND name IS NOT NULL;

UPDATE public.quality_indicators
SET benchmark = target_value
WHERE benchmark IS NULL AND target_value IS NOT NULL;

UPDATE public.lab_orders
SET sample_id = COALESCE(sample_id, sample_barcode, id::text),
    report_date = COALESCE(report_date, verified_at, completed_at, updated_at, created_at),
    received_at = COALESCE(received_at, collected_at, created_at),
    accession_number = COALESCE(accession_number, sample_barcode, id::text),
    order_date = COALESCE(order_date, created_at),
    collection_date = COALESCE(collection_date, collected_at),
    ordering_doctor_id = COALESCE(ordering_doctor_id, ordered_by),
    verified_by_id = COALESCE(verified_by_id, verified_by)
WHERE sample_id IS NULL
   OR report_date IS NULL
   OR received_at IS NULL
   OR accession_number IS NULL
   OR order_date IS NULL
   OR collection_date IS NULL
   OR ordering_doctor_id IS NULL
   OR verified_by_id IS NULL;

UPDATE public.lab_results
SET result_value = COALESCE(result_value, value),
    reference_range = COALESCE(reference_range, normal_range),
    is_abnormal = COALESCE(is_abnormal, flag::text NOT IN ('normal', 'Normal', 'NORMAL', 'none')),
    critical_flag = COALESCE(critical_flag, flag::text)
WHERE result_value IS NULL OR reference_range IS NULL OR critical_flag IS NULL;

UPDATE public.death_records
SET deceased_name = COALESCE(deceased_name, ''),
    age_at_death = COALESCE(age_at_death, ''),
    certifying_doctor = COALESCE(certifying_doctor, ''),
    period = COALESCE(period, to_char(date_of_death, 'YYYY-MM'))
WHERE deceased_name IS NULL OR age_at_death IS NULL OR certifying_doctor IS NULL OR period IS NULL;

UPDATE public.purchase_orders
SET po_date = order_date
WHERE po_date IS NULL AND order_date IS NOT NULL;

ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS report_date date;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS report_type text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS patient_initials text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS patient_weight_kg numeric;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS patient_height_cm numeric;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS reaction_start_date date;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS reaction_end_date date;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS reaction_outcome text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS seriousness text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS dechallenge_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS dechallenge_result text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS rechallenge_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS rechallenge_result text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS who_umc_category text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS naranjo_score integer;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS reporter_contact text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS pvpi_id text;
ALTER TABLE public.adr_reports ADD COLUMN IF NOT EXISTS vigiflow_id text;

UPDATE public.adr_reports
SET report_date = COALESCE(submitted_at::date, created_at::date)
WHERE report_date IS NULL;

UPDATE public.adr_reports
SET reaction_start_date = reaction_date
WHERE reaction_start_date IS NULL AND reaction_date IS NOT NULL;

UPDATE public.adr_reports
SET reaction_outcome = outcome
WHERE reaction_outcome IS NULL AND outcome IS NOT NULL;

UPDATE public.adr_reports
SET seriousness = COALESCE(seriousness, severity::text);

UPDATE public.adr_reports
SET pvpi_id = pvpi_reference
WHERE pvpi_id IS NULL AND pvpi_reference IS NOT NULL;

ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS certificate_number text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS certificate_date date;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS person_name text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS person_gender text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS stated_age text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS purpose_of_examination text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS requisition_from text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS requisition_number text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS requisition_date date;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS general_physical_development text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS weight_kg numeric;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS breast_development text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS pubic_hair text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS axillary_hair text;
ALTER TABLE public.age_estimations ADD COLUMN IF NOT EXISTS facial_hair text;

ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS donor_name text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS rh_factor text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS father_husband_name text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS id_proof_type text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS id_proof_number text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS donation_type text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS previous_donations integer NOT NULL DEFAULT 0;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS last_donation_date date;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS weight_kg double precision;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS blood_pressure text;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS pulse integer;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS temperature double precision;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS hemoglobin double precision;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS fit_to_donate boolean NOT NULL DEFAULT false;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS consent_date date;
ALTER TABLE public.blood_donors ADD COLUMN IF NOT EXISTS medical_officer_id uuid;

UPDATE public.blood_donors
SET registration_number = donor_number
WHERE registration_number IS NULL AND donor_number IS NOT NULL;

UPDATE public.blood_donors
SET donor_name = trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE donor_name IS NULL;

UPDATE public.blood_donors
SET id_proof_type = id_type
WHERE id_proof_type IS NULL AND id_type IS NOT NULL;

UPDATE public.blood_donors
SET id_proof_number = id_number
WHERE id_proof_number IS NULL AND id_number IS NOT NULL;

ALTER TABLE public.calibrations ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE public.calibrations ADD COLUMN IF NOT EXISTS calibration_standard text;
ALTER TABLE public.calibrations ADD COLUMN IF NOT EXISTS calibrated_by uuid;
ALTER TABLE public.calibrations ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.calibrations ADD COLUMN IF NOT EXISTS remarks text;

UPDATE public.calibrations
SET calibrated_by = performed_by
WHERE calibrated_by IS NULL AND performed_by IS NOT NULL;

ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS equipment_code text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS installation_date date;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS warranty_expiry date;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS purchase_cost double precision;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS category_id uuid;

UPDATE public.equipment
SET equipment_code = asset_tag
WHERE equipment_code IS NULL AND asset_tag IS NOT NULL;

UPDATE public.equipment
SET warranty_expiry = warranty_until
WHERE warranty_expiry IS NULL AND warranty_until IS NOT NULL;

UPDATE public.equipment
SET purchase_cost = cost::double precision
WHERE purchase_cost IS NULL AND cost IS NOT NULL;

ALTER TABLE public.ot_bookings ADD COLUMN IF NOT EXISTS anesthesiologist_id uuid;

UPDATE public.ot_bookings
SET anesthesiologist_id = anesthetist_id
WHERE anesthesiologist_id IS NULL AND anesthetist_id IS NOT NULL;

ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS procedure_code text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS indication text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS incision text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS findings text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS procedure_details text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS drain_details text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS closure_details text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS estimated_blood_loss_ml integer;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS transfusion_given boolean NOT NULL DEFAULT false;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS immediate_postop_condition text;
ALTER TABLE public.surgeries ADD COLUMN IF NOT EXISTS postop_instructions text;

ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS baby_id text;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS time_of_birth time;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS birth_weight_grams integer;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS delivery_type text;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS mother_admission_id uuid;
ALTER TABLE public.newborn_records ADD COLUMN IF NOT EXISTS attending_doctor_id uuid;

UPDATE public.newborn_records
SET baby_id = id::text
WHERE baby_id IS NULL;

UPDATE public.newborn_records
SET date_of_birth = birth_date::date
WHERE date_of_birth IS NULL AND birth_date IS NOT NULL;

UPDATE public.newborn_records
SET time_of_birth = birth_date::time
WHERE time_of_birth IS NULL AND birth_date IS NOT NULL;

UPDATE public.newborn_records
SET birth_weight_grams = weight_gm
WHERE birth_weight_grams IS NULL AND weight_gm IS NOT NULL;

ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS assessed_by_id uuid;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS history_of_falling integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS secondary_diagnosis integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS ambulatory_aid integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS iv_heparin_lock integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS iv_therapy integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS gait_transferring integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS gait integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS mental_status integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS total_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS fall_precautions_implemented boolean NOT NULL DEFAULT false;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS bed_alarm_on boolean NOT NULL DEFAULT false;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS side_rails_up boolean NOT NULL DEFAULT false;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS call_bell_within_reach boolean NOT NULL DEFAULT false;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS non_slip_footwear boolean NOT NULL DEFAULT false;
ALTER TABLE public.fall_risk_assessments ADD COLUMN IF NOT EXISTS next_reassessment_date timestamptz;

UPDATE public.fall_risk_assessments
SET assessed_by_id = recorded_by
WHERE assessed_by_id IS NULL AND recorded_by IS NOT NULL;

UPDATE public.fall_risk_assessments
SET gait = gait_transferring
WHERE gait = 0 AND gait_transferring IS NOT NULL;

UPDATE public.fall_risk_assessments
SET total_score = score
WHERE total_score = 0 AND score IS NOT NULL;

ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS leave_type_id uuid;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS application_number text;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS leave_from date;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS leave_to date;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.leave_applications ADD COLUMN IF NOT EXISTS remarks text;

UPDATE public.leave_applications
SET user_id = employee_id
WHERE user_id IS NULL AND employee_id IS NOT NULL;

UPDATE public.leave_applications
SET leave_from = COALESCE(leave_from, start_date),
    leave_to = COALESCE(leave_to, end_date),
    application_number = COALESCE(application_number, id::text)
WHERE leave_from IS NULL OR leave_to IS NULL OR application_number IS NULL;

ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS registration_date date;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS registration_time time;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS police_officer_name text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS police_officer_rank text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS police_dd_number text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS nature_of_case text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS alleged_history text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS date_time_of_incident timestamptz;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS place_of_incident text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS weapon_used text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS condition_on_arrival text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS treatment_given text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS samples_handed_to text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS opinion text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS patient_condition_at_discharge text;
ALTER TABLE public.mlc_cases ADD COLUMN IF NOT EXISTS examined_at timestamptz;

UPDATE public.mlc_cases
SET registration_date = registered_at::date
WHERE registration_date IS NULL AND registered_at IS NOT NULL;

UPDATE public.mlc_cases
SET registration_time = registered_at::time
WHERE registration_time IS NULL AND registered_at IS NOT NULL;

ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS refund_date timestamptz;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS original_payment_id uuid;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS processed_by uuid;

UPDATE public.refunds
SET refund_date = refunded_at
WHERE refund_date IS NULL AND refunded_at IS NOT NULL;

ALTER TABLE public.restraint_documentation ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE public.restraint_documentation ADD COLUMN IF NOT EXISTS actual_end_datetime timestamptz;

ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS user_department_id uuid;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS dispatched_by_id uuid;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS section_code text;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS nature_of_payment text;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS total_payment numeric;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS total_tds_deducted numeric;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS total_tds_deposited numeric;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS challan_number text;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS challan_date date;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS bsr_code text;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS verified_by_id uuid;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS verification_date date;
ALTER TABLE public.tds_certificates ADD COLUMN IF NOT EXISTS place text;

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS work_order_date date;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS work_type text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS estimated_hours double precision;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS estimated_cost double precision;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS materials_required jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS assigned_team text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS completion_date date;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS actual_hours double precision;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS actual_cost double precision;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS work_done text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS verified_by uuid;
UPDATE public.work_orders
SET work_order_date = COALESCE(work_order_date, requested_at::date, created_at::date),
    work_type = COALESCE(work_type, category),
    estimated_cost = COALESCE(estimated_cost, cost)
WHERE work_order_date IS NULL OR work_type IS NULL OR estimated_cost IS NULL;
ALTER TABLE public.tv_displays ADD COLUMN IF NOT EXISTS room_number text;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS unit_id uuid;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS issue_number text;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS issued_by uuid;
ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS verified_by uuid;

ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS admission_id uuid;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS insurance_id uuid;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS total_bill_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS deductions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS patient_payable numeric NOT NULL DEFAULT 0;

ALTER TABLE public.patient_insurance ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.patient_insurance ADD COLUMN IF NOT EXISTS tpa_id uuid;

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS pan text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address text;
UPDATE public.vendors
SET pan = pan_number
WHERE pan IS NULL AND pan_number IS NOT NULL;
UPDATE public.vendors
SET address = concat_ws(', ', address_line1, address_line2, city, state, pincode)
WHERE address IS NULL;

ALTER TABLE public.training_attendance ADD COLUMN IF NOT EXISTS training_id uuid;
ALTER TABLE public.training_attendance ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.training_attendance ADD COLUMN IF NOT EXISTS certificate_number text;
ALTER TABLE public.training_attendance ADD COLUMN IF NOT EXISTS score double precision;
ALTER TABLE public.training_attendance ADD COLUMN IF NOT EXISTS issued_by uuid;
UPDATE public.training_attendance
SET user_id = employee_id
WHERE user_id IS NULL AND employee_id IS NOT NULL;

ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS pulse_rate integer;
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS pain_score integer;
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS bp_systolic integer;
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS bp_diastolic integer;
UPDATE public.vitals
SET pulse_rate = pulse
WHERE pulse_rate IS NULL AND pulse IS NOT NULL;

UPDATE public.vitals v
SET patient_id = e.patient_id
FROM public.encounters e
WHERE v.patient_id IS NULL
  AND v.encounter_id = e.id
  AND v.tenant_id = e.tenant_id;

UPDATE public.vitals
SET bp_systolic = systolic_bp
WHERE bp_systolic IS NULL AND systolic_bp IS NOT NULL;

UPDATE public.vitals
SET bp_diastolic = diastolic_bp
WHERE bp_diastolic IS NULL AND diastolic_bp IS NOT NULL;

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS admission_id uuid;
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS time_slots text[];
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS quantity integer;
UPDATE public.prescription_items
SET status = item_status
WHERE status IS NULL AND item_status IS NOT NULL;

ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS prepared_by_id uuid;
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS reviewed_by_id uuid;
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS approved_by_id uuid;

CREATE TABLE IF NOT EXISTS public.incident_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL DEFAULT '',
    incident_date timestamptz NOT NULL DEFAULT now(),
    incident_type text NOT NULL DEFAULT '',
    severity text NOT NULL DEFAULT '',
    department_id uuid,
    description text NOT NULL DEFAULT '',
    immediate_action text,
    reported_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_number text NOT NULL DEFAULT '';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_date timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_type text NOT NULL DEFAULT '';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT '';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS immediate_action text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reported_by uuid;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS report_date date;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS report_time time;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_time time;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_location text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_category text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS severity_level text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS patient_involved boolean NOT NULL DEFAULT false;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS patient_harm_level text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_description text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS immediate_action_taken text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS patient_condition_post_incident text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS root_cause_identified text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS department_head_notified boolean NOT NULL DEFAULT false;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS quality_dept_notified boolean NOT NULL DEFAULT false;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS risk_management_notified boolean NOT NULL DEFAULT false;
UPDATE public.incident_reports
SET report_date = COALESCE(report_date, incident_date::date, created_at::date),
    report_time = COALESCE(report_time, incident_date::time, created_at::time),
    incident_time = COALESCE(incident_time, incident_date::time),
    incident_category = COALESCE(incident_category, incident_type),
    severity_level = COALESCE(severity_level, severity),
    incident_description = COALESCE(incident_description, description),
    immediate_action_taken = COALESCE(immediate_action_taken, immediate_action)
WHERE report_date IS NULL
   OR report_time IS NULL
   OR incident_time IS NULL
   OR incident_category IS NULL
   OR severity_level IS NULL
   OR incident_description IS NULL
   OR immediate_action_taken IS NULL;

UPDATE public.component_issues
SET unit_id = blood_bag_unit_id
WHERE unit_id IS NULL AND blood_bag_unit_id IS NOT NULL;

ALTER TABLE public.component_issues ADD COLUMN IF NOT EXISTS special_instructions text;

CREATE TABLE IF NOT EXISTS public.patient_insurances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    patient_id uuid,
    payer_name text,
    policy_number text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpa_companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.claim_procedures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    claim_id uuid,
    procedure_name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blood_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    patient_id uuid,
    admission_id uuid,
    request_number text,
    patient_blood_group text,
    patient_rh_type text,
    component_type text,
    blood_group text,
    units_requested integer NOT NULL DEFAULT 0,
    requested_at timestamptz NOT NULL DEFAULT now(),
    requested_by uuid,
    processed_by uuid,
    verified_by uuid,
    diagnosis text,
    indication text,
    antibody_screen text,
    special_requirements text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crossmatch_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    request_id uuid,
    unit_id uuid,
    result text,
    issue_status text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mlc_injuries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    mlc_case_id uuid,
    injury_number integer NOT NULL DEFAULT 0,
    injury_type text NOT NULL DEFAULT '',
    location text,
    size_cm text,
    description text,
    probable_age text,
    probable_weapon text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mlc_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    mlc_case_id uuid,
    sample_description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prescription_medications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    encounter_id uuid,
    drug_catalog_id uuid,
    drug_name text NOT NULL DEFAULT '',
    dose text NOT NULL DEFAULT '',
    route text NOT NULL DEFAULT '',
    frequency text NOT NULL DEFAULT '',
    duration text NOT NULL DEFAULT '',
    quantity integer,
    instructions text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drug_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    brand_name text,
    generic_name text,
    is_controlled boolean NOT NULL DEFAULT false,
    schedule text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.encounter_diagnoses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    encounter_id uuid,
    icd_code text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.iv_fluid_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    admission_id uuid,
    fluid_name text NOT NULL DEFAULT '',
    volume_ml integer NOT NULL DEFAULT 0,
    rate text,
    additives text[],
    start_time timestamptz NOT NULL DEFAULT now(),
    duration_hours double precision,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stat_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    admission_id uuid,
    order_type text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    ordered_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calibration_agencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    name text NOT NULL DEFAULT '',
    accreditation_number text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blood_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    bag_number text NOT NULL DEFAULT '',
    donation_date date NOT NULL DEFAULT current_date,
    expiry_date date NOT NULL DEFAULT current_date,
    blood_group text NOT NULL DEFAULT '',
    component_type text NOT NULL DEFAULT '',
    volume_ml integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fluid_intake (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    intake_type text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    volume_ml integer NOT NULL DEFAULT 0,
    route text,
    recorded_by_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fluid_output (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    admission_id uuid,
    output_time timestamptz NOT NULL DEFAULT now(),
    route text NOT NULL DEFAULT '',
    quantity_ml integer NOT NULL DEFAULT 0,
    remarks text,
    recorded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS output_type text;
ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS volume_ml integer;
ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS characteristics text;
ALTER TABLE public.fluid_output ADD COLUMN IF NOT EXISTS recorded_by_id uuid;

UPDATE public.fluid_output
SET recorded_at = COALESCE(recorded_at, output_time, created_at);

UPDATE public.fluid_output
SET output_type = COALESCE(output_type, route, 'output')
WHERE output_type IS NULL;

UPDATE public.fluid_output
SET description = COALESCE(description, remarks, route, 'Output')
WHERE description IS NULL;

UPDATE public.fluid_output
SET volume_ml = COALESCE(volume_ml, quantity_ml, 0)
WHERE volume_ml IS NULL;

UPDATE public.fluid_output
SET recorded_by_id = recorded_by
WHERE recorded_by_id IS NULL AND recorded_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.intake_output (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    intake_oral integer,
    intake_iv integer,
    intake_ng integer,
    intake_other integer,
    output_urine integer,
    output_vomit integer,
    output_drain integer,
    output_stool integer,
    output_other integer,
    recorded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    name text NOT NULL DEFAULT '',
    code text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gcs_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    eye_opening integer,
    verbal_response integer,
    motor_response integer,
    total_score integer,
    pupil_left_size text,
    pupil_left_reaction text,
    pupil_right_size text,
    pupil_right_reaction text,
    bp_systolic integer,
    bp_diastolic integer,
    pulse integer,
    spo2 integer,
    temperature numeric,
    assessed_by_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipd_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    admission_id uuid,
    order_type text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT '',
    drug_name text NOT NULL DEFAULT '',
    dose text NOT NULL DEFAULT '',
    route text,
    frequency text NOT NULL DEFAULT '',
    is_discharge_medication boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_pt_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    program_name text NOT NULL DEFAULT '',
    analyte text NOT NULL DEFAULT '',
    result text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_tat_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    test_category text NOT NULL DEFAULT '',
    target_tat_hours double precision NOT NULL DEFAULT 0,
    actual_tat_hours double precision NOT NULL DEFAULT 0,
    compliance_percentage double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_critical_value_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_critical_values integer NOT NULL DEFAULT 0,
    reported_within_target integer NOT NULL DEFAULT 0,
    average_reporting_time_minutes double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_performance_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    sample_rejection_rate double precision NOT NULL DEFAULT 0,
    repeat_rate double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nabl_scope_of_accreditation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    scope_description text NOT NULL DEFAULT '',
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    code text NOT NULL DEFAULT '',
    name text NOT NULL DEFAULT '',
    description text,
    department_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.package_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    bill_number text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    patient_id uuid,
    admission_id uuid,
    package_id uuid,
    package_amount double precision NOT NULL DEFAULT 0,
    additional_total double precision NOT NULL DEFAULT 0,
    exclusion_total double precision NOT NULL DEFAULT 0,
    gross_amount double precision NOT NULL DEFAULT 0,
    discount_amount double precision NOT NULL DEFAULT 0,
    tax_amount double precision NOT NULL DEFAULT 0,
    net_amount double precision NOT NULL DEFAULT 0,
    advance_paid double precision NOT NULL DEFAULT 0,
    insurance_amount double precision NOT NULL DEFAULT 0,
    balance_due double precision NOT NULL DEFAULT 0,
    doctor_id uuid
);

CREATE TABLE IF NOT EXISTS public.package_inclusions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text NOT NULL DEFAULT '',
    display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.package_additional_charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text NOT NULL DEFAULT '',
    amount double precision NOT NULL DEFAULT 0,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.package_additional_charges ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.package_exclusions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text NOT NULL DEFAULT '',
    amount double precision NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.package_exclusions_used (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text NOT NULL DEFAULT '',
    amount double precision NOT NULL DEFAULT 0,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rca_team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    incident_id uuid,
    user_id uuid,
    department_id uuid,
    role text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rca_data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    incident_id uuid,
    source_name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rca_root_causes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    incident_id uuid,
    category text,
    cause text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rca_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    incident_id uuid,
    action_description text NOT NULL DEFAULT '',
    responsible_person_id uuid,
    target_date date,
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    item_code text NOT NULL DEFAULT '',
    item_name text NOT NULL DEFAULT '',
    unit text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    transfer_id uuid,
    item_id uuid,
    batch_number text,
    expiry_date date,
    quantity double precision NOT NULL DEFAULT 0,
    unit_price double precision NOT NULL DEFAULT 0,
    amount double precision NOT NULL DEFAULT 0,
    line_number integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.education_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    title text NOT NULL DEFAULT '',
    code text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pcpndt_qualified_personnel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL DEFAULT '',
    qualification text NOT NULL DEFAULT '',
    registration_number text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pcpndt_procedure_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    procedure_type text NOT NULL DEFAULT '',
    total_count integer NOT NULL DEFAULT 0,
    male_fetus integer NOT NULL DEFAULT 0,
    female_fetus integer NOT NULL DEFAULT 0,
    indeterminate integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pcpndt_form_f_compliance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_forms integer NOT NULL DEFAULT 0,
    complete_forms integer NOT NULL DEFAULT 0,
    incomplete_forms integer NOT NULL DEFAULT 0,
    compliance_percentage double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pcpndt_inspections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    inspection_date date NOT NULL DEFAULT current_date,
    authority text NOT NULL DEFAULT '',
    findings text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_gas_systems (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    gas_type text NOT NULL DEFAULT '',
    source_type text NOT NULL DEFAULT '',
    location text NOT NULL DEFAULT '',
    capacity text NOT NULL DEFAULT '',
    last_tested date,
    next_test_due date,
    status text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cylinder_storage_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    total_capacity integer NOT NULL DEFAULT 0,
    oxygen_cylinders integer NOT NULL DEFAULT 0,
    nitrous_oxide_cylinders integer NOT NULL DEFAULT 0,
    co2_cylinders integer NOT NULL DEFAULT 0,
    other_cylinders integer NOT NULL DEFAULT 0,
    storage_compliant boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.peso_inspections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    inspection_date date NOT NULL DEFAULT current_date,
    inspector text NOT NULL DEFAULT '',
    findings text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gas_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    incident_date date NOT NULL DEFAULT current_date,
    gas_type text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    action_taken text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL DEFAULT '',
    incident_date timestamptz NOT NULL DEFAULT now(),
    incident_type text NOT NULL DEFAULT '',
    severity text NOT NULL DEFAULT '',
    department_id uuid,
    description text NOT NULL DEFAULT '',
    immediate_action text,
    reported_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trainings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    title text NOT NULL DEFAULT '',
    training_type text,
    training_date date NOT NULL DEFAULT current_date,
    duration_hours double precision,
    trainer_name text,
    trainer_organization text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS training_date date NOT NULL DEFAULT current_date;
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS duration_hours double precision;
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS trainer_name text;
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS trainer_organization text;

ALTER TABLE public.patient_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossmatch_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mlc_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mlc_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iv_fluid_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stat_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluid_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluid_output ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_output ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcs_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipd_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pt_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tat_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_critical_value_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nabl_scope_of_accreditation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_additional_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_exclusions_used ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rca_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rca_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rca_root_causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rca_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpndt_qualified_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpndt_procedure_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpndt_form_f_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpndt_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_gas_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinder_storage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peso_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
