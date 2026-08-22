pub mod compliance;
pub mod norms;

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

const SOURCE_QUALITY_INCIDENTS: &str = "quality_incidents";
const SOURCE_TRANSFUSION_RECORDS: &str = "transfusion_records";
const SOURCE_CODE_BLUE_EVENTS: &str = "code_blue_events";
const SOURCE_BME_BREAKDOWNS: &str = "bme_breakdowns";
const SOURCE_FMS_FIRE_DRILLS: &str = "fms_fire_drills";
const SOURCE_FMS_GAS_READINGS: &str = "fms_gas_readings";
const SOURCE_IPD_CLINICAL_ASSESSMENTS: &str = "ipd_clinical_assessments";
const SOURCE_BIOWASTE_RECORDS: &str = "biowaste_records";

pub async fn mirror_fall_incident(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    fallback_reported_by: Uuid,
    incident_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_falls_register \
         (tenant_id, patient_id, admission_id, fall_at, location, location_detail, \
          fall_type, contributing_factors, risk_assessment_done, risk_assessment_id, \
          morse_score, injury_level, injury_description, immediate_action, \
          incident_id, rca_required, reported_by, notes, source_module, source_record_id) \
         SELECT i.tenant_id, i.patient_id, a.id, COALESCE(i.incident_date, now()), \
                COALESCE(NULLIF(i.location, ''), 'unspecified'), i.location, \
                CASE WHEN lower(COALESCE(i.description, '')) LIKE '%assisted%' \
                     THEN 'assisted' ELSE 'unwitnessed' END, \
                CASE WHEN i.contributing_factors IS NULL THEN ARRAY[]::text[] \
                     ELSE ARRAY(SELECT jsonb_array_elements_text(i.contributing_factors)) END, \
                fra.id IS NOT NULL, fra.id, \
                CASE WHEN fra.scale = 'morse' THEN fra.score ELSE NULL END, \
                CASE i.severity::text \
                    WHEN 'near_miss' THEN 'none' \
                    WHEN 'minor' THEN 'minor' \
                    WHEN 'moderate' THEN 'moderate' \
                    ELSE 'major' \
                END, \
                COALESCE(i.description, i.title), i.immediate_action, i.id, \
                i.severity::text IN ('major', 'sentinel') OR i.is_reportable, \
                COALESCE(i.reported_by, $3), i.root_cause, $4, i.id \
         FROM quality_incidents i \
         LEFT JOIN LATERAL ( \
             SELECT ad.id, ad.encounter_id \
             FROM admissions ad \
             WHERE ad.tenant_id = i.tenant_id \
               AND ad.patient_id = i.patient_id \
               AND (ad.discharged_at IS NULL OR ad.discharged_at >= i.incident_date) \
             ORDER BY ad.admitted_at DESC \
             LIMIT 1 \
         ) a ON true \
         LEFT JOIN LATERAL ( \
             SELECT fr.id, fr.scale, fr.score \
             FROM fall_risk_assessments fr \
             WHERE fr.tenant_id = i.tenant_id \
               AND fr.encounter_id = a.encounter_id \
             ORDER BY fr.recorded_at DESC \
             LIMIT 1 \
         ) fra ON true \
         WHERE i.id = $1 \
           AND i.tenant_id = $2 \
           AND i.patient_id IS NOT NULL \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             patient_id = EXCLUDED.patient_id, \
             admission_id = EXCLUDED.admission_id, \
             fall_at = EXCLUDED.fall_at, \
             location = EXCLUDED.location, \
             location_detail = EXCLUDED.location_detail, \
             fall_type = EXCLUDED.fall_type, \
             contributing_factors = EXCLUDED.contributing_factors, \
             risk_assessment_done = EXCLUDED.risk_assessment_done, \
             risk_assessment_id = EXCLUDED.risk_assessment_id, \
             morse_score = EXCLUDED.morse_score, \
             injury_level = EXCLUDED.injury_level, \
             injury_description = EXCLUDED.injury_description, \
             immediate_action = EXCLUDED.immediate_action, \
             rca_required = EXCLUDED.rca_required, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        incident_id,
        tenant_id,
        fallback_reported_by,
        SOURCE_QUALITY_INCIDENTS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_sentinel_incident(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    fallback_reported_by: Uuid,
    incident_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_sentinel_event_register \
         (tenant_id, event_at, event_category, event_subtype, severity, patient_id, \
          location, description, immediate_actions, reportable_to_authority, \
          authority_reference, reportable_to_nqf, rca_required, rca_due_at, \
          review_status, reported_by, notes, source_module, source_record_id) \
         SELECT i.tenant_id, COALESCE(i.incident_date, now()), \
                COALESCE(NULLIF(i.incident_type, ''), 'sentinel_event'), NULL, \
                CASE i.severity::text \
                    WHEN 'sentinel' THEN 'permanent_harm' \
                    WHEN 'major' THEN 'temporary_harm' \
                    WHEN 'near_miss' THEN 'no_harm_near_miss' \
                    ELSE 'temporary_harm' \
                END, \
                i.patient_id, i.location, COALESCE(i.description, i.title), \
                i.immediate_action, i.is_reportable, i.regulatory_body, true, true, \
                COALESCE(i.incident_date, now()) + interval '72 hours', \
                'open', COALESCE(i.reported_by, $3), i.root_cause, $4, i.id \
         FROM quality_incidents i \
         WHERE i.id = $1 AND i.tenant_id = $2 \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             event_at = EXCLUDED.event_at, \
             event_category = EXCLUDED.event_category, \
             severity = EXCLUDED.severity, \
             patient_id = EXCLUDED.patient_id, \
             location = EXCLUDED.location, \
             description = EXCLUDED.description, \
             immediate_actions = EXCLUDED.immediate_actions, \
             reportable_to_authority = EXCLUDED.reportable_to_authority, \
             authority_reference = EXCLUDED.authority_reference, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        incident_id,
        tenant_id,
        fallback_reported_by,
        SOURCE_QUALITY_INCIDENTS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_transfusion_reaction(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    transfusion_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_blood_transfusion_reactions \
         (tenant_id, patient_id, transfusion_id, blood_unit_id, component_type, \
          reaction_at, onset_minutes, reaction_type, severity, symptoms, \
          reported_to_blood_bank, reported_to_blood_bank_at, reported_by, notes, \
          source_module, source_record_id) \
         SELECT tr.tenant_id, tr.patient_id, tr.id, tr.component_id, bc.component_type::text, \
                COALESCE(tr.reaction_reported_at, now()), \
                CASE WHEN tr.reaction_reported_at IS NULL THEN NULL \
                     ELSE EXTRACT(EPOCH FROM (tr.reaction_reported_at - tr.started_at))::int / 60 \
                END, \
                COALESCE(NULLIF(tr.reaction_type, ''), 'other'), \
                CASE COALESCE(tr.reaction_severity::text, 'moderate') \
                    WHEN 'fatal' THEN 'death' \
                    ELSE COALESCE(tr.reaction_severity::text, 'moderate') \
                END, \
                ARRAY[]::text[], true, tr.reaction_reported_at, tr.administered_by, \
                tr.reaction_details, $3, tr.id \
         FROM transfusion_records tr \
         LEFT JOIN blood_components bc \
           ON bc.id = tr.component_id AND bc.tenant_id = tr.tenant_id \
         WHERE tr.id = $1 AND tr.tenant_id = $2 AND tr.has_reaction = true \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             reaction_at = EXCLUDED.reaction_at, \
             onset_minutes = EXCLUDED.onset_minutes, \
             reaction_type = EXCLUDED.reaction_type, \
             severity = EXCLUDED.severity, \
             reported_to_blood_bank = EXCLUDED.reported_to_blood_bank, \
             reported_to_blood_bank_at = EXCLUDED.reported_to_blood_bank_at, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        transfusion_id,
        tenant_id,
        SOURCE_TRANSFUSION_RECORDS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_code_blue_started(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    fallback_user_id: Uuid,
    code_blue_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_code_blue_activations \
         (tenant_id, activated_at, activated_by, location, patient_id, admission_id, \
          reason, outcome, notes, source_module, source_record_id) \
         SELECT e.tenant_id, e.started_at, \
                COALESCE(e.recorder_user_id, e.leader_user_id, $3), \
                e.location, e.patient_id, a.id, 'unspecified', NULL, e.notes, $4, e.id \
         FROM code_blue_events e \
         LEFT JOIN LATERAL ( \
             SELECT id FROM admissions a \
             WHERE a.tenant_id = e.tenant_id AND a.encounter_id = e.encounter_id \
             ORDER BY a.created_at DESC LIMIT 1 \
         ) a ON true \
         WHERE e.id = $1 AND e.tenant_id = $2 \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             activated_at = EXCLUDED.activated_at, \
             activated_by = EXCLUDED.activated_by, \
             location = EXCLUDED.location, \
             patient_id = EXCLUDED.patient_id, \
             admission_id = COALESCE(EXCLUDED.admission_id, nabh_code_blue_activations.admission_id), \
             notes = COALESCE(EXCLUDED.notes, nabh_code_blue_activations.notes), \
             updated_at = now()",
        code_blue_id,
        tenant_id,
        fallback_user_id,
        SOURCE_CODE_BLUE_EVENTS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_code_blue_ended(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code_blue_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "UPDATE nabh_code_blue_activations n \
         SET outcome = CASE e.outcome \
                 WHEN 'rosc' THEN 'survived_intact' \
                 WHEN 'stable' THEN 'survived_intact' \
                 WHEN 'transferred' THEN 'transferred_icu' \
                 WHEN 'expired' THEN 'death_at_event' \
                 ELSE n.outcome \
             END, \
             transferred_to = CASE WHEN e.outcome = 'transferred' \
                 THEN 'ICU / higher care' ELSE n.transferred_to END, \
             drugs_administered = e.medications, \
             defibrillation_count = jsonb_array_length(e.shocks), \
             cpr_duration_minutes = CASE WHEN e.ended_at IS NULL THEN n.cpr_duration_minutes \
                 ELSE EXTRACT(EPOCH FROM (e.ended_at - e.started_at))::int / 60 END, \
             initial_rhythm = COALESCE( \
                 (SELECT elem->>'rhythm' FROM jsonb_array_elements(e.ecg_rhythm_log) elem LIMIT 1), \
                 n.initial_rhythm \
             ), \
             notes = COALESCE(e.notes, n.notes), \
             updated_at = now() \
         FROM code_blue_events e \
         WHERE n.tenant_id = $2 \
           AND n.source_module = $3 \
           AND n.source_record_id = e.id \
           AND e.id = $1 \
           AND e.tenant_id = $2",
        code_blue_id,
        tenant_id,
        SOURCE_CODE_BLUE_EVENTS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_bme_breakdown(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    breakdown_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_equipment_downtime_log \
         (tenant_id, equipment_id, equipment_name, equipment_serial, equipment_category, \
          location, downtime_start, downtime_end, reason, impact_level, impact_summary, \
          reported_to_bme, reported_to_bme_at, workorder_ref, vendor_engaged, resolved_by, \
          resolution_summary, parts_replaced, cost, notes, source_module, source_record_id) \
         SELECT b.tenant_id, b.equipment_id, e.name, e.serial_number, e.category, \
                e.location_description, COALESCE(b.downtime_start, b.reported_at), \
                b.downtime_end, 'breakdown', \
                CASE WHEN e.is_critical THEN 'critical' ELSE b.priority::text END, \
                b.description, true, b.reported_at, b.id::text, b.vendor_visit_required, \
                b.resolved_by, b.resolution_notes, b.spare_parts_used, \
                COALESCE(b.total_repair_cost, b.vendor_cost + b.spare_parts_cost, \
                         b.vendor_cost, b.spare_parts_cost), \
                b.notes, $3, b.id \
         FROM bme_breakdowns b \
         JOIN bme_equipment e ON e.id = b.equipment_id AND e.tenant_id = b.tenant_id \
         WHERE b.id = $1 AND b.tenant_id = $2 \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             equipment_name = EXCLUDED.equipment_name, \
             equipment_serial = EXCLUDED.equipment_serial, \
             equipment_category = EXCLUDED.equipment_category, \
             location = EXCLUDED.location, \
             downtime_start = EXCLUDED.downtime_start, \
             downtime_end = EXCLUDED.downtime_end, \
             impact_level = EXCLUDED.impact_level, \
             impact_summary = EXCLUDED.impact_summary, \
             vendor_engaged = EXCLUDED.vendor_engaged, \
             resolved_by = EXCLUDED.resolved_by, \
             resolution_summary = EXCLUDED.resolution_summary, \
             parts_replaced = EXCLUDED.parts_replaced, \
             cost = EXCLUDED.cost, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        breakdown_id,
        tenant_id,
        SOURCE_BME_BREAKDOWNS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_fire_drill(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    fallback_conducted_by: Uuid,
    fire_drill_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_fire_safety_drills \
         (tenant_id, drill_at, drill_type, location, scenario, participants_count, \
          participating_departments, incident_commander, alarm_at, evacuation_started_at, \
          evacuation_completed_at, issues_observed, corrective_actions, \
          corrective_action_owner, corrective_action_due, corrective_actions_done, \
          report_url, conducted_by, notes, source_module, source_record_id) \
         SELECT d.tenant_id, COALESCE(d.start_time, d.drill_date::timestamptz), \
                d.drill_type::text, COALESCE(f.name, 'Facility-wide'), \
                d.scenario_description, d.participants_count, d.zones_covered, d.approved_by, \
                d.start_time, d.start_time, \
                CASE WHEN d.start_time IS NULL OR d.evacuation_time_seconds IS NULL THEN NULL \
                     ELSE d.start_time + (d.evacuation_time_seconds || ' seconds')::interval \
                END, \
                CASE WHEN d.findings IS NULL OR trim(d.findings) = '' \
                     THEN ARRAY[]::text[] ELSE ARRAY[d.findings] END, \
                d.improvement_actions, d.approved_by, d.next_drill_due, \
                d.improvement_actions IS NULL, d.drill_report_url, \
                COALESCE(d.conducted_by, $3), d.notes, $4, d.id \
         FROM fms_fire_drills d \
         LEFT JOIN facilities f ON f.id = d.facility_id AND f.tenant_id = d.tenant_id \
         WHERE d.id = $1 AND d.tenant_id = $2 \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             drill_at = EXCLUDED.drill_at, \
             drill_type = EXCLUDED.drill_type, \
             location = EXCLUDED.location, \
             scenario = EXCLUDED.scenario, \
             participants_count = EXCLUDED.participants_count, \
             participating_departments = EXCLUDED.participating_departments, \
             incident_commander = EXCLUDED.incident_commander, \
             alarm_at = EXCLUDED.alarm_at, \
             evacuation_started_at = EXCLUDED.evacuation_started_at, \
             evacuation_completed_at = EXCLUDED.evacuation_completed_at, \
             issues_observed = EXCLUDED.issues_observed, \
             corrective_actions = EXCLUDED.corrective_actions, \
             corrective_action_owner = EXCLUDED.corrective_action_owner, \
             corrective_action_due = EXCLUDED.corrective_action_due, \
             corrective_actions_done = EXCLUDED.corrective_actions_done, \
             report_url = EXCLUDED.report_url, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        fire_drill_id,
        tenant_id,
        fallback_conducted_by,
        SOURCE_FMS_FIRE_DRILLS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_medical_gas_alarm(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    gas_reading_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_equipment_downtime_log \
         (tenant_id, equipment_id, equipment_name, equipment_serial, equipment_category, \
          location, downtime_start, downtime_end, reason, impact_level, impact_summary, \
          reported_to_bme, reported_to_bme_at, workorder_ref, vendor_engaged, resolved_by, \
          resolution_summary, parts_replaced, cost, notes, source_module, source_record_id) \
         SELECT g.tenant_id, NULL, \
                initcap(replace(g.gas_type::text, '_', ' ')) || ' ' || \
                    replace(g.source_type::text, '_', ' ') || ' alarm', \
                NULL, 'medical_gas', g.location_id::text, g.reading_at, NULL, \
                'utility_alarm', \
                CASE WHEN g.gas_type::text IN ('oxygen', 'medical_air', 'vacuum') \
                     THEN 'critical' ELSE 'high' END, \
                COALESCE(g.alarm_reason, g.notes, 'Medical gas alarm'), \
                true, g.reading_at, g.id::text, false, NULL, NULL, NULL, NULL, \
                g.notes, $3, g.id \
         FROM fms_gas_readings g \
         WHERE g.id = $1 AND g.tenant_id = $2 AND g.is_alarm = true \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             equipment_name = EXCLUDED.equipment_name, \
             equipment_category = EXCLUDED.equipment_category, \
             location = EXCLUDED.location, \
             downtime_start = EXCLUDED.downtime_start, \
             impact_level = EXCLUDED.impact_level, \
             impact_summary = EXCLUDED.impact_summary, \
             reported_to_bme = EXCLUDED.reported_to_bme, \
             reported_to_bme_at = EXCLUDED.reported_to_bme_at, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        gas_reading_id,
        tenant_id,
        SOURCE_FMS_GAS_READINGS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_pressure_ulcer_from_ipd_assessment(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    assessment_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "WITH src AS ( \
             SELECT ca.*, ad.patient_id, \
                    CASE WHEN ca.score_details->>'sensory_perception' ~ '^[1-4]$' \
                         THEN (ca.score_details->>'sensory_perception')::int END AS sensory_perception, \
                    CASE WHEN ca.score_details->>'moisture' ~ '^[1-4]$' \
                         THEN (ca.score_details->>'moisture')::int END AS moisture, \
                    CASE WHEN ca.score_details->>'activity' ~ '^[1-4]$' \
                         THEN (ca.score_details->>'activity')::int END AS activity, \
                    CASE WHEN ca.score_details->>'mobility' ~ '^[1-4]$' \
                         THEN (ca.score_details->>'mobility')::int END AS mobility, \
                    CASE WHEN ca.score_details->>'nutrition' ~ '^[1-4]$' \
                         THEN (ca.score_details->>'nutrition')::int END AS nutrition, \
                    CASE WHEN ca.score_details->>'friction_shear' ~ '^[1-3]$' \
                         THEN (ca.score_details->>'friction_shear')::int END AS friction_shear \
             FROM ipd_clinical_assessments ca \
             JOIN admissions ad ON ad.id = ca.admission_id AND ad.tenant_id = ca.tenant_id \
             WHERE ca.id = $1 \
               AND ca.tenant_id = $2 \
               AND ca.assessment_type = 'braden_scale'::clinical_assessment_type \
         ), scored AS ( \
             SELECT *, sensory_perception + moisture + activity + mobility + nutrition + friction_shear AS braden_total \
             FROM src \
             WHERE sensory_perception IS NOT NULL \
               AND moisture IS NOT NULL \
               AND activity IS NOT NULL \
               AND mobility IS NOT NULL \
               AND nutrition IS NOT NULL \
               AND friction_shear IS NOT NULL \
         ) \
         INSERT INTO nabh_pressure_ulcer_assessments \
         (tenant_id, patient_id, admission_id, assessed_at, assessed_by, \
          sensory_perception, moisture, activity, mobility, nutrition, friction_shear, \
          risk_level, injury_present, injury_stage, injury_location, injury_acquired, \
          injury_description, repositioning_plan, nutritional_plan, skin_care_plan, notes, \
          source_module, source_record_id) \
         SELECT tenant_id, patient_id, admission_id, assessed_at, assessed_by, \
                sensory_perception, moisture, activity, mobility, nutrition, friction_shear, \
                COALESCE( \
                    CASE lower(COALESCE(risk_level, '')) \
                        WHEN 'critical' THEN 'severe' \
                        WHEN 'severe' THEN 'severe' \
                        WHEN 'high' THEN 'high' \
                        WHEN 'moderate' THEN 'moderate' \
                        WHEN 'low' THEN 'mild' \
                        WHEN 'mild' THEN 'mild' \
                        WHEN 'no risk' THEN 'no risk' \
                    END, \
                    CASE WHEN braden_total <= 9 THEN 'severe' \
                         WHEN braden_total <= 12 THEN 'high' \
                         WHEN braden_total <= 14 THEN 'moderate' \
                         WHEN braden_total <= 18 THEN 'mild' \
                         ELSE 'no risk' END \
                ), \
                lower(COALESCE(score_details->>'injury_present', 'false')) IN ('true', 'yes', '1'), \
                NULLIF(score_details->>'injury_stage', ''), \
                NULLIF(score_details->>'injury_location', ''), \
                CASE score_details->>'injury_acquired' \
                    WHEN 'present_on_admission' THEN 'present_on_admission' \
                    WHEN 'hospital_acquired' THEN 'hospital_acquired' \
                    ELSE NULL \
                END, \
                NULLIF(score_details->>'injury_description', ''), \
                NULLIF(score_details->>'repositioning_plan', ''), \
                NULLIF(score_details->>'nutritional_plan', ''), \
                NULLIF(score_details->>'skin_care_plan', ''), \
                NULLIF(score_details->>'notes', ''), \
                $3, id \
         FROM scored \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             assessed_at = EXCLUDED.assessed_at, \
             assessed_by = EXCLUDED.assessed_by, \
             sensory_perception = EXCLUDED.sensory_perception, \
             moisture = EXCLUDED.moisture, \
             activity = EXCLUDED.activity, \
             mobility = EXCLUDED.mobility, \
             nutrition = EXCLUDED.nutrition, \
             friction_shear = EXCLUDED.friction_shear, \
             risk_level = EXCLUDED.risk_level, \
             injury_present = EXCLUDED.injury_present, \
             injury_stage = EXCLUDED.injury_stage, \
             injury_location = EXCLUDED.injury_location, \
             injury_acquired = EXCLUDED.injury_acquired, \
             injury_description = EXCLUDED.injury_description, \
             repositioning_plan = EXCLUDED.repositioning_plan, \
             nutritional_plan = EXCLUDED.nutritional_plan, \
             skin_care_plan = EXCLUDED.skin_care_plan, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        assessment_id,
        tenant_id,
        SOURCE_IPD_CLINICAL_ASSESSMENTS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mirror_biowaste_record(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    biowaste_record_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO nabh_bmw_disposal_log \
         (tenant_id, disposal_date, waste_category, waste_subtype, quantity_kg, \
          source_department, bag_count, barcode_refs, stored_at, handed_over_at, \
          disposal_agency, disposal_method, handed_over_by, received_by_agency, notes, \
          source_module, source_record_id) \
         SELECT b.tenant_id, b.record_date, \
                CASE b.waste_category::text \
                    WHEN 'white_translucent' THEN 'white' \
                    ELSE b.waste_category::text \
                END, \
                b.waste_category::text, b.weight_kg, b.department_id::text, \
                b.container_count, ARRAY_REMOVE(ARRAY[b.manifest_number], NULL)::text[], \
                b.record_date::timestamptz, b.record_date::timestamptz + interval '12 hours', \
                COALESCE(NULLIF(b.disposal_vendor, ''), 'In-house holding area'), \
                CASE b.waste_category::text \
                    WHEN 'yellow' THEN 'incineration' \
                    WHEN 'cytotoxic' THEN 'incineration' \
                    WHEN 'chemical' THEN 'sanitary_landfill' \
                    WHEN 'blue' THEN 'sanitary_landfill' \
                    ELSE 'autoclave' \
                END, \
                b.recorded_by, NULLIF(b.disposal_vendor, ''), b.notes, $3, b.id \
         FROM biowaste_records b \
         WHERE b.id = $1 AND b.tenant_id = $2 \
         ON CONFLICT (tenant_id, source_module, source_record_id) \
         WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL \
         DO UPDATE SET \
             disposal_date = EXCLUDED.disposal_date, \
             waste_category = EXCLUDED.waste_category, \
             waste_subtype = EXCLUDED.waste_subtype, \
             quantity_kg = EXCLUDED.quantity_kg, \
             source_department = EXCLUDED.source_department, \
             bag_count = EXCLUDED.bag_count, \
             barcode_refs = EXCLUDED.barcode_refs, \
             stored_at = EXCLUDED.stored_at, \
             handed_over_at = EXCLUDED.handed_over_at, \
             disposal_agency = EXCLUDED.disposal_agency, \
             disposal_method = EXCLUDED.disposal_method, \
             handed_over_by = EXCLUDED.handed_over_by, \
             received_by_agency = EXCLUDED.received_by_agency, \
             notes = EXCLUDED.notes, \
             updated_at = now()",
        biowaste_record_id,
        tenant_id,
        SOURCE_BIOWASTE_RECORDS
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
