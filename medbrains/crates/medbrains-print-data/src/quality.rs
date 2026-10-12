//! Print-data endpoints — quality & safety forms.
//!
//! Every form here reads the tables the product actually writes:
//! `quality_incidents`, `quality_capa`, `quality_action_items`, `adr_reports`
//! and `transfusion_records`. Sections of a form that nothing records yet are
//! printed blank rather than filled with guesses.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AdrReportPrintData, CapaAction, CapaFormPrintData, ConcomitantDrug, CorrectiveAction,
    IncidentReportPrintData, PreventiveAction, RcaTemplatePrintData, SuspectedDrug,
    TransfusionReactionPrintData, TransfusionVitals,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

/// Strings out of a JSONB column that should hold an array; anything else
/// (an object, a scalar) reads as empty instead of erroring.
macro_rules! jsonb_text_array {
    ($col:literal) => {
        concat!(
            "ARRAY(SELECT e #>> '{}' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(",
            $col,
            ") = 'array' THEN ",
            $col,
            " ELSE '[]'::jsonb END) e LIMIT 100)"
        )
    };
}

// ── Incident Report ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct IncidentReportRow {
    incident_number: String,
    title: String,
    report_date: String,
    report_time: String,
    incident_date: Option<String>,
    incident_time: Option<String>,
    location: Option<String>,
    department: Option<String>,
    incident_type: Option<String>,
    severity: Option<String>,
    patient_involved: bool,
    patient_name: Option<String>,
    patient_uhid: Option<String>,
    description: Option<String>,
    immediate_action: Option<String>,
    root_cause: Option<String>,
    contributing_factors: Vec<String>,
    reported_by: Option<String>,
    reported_by_designation: Option<String>,
    status: String,
}

pub async fn get_incident_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(incident_id): Path<Uuid>,
) -> Result<Json<IncidentReportPrintData>, AppError> {
    // A patient-safety incident report — the quality officer's permission, not
    // `admin.roles.list`, which it was once gated on.
    require_permission(&claims, permissions::quality::incidents::LIST)?;
    medbrains_authz_gate::require_access_via_optional(
        &state,
        &claims,
        medbrains_authz_gate::links::QUALITY_INCIDENT,
        incident_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IncidentReportRow>(concat!(
        "SELECT \
           qi.incident_number, \
           qi.title::text AS title, \
           to_char(qi.created_at, 'DD-Mon-YYYY') AS report_date, \
           to_char(qi.created_at, 'HH24:MI') AS report_time, \
           to_char(qi.incident_date, 'DD-Mon-YYYY') AS incident_date, \
           to_char(qi.incident_date, 'HH24:MI') AS incident_time, \
           qi.location, \
           dept.name AS department, \
           qi.incident_type, \
           qi.severity::text AS severity, \
           (qi.patient_id IS NOT NULL) AS patient_involved, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid AS patient_uhid, \
           qi.description, \
           qi.immediate_action, \
           qi.root_cause, ",
        jsonb_text_array!("qi.contributing_factors"),
        " AS contributing_factors, \
           CASE WHEN qi.is_anonymous THEN NULL ELSE reporter.full_name END AS reported_by, \
           CASE WHEN qi.is_anonymous THEN NULL ELSE reporter.designation END \
             AS reported_by_designation, \
           qi.status::text AS status \
         FROM quality_incidents qi \
         LEFT JOIN departments dept ON dept.id = qi.department_id AND dept.tenant_id = qi.tenant_id \
         LEFT JOIN patients p ON p.id = qi.patient_id AND p.tenant_id = qi.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users reporter ON reporter.id = qi.reported_by \
         WHERE qi.id = $1 AND qi.tenant_id = $2 AND qi.deleted_at IS NULL"
    ))
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(IncidentReportPrintData {
        incident_id: row.incident_number,
        title: row.title,
        report_date: row.report_date,
        report_time: row.report_time,
        incident_date: row.incident_date.unwrap_or_default(),
        incident_time: row.incident_time.unwrap_or_default(),
        incident_location: row.location.unwrap_or_default(),
        department: row.department.unwrap_or_default(),
        incident_type: row.incident_type.unwrap_or_default(),
        // ponytail: incident category, harm level, post-incident condition,
        // witnesses, staff involved and the notification list are not recorded
        // anywhere yet (`affected_persons` is free-form JSON nothing writes).
        incident_category: String::new(),
        severity_level: row.severity.unwrap_or_default(),
        patient_involved: row.patient_involved,
        patient_name: row.patient_name,
        patient_uhid: row.patient_uhid,
        patient_harm_level: None,
        staff_involved: Vec::new(),
        witnesses: Vec::new(),
        incident_description: row.description.unwrap_or_default(),
        immediate_action_taken: row.immediate_action.unwrap_or_default(),
        patient_condition_post_incident: None,
        notification_list: Vec::new(),
        root_cause_identified: row.root_cause,
        contributing_factors: row.contributing_factors,
        reported_by: row.reported_by.unwrap_or_default(),
        reported_by_designation: row.reported_by_designation.unwrap_or_default(),
        // ponytail: notification flags are not recorded anywhere yet.
        department_head_notified: None,
        quality_dept_notified: None,
        risk_management_notified: None,
        status: row.status,
    }))
}

// ── RCA Template (Root Cause Analysis) ───────────────────

#[derive(Debug, sqlx::FromRow)]
struct RcaIncidentRow {
    incident_number: String,
    incident_date: Option<String>,
    description: Option<String>,
    root_cause: Option<String>,
    contributing_factors: Vec<String>,
    status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct RcaCapaRow {
    capa_type: Option<String>,
    action_description: String,
    responsible_person: String,
    target_date: String,
    status: String,
    completion_date: Option<String>,
    effectiveness_check: Option<String>,
}

pub async fn get_rca_template_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(incident_id): Path<Uuid>,
) -> Result<Json<RcaTemplatePrintData>, AppError> {
    // Root-cause analysis of an incident, so it follows the incident permission
    // and the incident's (optional) patient.
    require_permission(&claims, permissions::quality::incidents::LIST)?;
    medbrains_authz_gate::require_access_via_optional(
        &state,
        &claims,
        medbrains_authz_gate::links::QUALITY_INCIDENT,
        incident_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RcaIncidentRow>(concat!(
        "SELECT \
           qi.incident_number, \
           to_char(qi.incident_date, 'DD-Mon-YYYY') AS incident_date, \
           qi.description, \
           qi.root_cause, ",
        jsonb_text_array!("qi.contributing_factors"),
        " AS contributing_factors, \
           qi.status::text AS status \
         FROM quality_incidents qi \
         WHERE qi.id = $1 AND qi.tenant_id = $2 AND qi.deleted_at IS NULL"
    ))
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let capas = sqlx::query_as::<_, RcaCapaRow>(
        "SELECT \
           c.capa_type, \
           COALESCE(c.action_plan, c.description, '') AS action_description, \
           COALESCE(u.full_name, '') AS responsible_person, \
           COALESCE(to_char(c.due_date, 'DD-Mon-YYYY'), '') AS target_date, \
           c.status::text AS status, \
           to_char(c.completed_at, 'DD-Mon-YYYY') AS completion_date, \
           c.effectiveness_check \
         FROM quality_capa c \
         LEFT JOIN users u ON u.id = c.assigned_to \
         WHERE c.incident_id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
         ORDER BY c.created_at LIMIT 500",
    )
    .bind(incident_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let effectiveness_measures = capas
        .iter()
        .filter_map(|c| c.effectiveness_check.clone())
        .collect();
    let mut corrective_actions = Vec::new();
    let mut preventive_actions = Vec::new();
    for c in capas {
        if c.capa_type.as_deref() == Some("preventive") {
            preventive_actions.push(PreventiveAction {
                action_description: c.action_description,
                responsible_person: c.responsible_person,
                target_date: c.target_date,
                status: c.status,
            });
        } else {
            // The CAPA form defaults to corrective; an untyped CAPA is one.
            corrective_actions.push(CorrectiveAction {
                action_description: c.action_description,
                responsible_person: c.responsible_person,
                target_date: c.target_date,
                status: c.status,
                completion_date: c.completion_date,
            });
        }
    }

    Ok(Json(RcaTemplatePrintData {
        // ponytail: there is no RCA record yet — RCA number, dates, team,
        // problem statement, data sources, timeline, method, 5-whys, fishbone,
        // follow-ups and sign-offs are not recorded anywhere. The form prints
        // what the incident and its CAPAs hold.
        rca_id: String::new(),
        incident_id: row.incident_number,
        incident_date: row.incident_date.unwrap_or_default(),
        incident_description: row.description.unwrap_or_default(),
        rca_start_date: String::new(),
        rca_completion_date: None,
        rca_team: Vec::new(),
        problem_statement: String::new(),
        data_sources: Vec::new(),
        timeline_of_events: Vec::new(),
        analysis_method: String::new(),
        five_whys: Vec::new(),
        fishbone_categories: Vec::new(),
        root_causes_identified: row.root_cause.into_iter().collect(),
        contributing_factors: row.contributing_factors,
        corrective_actions,
        preventive_actions,
        effectiveness_measures,
        follow_up_dates: Vec::new(),
        prepared_by: String::new(),
        reviewed_by: None,
        approved_by: None,
        status: row.status,
    }))
}

// ── CAPA Form (Corrective and Preventive Action) ─────────

#[derive(Debug, sqlx::FromRow)]
struct CapaFormRow {
    capa_number: String,
    capa_type: Option<String>,
    source: Option<String>,
    source_reference: Option<String>,
    initiated_date: String,
    department: Option<String>,
    description: Option<String>,
    root_cause: Option<String>,
    action_plan: Option<String>,
    status: String,
    completed_date: Option<String>,
    verified_date: Option<String>,
    verified_by: Option<String>,
    effectiveness_check: Option<String>,
}

pub async fn get_capa_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(capa_id): Path<Uuid>,
) -> Result<Json<CapaFormPrintData>, AppError> {
    require_permission(&claims, permissions::quality::capa::LIST)?;
    // A CAPA reaches a patient only through its incident, and both hops are
    // nullable — so resolve the first by hand and let the optional check take
    // the second. The gate's optional check does not follow chained links.
    let incident_id: Option<Uuid> = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT incident_id FROM quality_capa \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if let Some(incident_id) = incident_id {
        medbrains_authz_gate::require_access_via_optional(
            &state,
            &claims,
            medbrains_authz_gate::links::QUALITY_INCIDENT,
            incident_id,
        )
        .await?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CapaFormRow>(
        "SELECT \
           c.capa_number, \
           c.capa_type, \
           CASE WHEN qi.id IS NOT NULL THEN 'Incident' END AS source, \
           qi.incident_number AS source_reference, \
           to_char(c.created_at, 'DD-Mon-YYYY') AS initiated_date, \
           dept.name AS department, \
           c.description, \
           qi.root_cause, \
           c.action_plan, \
           c.status::text AS status, \
           to_char(c.completed_at, 'DD-Mon-YYYY') AS completed_date, \
           to_char(c.verified_at, 'DD-Mon-YYYY') AS verified_date, \
           verifier.full_name AS verified_by, \
           c.effectiveness_check \
         FROM quality_capa c \
         LEFT JOIN quality_incidents qi ON qi.id = c.incident_id AND qi.tenant_id = c.tenant_id \
           AND qi.deleted_at IS NULL \
         LEFT JOIN departments dept ON dept.id = qi.department_id AND dept.tenant_id = qi.tenant_id \
         LEFT JOIN users verifier ON verifier.id = c.verified_by \
         WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let proposed_actions = sqlx::query_as::<_, CapaAction>(
        "SELECT \
           (row_number() OVER (ORDER BY ai.created_at))::int4 AS action_number, \
           COALESCE(ai.description, '') AS action_description, \
           COALESCE(u.full_name, '') AS responsible_person, \
           COALESCE(to_char(ai.due_date, 'DD-Mon-YYYY'), '') AS target_date, \
           to_char(ai.completed_at, 'DD-Mon-YYYY') AS actual_date, \
           ai.status::text AS status, \
           ai.remarks \
         FROM quality_action_items ai \
         LEFT JOIN users u ON u.id = ai.assigned_to \
         WHERE ai.source_id = $1 AND ai.tenant_id = $2 AND ai.deleted_at IS NULL \
         ORDER BY ai.created_at LIMIT 500",
    )
    .bind(capa_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CapaFormPrintData {
        capa_id: row.capa_number,
        capa_type: row.capa_type.unwrap_or_default(),
        source: row.source.unwrap_or_default(),
        source_reference: row.source_reference,
        initiated_date: row.initiated_date,
        // ponytail: initiator, problem scope, affected processes, RCA method,
        // implementer, verification method/result, effectiveness date/evidence
        // and closure are not recorded anywhere yet.
        initiated_by: String::new(),
        department: row.department.unwrap_or_default(),
        problem_description: row.description.unwrap_or_default(),
        problem_scope: String::new(),
        affected_processes: Vec::new(),
        root_cause_analysis: row.root_cause,
        root_cause_method: None,
        action_plan: row.action_plan,
        proposed_actions,
        implementation_status: row.status.clone(),
        implementation_date: row.completed_date,
        implemented_by: None,
        verification_method: None,
        verification_date: row.verified_date,
        verified_by: row.verified_by,
        verification_result: None,
        effectiveness_check_date: None,
        effectiveness_result: row.effectiveness_check,
        effectiveness_evidence: None,
        closure_date: None,
        closed_by: None,
        closure_remarks: None,
        status: row.status,
    }))
}

// ── ADR Report (Adverse Drug Reaction) ───────────────────

#[derive(Debug, sqlx::FromRow)]
struct AdrReportRow {
    report_number: String,
    report_date: String,
    patient_initials: Option<String>,
    patient_age: Option<f64>,
    patient_gender: Option<String>,
    reaction_description: String,
    reaction_start_date: String,
    outcome: Option<String>,
    severity: String,
    seriousness_criteria: Vec<String>,
    drug_name: String,
    drug_generic_name: Option<String>,
    manufacturer: Option<String>,
    drug_batch_number: Option<String>,
    relevant_history: Option<String>,
    dechallenge: Option<String>,
    rechallenge: Option<String>,
    causality_assessment: Option<String>,
    reporter_name: Option<String>,
    reporter_qualification: Option<String>,
    reporter_department: Option<String>,
    reporter_contact: Option<String>,
    hospital_name: Option<String>,
    pvpi_reference: Option<String>,
}

pub async fn get_adr_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(report_id): Path<Uuid>,
) -> Result<Json<AdrReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::LIST)?;
    // Optional parent: an ADR can be filed against a batch with no patient.
    medbrains_authz_gate::require_access_via_optional(
        &state,
        &claims,
        medbrains_authz_gate::links::ADR_REPORT,
        report_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdrReportRow>(concat!(
        "SELECT \
           adr.report_number, \
           to_char(adr.created_at, 'DD-Mon-YYYY') AS report_date, \
           upper(left(p.first_name, 1) || left(p.last_name, 1)) AS patient_initials, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS patient_age, \
           p.gender::text AS patient_gender, \
           adr.reaction_description, \
           to_char(COALESCE(adr.onset_date, adr.reaction_date), 'DD-Mon-YYYY') \
             AS reaction_start_date, \
           adr.outcome, \
           adr.severity::text AS severity, ",
        jsonb_text_array!("adr.seriousness_criteria"),
        " AS seriousness_criteria, \
           adr.drug_name, \
           adr.drug_generic_name, \
           adr.manufacturer, \
           adr.drug_batch_number, \
           adr.relevant_history, \
           adr.dechallenge, \
           adr.rechallenge, \
           adr.causality_assessment, \
           reporter.full_name AS reporter_name, \
           reporter.qualification AS reporter_qualification, \
           dept.name AS reporter_department, \
           reporter.phone AS reporter_contact, \
           t.name AS hospital_name, \
           adr.pvpi_reference \
         FROM adr_reports adr \
         LEFT JOIN patients p ON p.id = adr.patient_id AND p.tenant_id = adr.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users reporter ON reporter.id = adr.reporter_id \
         LEFT JOIN departments dept \
           ON dept.id = COALESCE(adr.reporter_department_id, reporter.department_id) \
           AND dept.tenant_id = adr.tenant_id \
         LEFT JOIN tenants t ON t.id = adr.tenant_id \
         WHERE adr.id = $1 AND adr.tenant_id = $2 AND adr.deleted_at IS NULL"
    ))
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let concomitant_drugs = sqlx::query_as::<_, ConcomitantDrug>(
        "SELECT \
           COALESCE(e->>'drug_name', e->>'name', e #>> '{}') AS drug_name, \
           COALESCE(e->>'dose', '') AS dose, \
           COALESCE(e->>'route', '') AS route, \
           COALESCE(e->>'indication', '') AS indication \
         FROM adr_reports adr, \
           jsonb_array_elements(CASE WHEN jsonb_typeof(adr.concomitant_drugs) = 'array' \
             THEN adr.concomitant_drugs ELSE '[]'::jsonb END) e \
         WHERE adr.id = $1 AND adr.tenant_id = $2 AND adr.deleted_at IS NULL \
         LIMIT 100",
    )
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // ponytail: dose, route, frequency, dates and indication of the suspected
    // drug are not recorded anywhere yet — only its identity is.
    let suspected_drugs = vec![SuspectedDrug {
        drug_name: row.drug_name,
        generic_name: row.drug_generic_name,
        manufacturer: row.manufacturer,
        batch_number: row.drug_batch_number,
        dose: String::new(),
        route: String::new(),
        frequency: String::new(),
        start_date: String::new(),
        end_date: None,
        indication: String::new(),
    }];

    Ok(Json(AdrReportPrintData {
        report_id: row.report_number,
        report_date: row.report_date,
        // ponytail: report type (initial/follow-up), weight, height, reaction
        // end date, allergies, WHO-UMC category, Naranjo score and VigiFlow id
        // are not recorded anywhere yet.
        report_type: String::new(),
        patient_initials: row.patient_initials.unwrap_or_default(),
        patient_age: row.patient_age.map(|a| format!("{} yrs", a as i64)),
        patient_gender: row.patient_gender.unwrap_or_default(),
        patient_weight_kg: None,
        patient_height_cm: None,
        reaction_description: row.reaction_description,
        reaction_start_date: row.reaction_start_date,
        reaction_end_date: None,
        reaction_outcome: row.outcome.unwrap_or_default(),
        seriousness: row.severity,
        seriousness_criteria: row.seriousness_criteria,
        suspected_drugs,
        concomitant_drugs,
        relevant_history: row.relevant_history,
        allergies: None,
        // ponytail: `*_done` is not recorded — only the free-text result is.
        // `None` means "not recorded".
        dechallenge_done: None,
        dechallenge_result: row.dechallenge,
        rechallenge_done: None,
        rechallenge_result: row.rechallenge,
        causality_assessment: row.causality_assessment,
        who_umc_category: None,
        naranjo_score: None,
        reporter_name: row.reporter_name.unwrap_or_default(),
        reporter_qualification: row.reporter_qualification.unwrap_or_default(),
        reporter_department: row.reporter_department.unwrap_or_default(),
        reporter_contact: row.reporter_contact,
        hospital_name: row.hospital_name.unwrap_or_default(),
        pvpi_id: row.pvpi_reference,
        vigiflow_id: None,
    }))
}

// ── Transfusion Reaction Report ──────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionReactionRow {
    report_date: Option<String>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: Option<String>,
    blood_group: Option<String>,
    transfusion_date: String,
    transfusion_start_time: String,
    reaction_time: Option<String>,
    product_type: String,
    bag_number: String,
    donor_blood_group: String,
    reaction_type: Option<String>,
    severity: Option<String>,
    volume_transfused_ml: Option<i32>,
    reaction_details: Option<String>,
}

pub async fn get_transfusion_reaction_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfusion_id): Path<Uuid>,
) -> Result<Json<TransfusionReactionPrintData>, AppError> {
    // The reaction is recorded on the blood bank's transfusion record, so it
    // reads under that record's permission and its patient.
    require_permission(&claims, permissions::blood_bank::transfusion::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::TRANSFUSION_RECORD,
        transfusion_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TransfusionReactionRow>(
        "SELECT \
           to_char(tr.reaction_reported_at, 'DD-Mon-YYYY') AS report_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.blood_group::text AS blood_group, \
           to_char(tr.started_at, 'DD-Mon-YYYY') AS transfusion_date, \
           to_char(tr.started_at, 'HH24:MI') AS transfusion_start_time, \
           to_char(tr.reaction_reported_at, 'HH24:MI') AS reaction_time, \
           bc.component_type::text AS product_type, \
           bc.bag_number::text AS bag_number, \
           bc.blood_group::text AS donor_blood_group, \
           tr.reaction_type::text AS reaction_type, \
           tr.reaction_severity::text AS severity, \
           tr.volume_transfused_ml, \
           tr.reaction_details \
         FROM transfusion_records tr \
         JOIN patients p ON p.id = tr.patient_id AND p.tenant_id = tr.tenant_id \
         JOIN blood_components bc ON bc.id = tr.component_id AND bc.tenant_id = tr.tenant_id \
         WHERE tr.id = $1 AND tr.tenant_id = $2 AND tr.has_reaction \
           AND tr.deleted_at IS NULL",
    )
    .bind(transfusion_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(TransfusionReactionPrintData {
        // ponytail: report number, Rh factor (folded into blood group), ward and
        // bed, volumes, symptoms, vitals, management, investigation, outcome,
        // imputability, NACO number and the reporting/MO sign-offs are not
        // recorded anywhere yet. The NABH mirror row carries nothing more.
        report_id: String::new(),
        report_date: row.report_date.unwrap_or_default(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender.unwrap_or_default(),
        blood_group: row.blood_group.unwrap_or_default(),
        rh_factor: String::new(),
        ward_name: String::new(),
        bed_number: String::new(),
        transfusion_date: row.transfusion_date,
        transfusion_start_time: row.transfusion_start_time,
        reaction_time: row.reaction_time.unwrap_or_default(),
        product_type: row.product_type,
        bag_number: row.bag_number,
        donor_blood_group: row.donor_blood_group,
        volume_transfused_ml: row.volume_transfused_ml,
        volume_remaining_ml: None,
        reaction_type: row.reaction_type.unwrap_or_default(),
        symptoms: Vec::new(),
        vital_signs_during_reaction: TransfusionVitals {
            bp_systolic: None,
            bp_diastolic: None,
            pulse: None,
            temperature: None,
            spo2: None,
            respiratory_rate: None,
        },
        severity: row.severity.unwrap_or_default(),
        reaction_details: row.reaction_details,
        transfusion_stopped: None,
        transfusion_stopped_time: None,
        iv_line_kept_open: None,
        doctor_informed: None,
        doctor_name: None,
        blood_bank_informed: None,
        immediate_treatment: String::new(),
        repeat_grouping_done: None,
        repeat_crossmatch_done: None,
        dcoombs_test: None,
        urine_hemoglobin: None,
        plasma_hemoglobin: None,
        ldh: None,
        bilirubin: None,
        blood_culture_sent: None,
        bag_returned_to_blood_bank: None,
        patient_outcome: String::new(),
        reaction_resolved: None,
        permanent_sequelae: None,
        imputability: None,
        naco_report_number: None,
        reported_by: String::new(),
        reported_by_designation: String::new(),
        blood_bank_mo_name: None,
        blood_bank_mo_remarks: None,
    }))
}

/// quality print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/incident-report/{incident_id}",
            get(get_incident_report_print_data),
        )
        .route(
            "/api/print-data/rca-template/{incident_id}",
            get(get_rca_template_print_data),
        )
        .route(
            "/api/print-data/capa-form/{capa_id}",
            get(get_capa_form_print_data),
        )
        .route(
            "/api/print-data/adr-report/{report_id}",
            get(get_adr_report_print_data),
        )
        .route(
            "/api/print-data/transfusion-reaction/{transfusion_id}",
            get(get_transfusion_reaction_print_data),
        )
}
