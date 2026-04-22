//! Print-data endpoints — clinical documents.
//!
//! Each handler assembles the context data that a Handlebars template needs to
//! render a printable document. No HTML is produced here; the frontend template
//! engine does the rendering.

use axum::{Extension, Json, extract::{Path, State}};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AntibioticSensitivity, ComponentSlipPrintData, CrossmatchReportPrintData, CrossmatchUnit,
    CultureSensitivityPrintData, HistopathReportPrintData, IhcMarker,
    InvestigationRequisitionPrintData, LabOrderHeaderRow, LabReportPrintData, LabResultLine,
    MedicationLine, OrderedTest, PatientCardPrintData, PrescriptionHeaderRow,
    PrescriptionPrintData, RadiologyReportPrintData,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Prescription ─────────────────────────────────────────

pub async fn get_prescription_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<PrescriptionPrintData>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Header: patient + encounter + doctor + department + diagnosis
    let header = sqlx::query_as::<_, PrescriptionHeaderRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.phone, \
           u.full_name AS doctor_name, \
           dept.name AS department, \
           (SELECT string_agg(d.description, ', ') \
              FROM diagnoses d WHERE d.encounter_id = e.id AND d.tenant_id = e.tenant_id \
           ) AS diagnosis, \
           e.encounter_date::timestamptz AS encounter_date, \
           c.plan AS advice, \
           c.notes AS follow_up \
         FROM encounters e \
         JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         LEFT JOIN users u ON u.id = e.doctor_id \
         LEFT JOIN departments dept ON dept.id = e.department_id \
                                    AND dept.tenant_id = e.tenant_id \
         LEFT JOIN consultations c ON c.encounter_id = e.id \
                                   AND c.tenant_id = e.tenant_id \
         WHERE e.id = $1 AND e.tenant_id = $2 \
         LIMIT 1",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Medication lines from ALL prescriptions for this encounter
    let medications = sqlx::query_as::<_, MedicationLine>(
        "SELECT pi.drug_name, pi.dosage, pi.route, pi.frequency, \
                pi.duration, pi.instructions \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id \
                               AND pr.tenant_id = pi.tenant_id \
         WHERE pr.encounter_id = $1 AND pr.tenant_id = $2 \
         ORDER BY pi.created_at",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = header.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(PrescriptionPrintData {
        patient_name: header.patient_name,
        uhid: header.uhid,
        age: age_str,
        gender: header.gender,
        phone: header.phone,
        doctor_name: header.doctor_name,
        department: header.department,
        diagnosis: header.diagnosis,
        date: header.encounter_date.format("%d-%b-%Y").to_string(),
        medications,
        advice: header.advice,
        follow_up: header.follow_up,
    }))
}

// ── Lab Report ───────────────────────────────────────────

pub async fn get_lab_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let header = sqlx::query_as::<_, LabOrderHeaderRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           tc.name AS test_name, \
           tc.sample_type, \
           lo.collected_at, \
           lo.verified_at, \
           doc.full_name AS referring_doctor, \
           verifier.full_name AS pathologist_name \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         JOIN lab_test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
         LEFT JOIN users doc ON doc.id = lo.ordered_by \
         LEFT JOIN users verifier ON verifier.id = lo.verified_by \
         WHERE lo.id = $1 AND lo.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let results = sqlx::query_as::<_, LabResultLine>(
        "SELECT parameter_name, value, unit, normal_range, flag::text AS flag \
         FROM lab_results \
         WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = header.age.map(|a| format!("{} yrs", a as i64));
    let fmt_ts = |dt: Option<chrono::DateTime<chrono::Utc>>| {
        dt.map(|d| d.format("%d-%b-%Y %H:%M").to_string())
    };

    Ok(Json(LabReportPrintData {
        patient_name: header.patient_name,
        uhid: header.uhid,
        age: age_str,
        gender: header.gender,
        order_number: None,
        test_name: header.test_name,
        sample_type: header.sample_type,
        collected_at: fmt_ts(header.collected_at),
        reported_at: fmt_ts(header.verified_at),
        referring_doctor: header.referring_doctor,
        results,
        pathologist_name: header.pathologist_name,
    }))
}

// ── Radiology Report ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RadiologyReportRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    modality_name: String,
    body_part: Option<String>,
    clinical_indication: Option<String>,
    findings: String,
    impression: Option<String>,
    recommendations: Option<String>,
    reported_by_name: Option<String>,
    verified_by_name: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_radiology_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<RadiologyReportPrintData>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RadiologyReportRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           m.name AS modality_name, \
           ro.body_part, \
           ro.clinical_indication, \
           rr.findings, \
           rr.impression, \
           rr.recommendations, \
           reporter.full_name AS reported_by_name, \
           verifier.full_name AS verified_by_name, \
           rr.created_at \
         FROM radiology_orders ro \
         JOIN radiology_reports rr ON rr.order_id = ro.id \
                                   AND rr.tenant_id = ro.tenant_id \
         JOIN patients p ON p.id = ro.patient_id AND p.tenant_id = ro.tenant_id \
         JOIN radiology_modalities m ON m.id = ro.modality_id \
                                     AND m.tenant_id = ro.tenant_id \
         LEFT JOIN users reporter ON reporter.id = rr.reported_by \
         LEFT JOIN users verifier ON verifier.id = rr.verified_by \
         WHERE ro.id = $1 AND ro.tenant_id = $2 \
         ORDER BY rr.created_at DESC \
         LIMIT 1",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(RadiologyReportPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        modality: row.modality_name,
        body_part: row.body_part,
        clinical_indication: row.clinical_indication,
        findings: row.findings,
        impression: row.impression,
        recommendations: row.recommendations,
        reported_by: row.reported_by_name,
        verified_by: row.verified_by_name,
        date: row.created_at.format("%d-%b-%Y").to_string(),
    }))
}

// ── Patient Card ─────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PatientCardRow {
    patient_name: String,
    uhid: String,
    date_of_birth: Option<chrono::NaiveDate>,
    age: Option<f64>,
    gender: String,
    phone: String,
    email: Option<String>,
    address: Option<serde_json::Value>,
    category: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_patient_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientCardPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PatientCardRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           date_of_birth, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           phone, \
           email, \
           address, \
           category::text AS category, \
           created_at \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(PatientCardPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        phone: row.phone,
        email: row.email,
        address: row.address,
        category: row.category,
        registered_at: row.created_at.format("%d-%b-%Y").to_string(),
    }))
}

// ── Helper: fetch hospital name from tenants table ───────

async fn hospital_name(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Option<String>, AppError> {
    let name = sqlx::query_scalar::<_, Option<String>>(
        "SELECT name FROM tenants WHERE id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    Ok(name)
}

// ── Culture Sensitivity Report ──────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CultureSensitivityRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    sample_type: String,
    sample_id: String,
    collected_at: Option<chrono::DateTime<chrono::Utc>>,
    received_at: Option<chrono::DateTime<chrono::Utc>>,
    reported_at: Option<chrono::DateTime<chrono::Utc>>,
    referring_doctor: Option<String>,
    clinical_history: Option<String>,
    organism_isolated: Option<String>,
    colony_count: Option<String>,
    gram_stain: Option<String>,
    interpretation: Option<String>,
    comments: Option<String>,
    microbiologist_name: Option<String>,
}

pub async fn get_culture_sensitivity_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<CultureSensitivityPrintData>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CultureSensitivityRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           lo.sample_type, \
           lo.sample_id, \
           lo.collected_at, \
           lo.received_at, \
           lo.verified_at AS reported_at, \
           doc.full_name AS referring_doctor, \
           lo.clinical_history, \
           cr.organism_isolated, \
           cr.colony_count, \
           cr.gram_stain, \
           cr.interpretation, \
           cr.comments, \
           micro.full_name AS microbiologist_name \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         JOIN culture_results cr ON cr.order_id = lo.id AND cr.tenant_id = lo.tenant_id \
         LEFT JOIN users doc ON doc.id = lo.ordered_by \
         LEFT JOIN users micro ON micro.id = lo.verified_by \
         WHERE lo.id = $1 AND lo.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get sensitivity results
    let sensitivities = sqlx::query_as::<_, AntibioticSensitivity>(
        "SELECT \
           antibiotic_name, \
           antibiotic_class, \
           mic, \
           interpretation, \
           zone_size \
         FROM antibiotic_sensitivities \
         WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY antibiotic_class, antibiotic_name",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    // Check NABL accreditation
    let nabl_logo: bool = sqlx::query_scalar(
        "SELECT COALESCE((value->>'nabl_accredited')::boolean, false) \
         FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'lab' AND key = 'accreditation' \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(false);

    tx.commit().await?;

    let fmt_ts = |dt: Option<chrono::DateTime<chrono::Utc>>| {
        dt.map(|d| d.format("%d-%b-%Y %H:%M").to_string())
    };
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(CultureSensitivityPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        sample_type: row.sample_type,
        sample_id: row.sample_id,
        collected_at: fmt_ts(row.collected_at),
        received_at: fmt_ts(row.received_at),
        reported_at: fmt_ts(row.reported_at),
        referring_doctor: row.referring_doctor,
        clinical_history: row.clinical_history,
        organism_isolated: row.organism_isolated,
        colony_count: row.colony_count,
        gram_stain: row.gram_stain,
        sensitivity_results: sensitivities,
        interpretation: row.interpretation,
        comments: row.comments,
        microbiologist_name: row.microbiologist_name,
        hospital_name: h_name,
        nabl_logo,
    }))
}

// ── Histopathology Report ───────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct HistopathRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    specimen_type: String,
    specimen_id: String,
    collected_at: Option<chrono::DateTime<chrono::Utc>>,
    received_at: Option<chrono::DateTime<chrono::Utc>>,
    reported_at: Option<chrono::DateTime<chrono::Utc>>,
    referring_doctor: Option<String>,
    clinical_history: Option<String>,
    gross_description: Option<String>,
    microscopic_description: Option<String>,
    diagnosis: String,
    icd_o_morphology: Option<String>,
    icd_o_topography: Option<String>,
    staging: Option<String>,
    grade: Option<String>,
    margin_status: Option<String>,
    lymph_node_status: Option<String>,
    comments: Option<String>,
    pathologist_name: Option<String>,
}

pub async fn get_histopath_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<HistopathReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, HistopathRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           lo.sample_type AS specimen_type, \
           lo.sample_id AS specimen_id, \
           lo.collected_at, \
           lo.received_at, \
           lo.verified_at AS reported_at, \
           doc.full_name AS referring_doctor, \
           lo.clinical_history, \
           hr.gross_description, \
           hr.microscopic_description, \
           hr.diagnosis, \
           hr.icd_o_morphology, \
           hr.icd_o_topography, \
           hr.staging, \
           hr.grade, \
           hr.margin_status, \
           hr.lymph_node_status, \
           hr.comments, \
           pathol.full_name AS pathologist_name \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         JOIN histopath_results hr ON hr.order_id = lo.id AND hr.tenant_id = lo.tenant_id \
         LEFT JOIN users doc ON doc.id = lo.ordered_by \
         LEFT JOIN users pathol ON pathol.id = lo.verified_by \
         WHERE lo.id = $1 AND lo.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get IHC markers
    let ihc_markers = sqlx::query_as::<_, IhcMarker>(
        "SELECT marker_name, result, intensity, percentage \
         FROM ihc_markers \
         WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY marker_name",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    // Check NABL accreditation
    let nabl_logo: bool = sqlx::query_scalar(
        "SELECT COALESCE((value->>'nabl_accredited')::boolean, false) \
         FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'lab' AND key = 'accreditation' \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(false);

    tx.commit().await?;

    let fmt_ts = |dt: Option<chrono::DateTime<chrono::Utc>>| {
        dt.map(|d| d.format("%d-%b-%Y %H:%M").to_string())
    };
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(HistopathReportPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        specimen_type: row.specimen_type,
        specimen_id: row.specimen_id,
        collected_at: fmt_ts(row.collected_at),
        received_at: fmt_ts(row.received_at),
        reported_at: fmt_ts(row.reported_at),
        referring_doctor: row.referring_doctor,
        clinical_history: row.clinical_history,
        gross_description: row.gross_description,
        microscopic_description: row.microscopic_description,
        diagnosis: row.diagnosis,
        icd_o_morphology: row.icd_o_morphology,
        icd_o_topography: row.icd_o_topography,
        staging: row.staging,
        grade: row.grade,
        margin_status: row.margin_status,
        lymph_node_status: row.lymph_node_status,
        ihc_markers,
        comments: row.comments,
        pathologist_name: row.pathologist_name,
        hospital_name: h_name,
        nabl_logo,
    }))
}

// ── Crossmatch Report ───────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CrossmatchReportRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    blood_group: String,
    rh_type: String,
    request_date: chrono::DateTime<chrono::Utc>,
    request_number: String,
    ward: Option<String>,
    bed: Option<String>,
    diagnosis: Option<String>,
    requesting_doctor: Option<String>,
    units_requested: i32,
    component_type: String,
    antibody_screen: Option<String>,
    special_requirements: Option<String>,
    technician_name: Option<String>,
    verified_by: Option<String>,
}

pub async fn get_crossmatch_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<CrossmatchReportPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CrossmatchReportRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           br.patient_blood_group AS blood_group, \
           br.patient_rh_type AS rh_type, \
           br.created_at AS request_date, \
           br.request_number, \
           w.name AS ward, \
           b.bed_number AS bed, \
           br.diagnosis, \
           doc.full_name AS requesting_doctor, \
           br.units_requested, \
           br.component_type, \
           br.antibody_screen, \
           br.special_requirements, \
           tech.full_name AS technician_name, \
           verifier.full_name AS verified_by \
         FROM blood_requests br \
         JOIN patients p ON p.id = br.patient_id AND p.tenant_id = br.tenant_id \
         LEFT JOIN admissions adm ON adm.id = br.admission_id AND adm.tenant_id = br.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users doc ON doc.id = br.requested_by \
         LEFT JOIN users tech ON tech.id = br.processed_by \
         LEFT JOIN users verifier ON verifier.id = br.verified_by \
         WHERE br.id = $1 AND br.tenant_id = $2",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get crossmatch results for each unit
    let crossmatch_results = sqlx::query_as::<_, CrossmatchUnit>(
        "SELECT \
           bu.bag_number, \
           bu.donation_date::text AS donation_date, \
           bu.expiry_date::text AS expiry_date, \
           bu.blood_group AS donor_blood_group, \
           bu.volume_ml, \
           cm.result AS crossmatch_result, \
           cm.issue_status \
         FROM crossmatch_results cm \
         JOIN blood_units bu ON bu.id = cm.unit_id AND bu.tenant_id = cm.tenant_id \
         WHERE cm.request_id = $1 AND cm.tenant_id = $2 \
         ORDER BY cm.created_at",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(CrossmatchReportPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        blood_group: row.blood_group,
        rh_type: row.rh_type,
        request_date: row.request_date.format("%d-%b-%Y").to_string(),
        request_number: row.request_number,
        ward: row.ward,
        bed: row.bed,
        diagnosis: row.diagnosis,
        requesting_doctor: row.requesting_doctor,
        units_requested: row.units_requested,
        component_type: row.component_type,
        crossmatch_results,
        antibody_screen: row.antibody_screen,
        special_requirements: row.special_requirements,
        technician_name: row.technician_name,
        verified_by: row.verified_by,
        hospital_name: h_name,
    }))
}

// ── Component Issue Slip ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ComponentSlipRow {
    issue_number: String,
    issue_date: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    blood_group: String,
    ward: Option<String>,
    bed: Option<String>,
    bag_number: String,
    component_type: String,
    volume_ml: i32,
    donation_date: chrono::NaiveDate,
    expiry_date: chrono::NaiveDate,
    crossmatch_result: String,
    special_instructions: Option<String>,
    issued_by: Option<String>,
    verified_by: Option<String>,
}

pub async fn get_component_slip_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<ComponentSlipPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComponentSlipRow>(
        "SELECT \
           ci.issue_number, \
           ci.issued_at AS issue_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           br.patient_blood_group AS blood_group, \
           w.name AS ward, \
           b.bed_number AS bed, \
           bu.bag_number, \
           bu.component_type, \
           bu.volume_ml, \
           bu.donation_date, \
           bu.expiry_date, \
           cm.result AS crossmatch_result, \
           ci.special_instructions, \
           issuer.full_name AS issued_by, \
           verifier.full_name AS verified_by \
         FROM component_issues ci \
         JOIN blood_units bu ON bu.id = ci.unit_id AND bu.tenant_id = ci.tenant_id \
         JOIN blood_requests br ON br.id = ci.request_id AND br.tenant_id = ci.tenant_id \
         JOIN patients p ON p.id = br.patient_id AND p.tenant_id = br.tenant_id \
         LEFT JOIN crossmatch_results cm ON cm.unit_id = bu.id AND cm.request_id = br.id \
           AND cm.tenant_id = ci.tenant_id \
         LEFT JOIN admissions adm ON adm.id = br.admission_id AND adm.tenant_id = br.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users issuer ON issuer.id = ci.issued_by \
         LEFT JOIN users verifier ON verifier.id = ci.verified_by \
         WHERE ci.id = $1 AND ci.tenant_id = $2",
    )
    .bind(issue_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    // Generate barcode data (unit ID + issue ID for tracking)
    let barcode_data = format!("BB-{}-{}", row.bag_number, row.issue_number);

    Ok(Json(ComponentSlipPrintData {
        issue_number: row.issue_number,
        issue_date: row.issue_date.format("%d-%b-%Y").to_string(),
        issue_time: row.issue_date.format("%H:%M").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        blood_group: row.blood_group,
        ward: row.ward,
        bed: row.bed,
        bag_number: row.bag_number,
        component_type: row.component_type,
        volume_ml: row.volume_ml,
        donation_date: row.donation_date.format("%d-%b-%Y").to_string(),
        expiry_date: row.expiry_date.format("%d-%b-%Y").to_string(),
        crossmatch_result: row.crossmatch_result,
        special_instructions: row.special_instructions,
        issued_by: row.issued_by,
        verified_by: row.verified_by,
        barcode_data,
        hospital_name: h_name,
    }))
}

// ── Investigation Requisition ───────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct InvestigationRequisitionRow {
    requisition_number: String,
    requisition_date: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    ward: Option<String>,
    bed: Option<String>,
    requesting_doctor: Option<String>,
    department: Option<String>,
    clinical_history: Option<String>,
    diagnosis: Option<String>,
    priority: String,
    fasting_required: bool,
    special_instructions: Option<String>,
}

pub async fn get_investigation_requisition_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<InvestigationRequisitionPrintData>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InvestigationRequisitionRow>(
        "SELECT \
           lo.order_number AS requisition_number, \
           lo.created_at AS requisition_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           w.name AS ward, \
           b.bed_number AS bed, \
           doc.full_name AS requesting_doctor, \
           d.name AS department, \
           lo.clinical_history, \
           lo.diagnosis, \
           lo.priority::text AS priority, \
           COALESCE(lo.fasting_required, false) AS fasting_required, \
           lo.special_instructions \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         LEFT JOIN admissions adm ON adm.patient_id = p.id AND adm.tenant_id = p.tenant_id \
           AND adm.status = 'admitted' \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users doc ON doc.id = lo.ordered_by \
         LEFT JOIN departments d ON d.id = lo.department_id AND d.tenant_id = lo.tenant_id \
         WHERE lo.id = $1 AND lo.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get ordered tests
    let tests_ordered = sqlx::query_as::<_, OrderedTest>(
        "SELECT \
           tc.name AS test_name, \
           tc.code AS test_code, \
           tc.sample_type, \
           tc.container \
         FROM lab_order_items loi \
         JOIN lab_test_catalog tc ON tc.id = loi.test_id AND tc.tenant_id = loi.tenant_id \
         WHERE loi.order_id = $1 AND loi.tenant_id = $2 \
         ORDER BY tc.name",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));
    // Generate barcode data for sample collection
    let barcode_data = format!("LAB-{}", row.requisition_number);

    Ok(Json(InvestigationRequisitionPrintData {
        requisition_number: row.requisition_number,
        requisition_date: row.requisition_date.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        ward: row.ward,
        bed: row.bed,
        requesting_doctor: row.requesting_doctor,
        department: row.department,
        clinical_history: row.clinical_history,
        diagnosis: row.diagnosis,
        tests_ordered,
        priority: row.priority,
        fasting_required: row.fasting_required,
        special_instructions: row.special_instructions,
        barcode_data,
    }))
}

