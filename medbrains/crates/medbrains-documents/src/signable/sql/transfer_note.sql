-- Signable payload: transfer_note. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.transfer_note.v2',
    'record_type',
    'transfer_note',
    'record_id', t.id,
    'tenant_id', t.tenant_id,
    'admission_id', t.admission_id,
    'admission', jsonb_build_object('id', a.id,
    'encounter_id', a.encounter_id,
    'patient_id', a.patient_id,
    'admitting_doctor', a.admitting_doctor,
    'admitted_at', a.admitted_at),
    'patient_id', a.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'transfer_type', t.transfer_type,
    'from_ward_id', t.from_ward_id,
    'to_ward_id', t.to_ward_id,
    'from_bed_id', t.from_bed_id,
    'to_bed_id', t.to_bed_id,
    'reason', t.reason,
    'clinical_summary', t.clinical_summary,
    'transferred_by', t.transferred_by,
    'transferred_at', t.transferred_at,
    'notes', t.notes)
FROM ipd_transfer_logs t
JOIN admissions a ON a.tenant_id = t.tenant_id AND a.id = t.admission_id
JOIN patients pat ON pat.tenant_id = a.tenant_id AND pat.id = a.patient_id
WHERE t.tenant_id = $1 AND t.id = $2 AND t.deleted_at IS NULL
AND ($3 <> 'primary' OR t.transferred_by = $4 OR a.admitting_doctor = $4)
