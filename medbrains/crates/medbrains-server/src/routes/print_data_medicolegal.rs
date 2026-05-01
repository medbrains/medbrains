//! Print-data endpoints — medico-legal forms.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AgeEstimationPrintData, AmaFormPrintData, DeathDeclarationPrintData, EpiphysealFusion,
    InjuryEntry, MlcDateEntry, MlcDocumentationPrintData, MlcRegisterPrintData, PoliceVisitEntry,
    SamplePreservedEntry, SecondaryCharacters, WoundCertificatePrintData, WoundEntry,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Against Medical Advice (AMA) Form ────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AmaFormRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    admission_date: chrono::NaiveDate,
    ward_name: String,
    bed_number: String,
    diagnosis: String,
    treating_doctor: Option<String>,
    ama_date: chrono::NaiveDate,
    ama_time: chrono::NaiveTime,
    patient_understands_risks: bool,
    patient_refuses_treatment: bool,
    patient_assumes_responsibility: bool,
    reason_for_ama: Option<String>,
    patient_signature_obtained: bool,
    relative_name: Option<String>,
    relative_relationship: Option<String>,
    relative_signature_obtained: bool,
    witness1_name: Option<String>,
    witness1_designation: Option<String>,
    witness2_name: Option<String>,
    witness2_designation: Option<String>,
    doctor_name: Option<String>,
    doctor_signature_obtained: bool,
    thumb_impression_taken: bool,
    interpreter_used: bool,
    interpreter_name: Option<String>,
    interpreter_language: Option<String>,
}

pub async fn get_ama_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<AmaFormPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AmaFormRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.id::text AS admission_number, \
           a.admitted_at::date AS admission_date, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           COALESCE(a.provisional_diagnosis, 'N/A') AS diagnosis, \
           doc.full_name AS treating_doctor, \
           COALESCE(ama.ama_date, CURRENT_DATE) AS ama_date, \
           COALESCE(ama.ama_time, CURRENT_TIME) AS ama_time, \
           COALESCE(ama.patient_understands_risks, true) AS patient_understands_risks, \
           COALESCE(ama.patient_refuses_treatment, true) AS patient_refuses_treatment, \
           COALESCE(ama.patient_assumes_responsibility, true) AS patient_assumes_responsibility, \
           ama.reason_for_ama, \
           COALESCE(ama.patient_signature_obtained, false) AS patient_signature_obtained, \
           ama.relative_name, \
           ama.relative_relationship, \
           COALESCE(ama.relative_signature_obtained, false) AS relative_signature_obtained, \
           ama.witness1_name, \
           ama.witness1_designation, \
           ama.witness2_name, \
           ama.witness2_designation, \
           doc.full_name AS doctor_name, \
           COALESCE(ama.doctor_signature_obtained, false) AS doctor_signature_obtained, \
           COALESCE(ama.thumb_impression_taken, false) AS thumb_impression_taken, \
           COALESCE(ama.interpreter_used, false) AS interpreter_used, \
           ama.interpreter_name, \
           ama.interpreter_language \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN ama_forms ama ON ama.admission_id = a.id AND ama.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let risks_explained: Vec<String> = sqlx::query_scalar(
        "SELECT risk_text FROM ama_risks_explained \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let ama_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(AmaFormPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_number: row.admission_number,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        diagnosis: row.diagnosis,
        treating_doctor: row.treating_doctor.unwrap_or_default(),
        ama_date: row.ama_date.format("%d-%b-%Y").to_string(),
        ama_time: row.ama_time.format("%H:%M").to_string(),
        risks_explained,
        patient_understands_risks: row.patient_understands_risks,
        patient_refuses_treatment: row.patient_refuses_treatment,
        patient_assumes_responsibility: row.patient_assumes_responsibility,
        reason_for_ama: row.reason_for_ama,
        patient_signature_obtained: row.patient_signature_obtained,
        relative_name: row.relative_name,
        relative_relationship: row.relative_relationship,
        relative_signature_obtained: row.relative_signature_obtained,
        witness1_name: row.witness1_name,
        witness1_designation: row.witness1_designation,
        witness2_name: row.witness2_name,
        witness2_designation: row.witness2_designation,
        doctor_name: row.doctor_name.unwrap_or_default(),
        doctor_signature_obtained: row.doctor_signature_obtained,
        thumb_impression_taken: row.thumb_impression_taken,
        interpreter_used: row.interpreter_used,
        interpreter_name: row.interpreter_name,
        interpreter_language: row.interpreter_language,
        signatures: super::signed_documents::to_print_signatures(ama_sigs),
    }))
}

// ── MLC Register ─────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct MlcRegisterRow {
    mlc_number: String,
    registration_date: chrono::NaiveDate,
    registration_time: chrono::NaiveTime,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    brought_by: Option<String>,
    police_station: Option<String>,
    police_officer_name: Option<String>,
    police_officer_rank: Option<String>,
    police_dd_number: Option<String>,
    nature_of_case: String,
    alleged_history: String,
    date_time_of_incident: Option<chrono::DateTime<chrono::Utc>>,
    place_of_incident: Option<String>,
    weapon_used: Option<String>,
    condition_on_arrival: String,
    treatment_given: String,
    samples_handed_to: Option<String>,
    opinion: Option<String>,
    patient_condition_at_discharge: Option<String>,
    examining_doctor: Option<String>,
    examined_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_mlc_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
) -> Result<Json<MlcRegisterPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, MlcRegisterRow>(
        "SELECT \
           mlc.mlc_number, \
           mlc.registration_date, \
           mlc.registration_time, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           mlc.brought_by, \
           mlc.police_station, \
           mlc.police_officer_name, \
           mlc.police_officer_rank, \
           mlc.police_dd_number, \
           mlc.nature_of_case, \
           mlc.alleged_history, \
           mlc.date_time_of_incident, \
           mlc.place_of_incident, \
           mlc.weapon_used, \
           mlc.condition_on_arrival, \
           mlc.treatment_given, \
           mlc.samples_handed_to, \
           mlc.opinion, \
           mlc.patient_condition_at_discharge, \
           doc.full_name AS examining_doctor, \
           mlc.examined_at \
         FROM mlc_cases mlc \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
         LEFT JOIN users doc ON doc.id = mlc.examining_doctor_id \
         WHERE mlc.id = $1 AND mlc.tenant_id = $2",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let injuries_noted = sqlx::query_as::<_, InjuryEntry>(
        "SELECT \
           injury_number, \
           injury_type, \
           location, \
           size_cm, \
           description, \
           probable_age, \
           probable_weapon \
         FROM mlc_injuries \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY injury_number",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let samples_collected: Vec<String> = sqlx::query_scalar(
        "SELECT sample_description FROM mlc_samples \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(MlcRegisterPrintData {
        mlc_number: row.mlc_number,
        registration_date: row.registration_date.format("%d-%b-%Y").to_string(),
        registration_time: row.registration_time.format("%H:%M").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        brought_by: row.brought_by,
        police_station: row.police_station,
        police_officer_name: row.police_officer_name,
        police_officer_rank: row.police_officer_rank,
        police_dd_number: row.police_dd_number,
        nature_of_case: row.nature_of_case,
        alleged_history: row.alleged_history,
        date_time_of_incident: row
            .date_time_of_incident
            .map(|dt| dt.format("%d-%b-%Y %H:%M").to_string()),
        place_of_incident: row.place_of_incident,
        weapon_used: row.weapon_used,
        condition_on_arrival: row.condition_on_arrival,
        injuries_noted,
        treatment_given: row.treatment_given,
        samples_collected,
        samples_handed_to: row.samples_handed_to,
        opinion: row.opinion,
        patient_condition_at_discharge: row.patient_condition_at_discharge,
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        examined_at: row.examined_at.format("%d-%b-%Y %H:%M").to_string(),
    }))
}

// ── Wound Certificate ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct WoundCertRow {
    certificate_number: String,
    certificate_date: chrono::NaiveDate,
    patient_name: String,
    patient_age: Option<f64>,
    patient_gender: String,
    patient_address: Option<String>,
    patient_occupation: Option<String>,
    identified_by: Option<String>,
    identification_document: Option<String>,
    examination_date: chrono::NaiveDate,
    examination_time: chrono::NaiveTime,
    mlc_number: Option<String>,
    police_requisition_number: Option<String>,
    police_station: Option<String>,
    alleged_incident_date: Option<chrono::NaiveDate>,
    alleged_incident_time: Option<chrono::NaiveTime>,
    alleged_incident_place: Option<String>,
    alleged_manner: Option<String>,
    general_condition: String,
    vital_signs: Option<String>,
    x_ray_findings: Option<String>,
    other_investigations: Option<String>,
    opinion_nature: String,
    opinion_weapon: Option<String>,
    opinion_duration: Option<String>,
    opinion_disability: Option<String>,
    opinion_danger_to_life: Option<String>,
    examining_doctor: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
}

pub async fn get_wound_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
) -> Result<Json<WoundCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, WoundCertRow>(
        "SELECT \
           wc.certificate_number, \
           wc.certificate_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS patient_age, \
           p.gender::text AS patient_gender, \
           p.address::text AS patient_address, \
           p.occupation AS patient_occupation, \
           wc.identified_by, \
           wc.identification_document, \
           wc.examination_date, \
           wc.examination_time, \
           mlc.mlc_number, \
           wc.police_requisition_number, \
           wc.police_station, \
           wc.alleged_incident_date, \
           wc.alleged_incident_time, \
           wc.alleged_incident_place, \
           wc.alleged_manner, \
           wc.general_condition, \
           wc.vital_signs, \
           wc.x_ray_findings, \
           wc.other_investigations, \
           wc.opinion_nature, \
           wc.opinion_weapon, \
           wc.opinion_duration, \
           wc.opinion_disability, \
           wc.opinion_danger_to_life, \
           doc.full_name AS examining_doctor, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number \
         FROM wound_certificates wc \
         JOIN patients p ON p.id = wc.patient_id AND p.tenant_id = wc.tenant_id \
         LEFT JOIN mlc_cases mlc ON mlc.id = wc.mlc_case_id AND mlc.tenant_id = wc.tenant_id \
         LEFT JOIN users doc ON doc.id = wc.examining_doctor_id \
         WHERE wc.id = $1 AND wc.tenant_id = $2",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let injuries = sqlx::query_as::<_, WoundEntry>(
        "SELECT \
           wound_number, \
           wound_type, \
           location, \
           dimensions, \
           margins, \
           floor, \
           surrounding_area, \
           healing_stage, \
           probable_age_of_wound \
         FROM wound_certificate_injuries \
         WHERE wound_certificate_id = $1 AND tenant_id = $2 \
         ORDER BY wound_number",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let wound_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    let wound_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(WoundCertificatePrintData {
        certificate_number: row.certificate_number,
        certificate_date: row.certificate_date.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        patient_age: row.patient_age.map(|a| format!("{} yrs", a as i64)),
        patient_gender: row.patient_gender,
        patient_address: row.patient_address,
        patient_occupation: row.patient_occupation,
        identified_by: row.identified_by,
        identification_document: row.identification_document,
        examination_date: row.examination_date.format("%d-%b-%Y").to_string(),
        examination_time: row.examination_time.format("%H:%M").to_string(),
        mlc_number: row.mlc_number,
        police_requisition_number: row.police_requisition_number,
        police_station: row.police_station,
        alleged_incident_date: row
            .alleged_incident_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        alleged_incident_time: row
            .alleged_incident_time
            .map(|t| t.format("%H:%M").to_string()),
        alleged_incident_place: row.alleged_incident_place,
        alleged_manner: row.alleged_manner,
        general_condition: row.general_condition,
        vital_signs: row.vital_signs,
        injuries,
        x_ray_findings: row.x_ray_findings,
        other_investigations: row.other_investigations,
        opinion_nature: row.opinion_nature,
        opinion_weapon: row.opinion_weapon,
        opinion_duration: row.opinion_duration,
        opinion_disability: row.opinion_disability,
        opinion_danger_to_life: row.opinion_danger_to_life,
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        signatures: super::signed_documents::to_print_signatures(wound_sigs),
    }))
}

// ── Age Estimation ───────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AgeEstimationRow {
    certificate_number: String,
    certificate_date: chrono::NaiveDate,
    person_name: String,
    person_gender: String,
    stated_age: Option<String>,
    purpose_of_examination: String,
    requisition_from: Option<String>,
    requisition_number: Option<String>,
    requisition_date: Option<chrono::NaiveDate>,
    general_physical_development: String,
    height_cm: Option<f64>,
    weight_kg: Option<f64>,
    breast_development: Option<String>,
    pubic_hair: Option<String>,
    axillary_hair: Option<String>,
    facial_hair: Option<String>,
    voice_change: Option<String>,
    other_findings: Option<String>,
    dental_formula: String,
    third_molars_status: String,
    teeth_wear: Option<String>,
    xray_wrist_findings: Option<String>,
    xray_elbow_findings: Option<String>,
    xray_shoulder_findings: Option<String>,
    estimated_age_years: String,
    age_range_min: Option<i32>,
    age_range_max: Option<i32>,
    opinion_basis: String,
    examining_doctor: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
}

pub async fn get_age_estimation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
) -> Result<Json<AgeEstimationPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AgeEstimationRow>(
        "SELECT \
           ae.certificate_number, \
           ae.certificate_date, \
           ae.person_name, \
           ae.person_gender, \
           ae.stated_age, \
           ae.purpose_of_examination, \
           ae.requisition_from, \
           ae.requisition_number, \
           ae.requisition_date, \
           ae.general_physical_development, \
           ae.height_cm, \
           ae.weight_kg, \
           ae.breast_development, \
           ae.pubic_hair, \
           ae.axillary_hair, \
           ae.facial_hair, \
           ae.voice_change, \
           ae.other_findings, \
           ae.dental_formula, \
           ae.third_molars_status, \
           ae.teeth_wear, \
           ae.xray_wrist_findings, \
           ae.xray_elbow_findings, \
           ae.xray_shoulder_findings, \
           ae.estimated_age_years, \
           ae.age_range_min, \
           ae.age_range_max, \
           ae.opinion_basis, \
           doc.full_name AS examining_doctor, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number \
         FROM age_estimations ae \
         LEFT JOIN users doc ON doc.id = ae.examining_doctor_id \
         WHERE ae.id = $1 AND ae.tenant_id = $2",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let identification_marks: Vec<String> = sqlx::query_scalar(
        "SELECT mark_description FROM age_estimation_marks \
         WHERE age_estimation_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let epiphyseal_fusion_status = sqlx::query_as::<_, EpiphysealFusion>(
        "SELECT joint, bone, fusion_status, typical_age_range \
         FROM age_estimation_epiphyseal \
         WHERE age_estimation_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let age_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(AgeEstimationPrintData {
        certificate_number: row.certificate_number,
        certificate_date: row.certificate_date.format("%d-%b-%Y").to_string(),
        person_name: row.person_name,
        person_gender: row.person_gender,
        stated_age: row.stated_age,
        purpose_of_examination: row.purpose_of_examination,
        requisition_from: row.requisition_from,
        requisition_number: row.requisition_number,
        requisition_date: row
            .requisition_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        identification_marks,
        general_physical_development: row.general_physical_development,
        height_cm: row.height_cm,
        weight_kg: row.weight_kg,
        secondary_sexual_characters: SecondaryCharacters {
            breast_development: row.breast_development,
            pubic_hair: row.pubic_hair,
            axillary_hair: row.axillary_hair,
            facial_hair: row.facial_hair,
            voice_change: row.voice_change,
            other_findings: row.other_findings,
        },
        dental_formula: row.dental_formula,
        third_molars_status: row.third_molars_status,
        teeth_wear: row.teeth_wear,
        xray_wrist_findings: row.xray_wrist_findings,
        xray_elbow_findings: row.xray_elbow_findings,
        xray_shoulder_findings: row.xray_shoulder_findings,
        epiphyseal_fusion_status,
        estimated_age_years: row.estimated_age_years,
        age_range_min: row.age_range_min,
        age_range_max: row.age_range_max,
        opinion_basis: row.opinion_basis,
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        signatures: super::signed_documents::to_print_signatures(age_sigs),
    }))
}

// ── Death Declaration ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DeathDeclRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    admission_number: Option<String>,
    admission_date: Option<chrono::NaiveDate>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    date_of_death: chrono::NaiveDate,
    time_of_death: chrono::NaiveTime,
    place_of_death: String,
    brought_dead: bool,
    cause_of_death_immediate: String,
    cause_of_death_antecedent: Option<String>,
    cause_of_death_underlying: Option<String>,
    other_significant_conditions: Option<String>,
    manner_of_death: String,
    is_mlc: bool,
    mlc_number: Option<String>,
    autopsy_required: bool,
    autopsy_performed: bool,
    relatives_informed: bool,
    relative_name: Option<String>,
    relative_relationship: Option<String>,
    declared_by: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
    death_certificate_number: Option<String>,
}

pub async fn get_death_declaration_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<DeathDeclarationPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, DeathDeclRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           a.id::text AS admission_number, \
           a.admitted_at::date AS admission_date, \
           w.name AS ward_name, \
           l.name AS bed_number, \
           dd.date_of_death, \
           dd.time_of_death, \
           dd.place_of_death, \
           dd.brought_dead, \
           dd.cause_of_death_immediate, \
           dd.cause_of_death_antecedent, \
           dd.cause_of_death_underlying, \
           dd.other_significant_conditions, \
           dd.manner_of_death, \
           dd.is_mlc, \
           mlc.mlc_number, \
           dd.autopsy_required, \
           dd.autopsy_performed, \
           dd.relatives_informed, \
           dd.relative_name, \
           dd.relative_relationship, \
           doc.full_name AS declared_by, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number, \
           dd.death_certificate_number \
         FROM death_declarations dd \
         JOIN patients p ON p.id = dd.patient_id AND p.tenant_id = dd.tenant_id \
         LEFT JOIN admissions a ON a.id = dd.admission_id AND a.tenant_id = dd.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN mlc_cases mlc ON mlc.id = dd.mlc_case_id AND mlc.tenant_id = dd.tenant_id \
         LEFT JOIN users doc ON doc.id = dd.declared_by_id \
         WHERE dd.patient_id = $1 AND dd.tenant_id = $2 \
         ORDER BY dd.created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let dd_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "death_certificate",
        patient_id,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(DeathDeclarationPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        admission_number: row.admission_number,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        date_of_death: row.date_of_death.format("%d-%b-%Y").to_string(),
        time_of_death: row.time_of_death.format("%H:%M").to_string(),
        place_of_death: row.place_of_death,
        brought_dead: row.brought_dead,
        cause_of_death_immediate: row.cause_of_death_immediate,
        cause_of_death_antecedent: row.cause_of_death_antecedent,
        cause_of_death_underlying: row.cause_of_death_underlying,
        other_significant_conditions: row.other_significant_conditions,
        manner_of_death: row.manner_of_death,
        is_mlc: row.is_mlc,
        mlc_number: row.mlc_number,
        autopsy_required: row.autopsy_required,
        autopsy_performed: row.autopsy_performed,
        relatives_informed: row.relatives_informed,
        relative_name: row.relative_name,
        relative_relationship: row.relative_relationship,
        declared_by: row.declared_by.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        death_certificate_number: row.death_certificate_number,
        signatures: super::signed_documents::to_print_signatures(dd_sigs),
    }))
}

// ── MLC Documentation (Full Case Summary) ────────────────

#[derive(Debug, sqlx::FromRow)]
struct MlcDocRow {
    mlc_number: String,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    admission_date: Option<chrono::NaiveDate>,
    discharge_date: Option<chrono::NaiveDate>,
    final_diagnosis: String,
    treatment_summary: String,
    investigation_summary: String,
    clinical_findings_at_discharge: String,
    complications: Option<String>,
    prognosis: String,
    permanent_disability: Option<String>,
    disability_percentage: Option<String>,
    police_station: Option<String>,
    fir_number: Option<String>,
    court_case_number: Option<String>,
    prepared_by: Option<String>,
    verified_by: Option<String>,
    prepared_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_mlc_documentation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
) -> Result<Json<MlcDocumentationPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, MlcDocRow>(
        "SELECT \
           mlc.mlc_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           a.admitted_at::date AS admission_date, \
           a.discharged_at::date AS discharge_date, \
           COALESCE(mlc.medical_opinion, 'N/A') AS final_diagnosis, \
           'N/A'::text AS treatment_summary, \
           'N/A'::text AS investigation_summary, \
           COALESCE(mlc.examination_findings, 'N/A') AS clinical_findings_at_discharge, \
           NULL::text AS complications, \
           'N/A'::text AS prognosis, \
           NULL::text AS permanent_disability, \
           NULL::text AS disability_percentage, \
           mlc.police_station, \
           mlc.fir_number, \
           NULL::text AS court_case_number, \
           preparer.full_name AS prepared_by, \
           NULL::text AS verified_by, \
           mlc.updated_at AS prepared_at \
         FROM mlc_cases mlc \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
         LEFT JOIN admissions a ON a.id = mlc.admission_id AND a.tenant_id = mlc.tenant_id \
         LEFT JOIN users preparer ON preparer.id = mlc.registered_by \
         WHERE mlc.id = $1 AND mlc.tenant_id = $2",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let operative_procedures: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_name FROM mlc_procedures \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY performed_at",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let police_visits = sqlx::query_as::<_, PoliceVisitEntry>(
        "SELECT visit_date::text, officer_name, officer_rank, purpose, statement_recorded \
         FROM mlc_police_visits \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY visit_date",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let samples_preserved = sqlx::query_as::<_, SamplePreservedEntry>(
        "SELECT sample_type, quantity, preservation_method, \
           collected_date::text, handed_to, handed_date::text \
         FROM mlc_samples \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY collected_date",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let certificates_issued: Vec<String> = sqlx::query_scalar(
        "SELECT certificate_type FROM mlc_certificates \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY issued_date",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let important_dates = sqlx::query_as::<_, MlcDateEntry>(
        "SELECT event_date::text, event_description \
         FROM mlc_important_dates \
         WHERE mlc_case_id = $1 AND tenant_id = $2 \
         ORDER BY event_date",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mlc_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(MlcDocumentationPrintData {
        mlc_number: row.mlc_number,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        final_diagnosis: row.final_diagnosis,
        treatment_summary: row.treatment_summary,
        operative_procedures,
        investigation_summary: row.investigation_summary,
        clinical_findings_at_discharge: row.clinical_findings_at_discharge,
        complications: row.complications,
        prognosis: row.prognosis,
        permanent_disability: row.permanent_disability,
        disability_percentage: row.disability_percentage,
        police_station: row.police_station,
        fir_number: row.fir_number,
        court_case_number: row.court_case_number,
        police_visits,
        samples_preserved,
        certificates_issued,
        important_dates,
        prepared_by: row.prepared_by.unwrap_or_default(),
        verified_by: row.verified_by.unwrap_or_default(),
        prepared_at: row.prepared_at.format("%d-%b-%Y %H:%M").to_string(),
        signatures: super::signed_documents::to_print_signatures(mlc_sigs),
    }))
}
