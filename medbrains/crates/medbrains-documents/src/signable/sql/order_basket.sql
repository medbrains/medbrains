-- Signable payload: order_basket. Binds $1 tenant, $2 record, $3 signer role, $4 signer.
SELECT jsonb_build_object('schema',
    'medbrains.signable.order_basket.v2',
    'record_type',
    'order_basket',
    'record_id', ob.id,
    'tenant_id', ob.tenant_id,
    'encounter_id', ob.encounter_id,
    'patient_id', ob.patient_id,
    'patient', jsonb_build_object('id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'signed_by', ob.signed_by,
    'signed_at', ob.signed_at,
    'items_count', ob.items_count,
    'items_snapshot', ob.items_snapshot,
    'warnings_acknowledged', ob.warnings_acknowledged,
    'override_reasons', ob.override_reasons,
    'created_order_ids', ob.created_order_ids)
FROM order_basket_signatures ob
JOIN patients pat ON pat.tenant_id = ob.tenant_id AND pat.id = ob.patient_id
WHERE ob.tenant_id = $1 AND ob.id = $2 AND ob.deleted_at IS NULL
AND ($3 <> 'primary' OR ob.signed_by = $4)
