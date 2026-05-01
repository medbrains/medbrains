//! Print-data endpoints — consent forms.
//!
//! Each handler assembles the context data for a consent form template.
//! Consent forms include patient details, procedure info, risks, alternatives,
//! and signature blocks for patient, guardian, witness, and doctor.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AbdmConsentPrintData, ConsentPrintData, DnrConsentPrintData, OrganDonationConsentPrintData,
    ResearchConsentPrintData, TeachingConsentPrintData,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Helper row types ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ConsentBaseRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    address: Option<String>,
    phone: String,
    blood_group: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct AdmissionConsentRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    address: Option<String>,
    phone: String,
    blood_group: Option<String>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
    department: Option<String>,
    admission_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct SurgicalConsentRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    address: Option<String>,
    phone: String,
    blood_group: Option<String>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    procedure_name: String,
    procedure_date: Option<chrono::NaiveDate>,
    surgeon_name: Option<String>,
    anesthetist_name: Option<String>,
    department: Option<String>,
    admission_id: Option<Uuid>,
}

// ── General Admission Consent ────────────────────────────

pub async fn get_general_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AdmissionConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "general_admission".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: Some(row.admission_id.to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        treating_doctor: row.doctor_name,
        department: row.department,
        procedure_name: None,
        procedure_date: None,
        surgeon_name: None,
        anesthetist_name: None,
        risks_explained: vec![
            "General risks of hospitalization".to_string(),
            "Possible infection during hospital stay".to_string(),
            "Allergic reactions to medications".to_string(),
        ],
        alternatives_discussed: vec![
            "Outpatient treatment".to_string(),
            "Home-based care".to_string(),
        ],
        special_instructions: None,
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── Surgical Procedure Consent ───────────────────────────

pub async fn get_surgical_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SurgicalConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           loc.name AS bed_number, \
           w.name AS ward_name, \
           ob.procedure_name, \
           ob.scheduled_date AS procedure_date, \
           surgeon.full_name AS surgeon_name, \
           anesth.full_name AS anesthetist_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM ot_bookings ob \
         JOIN patients p ON p.id = ob.patient_id AND p.tenant_id = ob.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = ob.surgeon_id \
         LEFT JOIN users anesth ON anesth.id = ob.anesthesiologist_id \
         LEFT JOIN admissions a ON a.id = ob.admission_id AND a.tenant_id = ob.tenant_id \
         LEFT JOIN locations loc ON loc.id = a.bed_id AND loc.tenant_id = ob.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = ob.tenant_id \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = ob.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = ob.tenant_id \
         WHERE ob.id = $1 AND ob.tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "surgical".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: row.admission_id.map(|id| id.to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        treating_doctor: row.surgeon_name.clone(),
        department: row.department,
        procedure_name: Some(row.procedure_name),
        procedure_date: row.procedure_date.map(|d| d.format("%d-%b-%Y").to_string()),
        surgeon_name: row.surgeon_name,
        anesthetist_name: row.anesthetist_name,
        risks_explained: vec![
            "Bleeding during or after surgery".to_string(),
            "Infection at surgical site".to_string(),
            "Anesthesia complications".to_string(),
            "Blood clots (DVT/PE)".to_string(),
            "Damage to surrounding organs".to_string(),
            "Need for additional procedures".to_string(),
        ],
        alternatives_discussed: vec![
            "Conservative medical management".to_string(),
            "Alternative surgical approaches".to_string(),
            "Watchful waiting".to_string(),
        ],
        special_instructions: None,
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── Anesthesia Consent ───────────────────────────────────

pub async fn get_anesthesia_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SurgicalConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           loc.name AS bed_number, \
           w.name AS ward_name, \
           ob.procedure_name, \
           ob.scheduled_date AS procedure_date, \
           surgeon.full_name AS surgeon_name, \
           anesth.full_name AS anesthetist_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM ot_bookings ob \
         JOIN patients p ON p.id = ob.patient_id AND p.tenant_id = ob.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = ob.surgeon_id \
         LEFT JOIN users anesth ON anesth.id = ob.anesthesiologist_id \
         LEFT JOIN admissions a ON a.id = ob.admission_id AND a.tenant_id = ob.tenant_id \
         LEFT JOIN locations loc ON loc.id = a.bed_id AND loc.tenant_id = ob.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = ob.tenant_id \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = ob.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = ob.tenant_id \
         WHERE ob.id = $1 AND ob.tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "anesthesia".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: row.admission_id.map(|id| id.to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        treating_doctor: row.anesthetist_name.clone(),
        department: row.department,
        procedure_name: Some(row.procedure_name),
        procedure_date: row.procedure_date.map(|d| d.format("%d-%b-%Y").to_string()),
        surgeon_name: row.surgeon_name,
        anesthetist_name: row.anesthetist_name,
        risks_explained: vec![
            "Allergic reactions to anesthetic agents".to_string(),
            "Nausea and vomiting".to_string(),
            "Sore throat from intubation".to_string(),
            "Dental damage".to_string(),
            "Nerve damage".to_string(),
            "Awareness during surgery (rare)".to_string(),
            "Respiratory complications".to_string(),
            "Cardiac complications (rare)".to_string(),
        ],
        alternatives_discussed: vec![
            "General anesthesia".to_string(),
            "Regional anesthesia (spinal/epidural)".to_string(),
            "Local anesthesia with sedation".to_string(),
        ],
        special_instructions: Some("NPO (nil per oral) for 6-8 hours before surgery".to_string()),
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── Blood Transfusion Consent ────────────────────────────

pub async fn get_blood_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AdmissionConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "blood_transfusion".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: Some(row.admission_id.to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        treating_doctor: row.doctor_name,
        department: row.department,
        procedure_name: None,
        procedure_date: None,
        surgeon_name: None,
        anesthetist_name: None,
        risks_explained: vec![
            "Transfusion reactions (fever, chills, hives)".to_string(),
            "Allergic reactions".to_string(),
            "Hemolytic reactions (rare)".to_string(),
            "Infection transmission (HIV, Hepatitis - very rare)".to_string(),
            "Volume overload".to_string(),
            "Iron overload (with multiple transfusions)".to_string(),
            "Transfusion-related acute lung injury (TRALI)".to_string(),
        ],
        alternatives_discussed: vec![
            "Iron supplementation".to_string(),
            "Erythropoietin therapy".to_string(),
            "Autologous blood transfusion".to_string(),
            "Blood substitutes".to_string(),
        ],
        special_instructions: None,
        blood_group: row.blood_group,
        components_required: vec![
            "Packed Red Blood Cells (PRBC)".to_string(),
            "Fresh Frozen Plasma (FFP)".to_string(),
            "Platelets".to_string(),
        ],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── HIV Testing Consent ──────────────────────────────────

pub async fn get_hiv_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ConsentBaseRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           date_of_birth, \
           COALESCE((address->>'line1') || ', ' || (address->>'city'), NULL) AS address, \
           phone, \
           blood_group::text AS blood_group \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "hiv_testing".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: None,
        bed_number: None,
        ward_name: None,
        treating_doctor: None,
        department: None,
        procedure_name: None,
        procedure_date: None,
        surgeon_name: None,
        anesthetist_name: None,
        risks_explained: vec![
            "Test may be positive, negative, or indeterminate".to_string(),
            "Window period may affect results".to_string(),
            "Confirmatory testing may be required".to_string(),
            "Psychological impact of results".to_string(),
        ],
        alternatives_discussed: vec![
            "Anonymous testing at government centers".to_string(),
            "Home testing kits".to_string(),
        ],
        special_instructions: Some(
            "Pre-test counseling completed. Post-test counseling will be provided.".to_string(),
        ),
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── AMA (Against Medical Advice) Consent ─────────────────

pub async fn get_ama_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AdmissionConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get diagnosis for context
    let diagnosis: Option<String> = sqlx::query_scalar(
        "SELECT provisional_diagnosis FROM admissions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "ama".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: Some(row.admission_id.to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        treating_doctor: row.doctor_name,
        department: row.department,
        procedure_name: diagnosis,
        procedure_date: None,
        surgeon_name: None,
        anesthetist_name: None,
        risks_explained: vec![
            "Condition may worsen without treatment".to_string(),
            "Risk of complications or death".to_string(),
            "Hospital not responsible for outcomes after discharge".to_string(),
            "Emergency readmission may be required".to_string(),
        ],
        alternatives_discussed: vec![
            "Continue hospital treatment".to_string(),
            "Transfer to another facility".to_string(),
            "Home-based care with medical follow-up".to_string(),
        ],
        special_instructions: None,
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: Some("Patient/family requesting discharge against medical advice".to_string()),
        advice_given_at_discharge: Some("Continue prescribed medications. Return immediately if symptoms worsen. Follow up with treating doctor.".to_string()),
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── Photography/Recording Consent ────────────────────────

pub async fn get_photo_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<ConsentPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ConsentBaseRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           date_of_birth, \
           COALESCE((address->>'line1') || ', ' || (address->>'city'), NULL) AS address, \
           phone, \
           blood_group::text AS blood_group \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        address: row.address,
        phone: row.phone,
        consent_type: "photography".to_string(),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        admission_id: None,
        bed_number: None,
        ward_name: None,
        treating_doctor: None,
        department: None,
        procedure_name: None,
        procedure_date: None,
        surgeon_name: None,
        anesthetist_name: None,
        risks_explained: vec![
            "Images may be used for medical documentation".to_string(),
            "Images may be used for teaching/training purposes".to_string(),
            "Images may be published in medical literature".to_string(),
            "Patient identity will be protected where possible".to_string(),
        ],
        alternatives_discussed: vec![
            "Decline photography consent".to_string(),
            "Consent with face/identifiers obscured".to_string(),
            "Consent for internal use only".to_string(),
        ],
        special_instructions: Some(
            "Consent is voluntary and can be withdrawn at any time.".to_string(),
        ),
        blood_group: row.blood_group,
        components_required: vec![],
        reason_for_ama: None,
        advice_given_at_discharge: None,
        language: "en".to_string(),
        translated_content: None,
    }))
}

// ── DNR (Do Not Resuscitate) Consent ─────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DnrConsentRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: chrono::DateTime<chrono::Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    diagnosis: Option<String>,
    treating_doctor: Option<String>,
}

pub async fn get_dnr_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<DnrConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, DnrConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           a.admitted_at AS admission_date, \
           b.bed_number, \
           w.name AS ward_name, \
           a.primary_diagnosis AS diagnosis, \
           doc.full_name AS treating_doctor \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users doc ON doc.id = a.attending_doctor_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(DnrConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        diagnosis: row.diagnosis,
        prognosis: Some("Terminal illness with poor prognosis".to_string()),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_time: now.format("%H:%M").to_string(),
        dnr_type: "full_dnr".to_string(),
        interventions_declined: vec![
            "Cardiopulmonary Resuscitation (CPR)".to_string(),
            "Mechanical Ventilation".to_string(),
            "Defibrillation".to_string(),
            "Vasopressors/Inotropes".to_string(),
        ],
        interventions_allowed: vec![
            "Pain management".to_string(),
            "Comfort care".to_string(),
            "IV fluids".to_string(),
            "Oxygen therapy".to_string(),
        ],
        patient_wishes: None,
        family_discussion_notes: None,
        treating_doctor: row.treating_doctor,
        witness_name: None,
        language: "en".to_string(),
    }))
}

// ── Organ Donation Consent ──────────────────────────────

pub async fn get_organ_donation_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<OrganDonationConsentPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ConsentBaseRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           date_of_birth, \
           COALESCE((address->>'line1') || ', ' || (address->>'city'), NULL) AS address, \
           phone, \
           blood_group::text AS blood_group \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get hospital name
    let h_name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(OrganDonationConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        address: row.address,
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_type: "pledge".to_string(),
        organs_consented: vec![
            "Heart".to_string(),
            "Lungs".to_string(),
            "Liver".to_string(),
            "Kidneys".to_string(),
            "Pancreas".to_string(),
            "Intestines".to_string(),
        ],
        tissues_consented: vec![
            "Corneas".to_string(),
            "Skin".to_string(),
            "Heart Valves".to_string(),
            "Bone".to_string(),
            "Tendons".to_string(),
        ],
        next_of_kin_name: None,
        next_of_kin_relation: None,
        next_of_kin_phone: None,
        thoa_registration_number: None,
        transplant_coordinator: None,
        hospital_name: h_name,
        language: "en".to_string(),
    }))
}

// ── Research Participation Consent ──────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ResearchEnrollmentRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    study_title: String,
    study_protocol_number: String,
    principal_investigator: Option<String>,
    iec_approval_number: String,
    iec_approval_date: chrono::NaiveDate,
    sponsor_name: Option<String>,
    study_purpose: String,
    compensation: Option<String>,
    enrolled_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_research_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(enrollment_id): Path<Uuid>,
) -> Result<Json<ResearchConsentPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ResearchEnrollmentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           rs.title AS study_title, \
           rs.protocol_number AS study_protocol_number, \
           pi.full_name AS principal_investigator, \
           rs.iec_approval_number, \
           rs.iec_approval_date, \
           rs.sponsor_name, \
           rs.study_purpose, \
           re.compensation, \
           re.enrolled_at \
         FROM research_enrollments re \
         JOIN patients p ON p.id = re.patient_id AND p.tenant_id = re.tenant_id \
         JOIN research_studies rs ON rs.id = re.study_id AND rs.tenant_id = re.tenant_id \
         LEFT JOIN users pi ON pi.id = rs.principal_investigator_id \
         WHERE re.id = $1 AND re.tenant_id = $2",
    )
    .bind(enrollment_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get procedures involved
    let procedures: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_description FROM research_study_procedures \
         WHERE study_id = (SELECT study_id FROM research_enrollments WHERE id = $1) \
           AND tenant_id = $2 \
         ORDER BY sort_order",
    )
    .bind(enrollment_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(ResearchConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        consent_date: row.enrolled_at.format("%d-%b-%Y").to_string(),
        study_title: row.study_title,
        study_protocol_number: row.study_protocol_number,
        principal_investigator: row.principal_investigator.unwrap_or_default(),
        iec_approval_number: row.iec_approval_number,
        iec_approval_date: row.iec_approval_date.format("%d-%b-%Y").to_string(),
        sponsor_name: row.sponsor_name,
        study_purpose: row.study_purpose,
        procedures_involved: procedures,
        risks_benefits: "Detailed risks and benefits have been explained as per study protocol.".to_string(),
        compensation: row.compensation,
        confidentiality_statement: "All personal information will be kept strictly confidential. Data will be coded and de-identified.".to_string(),
        withdrawal_rights: "Participation is voluntary. You may withdraw at any time without affecting your medical care.".to_string(),
        contact_details: "For queries, contact the Principal Investigator or IEC.".to_string(),
        language: "en".to_string(),
    }))
}

// ── ABDM Data Sharing Consent ───────────────────────────

pub async fn get_abdm_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<AbdmConsentPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Get patient with ABHA details
    let row: (String, String, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT \
           (first_name || ' ' || last_name), \
           uhid, \
           abha_number, \
           abha_address \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get hospital name (HIP)
    let h_name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(AbdmConsentPrintData {
        patient_name: row.0,
        uhid: row.1,
        abha_number: row.2,
        abha_address: row.3,
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_type: "data_sharing".to_string(),
        purposes_consented: vec![
            "Care Management".to_string(),
            "Disease Research".to_string(),
            "Public Health".to_string(),
        ],
        health_info_types: vec![
            "Prescription".to_string(),
            "Diagnostic Report".to_string(),
            "OP Consultation".to_string(),
            "Discharge Summary".to_string(),
            "Immunization Record".to_string(),
        ],
        hip_name: h_name.unwrap_or_else(|| "Hospital".to_string()),
        hiu_name: None,
        validity_period: Some("1 year".to_string()),
        language: "en".to_string(),
    }))
}

// ── Teaching/Student Observation Consent ────────────────

pub async fn get_teaching_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<TeachingConsentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, AdmissionConsentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           COALESCE((p.address->>'line1') || ', ' || (p.address->>'city'), NULL) AS address, \
           p.phone, \
           p.blood_group::text AS blood_group, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           a.id AS admission_id \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(TeachingConsentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_id: Some(row.admission_id.to_string()),
        consent_date: now.format("%d-%b-%Y").to_string(),
        consent_type: "observation".to_string(),
        teaching_activity: "Clinical case discussion and examination".to_string(),
        student_level: "pg".to_string(),
        department: row.department,
        faculty_supervisor: row.doctor_name,
        patient_rights_explained: true,
        can_withdraw_anytime: true,
        language: "en".to_string(),
    }))
}
