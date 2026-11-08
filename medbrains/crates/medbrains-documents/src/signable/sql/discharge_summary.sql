-- Signable payload: discharge_summary. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object(
    'schema',
    'medbrains.signable.ipd_discharge_summary.v2',
    'record_type',
    'discharge_summary',
    'record_id', ds.id,
    'tenant_id', ds.tenant_id,
    'admission_id', ds.admission_id,
    'admission', jsonb_build_object(
    'id', a.id,
    'encounter_id', a.encounter_id,
    'patient_id', a.patient_id,
    'admitting_doctor', a.admitting_doctor,
    'admitted_at', a.admitted_at,
    'ip_type', a.ip_type),
    'patient', jsonb_build_object(
    'id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'template_id', ds.template_id,
    'final_diagnosis', ds.final_diagnosis,
    'condition_at_discharge', ds.condition_at_discharge,
    'course_in_hospital', ds.course_in_hospital,
    'treatment_given', ds.treatment_given,
    'procedures_performed', ds.procedures_performed,
    'investigation_summary', ds.investigation_summary,
    'medications_on_discharge', ds.medications_on_discharge,
    'follow_up_instructions', ds.follow_up_instructions,
    'follow_up_date', ds.follow_up_date,
    'dietary_advice', ds.dietary_advice,
    'activity_restrictions', ds.activity_restrictions,
    'warning_signs', ds.warning_signs,
    'emergency_contact_info', ds.emergency_contact_info,
    'prepared_by', ds.prepared_by,
    'created_at', ds.created_at)
FROM ipd_discharge_summaries ds
JOIN admissions a ON a.tenant_id = ds.tenant_id AND a.id = ds.admission_id
JOIN patients pat ON pat.tenant_id = a.tenant_id AND pat.id = a.patient_id
WHERE ds.tenant_id = $1 AND ds.id = $2 AND ds.deleted_at IS NULL
AND ($3 <> 'primary' OR ds.prepared_by = $4 OR ds.verified_by = $4)
