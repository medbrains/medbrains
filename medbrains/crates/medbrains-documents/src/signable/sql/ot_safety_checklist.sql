-- Signable payload: ot_safety_checklist. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.ot_safety_checklist.v2',
    'record_type',
    'ot_safety_checklist',
    'record_id', c.id,
    'tenant_id', c.tenant_id,
    'booking_id', c.booking_id,
    'booking', jsonb_build_object('id', b.id,
    'patient_id', b.patient_id,
    'admission_id', b.admission_id,
    'procedure_name', b.procedure_name,
    'procedure_code', b.procedure_code,
    'laterality', b.laterality,
    'surgical_site', b.surgical_site,
    'scheduled_date', b.scheduled_date),
    'patient_id', b.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'phase', c.phase,
    'items', c.items,
    'completed', c.completed,
    'completed_by', c.completed_by,
    'completed_at', c.completed_at,
    'verified_by', c.verified_by)
FROM ot_surgical_safety_checklists c
JOIN ot_bookings b ON b.tenant_id = c.tenant_id AND b.id = c.booking_id
JOIN patients pat ON pat.tenant_id = b.tenant_id AND pat.id = b.patient_id
WHERE c.tenant_id = $1 AND c.id = $2 AND c.deleted_at IS NULL
AND ($3 <> 'primary' OR c.completed_by = $4 OR c.verified_by = $4)
