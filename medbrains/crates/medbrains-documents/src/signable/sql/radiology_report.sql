-- Signable payload: radiology_report. Binds $1 tenant, $2 record; authorship is checked apart (signable.rs).
SELECT jsonb_build_object(
    'schema',
    'medbrains.signable.radiology_report.v2',
    'record_type',
    'radiology_report',
    'record_id', rr.id,
    'tenant_id', rr.tenant_id,
    'order_id', rr.order_id,
    'order', jsonb_build_object(
    'id', ro.id,
    'patient_id', ro.patient_id,
    'encounter_id', ro.encounter_id,
    'modality_id', ro.modality_id,
    'body_part', ro.body_part,
    'clinical_indication', ro.clinical_indication,
    'priority', ro.priority,
    'contrast_required', ro.contrast_required,
    'pregnancy_checked', ro.pregnancy_checked,
    'allergy_flagged', ro.allergy_flagged,
    'pacs_study_uid', ro.pacs_study_uid),
    'patient', jsonb_build_object(
    'id', pat.id,
    'uhid', pat.uhid,
    'name', CONCAT_WS(' ', NULLIF(pat.prefix,
    ''), pat.first_name, NULLIF(pat.middle_name,
    ''), pat.last_name),
    'gender', pat.gender,
    'date_of_birth', pat.date_of_birth),
    'reported_by', rr.reported_by,
    'findings', rr.findings,
    'impression', rr.impression,
    'recommendations', rr.recommendations,
    'is_critical', rr.is_critical,
    'template_name', rr.template_name,
    'created_at', rr.created_at)
FROM radiology_reports rr
JOIN radiology_orders ro ON ro.tenant_id = rr.tenant_id AND ro.id = rr.order_id
JOIN patients pat ON pat.tenant_id = ro.tenant_id AND pat.id = ro.patient_id
WHERE rr.tenant_id = $1 AND rr.id = $2 AND rr.deleted_at IS NULL
