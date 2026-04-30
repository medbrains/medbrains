//! Print-data endpoints — quality & safety forms.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AdrReportPrintData, CapaAction, CapaFormPrintData, ConcomitantDrug, CorrectiveAction,
    FishboneCategory, FiveWhyEntry, IncidentReportPrintData, PreventiveAction, RcaTeamMember,
    RcaTemplatePrintData, RcaTimelineEntry, StaffInvolvedEntry, SuspectedDrug,
    TransfusionReactionPrintData, TransfusionVitals,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Incident Report ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct IncidentReportRow {
    incident_id: String,
    report_date: chrono::NaiveDate,
    report_time: chrono::NaiveTime,
    incident_date: chrono::NaiveDate,
    incident_time: chrono::NaiveTime,
    incident_location: String,
    department: String,
    incident_type: String,
    incident_category: String,
    severity_level: String,
    patient_involved: bool,
    patient_name: Option<String>,
    patient_uhid: Option<String>,
    patient_harm_level: Option<String>,
    incident_description: String,
    immediate_action_taken: String,
    patient_condition_post_incident: Option<String>,
    root_cause_identified: Option<String>,
    reported_by: String,
    reported_by_designation: String,
    department_head_notified: bool,
    quality_dept_notified: bool,
    risk_management_notified: bool,
    status: String,
}

pub async fn get_incident_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(incident_id): Path<Uuid>,
) -> Result<Json<IncidentReportPrintData>, AppError> {
    require_permission(&claims, permissions::admin::roles::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, IncidentReportRow>(
        "SELECT \
           ir.incident_number AS incident_id, \
           ir.report_date, \
           ir.report_time, \
           ir.incident_date, \
           ir.incident_time, \
           ir.incident_location, \
           dept.name AS department, \
           ir.incident_type, \
           ir.incident_category, \
           ir.severity_level, \
           ir.patient_involved, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid AS patient_uhid, \
           ir.patient_harm_level, \
           ir.incident_description, \
           ir.immediate_action_taken, \
           ir.patient_condition_post_incident, \
           ir.root_cause_identified, \
           reporter.full_name AS reported_by, \
           reporter.designation AS reported_by_designation, \
           ir.department_head_notified, \
           ir.quality_dept_notified, \
           ir.risk_management_notified, \
           ir.status \
         FROM incident_reports ir \
         LEFT JOIN departments dept ON dept.id = ir.department_id AND dept.tenant_id = ir.tenant_id \
         LEFT JOIN patients p ON p.id = ir.patient_id AND p.tenant_id = ir.tenant_id \
         LEFT JOIN users reporter ON reporter.id = ir.reported_by_id \
         WHERE ir.id = $1 AND ir.tenant_id = $2",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let staff_involved = sqlx::query_as::<_, StaffInvolvedEntry>(
        "SELECT u.full_name AS staff_name, u.designation, si.role_in_incident \
         FROM incident_staff_involved si \
         LEFT JOIN users u ON u.id = si.staff_id \
         WHERE si.incident_id = $1 AND si.tenant_id = $2 \
         ORDER BY si.created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let witnesses: Vec<String> = sqlx::query_scalar(
        "SELECT witness_name FROM incident_witnesses \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let notification_list: Vec<String> = sqlx::query_scalar(
        "SELECT notified_person FROM incident_notifications \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY notified_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let contributing_factors: Vec<String> = sqlx::query_scalar(
        "SELECT factor_description FROM incident_contributing_factors \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(IncidentReportPrintData {
        incident_id: row.incident_id,
        report_date: row.report_date.format("%d-%b-%Y").to_string(),
        report_time: row.report_time.format("%H:%M").to_string(),
        incident_date: row.incident_date.format("%d-%b-%Y").to_string(),
        incident_time: row.incident_time.format("%H:%M").to_string(),
        incident_location: row.incident_location,
        department: row.department,
        incident_type: row.incident_type,
        incident_category: row.incident_category,
        severity_level: row.severity_level,
        patient_involved: row.patient_involved,
        patient_name: row.patient_name,
        patient_uhid: row.patient_uhid,
        patient_harm_level: row.patient_harm_level,
        staff_involved,
        witnesses,
        incident_description: row.incident_description,
        immediate_action_taken: row.immediate_action_taken,
        patient_condition_post_incident: row.patient_condition_post_incident,
        notification_list,
        root_cause_identified: row.root_cause_identified,
        contributing_factors,
        reported_by: row.reported_by,
        reported_by_designation: row.reported_by_designation,
        department_head_notified: row.department_head_notified,
        quality_dept_notified: row.quality_dept_notified,
        risk_management_notified: row.risk_management_notified,
        status: row.status,
    }))
}

// ── RCA Template (Root Cause Analysis) ───────────────────

#[derive(Debug, sqlx::FromRow)]
struct RcaTemplateRow {
    rca_id: String,
    incident_id: String,
    incident_date: chrono::NaiveDate,
    incident_description: String,
    rca_start_date: chrono::NaiveDate,
    rca_completion_date: Option<chrono::NaiveDate>,
    problem_statement: String,
    analysis_method: String,
    prepared_by: String,
    reviewed_by: Option<String>,
    approved_by: Option<String>,
    status: String,
}

pub async fn get_rca_template_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(incident_id): Path<Uuid>,
) -> Result<Json<RcaTemplatePrintData>, AppError> {
    require_permission(&claims, permissions::admin::roles::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, RcaTemplateRow>(
        "SELECT \
           rca.rca_number AS rca_id, \
           ir.incident_number AS incident_id, \
           ir.incident_date, \
           ir.incident_description, \
           rca.rca_start_date, \
           rca.rca_completion_date, \
           rca.problem_statement, \
           rca.analysis_method, \
           preparer.full_name AS prepared_by, \
           reviewer.full_name AS reviewed_by, \
           approver.full_name AS approved_by, \
           rca.status \
         FROM rca_reports rca \
         JOIN incident_reports ir ON ir.id = rca.incident_id AND ir.tenant_id = rca.tenant_id \
         LEFT JOIN users preparer ON preparer.id = rca.prepared_by_id \
         LEFT JOIN users reviewer ON reviewer.id = rca.reviewed_by_id \
         LEFT JOIN users approver ON approver.id = rca.approved_by_id \
         WHERE rca.incident_id = $1 AND rca.tenant_id = $2",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let rca_team = sqlx::query_as::<_, RcaTeamMember>(
        "SELECT u.full_name AS name, u.designation, dept.name AS department, rt.role \
         FROM rca_team_members rt \
         LEFT JOIN users u ON u.id = rt.user_id \
         LEFT JOIN departments dept ON dept.id = rt.department_id AND dept.tenant_id = rt.tenant_id \
         WHERE rt.incident_id = $1 AND rt.tenant_id = $2 \
         ORDER BY rt.created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let data_sources: Vec<String> = sqlx::query_scalar(
        "SELECT source_description FROM rca_data_sources \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let timeline_of_events = sqlx::query_as::<_, RcaTimelineEntry>(
        "SELECT event_time::text, event_description, who_involved \
         FROM rca_timeline_events \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY event_time",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let five_whys = sqlx::query_as::<_, FiveWhyEntry>(
        "SELECT level, question, answer \
         FROM rca_five_whys \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY level",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    #[derive(sqlx::FromRow)]
    struct FishboneRow {
        category: String,
        cause: String,
    }

    let fishbone_rows: Vec<FishboneRow> = sqlx::query_as(
        "SELECT category, cause \
         FROM rca_fishbone_causes \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY category, created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut fishbone_categories: Vec<FishboneCategory> = Vec::new();
    for row in fishbone_rows {
        if let Some(cat) = fishbone_categories
            .iter_mut()
            .find(|c| c.category == row.category)
        {
            cat.causes.push(row.cause);
        } else {
            fishbone_categories.push(FishboneCategory {
                category: row.category,
                causes: vec![row.cause],
            });
        }
    }

    let root_causes_identified: Vec<String> = sqlx::query_scalar(
        "SELECT root_cause FROM rca_root_causes \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let contributing_factors: Vec<String> = sqlx::query_scalar(
        "SELECT factor_description FROM rca_contributing_factors \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let corrective_actions = sqlx::query_as::<_, CorrectiveAction>(
        "SELECT action_description, responsible_person, target_date::text, status, completion_date::text \
         FROM rca_corrective_actions \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let preventive_actions = sqlx::query_as::<_, PreventiveAction>(
        "SELECT action_description, responsible_person, target_date::text, status \
         FROM rca_preventive_actions \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let effectiveness_measures: Vec<String> = sqlx::query_scalar(
        "SELECT measure_description FROM rca_effectiveness_measures \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let follow_up_dates: Vec<String> = sqlx::query_scalar(
        "SELECT follow_up_date::text FROM rca_follow_up_dates \
         WHERE incident_id = $1 AND tenant_id = $2 \
         ORDER BY follow_up_date",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(RcaTemplatePrintData {
        rca_id: row.rca_id,
        incident_id: row.incident_id,
        incident_date: row.incident_date.format("%d-%b-%Y").to_string(),
        incident_description: row.incident_description,
        rca_start_date: row.rca_start_date.format("%d-%b-%Y").to_string(),
        rca_completion_date: row
            .rca_completion_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        rca_team,
        problem_statement: row.problem_statement,
        data_sources,
        timeline_of_events,
        analysis_method: row.analysis_method,
        five_whys,
        fishbone_categories,
        root_causes_identified,
        contributing_factors,
        corrective_actions,
        preventive_actions,
        effectiveness_measures,
        follow_up_dates,
        prepared_by: row.prepared_by,
        reviewed_by: row.reviewed_by,
        approved_by: row.approved_by,
        status: row.status,
    }))
}

// ── CAPA Form (Corrective and Preventive Action) ─────────

#[derive(Debug, sqlx::FromRow)]
struct CapaFormRow {
    capa_id: String,
    capa_type: String,
    source: String,
    source_reference: Option<String>,
    initiated_date: chrono::NaiveDate,
    initiated_by: String,
    department: String,
    problem_description: String,
    problem_scope: String,
    root_cause_analysis: Option<String>,
    root_cause_method: Option<String>,
    implementation_status: String,
    implementation_date: Option<chrono::NaiveDate>,
    implemented_by: Option<String>,
    verification_method: Option<String>,
    verification_date: Option<chrono::NaiveDate>,
    verified_by: Option<String>,
    verification_result: Option<String>,
    effectiveness_check_date: Option<chrono::NaiveDate>,
    effectiveness_result: Option<String>,
    effectiveness_evidence: Option<String>,
    closure_date: Option<chrono::NaiveDate>,
    closed_by: Option<String>,
    closure_remarks: Option<String>,
    status: String,
}

pub async fn get_capa_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(capa_id): Path<Uuid>,
) -> Result<Json<CapaFormPrintData>, AppError> {
    require_permission(&claims, permissions::admin::roles::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CapaFormRow>(
        "SELECT \
           capa.capa_number AS capa_id, \
           capa.capa_type, \
           capa.source, \
           capa.source_reference, \
           capa.initiated_date, \
           initiator.full_name AS initiated_by, \
           dept.name AS department, \
           capa.problem_description, \
           capa.problem_scope, \
           capa.root_cause_analysis, \
           capa.root_cause_method, \
           capa.implementation_status, \
           capa.implementation_date, \
           implementer.full_name AS implemented_by, \
           capa.verification_method, \
           capa.verification_date, \
           verifier.full_name AS verified_by, \
           capa.verification_result, \
           capa.effectiveness_check_date, \
           capa.effectiveness_result, \
           capa.effectiveness_evidence, \
           capa.closure_date, \
           closer.full_name AS closed_by, \
           capa.closure_remarks, \
           capa.status \
         FROM capa_records capa \
         LEFT JOIN users initiator ON initiator.id = capa.initiated_by_id \
         LEFT JOIN departments dept ON dept.id = capa.department_id AND dept.tenant_id = capa.tenant_id \
         LEFT JOIN users implementer ON implementer.id = capa.implemented_by_id \
         LEFT JOIN users verifier ON verifier.id = capa.verified_by_id \
         LEFT JOIN users closer ON closer.id = capa.closed_by_id \
         WHERE capa.id = $1 AND capa.tenant_id = $2",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let affected_processes: Vec<String> = sqlx::query_scalar(
        "SELECT process_name FROM capa_affected_processes \
         WHERE capa_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let proposed_actions = sqlx::query_as::<_, CapaAction>(
        "SELECT action_number, action_description, responsible_person, \
           target_date::text, actual_date::text, status, remarks \
         FROM capa_actions \
         WHERE capa_id = $1 AND tenant_id = $2 \
         ORDER BY action_number",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CapaFormPrintData {
        capa_id: row.capa_id,
        capa_type: row.capa_type,
        source: row.source,
        source_reference: row.source_reference,
        initiated_date: row.initiated_date.format("%d-%b-%Y").to_string(),
        initiated_by: row.initiated_by,
        department: row.department,
        problem_description: row.problem_description,
        problem_scope: row.problem_scope,
        affected_processes,
        root_cause_analysis: row.root_cause_analysis,
        root_cause_method: row.root_cause_method,
        proposed_actions,
        implementation_status: row.implementation_status,
        implementation_date: row
            .implementation_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        implemented_by: row.implemented_by,
        verification_method: row.verification_method,
        verification_date: row
            .verification_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        verified_by: row.verified_by,
        verification_result: row.verification_result,
        effectiveness_check_date: row
            .effectiveness_check_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        effectiveness_result: row.effectiveness_result,
        effectiveness_evidence: row.effectiveness_evidence,
        closure_date: row.closure_date.map(|d| d.format("%d-%b-%Y").to_string()),
        closed_by: row.closed_by,
        closure_remarks: row.closure_remarks,
        status: row.status,
    }))
}

// ── ADR Report (Adverse Drug Reaction) ───────────────────

#[derive(Debug, sqlx::FromRow)]
struct AdrReportRow {
    report_id: String,
    report_date: chrono::NaiveDate,
    report_type: String,
    patient_initials: String,
    patient_age: Option<f64>,
    patient_gender: String,
    patient_weight_kg: Option<f64>,
    patient_height_cm: Option<f64>,
    reaction_description: String,
    reaction_start_date: chrono::NaiveDate,
    reaction_end_date: Option<chrono::NaiveDate>,
    reaction_outcome: String,
    seriousness: String,
    relevant_history: Option<String>,
    allergies: Option<String>,
    dechallenge_done: bool,
    dechallenge_result: Option<String>,
    rechallenge_done: bool,
    rechallenge_result: Option<String>,
    causality_assessment: Option<String>,
    who_umc_category: Option<String>,
    naranjo_score: Option<i32>,
    reporter_name: String,
    reporter_qualification: String,
    reporter_department: String,
    reporter_contact: Option<String>,
    hospital_name: String,
    pvpi_id: Option<String>,
    vigiflow_id: Option<String>,
}

pub async fn get_adr_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(report_id): Path<Uuid>,
) -> Result<Json<AdrReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AdrReportRow>(
        "SELECT \
           adr.report_number AS report_id, \
           adr.report_date, \
           adr.report_type, \
           adr.patient_initials, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS patient_age, \
           p.gender::text AS patient_gender, \
           adr.patient_weight_kg, \
           adr.patient_height_cm, \
           adr.reaction_description, \
           adr.reaction_start_date, \
           adr.reaction_end_date, \
           adr.reaction_outcome, \
           adr.seriousness, \
           adr.relevant_history, \
           adr.allergies, \
           adr.dechallenge_done, \
           adr.dechallenge_result, \
           adr.rechallenge_done, \
           adr.rechallenge_result, \
           adr.causality_assessment, \
           adr.who_umc_category, \
           adr.naranjo_score, \
           reporter.full_name AS reporter_name, \
           reporter.designation AS reporter_qualification, \
           dept.name AS reporter_department, \
           adr.reporter_contact, \
           t.name AS hospital_name, \
           adr.pvpi_id, \
           adr.vigiflow_id \
         FROM adr_reports adr \
         JOIN patients p ON p.id = adr.patient_id AND p.tenant_id = adr.tenant_id \
         LEFT JOIN users reporter ON reporter.id = adr.reporter_id \
         LEFT JOIN departments dept ON dept.id = adr.reporter_department_id AND dept.tenant_id = adr.tenant_id \
         LEFT JOIN tenants t ON t.id = adr.tenant_id \
         WHERE adr.id = $1 AND adr.tenant_id = $2",
    )
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let seriousness_criteria: Vec<String> = sqlx::query_scalar(
        "SELECT criterion FROM adr_seriousness_criteria \
         WHERE adr_report_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let suspected_drugs = sqlx::query_as::<_, SuspectedDrug>(
        "SELECT drug_name, generic_name, manufacturer, batch_number, \
           dose, route, frequency, start_date::text, end_date::text, indication \
         FROM adr_suspected_drugs \
         WHERE adr_report_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let concomitant_drugs = sqlx::query_as::<_, ConcomitantDrug>(
        "SELECT drug_name, dose, route, indication \
         FROM adr_concomitant_drugs \
         WHERE adr_report_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AdrReportPrintData {
        report_id: row.report_id,
        report_date: row.report_date.format("%d-%b-%Y").to_string(),
        report_type: row.report_type,
        patient_initials: row.patient_initials,
        patient_age: row.patient_age.map(|a| format!("{} yrs", a as i64)),
        patient_gender: row.patient_gender,
        patient_weight_kg: row.patient_weight_kg,
        patient_height_cm: row.patient_height_cm,
        reaction_description: row.reaction_description,
        reaction_start_date: row.reaction_start_date.format("%d-%b-%Y").to_string(),
        reaction_end_date: row
            .reaction_end_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        reaction_outcome: row.reaction_outcome,
        seriousness: row.seriousness,
        seriousness_criteria,
        suspected_drugs,
        concomitant_drugs,
        relevant_history: row.relevant_history,
        allergies: row.allergies,
        dechallenge_done: row.dechallenge_done,
        dechallenge_result: row.dechallenge_result,
        rechallenge_done: row.rechallenge_done,
        rechallenge_result: row.rechallenge_result,
        causality_assessment: row.causality_assessment,
        who_umc_category: row.who_umc_category,
        naranjo_score: row.naranjo_score,
        reporter_name: row.reporter_name,
        reporter_qualification: row.reporter_qualification,
        reporter_department: row.reporter_department,
        reporter_contact: row.reporter_contact,
        hospital_name: row.hospital_name,
        pvpi_id: row.pvpi_id,
        vigiflow_id: row.vigiflow_id,
    }))
}

// ── Transfusion Reaction Report ──────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionReactionRow {
    report_id: String,
    report_date: chrono::NaiveDate,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    blood_group: String,
    rh_factor: String,
    ward_name: String,
    bed_number: String,
    transfusion_date: chrono::NaiveDate,
    transfusion_start_time: chrono::NaiveTime,
    reaction_time: chrono::NaiveTime,
    product_type: String,
    bag_number: String,
    donor_blood_group: String,
    volume_transfused_ml: i32,
    volume_remaining_ml: i32,
    reaction_type: String,
    severity: String,
    transfusion_stopped: bool,
    transfusion_stopped_time: Option<chrono::NaiveTime>,
    iv_line_kept_open: bool,
    doctor_informed: bool,
    doctor_name: Option<String>,
    blood_bank_informed: bool,
    immediate_treatment: String,
    repeat_grouping_done: bool,
    repeat_crossmatch_done: bool,
    dcoombs_test: Option<String>,
    urine_hemoglobin: Option<String>,
    plasma_hemoglobin: Option<String>,
    ldh: Option<String>,
    bilirubin: Option<String>,
    blood_culture_sent: bool,
    bag_returned_to_blood_bank: bool,
    patient_outcome: String,
    reaction_resolved: bool,
    permanent_sequelae: Option<String>,
    imputability: Option<String>,
    naco_report_number: Option<String>,
    reported_by: String,
    reported_by_designation: String,
    blood_bank_mo_name: Option<String>,
    blood_bank_mo_remarks: Option<String>,
}

pub async fn get_transfusion_reaction_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(reaction_id): Path<Uuid>,
) -> Result<Json<TransfusionReactionPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TransfusionReactionRow>(
        "SELECT \
           tr.report_number AS report_id, \
           tr.report_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.blood_group::text AS blood_group, \
           p.rh_factor::text AS rh_factor, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           tr.transfusion_date, \
           tr.transfusion_start_time, \
           tr.reaction_time, \
           tr.product_type, \
           tr.bag_number, \
           tr.donor_blood_group, \
           tr.volume_transfused_ml, \
           tr.volume_remaining_ml, \
           tr.reaction_type, \
           tr.severity, \
           tr.transfusion_stopped, \
           tr.transfusion_stopped_time, \
           tr.iv_line_kept_open, \
           tr.doctor_informed, \
           doc.full_name AS doctor_name, \
           tr.blood_bank_informed, \
           tr.immediate_treatment, \
           tr.repeat_grouping_done, \
           tr.repeat_crossmatch_done, \
           tr.dcoombs_test, \
           tr.urine_hemoglobin, \
           tr.plasma_hemoglobin, \
           tr.ldh, \
           tr.bilirubin, \
           tr.blood_culture_sent, \
           tr.bag_returned_to_blood_bank, \
           tr.patient_outcome, \
           tr.reaction_resolved, \
           tr.permanent_sequelae, \
           tr.imputability, \
           tr.naco_report_number, \
           reporter.full_name AS reported_by, \
           reporter.designation AS reported_by_designation, \
           bbmo.full_name AS blood_bank_mo_name, \
           tr.blood_bank_mo_remarks \
         FROM transfusion_reactions tr \
         JOIN patients p ON p.id = tr.patient_id AND p.tenant_id = tr.tenant_id \
         LEFT JOIN admissions a ON a.id = tr.admission_id AND a.tenant_id = tr.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = tr.doctor_id \
         LEFT JOIN users reporter ON reporter.id = tr.reported_by_id \
         LEFT JOIN users bbmo ON bbmo.id = tr.blood_bank_mo_id \
         WHERE tr.id = $1 AND tr.tenant_id = $2",
    )
    .bind(reaction_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let symptoms: Vec<String> = sqlx::query_scalar(
        "SELECT symptom FROM transfusion_reaction_symptoms \
         WHERE reaction_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(reaction_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    #[derive(sqlx::FromRow)]
    struct VitalsRow {
        bp_systolic: Option<i32>,
        bp_diastolic: Option<i32>,
        pulse: Option<i32>,
        temperature: Option<f64>,
        spo2: Option<i32>,
        respiratory_rate: Option<i32>,
    }

    let vitals_row: Option<VitalsRow> = sqlx::query_as(
        "SELECT bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate \
         FROM transfusion_reaction_vitals \
         WHERE reaction_id = $1 AND tenant_id = $2 \
         LIMIT 1",
    )
    .bind(reaction_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let vital_signs_during_reaction = vitals_row.map_or(
        TransfusionVitals {
            bp_systolic: None,
            bp_diastolic: None,
            pulse: None,
            temperature: None,
            spo2: None,
            respiratory_rate: None,
        },
        |v| TransfusionVitals {
            bp_systolic: v.bp_systolic,
            bp_diastolic: v.bp_diastolic,
            pulse: v.pulse,
            temperature: v.temperature,
            spo2: v.spo2,
            respiratory_rate: v.respiratory_rate,
        },
    );

    tx.commit().await?;

    Ok(Json(TransfusionReactionPrintData {
        report_id: row.report_id,
        report_date: row.report_date.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        blood_group: row.blood_group,
        rh_factor: row.rh_factor,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        transfusion_date: row.transfusion_date.format("%d-%b-%Y").to_string(),
        transfusion_start_time: row.transfusion_start_time.format("%H:%M").to_string(),
        reaction_time: row.reaction_time.format("%H:%M").to_string(),
        product_type: row.product_type,
        bag_number: row.bag_number,
        donor_blood_group: row.donor_blood_group,
        volume_transfused_ml: row.volume_transfused_ml,
        volume_remaining_ml: row.volume_remaining_ml,
        reaction_type: row.reaction_type,
        symptoms,
        vital_signs_during_reaction,
        severity: row.severity,
        transfusion_stopped: row.transfusion_stopped,
        transfusion_stopped_time: row
            .transfusion_stopped_time
            .map(|t| t.format("%H:%M").to_string()),
        iv_line_kept_open: row.iv_line_kept_open,
        doctor_informed: row.doctor_informed,
        doctor_name: row.doctor_name,
        blood_bank_informed: row.blood_bank_informed,
        immediate_treatment: row.immediate_treatment,
        repeat_grouping_done: row.repeat_grouping_done,
        repeat_crossmatch_done: row.repeat_crossmatch_done,
        dcoombs_test: row.dcoombs_test,
        urine_hemoglobin: row.urine_hemoglobin,
        plasma_hemoglobin: row.plasma_hemoglobin,
        ldh: row.ldh,
        bilirubin: row.bilirubin,
        blood_culture_sent: row.blood_culture_sent,
        bag_returned_to_blood_bank: row.bag_returned_to_blood_bank,
        patient_outcome: row.patient_outcome,
        reaction_resolved: row.reaction_resolved,
        permanent_sequelae: row.permanent_sequelae,
        imputability: row.imputability,
        naco_report_number: row.naco_report_number,
        reported_by: row.reported_by,
        reported_by_designation: row.reported_by_designation,
        blood_bank_mo_name: row.blood_bank_mo_name,
        blood_bank_mo_remarks: row.blood_bank_mo_remarks,
    }))
}
