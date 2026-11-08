-- Signable payload: lab_report. Binds $1 tenant, $2 record; authorship is checked apart (signable.rs).
SELECT jsonb_build_object(
    'schema',
    'medbrains.signable.lab_result.v2',
    'record_type',
    'lab_report',
    'record_id', lr.id,
    'tenant_id', lr.tenant_id,
    'order_id', lr.order_id,
    'order', jsonb_build_object(
    'id', lo.id,
    'encounter_id', lo.encounter_id,
    'patient_id', lo.patient_id,
    'test_id', lo.test_id,
    'priority', lo.priority,
    'sample_barcode', lo.sample_barcode,
    'is_stat', lo.is_stat,
    'camp_id', lo.camp_id,
    'department_id', lo.department_id),
    'patient', jsonb_build_object(
    'id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'parameter_name', lr.parameter_name,
    'value', lr.value,
    'numeric_value', lr.numeric_value,
    'unit', lr.unit,
    'normal_range', lr.normal_range,
    'flag', lr.flag,
    'result_value', lr.result_value,
    'reference_range', lr.reference_range,
    'is_abnormal', lr.is_abnormal,
    'is_critical', lr.is_critical,
    'critical_flag', lr.critical_flag,
    'method', lr.method,
    'notes', lr.notes,
    'is_auto_validated', lr.is_auto_validated,
    'entered_by', lr.entered_by,
    'created_at', lr.created_at)
FROM lab_results lr
JOIN lab_orders lo ON lo.tenant_id = lr.tenant_id AND lo.id = lr.order_id
JOIN patients pat ON pat.tenant_id = lo.tenant_id AND pat.id = lo.patient_id
WHERE lr.tenant_id = $1 AND lr.id = $2 AND lr.deleted_at IS NULL
