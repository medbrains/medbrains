-- Signable payload: er_discharge_summary. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.er_discharge_summary.v2',
    'record_type',
    'er_discharge_summary',
    'record_id', s.id,
    'tenant_id', s.tenant_id,
    'er_visit_id', s.er_visit_id,
    'er_visit', jsonb_build_object('id', v.id,
    'patient_id', v.patient_id,
    'encounter_id', v.encounter_id,
    'visit_number', v.visit_number,
    'arrival_time', v.arrival_time),
    'patient_id', v.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'final_diagnosis', s.final_diagnosis,
    'condition_at_discharge', s.condition_at_discharge,
    'clinical_course', s.clinical_course,
    'treatment_given', s.treatment_given,
    'medications_on_discharge', s.medications_on_discharge,
    'follow_up_instructions', s.follow_up_instructions,
    'follow_up_date', s.follow_up_date,
    'warning_signs', s.warning_signs,
    'prepared_by', s.prepared_by)
FROM er_discharge_summaries s
JOIN er_visits v ON v.tenant_id = s.tenant_id AND v.id = s.er_visit_id
JOIN patients pat ON pat.tenant_id = v.tenant_id AND pat.id = v.patient_id
WHERE s.tenant_id = $1 AND s.id = $2
AND ($3 <> 'primary' OR s.prepared_by = $4 OR s.verified_by = $4)
