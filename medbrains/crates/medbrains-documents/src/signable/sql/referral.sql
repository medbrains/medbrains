-- Signable payload: referral. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.referral.v2',
    'record_type',
    'referral',
    'record_id', r.id,
    'tenant_id', r.tenant_id,
    'encounter_id', r.encounter_id,
    'patient_id', r.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'from_department_id', r.from_department_id,
    'to_department_id', r.to_department_id,
    'from_doctor_id', r.from_doctor_id,
    'to_doctor_id', r.to_doctor_id,
    'urgency', r.urgency,
    'reason', r.reason,
    'clinical_notes', r.clinical_notes)
FROM referrals r
JOIN patients pat ON pat.tenant_id = r.tenant_id AND pat.id = r.patient_id
WHERE r.tenant_id = $1 AND r.id = $2 AND r.deleted_at IS NULL
AND ($3 <> 'primary' OR r.from_doctor_id = $4)
