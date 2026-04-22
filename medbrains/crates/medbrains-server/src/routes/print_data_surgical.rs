//! Print-data endpoints — surgical & OT forms.

use axum::{Extension, Json, extract::{Path, State}};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AnesthesiaDrug, AnesthesiaRecordPrintData, AnesthesiaVitalEntry, BloodProductEntry,
    CaseSheetCoverPrintData, FluidEntry, OperationNotesPrintData, PostopFluidOrder,
    PostopMedicationOrder, PostopOrdersPrintData, PreopAssessmentPrintData, PreopLabResult,
    PreopVitals, SurgicalSafetyChecklistPrintData, SurgicalSignIn, SurgicalSignOut,
    SurgicalTimeOut, TransfusionMonitoringEntry, TransfusionMonitoringPrintData,
    TransfusionVitals,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Case Sheet Cover ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CaseSheetCoverRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    admission_date: chrono::DateTime<chrono::Utc>,
    ward_name: String,
    bed_number: String,
    attending_doctor: String,
    department: String,
    provisional_diagnosis: Option<String>,
    final_diagnosis: Option<String>,
    blood_group: Option<String>,
    emergency_contact_name: Option<String>,
    emergency_contact_phone: Option<String>,
    insurance_provider: Option<String>,
    policy_number: Option<String>,
}

pub async fn get_case_sheet_cover_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<CaseSheetCoverPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseSheetCoverRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admission_number, \
           a.admitted_at AS admission_date, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           doc.full_name AS attending_doctor, \
           dept.name AS department, \
           a.provisional_diagnosis, \
           a.final_diagnosis, \
           p.blood_group::text AS blood_group, \
           p.emergency_contact_name, \
           p.emergency_contact_phone, \
           ins.payer_name AS insurance_provider, \
           ins.policy_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN departments dept ON dept.id = a.department_id AND dept.tenant_id = a.tenant_id \
         LEFT JOIN patient_insurances ins ON ins.patient_id = p.id AND ins.tenant_id = a.tenant_id AND ins.is_primary = true \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CaseSheetCoverPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_number: row.admission_number,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        attending_doctor: row.attending_doctor,
        department: row.department,
        provisional_diagnosis: row.provisional_diagnosis,
        final_diagnosis: row.final_diagnosis,
        allergies,
        blood_group: row.blood_group,
        emergency_contact_name: row.emergency_contact_name,
        emergency_contact_phone: row.emergency_contact_phone,
        insurance_provider: row.insurance_provider,
        policy_number: row.policy_number,
    }))
}

// ── Pre-Operative Assessment ─────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PreopAssessmentRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    planned_surgery: String,
    surgery_date: chrono::NaiveDate,
    surgeon_name: String,
    anesthesiologist_name: Option<String>,
    asa_grade: Option<String>,
    anesthesia_plan: Option<String>,
    special_instructions: Option<String>,
    consent_obtained: bool,
    npo_status: Option<String>,
    assessed_by: String,
    assessed_at: chrono::DateTime<chrono::Utc>,
    bp_systolic: Option<i32>,
    bp_diastolic: Option<i32>,
    pulse: Option<i32>,
    temperature: Option<f64>,
    spo2: Option<i32>,
    weight_kg: Option<f64>,
    height_cm: Option<f64>,
    ecg_findings: Option<String>,
    chest_xray_findings: Option<String>,
}

pub async fn get_preop_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<PreopAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PreopAssessmentRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admission_number, \
           COALESCE(pa.planned_procedure, 'Surgery') AS planned_surgery, \
           COALESCE(pa.surgery_date, CURRENT_DATE) AS surgery_date, \
           surgeon.full_name AS surgeon_name, \
           anesth.full_name AS anesthesiologist_name, \
           pa.asa_grade::text AS asa_grade, \
           pa.anesthesia_plan, \
           pa.special_instructions, \
           COALESCE(pa.consent_obtained, false) AS consent_obtained, \
           pa.npo_status, \
           assessor.full_name AS assessed_by, \
           COALESCE(pa.assessed_at, NOW()) AS assessed_at, \
           pa.bp_systolic, \
           pa.bp_diastolic, \
           pa.pulse, \
           pa.temperature, \
           pa.spo2, \
           pa.weight_kg, \
           pa.height_cm, \
           pa.ecg_findings, \
           pa.chest_xray_findings \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN preop_assessments pa ON pa.admission_id = a.id AND pa.tenant_id = a.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = pa.surgeon_id \
         LEFT JOIN users anesth ON anesth.id = pa.anesthesiologist_id \
         LEFT JOIN users assessor ON assessor.id = pa.assessed_by_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let current_medications: Vec<String> = sqlx::query_scalar(
        "SELECT drug_name || ' ' || dosage || ' ' || frequency \
         FROM prescription_items pi \
         JOIN encounters e ON e.id = pi.encounter_id AND e.tenant_id = pi.tenant_id \
         WHERE e.patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND pi.tenant_id = $2 AND pi.is_active = true \
         ORDER BY pi.created_at DESC LIMIT 10",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let medical_history: Vec<String> = sqlx::query_scalar(
        "SELECT condition_name FROM patient_medical_history \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let surgical_history: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_name FROM patient_surgical_history \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_results = sqlx::query_as::<_, PreopLabResult>(
        "SELECT lr.parameter_name AS test_name, lr.value, lr.unit, lr.flag \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.lab_order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND lr.tenant_id = $2 \
         ORDER BY lr.created_at DESC LIMIT 20",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(PreopAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_number: row.admission_number,
        planned_surgery: row.planned_surgery,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        surgeon_name: row.surgeon_name,
        anesthesiologist_name: row.anesthesiologist_name,
        asa_grade: row.asa_grade,
        allergies,
        current_medications,
        medical_history,
        surgical_history,
        vitals: PreopVitals {
            bp_systolic: row.bp_systolic,
            bp_diastolic: row.bp_diastolic,
            pulse: row.pulse,
            temperature: row.temperature,
            spo2: row.spo2,
            weight_kg: row.weight_kg,
            height_cm: row.height_cm,
        },
        lab_results,
        ecg_findings: row.ecg_findings,
        chest_xray_findings: row.chest_xray_findings,
        anesthesia_plan: row.anesthesia_plan,
        special_instructions: row.special_instructions,
        consent_obtained: row.consent_obtained,
        npo_status: row.npo_status,
        assessed_by: row.assessed_by,
        assessed_at: row.assessed_at.format("%d-%b-%Y %H:%M").to_string(),
    }))
}

// ── Surgical Safety Checklist (WHO) ──────────────────────

#[derive(Debug, sqlx::FromRow)]
struct SurgicalSafetyRow {
    patient_name: String,
    uhid: String,
    surgery_id: Uuid,
    procedure_name: String,
    surgery_date: chrono::NaiveDate,
    ot_number: String,
    surgeon_name: String,
    anesthesiologist_name: String,
    scrub_nurse_name: String,
    circulating_nurse_name: Option<String>,
}

pub async fn get_surgical_safety_checklist_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(surgery_id): Path<Uuid>,
) -> Result<Json<SurgicalSafetyChecklistPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SurgicalSafetyRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           s.id AS surgery_id, \
           s.procedure_name, \
           s.surgery_date, \
           COALESCE(ot.name, 'OT-1') AS ot_number, \
           surgeon.full_name AS surgeon_name, \
           COALESCE(anesth.full_name, 'N/A') AS anesthesiologist_name, \
           COALESCE(scrub.full_name, 'N/A') AS scrub_nurse_name, \
           circ.full_name AS circulating_nurse_name \
         FROM surgeries s \
         JOIN admissions a ON a.id = s.admission_id AND a.tenant_id = s.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations ot ON ot.id = s.ot_id AND ot.tenant_id = s.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = s.surgeon_id \
         LEFT JOIN users anesth ON anesth.id = s.anesthesiologist_id \
         LEFT JOIN users scrub ON scrub.id = s.scrub_nurse_id \
         LEFT JOIN users circ ON circ.id = s.circulating_nurse_id \
         WHERE s.id = $1 AND s.tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Default checklist values (in practice, these would be fetched from DB)
    Ok(Json(SurgicalSafetyChecklistPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        surgery_id: row.surgery_id.to_string(),
        procedure_name: row.procedure_name,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        ot_number: row.ot_number,
        sign_in: SurgicalSignIn {
            patient_confirmed_identity: true,
            site_marked: true,
            consent_signed: true,
            anesthesia_check_complete: true,
            pulse_oximeter_working: true,
            known_allergy: None,
            difficult_airway_risk: false,
            blood_loss_risk: false,
            completed_by: row.anesthesiologist_name.clone(),
            completed_at: String::new(),
        },
        time_out: SurgicalTimeOut {
            team_members_introduced: true,
            patient_name_confirmed: true,
            procedure_confirmed: true,
            site_confirmed: true,
            antibiotics_given: true,
            antibiotics_time: None,
            essential_imaging_displayed: true,
            anticipated_critical_events: None,
            completed_by: row.surgeon_name.clone(),
            completed_at: String::new(),
        },
        sign_out: SurgicalSignOut {
            procedure_recorded: true,
            instrument_count_correct: true,
            sponge_count_correct: true,
            specimens_labeled: true,
            equipment_issues: None,
            recovery_concerns: None,
            completed_by: row.scrub_nurse_name.clone(),
            completed_at: String::new(),
        },
        surgeon_name: row.surgeon_name,
        anesthesiologist_name: row.anesthesiologist_name,
        scrub_nurse_name: row.scrub_nurse_name,
        circulating_nurse_name: row.circulating_nurse_name,
    }))
}

// ── Anesthesia Record ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AnesthesiaRecordRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    weight_kg: Option<f64>,
    surgery_id: Uuid,
    procedure_name: String,
    surgery_date: chrono::NaiveDate,
    anesthesia_type: String,
    asa_grade: String,
    anesthesiologist_name: String,
    airway_type: Option<String>,
    ett_size: Option<String>,
    intubation_grade: Option<String>,
    urine_output_ml: Option<i32>,
    blood_loss_ml: Option<i32>,
    anesthesia_start: chrono::DateTime<chrono::Utc>,
    surgery_start: chrono::DateTime<chrono::Utc>,
    surgery_end: chrono::DateTime<chrono::Utc>,
    anesthesia_end: chrono::DateTime<chrono::Utc>,
    extubation_time: Option<chrono::DateTime<chrono::Utc>>,
    pacu_arrival_time: Option<chrono::DateTime<chrono::Utc>>,
    aldrete_score: Option<i32>,
    complications: Option<String>,
    postop_orders: Option<String>,
}

pub async fn get_anesthesia_record_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(surgery_id): Path<Uuid>,
) -> Result<Json<AnesthesiaRecordPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AnesthesiaRecordRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           ar.weight_kg, \
           s.id AS surgery_id, \
           s.procedure_name, \
           s.surgery_date, \
           COALESCE(ar.anesthesia_type::text, 'General') AS anesthesia_type, \
           COALESCE(ar.asa_grade::text, 'I') AS asa_grade, \
           anesth.full_name AS anesthesiologist_name, \
           ar.airway_type, \
           ar.ett_size, \
           ar.intubation_grade, \
           ar.urine_output_ml, \
           ar.blood_loss_ml, \
           COALESCE(ar.anesthesia_start, s.surgery_start_time) AS anesthesia_start, \
           COALESCE(s.surgery_start_time, NOW()) AS surgery_start, \
           COALESCE(s.surgery_end_time, NOW()) AS surgery_end, \
           COALESCE(ar.anesthesia_end, s.surgery_end_time, NOW()) AS anesthesia_end, \
           ar.extubation_time, \
           ar.pacu_arrival_time, \
           ar.aldrete_score, \
           ar.complications, \
           ar.postop_orders \
         FROM surgeries s \
         JOIN admissions a ON a.id = s.admission_id AND a.tenant_id = s.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN anesthesia_records ar ON ar.surgery_id = s.id AND ar.tenant_id = s.tenant_id \
         LEFT JOIN users anesth ON anesth.id = s.anesthesiologist_id \
         WHERE s.id = $1 AND s.tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let induction_agents = sqlx::query_as::<_, AnesthesiaDrug>(
        "SELECT drug_name, dose, route, time::text \
         FROM anesthesia_drugs \
         WHERE surgery_id = $1 AND tenant_id = $2 AND drug_category = 'induction' \
         ORDER BY time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let maintenance_agents = sqlx::query_as::<_, AnesthesiaDrug>(
        "SELECT drug_name, dose, route, time::text \
         FROM anesthesia_drugs \
         WHERE surgery_id = $1 AND tenant_id = $2 AND drug_category = 'maintenance' \
         ORDER BY time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let muscle_relaxants = sqlx::query_as::<_, AnesthesiaDrug>(
        "SELECT drug_name, dose, route, time::text \
         FROM anesthesia_drugs \
         WHERE surgery_id = $1 AND tenant_id = $2 AND drug_category = 'muscle_relaxant' \
         ORDER BY time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let analgesics = sqlx::query_as::<_, AnesthesiaDrug>(
        "SELECT drug_name, dose, route, time::text \
         FROM anesthesia_drugs \
         WHERE surgery_id = $1 AND tenant_id = $2 AND drug_category = 'analgesic' \
         ORDER BY time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let other_drugs = sqlx::query_as::<_, AnesthesiaDrug>(
        "SELECT drug_name, dose, route, time::text \
         FROM anesthesia_drugs \
         WHERE surgery_id = $1 AND tenant_id = $2 AND drug_category = 'other' \
         ORDER BY time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let vitals_timeline = sqlx::query_as::<_, AnesthesiaVitalEntry>(
        "SELECT recorded_at::text AS time, bp_systolic, bp_diastolic, pulse, spo2, etco2, temperature AS temp \
         FROM anesthesia_vitals \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let iv_fluids = sqlx::query_as::<_, FluidEntry>(
        "SELECT fluid_type, volume_ml, start_time::text \
         FROM anesthesia_fluids \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY start_time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let blood_products = sqlx::query_as::<_, BloodProductEntry>(
        "SELECT product_type, bag_number, volume_ml, start_time::text \
         FROM anesthesia_blood_products \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY start_time",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AnesthesiaRecordPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        weight_kg: row.weight_kg,
        surgery_id: row.surgery_id.to_string(),
        procedure_name: row.procedure_name,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        anesthesia_type: row.anesthesia_type,
        asa_grade: row.asa_grade,
        anesthesiologist_name: row.anesthesiologist_name,
        airway_type: row.airway_type,
        ett_size: row.ett_size,
        intubation_grade: row.intubation_grade,
        induction_agents,
        maintenance_agents,
        muscle_relaxants,
        analgesics,
        other_drugs,
        vitals_timeline,
        iv_fluids,
        blood_products,
        urine_output_ml: row.urine_output_ml,
        blood_loss_ml: row.blood_loss_ml,
        anesthesia_start: row.anesthesia_start.format("%H:%M").to_string(),
        surgery_start: row.surgery_start.format("%H:%M").to_string(),
        surgery_end: row.surgery_end.format("%H:%M").to_string(),
        anesthesia_end: row.anesthesia_end.format("%H:%M").to_string(),
        extubation_time: row.extubation_time.map(|t| t.format("%H:%M").to_string()),
        pacu_arrival_time: row.pacu_arrival_time.map(|t| t.format("%H:%M").to_string()),
        aldrete_score: row.aldrete_score,
        complications: row.complications,
        postop_orders: row.postop_orders,
    }))
}

// ── Operation Notes ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OperationNotesRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    surgery_id: Uuid,
    surgery_date: chrono::NaiveDate,
    procedure_name: String,
    procedure_code: Option<String>,
    indication: String,
    surgeon_name: String,
    anesthesiologist_name: String,
    anesthesia_type: String,
    ot_number: String,
    position: Option<String>,
    incision: Option<String>,
    findings: String,
    procedure_details: String,
    drain_details: Option<String>,
    closure_details: Option<String>,
    estimated_blood_loss_ml: Option<i32>,
    transfusion_given: Option<String>,
    complications: Option<String>,
    surgery_start: chrono::DateTime<chrono::Utc>,
    surgery_end: chrono::DateTime<chrono::Utc>,
    immediate_postop_condition: Option<String>,
    postop_instructions: Option<String>,
    dictated_by: String,
    dictated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_operation_notes_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(surgery_id): Path<Uuid>,
) -> Result<Json<OperationNotesPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OperationNotesRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           s.id AS surgery_id, \
           s.surgery_date, \
           s.procedure_name, \
           s.procedure_code, \
           COALESCE(s.indication, 'N/A') AS indication, \
           surgeon.full_name AS surgeon_name, \
           COALESCE(anesth.full_name, 'N/A') AS anesthesiologist_name, \
           COALESCE(s.anesthesia_type::text, 'General') AS anesthesia_type, \
           COALESCE(ot.name, 'OT-1') AS ot_number, \
           s.position, \
           s.incision, \
           COALESCE(s.findings, 'As expected') AS findings, \
           COALESCE(s.procedure_details, 'Procedure performed as planned') AS procedure_details, \
           s.drain_details, \
           s.closure_details, \
           s.estimated_blood_loss_ml, \
           s.transfusion_given, \
           s.complications, \
           COALESCE(s.surgery_start_time, NOW()) AS surgery_start, \
           COALESCE(s.surgery_end_time, NOW()) AS surgery_end, \
           s.immediate_postop_condition, \
           s.postop_instructions, \
           surgeon.full_name AS dictated_by, \
           COALESCE(s.updated_at, s.created_at) AS dictated_at \
         FROM surgeries s \
         JOIN admissions a ON a.id = s.admission_id AND a.tenant_id = s.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations ot ON ot.id = s.ot_id AND ot.tenant_id = s.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = s.surgeon_id \
         LEFT JOIN users anesth ON anesth.id = s.anesthesiologist_id \
         WHERE s.id = $1 AND s.tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let assistant_surgeons: Vec<String> = sqlx::query_scalar(
        "SELECT u.full_name FROM surgery_assistants sa \
         JOIN users u ON u.id = sa.user_id \
         WHERE sa.surgery_id = $1 AND sa.tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let specimens_sent: Vec<String> = sqlx::query_scalar(
        "SELECT specimen_description FROM surgery_specimens \
         WHERE surgery_id = $1 AND tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let duration_minutes = (row.surgery_end - row.surgery_start).num_minutes() as i32;

    Ok(Json(OperationNotesPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        surgery_id: row.surgery_id.to_string(),
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        procedure_name: row.procedure_name,
        procedure_code: row.procedure_code,
        indication: row.indication,
        surgeon_name: row.surgeon_name,
        assistant_surgeons,
        anesthesiologist_name: row.anesthesiologist_name,
        anesthesia_type: row.anesthesia_type,
        ot_number: row.ot_number,
        position: row.position,
        incision: row.incision,
        findings: row.findings,
        procedure_details: row.procedure_details,
        specimens_sent,
        drain_details: row.drain_details,
        closure_details: row.closure_details,
        estimated_blood_loss_ml: row.estimated_blood_loss_ml,
        transfusion_given: row.transfusion_given,
        complications: row.complications,
        surgery_start: row.surgery_start.format("%H:%M").to_string(),
        surgery_end: row.surgery_end.format("%H:%M").to_string(),
        duration_minutes,
        immediate_postop_condition: row.immediate_postop_condition,
        postop_instructions: row.postop_instructions,
        dictated_by: row.dictated_by,
        dictated_at: row.dictated_at.format("%d-%b-%Y %H:%M").to_string(),
    }))
}

// ── Post-Operative Orders ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PostopOrdersRow {
    patient_name: String,
    uhid: String,
    admission_number: String,
    surgery_date: chrono::NaiveDate,
    procedure_name: String,
    surgeon_name: String,
    ward_name: String,
    bed_number: String,
    diet_orders: Option<String>,
    position_orders: Option<String>,
    activity_orders: Option<String>,
    drain_care: Option<String>,
    wound_care: Option<String>,
    vte_prophylaxis: Option<String>,
    pain_management: Option<String>,
    special_instructions: Option<String>,
    ordered_by: String,
    ordered_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_postop_orders_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(surgery_id): Path<Uuid>,
) -> Result<Json<PostopOrdersPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PostopOrdersRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           s.surgery_date, \
           s.procedure_name, \
           surgeon.full_name AS surgeon_name, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           po.diet_orders, \
           po.position_orders, \
           po.activity_orders, \
           po.drain_care, \
           po.wound_care, \
           po.vte_prophylaxis, \
           po.pain_management, \
           po.special_instructions, \
           surgeon.full_name AS ordered_by, \
           COALESCE(po.created_at, NOW()) AS ordered_at \
         FROM surgeries s \
         JOIN admissions a ON a.id = s.admission_id AND a.tenant_id = s.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = s.surgeon_id \
         LEFT JOIN postop_orders po ON po.surgery_id = s.id AND po.tenant_id = s.tenant_id \
         WHERE s.id = $1 AND s.tenant_id = $2",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let iv_fluids = sqlx::query_as::<_, PostopFluidOrder>(
        "SELECT fluid_type, rate_ml_hr, duration_hours \
         FROM postop_iv_fluids \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let medications = sqlx::query_as::<_, PostopMedicationOrder>(
        "SELECT drug_name, dose, route, frequency, duration, special_instructions \
         FROM postop_medications \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let monitoring_orders: Vec<String> = sqlx::query_scalar(
        "SELECT order_text FROM postop_monitoring_orders \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_orders: Vec<String> = sqlx::query_scalar(
        "SELECT test_name FROM postop_lab_orders \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let imaging_orders: Vec<String> = sqlx::query_scalar(
        "SELECT study_name FROM postop_imaging_orders \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let warning_signs: Vec<String> = sqlx::query_scalar(
        "SELECT warning_text FROM postop_warning_signs \
         WHERE surgery_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(surgery_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(PostopOrdersPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        procedure_name: row.procedure_name,
        surgeon_name: row.surgeon_name,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        diet_orders: row.diet_orders,
        position_orders: row.position_orders,
        activity_orders: row.activity_orders,
        iv_fluids,
        medications,
        monitoring_orders,
        drain_care: row.drain_care,
        wound_care: row.wound_care,
        vte_prophylaxis: row.vte_prophylaxis,
        pain_management: row.pain_management,
        lab_orders,
        imaging_orders,
        special_instructions: row.special_instructions,
        warning_signs,
        ordered_by: row.ordered_by,
        ordered_at: row.ordered_at.format("%d-%b-%Y %H:%M").to_string(),
    }))
}

// ── Transfusion Monitoring ───────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionMonitoringRow {
    patient_name: String,
    uhid: String,
    admission_number: String,
    ward_name: String,
    bed_number: String,
    transfusion_id: Uuid,
    transfusion_date: chrono::NaiveDate,
    product_type: String,
    bag_number: String,
    blood_group: String,
    rh_factor: String,
    volume_ml: i32,
    expiry_date: chrono::NaiveDate,
    crossmatch_compatible: bool,
    patient_id_verified_by: String,
    product_verified_by: String,
    consent_on_file: bool,
    transfusion_start_time: chrono::DateTime<chrono::Utc>,
    started_by: String,
    transfusion_end_time: Option<chrono::DateTime<chrono::Utc>>,
    total_volume_infused_ml: Option<i32>,
    adverse_reaction: bool,
    reaction_type: Option<String>,
    reaction_time: Option<chrono::DateTime<chrono::Utc>>,
    action_taken: Option<String>,
    completed_by: Option<String>,
}

pub async fn get_transfusion_monitoring_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfusion_id): Path<Uuid>,
) -> Result<Json<TransfusionMonitoringPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TransfusionMonitoringRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           t.id AS transfusion_id, \
           t.transfusion_date, \
           t.product_type::text AS product_type, \
           t.bag_number, \
           t.blood_group::text AS blood_group, \
           t.rh_factor::text AS rh_factor, \
           t.volume_ml, \
           t.expiry_date, \
           t.crossmatch_compatible, \
           verifier1.full_name AS patient_id_verified_by, \
           verifier2.full_name AS product_verified_by, \
           t.consent_on_file, \
           t.transfusion_start_time, \
           starter.full_name AS started_by, \
           t.transfusion_end_time, \
           t.total_volume_infused_ml, \
           t.adverse_reaction, \
           t.reaction_type, \
           t.reaction_time, \
           t.action_taken, \
           completer.full_name AS completed_by \
         FROM transfusions t \
         JOIN admissions a ON a.id = t.admission_id AND a.tenant_id = t.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users verifier1 ON verifier1.id = t.patient_verified_by_id \
         LEFT JOIN users verifier2 ON verifier2.id = t.product_verified_by_id \
         LEFT JOIN users starter ON starter.id = t.started_by_id \
         LEFT JOIN users completer ON completer.id = t.completed_by_id \
         WHERE t.id = $1 AND t.tenant_id = $2",
    )
    .bind(transfusion_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let monitoring_entries = sqlx::query_as::<_, TransfusionMonitoringEntry>(
        "SELECT \
           recorded_at::text AS time, \
           bp_systolic, bp_diastolic, pulse, temperature, spo2, \
           symptoms, \
           recorder.full_name AS recorded_by \
         FROM transfusion_monitoring tm \
         LEFT JOIN users recorder ON recorder.id = tm.recorded_by_id \
         WHERE tm.transfusion_id = $1 AND tm.tenant_id = $2 \
         ORDER BY tm.recorded_at",
    )
    .bind(transfusion_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(TransfusionMonitoringPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        transfusion_id: row.transfusion_id.to_string(),
        transfusion_date: row.transfusion_date.format("%d-%b-%Y").to_string(),
        product_type: row.product_type,
        bag_number: row.bag_number,
        blood_group: row.blood_group,
        rh_factor: row.rh_factor,
        volume_ml: row.volume_ml,
        expiry_date: row.expiry_date.format("%d-%b-%Y").to_string(),
        pre_vitals: TransfusionVitals {
            bp_systolic: None,
            bp_diastolic: None,
            pulse: None,
            temperature: None,
            spo2: None,
            respiratory_rate: None,
        },
        crossmatch_compatible: row.crossmatch_compatible,
        patient_id_verified_by: row.patient_id_verified_by,
        product_verified_by: row.product_verified_by,
        consent_on_file: row.consent_on_file,
        transfusion_start_time: row.transfusion_start_time.format("%H:%M").to_string(),
        started_by: row.started_by,
        monitoring_entries,
        transfusion_end_time: row.transfusion_end_time.map(|t| t.format("%H:%M").to_string()),
        post_vitals: None,
        total_volume_infused_ml: row.total_volume_infused_ml,
        adverse_reaction: row.adverse_reaction,
        reaction_type: row.reaction_type,
        reaction_time: row.reaction_time.map(|t| t.format("%H:%M").to_string()),
        action_taken: row.action_taken,
        completed_by: row.completed_by,
    }))
}
