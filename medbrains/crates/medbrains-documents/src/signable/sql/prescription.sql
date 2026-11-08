-- Signable payload: prescription. Binds $1 tenant, $2 record; authorship is checked apart (signable.rs).
SELECT jsonb_build_object(
    'schema',
    'medbrains.signable.prescription.v2',
    'record_type',
    'prescription',
    'record_id', p.id,
    'tenant_id', p.tenant_id,
    'encounter_id', p.encounter_id,
    'encounter', jsonb_build_object(
    'id', e.id,
    'patient_id', e.patient_id,
    'encounter_type', e.encounter_type,
    'department_id', e.department_id,
    'doctor_id', e.doctor_id,
    'encounter_date', e.encounter_date,
    'visit_type', e.visit_type),
    'patient_id', COALESCE(p.patient_id, e.patient_id),
    'patient', CASE WHEN pat.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth) END,
    'doctor_id', p.doctor_id,
    'notes', p.notes,
    'created_at', p.created_at,
    'items', COALESCE(( SELECT jsonb_agg(jsonb_build_object(
    'id', pi.id,
    'drug_name', pi.drug_name,
    'dosage', pi.dosage,
    'frequency', pi.frequency,
    'duration', pi.duration,
    'route', pi.route,
    'instructions', pi.instructions,
    'quantity', pi.quantity,
    'time_slots', pi.time_slots,
    'end_date', pi.end_date,
    'catalog_item_id', pi.catalog_item_id,
    'created_at', pi.created_at) ORDER BY pi.created_at, pi.id)
FROM prescription_items pi
WHERE pi.tenant_id = p.tenant_id AND pi.prescription_id = p.id AND pi.deleted_at IS NULL),
    '[]'::jsonb))
FROM prescriptions p
LEFT JOIN encounters e ON e.tenant_id = p.tenant_id AND e.id = p.encounter_id
LEFT JOIN patients pat ON pat.tenant_id = p.tenant_id AND pat.id = COALESCE(p.patient_id, e.patient_id)
WHERE p.tenant_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
