-- Signable payload: medical_certificate. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.medical_certificate.v2',
    'record_type',
    'medical_certificate',
    'record_id', c.id,
    'tenant_id', c.tenant_id,
    'encounter_id', c.encounter_id,
    'patient_id', c.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'doctor_id', c.doctor_id,
    'certificate_type', c.certificate_type,
    'certificate_number', c.certificate_number,
    'issued_date', c.issued_date,
    'valid_from', c.valid_from,
    'valid_to', c.valid_to,
    'diagnosis', c.diagnosis,
    'remarks', c.remarks,
    'body', c.body)
FROM medical_certificates c
JOIN patients pat ON pat.tenant_id = c.tenant_id AND pat.id = c.patient_id
WHERE c.tenant_id = $1 AND c.id = $2 AND c.deleted_at IS NULL
AND ($3 <> 'primary' OR c.doctor_id = $4)
