//! Print-data endpoints — MRD (Medical Records Department) forms.
//!
//! Each handler assembles the context data for MRD form templates including
//! progress notes, nursing assessments, MAR, vitals charts, I/O charts, and
//! discharge checklists.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    ChecklistItem, DischargeChecklistPrintData, FallRiskAssessmentPrintData,
    FluidBalanceChartPrintData, FluidIntakeEntry, FluidOutputEntry, FollowUpItem,
    GcsChartPrintData, GcsEntry, IoChartPrintData, IoEntry, IoTotals, MarAdministration,
    MarMedicationRow, MarPrintData, NursingAssessmentPrintData, PainAssessmentEntry,
    PainAssessmentPrintData, PressureUlcerRiskPrintData, ProgressNotePrintData,
    SkinAssessmentEntry, TransfusionRequisitionPrintData, VitalReading, VitalSignsBlock,
    VitalsChartPrintData,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Helper row types ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AdmissionBaseRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: String,
    bed_number: Option<String>,
    ward_name: Option<String>,
    diagnosis: Option<String>,
}

// ── Progress Note ────────────────────────────────────────

pub async fn get_progress_note_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<ProgressNotePrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get treating doctor name
    let doctor_name: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Attending Physician') \
         FROM admissions a \
         LEFT JOIN users u ON u.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get latest vitals if available
    let vitals: Option<VitalSignsBlock> = sqlx::query_as::<
        _,
        (
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        "SELECT \
           temperature::text, \
           pulse_rate::text, \
           systolic_bp::text, \
           diastolic_bp::text, \
           respiratory_rate::text, \
           spo2::text, \
           pain_score::text \
         FROM vitals v \
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND v.tenant_id = $2 \
         ORDER BY v.recorded_at DESC \
         LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .map(|(temp, pulse, sys, dia, rr, spo2, pain)| VitalSignsBlock {
        temperature: temp,
        pulse,
        bp_systolic: sys,
        bp_diastolic: dia,
        respiratory_rate: rr,
        spo2,
        pain_score: pain,
    });

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(ProgressNotePrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        diagnosis: row.diagnosis,
        note_date: now.format("%d-%b-%Y").to_string(),
        note_time: Some(now.format("%H:%M").to_string()),
        shift: None,
        subjective: None, // To be filled by clinician
        objective: None,
        assessment: None,
        plan: None,
        vital_signs: vitals,
        io_balance: None,
        doctor_name,
        doctor_signature: None,
    }))
}

// ── Nursing Assessment ───────────────────────────────────

pub async fn get_nursing_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<NursingAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 \
           AND is_active = true \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get latest vitals
    let vitals: VitalSignsBlock = sqlx::query_as::<
        _,
        (
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        "SELECT \
           temperature::text, \
           pulse_rate::text, \
           systolic_bp::text, \
           diastolic_bp::text, \
           respiratory_rate::text, \
           spo2::text, \
           pain_score::text \
         FROM vitals v \
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND v.tenant_id = $2 \
         ORDER BY v.recorded_at DESC \
         LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .map_or(
        VitalSignsBlock {
            temperature: None,
            pulse: None,
            bp_systolic: None,
            bp_diastolic: None,
            respiratory_rate: None,
            spo2: None,
            pain_score: None,
        },
        |(temp, pulse, sys, dia, rr, spo2, pain)| VitalSignsBlock {
            temperature: temp,
            pulse,
            bp_systolic: sys,
            bp_diastolic: dia,
            respiratory_rate: rr,
            spo2,
            pain_score: pain,
        },
    );

    tx.commit().await?;

    let now = chrono::Utc::now();
    let age_str = row.age.map(|a| format!("{} yrs", a as i64));

    Ok(Json(NursingAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        assessment_date: now.format("%d-%b-%Y").to_string(),
        assessment_time: now.format("%H:%M").to_string(),
        shift: "morning".to_string(),
        chief_complaint: row.diagnosis,
        history: None,
        allergies,
        vital_signs: vitals,
        consciousness_level: None,
        pain_assessment: None,
        skin_integrity: None,
        mobility_status: None,
        fall_risk_score: None,
        braden_score: None,
        nutritional_status: None,
        iv_lines: vec![],
        drains_tubes: vec![],
        nursing_diagnosis: vec![],
        care_plan: None,
        nurse_name: "Assigned Nurse".to_string(),
        nurse_signature: None,
    }))
}

// ── MAR (Medication Administration Record) ───────────────

pub async fn get_mar_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<MarPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 \
           AND is_active = true \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get active medications from IPD orders
    #[derive(sqlx::FromRow)]
    struct MedRow {
        drug_name: String,
        dose: String,
        route: Option<String>,
        frequency: String,
    }

    let meds = sqlx::query_as::<_, MedRow>(
        "SELECT \
           io.drug_name, \
           io.dose, \
           io.route, \
           io.frequency \
         FROM ipd_orders io \
         WHERE io.admission_id = $1 AND io.tenant_id = $2 \
           AND io.order_type = 'medication' \
           AND io.status = 'active' \
         ORDER BY io.created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} yrs", a as i64));
    let now = chrono::Utc::now();

    // Build medication rows with scheduled times based on frequency
    let medications: Vec<MarMedicationRow> = meds
        .into_iter()
        .map(|m| {
            let scheduled_times = match m.frequency.to_lowercase().as_str() {
                "od" | "qd" => vec!["08:00".to_string()],
                "bd" | "bid" => vec!["08:00".to_string(), "20:00".to_string()],
                "tid" => vec![
                    "08:00".to_string(),
                    "14:00".to_string(),
                    "20:00".to_string(),
                ],
                "qid" => vec![
                    "06:00".to_string(),
                    "12:00".to_string(),
                    "18:00".to_string(),
                    "22:00".to_string(),
                ],
                "sos" | "prn" => vec![],
                _ => vec!["08:00".to_string()],
            };
            let administrations: Vec<MarAdministration> = scheduled_times
                .iter()
                .map(|t| MarAdministration {
                    scheduled_time: t.clone(),
                    actual_time: None,
                    given_by: None,
                    status: "pending".to_string(),
                    notes: None,
                })
                .collect();
            MarMedicationRow {
                drug_name: m.drug_name,
                dose: m.dose,
                route: m.route.unwrap_or_else(|| "PO".to_string()),
                frequency: m.frequency,
                scheduled_times,
                administrations,
            }
        })
        .collect();

    Ok(Json(MarPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        allergies,
        chart_date: now.format("%d-%b-%Y").to_string(),
        medications,
    }))
}

// ── Vitals Chart ─────────────────────────────────────────

pub async fn get_vitals_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<VitalsChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get vitals for today
    #[derive(sqlx::FromRow)]
    struct VitalRow {
        recorded_at: chrono::DateTime<chrono::Utc>,
        temperature: Option<f64>,
        pulse_rate: Option<i32>,
        systolic_bp: Option<i32>,
        diastolic_bp: Option<i32>,
        respiratory_rate: Option<i32>,
        spo2: Option<i32>,
        pain_score: Option<i32>,
        recorded_by_name: Option<String>,
    }

    let vitals = sqlx::query_as::<_, VitalRow>(
        "SELECT \
           v.recorded_at, \
           v.temperature, \
           v.pulse_rate, \
           v.systolic_bp, \
           v.diastolic_bp, \
           v.respiratory_rate, \
           v.spo2, \
           v.pain_score, \
           u.full_name AS recorded_by_name \
         FROM vitals v \
         LEFT JOIN users u ON u.id = v.recorded_by \
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND v.tenant_id = $2 \
           AND v.recorded_at::date = CURRENT_DATE \
         ORDER BY v.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} yrs", a as i64));
    let now = chrono::Utc::now();

    let readings: Vec<VitalReading> = vitals
        .into_iter()
        .map(|v| VitalReading {
            recorded_at: v.recorded_at.format("%H:%M").to_string(),
            shift: None,
            temperature: v.temperature.map(|t| format!("{t:.1}")),
            pulse: v.pulse_rate.map(|p| p.to_string()),
            bp_systolic: v.systolic_bp.map(|s| s.to_string()),
            bp_diastolic: v.diastolic_bp.map(|d| d.to_string()),
            respiratory_rate: v.respiratory_rate.map(|r| r.to_string()),
            spo2: v.spo2.map(|s| format!("{s}%")),
            pain_score: v.pain_score.map(|p| p.to_string()),
            recorded_by: v.recorded_by_name,
        })
        .collect();

    Ok(Json(VitalsChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        chart_date: now.format("%d-%b-%Y").to_string(),
        readings,
    }))
}

// ── I/O Chart (Intake/Output) ────────────────────────────

pub async fn get_io_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IoChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get I/O entries for today
    #[derive(sqlx::FromRow)]
    struct IoRow {
        recorded_at: chrono::DateTime<chrono::Utc>,
        intake_oral: Option<i32>,
        intake_iv: Option<i32>,
        intake_ng: Option<i32>,
        intake_other: Option<i32>,
        output_urine: Option<i32>,
        output_vomit: Option<i32>,
        output_drain: Option<i32>,
        output_stool: Option<i32>,
        output_other: Option<i32>,
        recorded_by_name: Option<String>,
    }

    let ios = sqlx::query_as::<_, IoRow>(
        "SELECT \
           io.recorded_at, \
           io.intake_oral, \
           io.intake_iv, \
           io.intake_ng, \
           io.intake_other, \
           io.output_urine, \
           io.output_vomit, \
           io.output_drain, \
           io.output_stool, \
           io.output_other, \
           u.full_name AS recorded_by_name \
         FROM intake_output io \
         LEFT JOIN users u ON u.id = io.recorded_by \
         WHERE io.admission_id = $1 \
           AND io.tenant_id = $2 \
           AND io.recorded_at::date = CURRENT_DATE \
         ORDER BY io.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} yrs", a as i64));
    let now = chrono::Utc::now();

    let mut total_intake = 0;
    let mut total_output = 0;

    let entries: Vec<IoEntry> = ios
        .into_iter()
        .map(|io| {
            let intake = io.intake_oral.unwrap_or(0)
                + io.intake_iv.unwrap_or(0)
                + io.intake_ng.unwrap_or(0)
                + io.intake_other.unwrap_or(0);
            let output = io.output_urine.unwrap_or(0)
                + io.output_vomit.unwrap_or(0)
                + io.output_drain.unwrap_or(0)
                + io.output_stool.unwrap_or(0)
                + io.output_other.unwrap_or(0);
            total_intake += intake;
            total_output += output;
            IoEntry {
                recorded_at: io.recorded_at.format("%H:%M").to_string(),
                shift: None,
                intake_oral: io.intake_oral,
                intake_iv: io.intake_iv,
                intake_ng: io.intake_ng,
                intake_other: io.intake_other,
                output_urine: io.output_urine,
                output_vomit: io.output_vomit,
                output_drain: io.output_drain,
                output_stool: io.output_stool,
                output_other: io.output_other,
                recorded_by: io.recorded_by_name,
            }
        })
        .collect();

    let daily_totals = IoTotals {
        total_intake,
        total_output,
        balance: total_intake - total_output,
    };

    Ok(Json(IoChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        chart_date: now.format("%d-%b-%Y").to_string(),
        entries,
        daily_totals,
    }))
}

// ── Discharge Checklist ──────────────────────────────────

pub async fn get_discharge_checklist_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<DischargeChecklistPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct DischargeRow {
        patient_name: String,
        uhid: String,
        age: Option<f64>,
        gender: String,
        admission_date: String,
        expected_discharge_date: Option<String>,
        bed_number: Option<String>,
        ward_name: Option<String>,
        diagnosis: Option<String>,
        discharge_type: Option<String>,
    }

    let row = sqlx::query_as::<_, DischargeRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           a.expected_discharge_date::text AS expected_discharge_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           a.discharge_type::text AS discharge_type \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get discharge medications
    let discharge_meds: Vec<String> = sqlx::query_scalar(
        "SELECT drug_name || ' ' || dose || ' ' || frequency \
         FROM ipd_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND order_type = 'medication' \
           AND is_discharge_medication = true \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} yrs", a as i64));
    let now = chrono::Utc::now();

    // Build standard discharge checklist items
    let checklist_items = vec![
        ChecklistItem {
            category: "Clinical".to_string(),
            item: "Discharge summary completed".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Clinical".to_string(),
            item: "Discharge medications prescribed".to_string(),
            completed: !discharge_meds.is_empty(),
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Clinical".to_string(),
            item: "Patient/family education completed".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Clinical".to_string(),
            item: "Follow-up appointments scheduled".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Nursing".to_string(),
            item: "IV lines removed".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Nursing".to_string(),
            item: "Foley catheter removed".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Nursing".to_string(),
            item: "Patient belongings returned".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Administrative".to_string(),
            item: "Final bill generated".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Administrative".to_string(),
            item: "Bill settled/payment arranged".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
        ChecklistItem {
            category: "Administrative".to_string(),
            item: "Insurance/TPA clearance obtained".to_string(),
            completed: false,
            completed_by: None,
            completed_at: None,
            notes: None,
        },
    ];

    let follow_up_appointments = vec![FollowUpItem {
        department: "General Medicine".to_string(),
        doctor_name: None,
        recommended_date: "1 week".to_string(),
        reason: Some("Post-discharge review".to_string()),
    }];

    Ok(Json(DischargeChecklistPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date,
        expected_discharge_date: row
            .expected_discharge_date
            .unwrap_or_else(|| now.format("%d-%b-%Y").to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        diagnosis: row.diagnosis,
        discharge_type: row.discharge_type,
        checklist_items,
        discharge_medications: discharge_meds,
        follow_up_appointments,
        patient_education_completed: false,
        discharge_summary_ready: false,
        final_bill_settled: false,
        verified_by: None,
        verified_at: None,
    }))
}

// ══════════════════════════════════════════════════════════
// Phase 3: Clinical Charts
// ══════════════════════════════════════════════════════════

// ── Fluid Balance Chart ──────────────────────────────────

pub async fn get_fluid_balance_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<FluidBalanceChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let attending_doctor: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Attending Physician') \
         FROM admissions a \
         LEFT JOIN users u ON u.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let intake_entries = sqlx::query_as::<_, FluidIntakeEntry>(
        "SELECT \
           recorded_at::text AS time, \
           intake_type, \
           description, \
           volume_ml, \
           route, \
           recorder.full_name AS recorded_by \
         FROM fluid_intake fi \
         LEFT JOIN users recorder ON recorder.id = fi.recorded_by_id \
         WHERE fi.admission_id = $1 AND fi.tenant_id = $2 \
           AND fi.recorded_at::date = CURRENT_DATE \
         ORDER BY fi.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let output_entries = sqlx::query_as::<_, FluidOutputEntry>(
        "SELECT \
           recorded_at::text AS time, \
           output_type, \
           description, \
           volume_ml, \
           characteristics, \
           recorder.full_name AS recorded_by \
         FROM fluid_output fo \
         LEFT JOIN users recorder ON recorder.id = fo.recorded_by_id \
         WHERE fo.admission_id = $1 AND fo.tenant_id = $2 \
           AND fo.recorded_at::date = CURRENT_DATE \
         ORDER BY fo.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_intake_ml: i32 = intake_entries.iter().map(|e| e.volume_ml).sum();
    let total_output_ml: i32 = output_entries.iter().map(|e| e.volume_ml).sum();
    let now = chrono::Utc::now();

    Ok(Json(FluidBalanceChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: "N/A".to_string(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        chart_date: now.format("%d-%b-%Y").to_string(),
        attending_doctor,
        intake_entries,
        output_entries,
        total_intake_ml,
        total_output_ml,
        net_balance_ml: total_intake_ml - total_output_ml,
        cumulative_intake_ml: None,
        cumulative_output_ml: None,
        cumulative_balance_ml: None,
        shift_nurse: None,
    }))
}

// ── Pain Assessment ──────────────────────────────────────

pub async fn get_pain_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<PainAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let assessments = sqlx::query_as::<_, PainAssessmentEntry>(
        "SELECT \
           recorded_at::text AS time, \
           pain_score, \
           pain_scale_used, \
           pain_location, \
           pain_character, \
           aggravating_factors, \
           relieving_factors, \
           intervention_given, \
           response_to_intervention, \
           reassessment_score, \
           assessor.full_name AS assessed_by \
         FROM pain_assessments pa \
         LEFT JOIN users assessor ON assessor.id = pa.assessed_by_id \
         WHERE pa.admission_id = $1 AND pa.tenant_id = $2 \
           AND pa.recorded_at::date = CURRENT_DATE \
         ORDER BY pa.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let assessed_by: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Nursing Staff') \
         FROM pain_assessments pa \
         LEFT JOIN users u ON u.id = pa.assessed_by_id \
         WHERE pa.admission_id = $1 AND pa.tenant_id = $2 \
         ORDER BY pa.recorded_at DESC LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_else(|| "Nursing Staff".to_string());

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(PainAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: "N/A".to_string(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        assessment_date: now.format("%d-%b-%Y").to_string(),
        assessments,
        pain_management_plan: None,
        assessed_by,
    }))
}

// ── Fall Risk Assessment (Morse Fall Scale) ─────────────

#[derive(Debug, sqlx::FromRow)]
struct FallRiskRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    admission_number: String,
    ward_name: String,
    bed_number: String,
    history_of_falling: i32,
    secondary_diagnosis: i32,
    ambulatory_aid: i32,
    iv_therapy: i32,
    gait: i32,
    mental_status: i32,
    total_score: i32,
    risk_level: String,
    fall_precautions_implemented: bool,
    bed_alarm_on: bool,
    side_rails_up: bool,
    call_bell_within_reach: bool,
    non_slip_footwear: bool,
    assessed_by: String,
    next_reassessment_date: Option<chrono::NaiveDate>,
}

pub async fn get_fall_risk_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<FallRiskAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FallRiskRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           a.admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           COALESCE(fr.history_of_falling, 0) AS history_of_falling, \
           COALESCE(fr.secondary_diagnosis, 0) AS secondary_diagnosis, \
           COALESCE(fr.ambulatory_aid, 0) AS ambulatory_aid, \
           COALESCE(fr.iv_therapy, 0) AS iv_therapy, \
           COALESCE(fr.gait, 0) AS gait, \
           COALESCE(fr.mental_status, 0) AS mental_status, \
           COALESCE(fr.total_score, 0) AS total_score, \
           COALESCE(fr.risk_level, 'Low') AS risk_level, \
           COALESCE(fr.fall_precautions_implemented, false) AS fall_precautions_implemented, \
           COALESCE(fr.bed_alarm_on, false) AS bed_alarm_on, \
           COALESCE(fr.side_rails_up, false) AS side_rails_up, \
           COALESCE(fr.call_bell_within_reach, false) AS call_bell_within_reach, \
           COALESCE(fr.non_slip_footwear, false) AS non_slip_footwear, \
           COALESCE(assessor.full_name, 'Nursing Staff') AS assessed_by, \
           fr.next_reassessment_date \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN fall_risk_assessments fr ON fr.admission_id = a.id AND fr.tenant_id = a.tenant_id \
         LEFT JOIN users assessor ON assessor.id = fr.assessed_by_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let interventions: Vec<String> = sqlx::query_scalar(
        "SELECT intervention_text FROM fall_risk_interventions \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(FallRiskAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        admission_number: row.admission_number,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        assessment_date: now.format("%d-%b-%Y").to_string(),
        history_of_falling: row.history_of_falling,
        secondary_diagnosis: row.secondary_diagnosis,
        ambulatory_aid: row.ambulatory_aid,
        iv_therapy: row.iv_therapy,
        gait: row.gait,
        mental_status: row.mental_status,
        total_score: row.total_score,
        risk_level: row.risk_level,
        interventions,
        fall_precautions_implemented: row.fall_precautions_implemented,
        bed_alarm_on: row.bed_alarm_on,
        side_rails_up: row.side_rails_up,
        call_bell_within_reach: row.call_bell_within_reach,
        non_slip_footwear: row.non_slip_footwear,
        assessed_by: row.assessed_by,
        next_reassessment_date: row
            .next_reassessment_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
    }))
}

// ── Pressure Ulcer Risk Assessment (Braden Scale) ────────

#[derive(Debug, sqlx::FromRow)]
struct PressureUlcerRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    admission_number: String,
    ward_name: String,
    bed_number: String,
    sensory_perception: i32,
    moisture: i32,
    activity: i32,
    mobility: i32,
    nutrition: i32,
    friction_shear: i32,
    total_score: i32,
    risk_level: String,
    repositioning_schedule: Option<String>,
    support_surface: Option<String>,
    nutrition_plan: Option<String>,
    moisture_management: Option<String>,
    assessed_by: String,
    next_reassessment_date: Option<chrono::NaiveDate>,
}

pub async fn get_pressure_ulcer_risk_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<PressureUlcerRiskPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PressureUlcerRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           a.admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           COALESCE(pr.sensory_perception, 4) AS sensory_perception, \
           COALESCE(pr.moisture, 4) AS moisture, \
           COALESCE(pr.activity, 4) AS activity, \
           COALESCE(pr.mobility, 4) AS mobility, \
           COALESCE(pr.nutrition, 4) AS nutrition, \
           COALESCE(pr.friction_shear, 3) AS friction_shear, \
           COALESCE(pr.total_score, 23) AS total_score, \
           COALESCE(pr.risk_level, 'No Risk') AS risk_level, \
           pr.repositioning_schedule, \
           pr.support_surface, \
           pr.nutrition_plan, \
           pr.moisture_management, \
           COALESCE(assessor.full_name, 'Nursing Staff') AS assessed_by, \
           pr.next_reassessment_date \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN pressure_ulcer_assessments pr ON pr.admission_id = a.id AND pr.tenant_id = a.tenant_id \
         LEFT JOIN users assessor ON assessor.id = pr.assessed_by_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let skin_assessment = sqlx::query_as::<_, SkinAssessmentEntry>(
        "SELECT body_area, skin_condition, stage, wound_size_cm, notes \
         FROM skin_assessments \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let other_interventions: Vec<String> = sqlx::query_scalar(
        "SELECT intervention_text FROM pressure_ulcer_interventions \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(PressureUlcerRiskPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        admission_number: row.admission_number,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        assessment_date: now.format("%d-%b-%Y").to_string(),
        sensory_perception: row.sensory_perception,
        moisture: row.moisture,
        activity: row.activity,
        mobility: row.mobility,
        nutrition: row.nutrition,
        friction_shear: row.friction_shear,
        total_score: row.total_score,
        risk_level: row.risk_level,
        skin_assessment,
        repositioning_schedule: row.repositioning_schedule,
        support_surface: row.support_surface,
        nutrition_plan: row.nutrition_plan,
        moisture_management: row.moisture_management,
        other_interventions,
        assessed_by: row.assessed_by,
        next_reassessment_date: row
            .next_reassessment_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
    }))
}

// ── Glasgow Coma Scale Chart ─────────────────────────────

pub async fn get_gcs_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<GcsChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let attending_doctor: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Attending Physician') \
         FROM admissions a \
         LEFT JOIN users u ON u.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let entries = sqlx::query_as::<_, GcsEntry>(
        "SELECT \
           recorded_at::text AS time, \
           eye_opening, \
           verbal_response, \
           motor_response, \
           total_score, \
           pupil_left_size, \
           pupil_left_reaction, \
           pupil_right_size, \
           pupil_right_reaction, \
           bp_systolic, \
           bp_diastolic, \
           pulse, \
           spo2, \
           temperature AS temp, \
           assessor.full_name AS assessed_by \
         FROM gcs_assessments ga \
         LEFT JOIN users assessor ON assessor.id = ga.assessed_by_id \
         WHERE ga.admission_id = $1 AND ga.tenant_id = $2 \
           AND ga.recorded_at::date = CURRENT_DATE \
         ORDER BY ga.recorded_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(GcsChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: "N/A".to_string(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        chart_date: now.format("%d-%b-%Y").to_string(),
        diagnosis: row.diagnosis,
        entries,
        attending_doctor,
    }))
}

// ── Transfusion Requisition ──────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionReqRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    blood_group: Option<String>,
    rh_factor: Option<String>,
    admission_number: Option<String>,
    ward_name: String,
    bed_number: String,
    request_id: Uuid,
    request_date: chrono::NaiveDate,
    clinical_indication: String,
    diagnosis: Option<String>,
    hemoglobin: Option<String>,
    hematocrit: Option<String>,
    platelet_count: Option<String>,
    pt_inr: Option<String>,
    aptt: Option<String>,
    product_requested: String,
    units_requested: i32,
    urgency: String,
    special_requirements: Option<String>,
    previous_transfusions: Option<String>,
    previous_reactions: Option<String>,
    pregnancy_history: Option<String>,
    consent_obtained: bool,
    sample_collected_by: Option<String>,
    sample_collected_at: Option<chrono::DateTime<chrono::Utc>>,
    requested_by: String,
    requested_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_transfusion_requisition_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<TransfusionRequisitionPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TransfusionReqRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.blood_group::text AS blood_group, \
           p.rh_factor::text AS rh_factor, \
           a.admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           tr.id AS request_id, \
           tr.request_date, \
           tr.clinical_indication, \
           tr.diagnosis, \
           tr.hemoglobin, \
           tr.hematocrit, \
           tr.platelet_count, \
           tr.pt_inr, \
           tr.aptt, \
           tr.product_requested::text AS product_requested, \
           tr.units_requested, \
           tr.urgency::text AS urgency, \
           tr.special_requirements, \
           tr.previous_transfusions, \
           tr.previous_reactions, \
           tr.pregnancy_history, \
           COALESCE(tr.consent_obtained, false) AS consent_obtained, \
           collector.full_name AS sample_collected_by, \
           tr.sample_collected_at, \
           requester.full_name AS requested_by, \
           tr.created_at AS requested_at \
         FROM transfusion_requests tr \
         JOIN patients p ON p.id = tr.patient_id AND p.tenant_id = tr.tenant_id \
         LEFT JOIN admissions a ON a.id = tr.admission_id AND a.tenant_id = tr.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users collector ON collector.id = tr.sample_collected_by_id \
         LEFT JOIN users requester ON requester.id = tr.requested_by_id \
         WHERE tr.id = $1 AND tr.tenant_id = $2",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(TransfusionRequisitionPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        blood_group: row.blood_group,
        rh_factor: row.rh_factor,
        admission_number: row.admission_number,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        request_id: row.request_id.to_string(),
        request_date: row.request_date.format("%d-%b-%Y").to_string(),
        clinical_indication: row.clinical_indication,
        diagnosis: row.diagnosis,
        hemoglobin: row.hemoglobin,
        hematocrit: row.hematocrit,
        platelet_count: row.platelet_count,
        pt_inr: row.pt_inr,
        aptt: row.aptt,
        product_requested: row.product_requested,
        units_requested: row.units_requested,
        urgency: row.urgency,
        special_requirements: row.special_requirements,
        previous_transfusions: row.previous_transfusions,
        previous_reactions: row.previous_reactions,
        pregnancy_history: row.pregnancy_history,
        consent_obtained: row.consent_obtained,
        sample_collected_by: row.sample_collected_by,
        sample_collected_at: row
            .sample_collected_at
            .map(|t| t.format("%d-%b-%Y %H:%M").to_string()),
        requested_by: row.requested_by,
        requested_at: row.requested_at.format("%d-%b-%Y %H:%M").to_string(),
    }))
}
