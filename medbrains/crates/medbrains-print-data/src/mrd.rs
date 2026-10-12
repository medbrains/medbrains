//! Print-data endpoints — MRD (Medical Records Department) forms.
//!
//! Each handler assembles the context data for MRD form templates including
//! progress notes, nursing assessments, MAR, vitals charts, I/O charts, and
//! discharge checklists.

use axum::routing::get;
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

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

/// Per-admission access gate (ReBAC): the caller must be linked to the
/// admission (its treating/ward department, attending, or an explicit grant) to
/// print its clinical record. Returns `NotFound` (not `Forbidden`) so the
/// endpoint isn't an existence oracle. Composes on top of `require_permission`
/// + tenant RLS. See RFC-PATIENT-ACCESS-CONTROL.
async fn require_admission_access(
    state: &AppState,
    claims: &Claims,
    admission_id: Uuid,
) -> Result<(), AppError> {
    // Delegates to the canonical resolver rather than repeating it. The
    // hand-rolled copy that lived here collapsed a backend outage into
    // `NotFound`, so a fault told the caller the record did not exist.
    medbrains_authz_gate::require_admission_access(state, claims, admission_id).await
}

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
    /// The admission's encounter number — the IP number printed on charts.
    admission_number: Option<String>,
}

// ── Progress Note ────────────────────────────────────────

pub async fn get_progress_note_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<ProgressNotePrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1 AND deleted_at IS NULL) \
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
        note_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
        note_time: Some(now.with_timezone(&tz).format("%H:%M").to_string()),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1 AND deleted_at IS NULL) \
           AND tenant_id = $2 \
           AND is_active = true \
         ORDER BY created_at LIMIT 5000",
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
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1 AND deleted_at IS NULL) \
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
        assessment_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
        assessment_time: now.with_timezone(&tz).format("%H:%M").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1 AND deleted_at IS NULL) \
           AND tenant_id = $2 \
           AND is_active = true \
         ORDER BY created_at LIMIT 5000",
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
         ORDER BY io.created_at LIMIT 5000",
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
        chart_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
         WHERE v.patient_id = (SELECT patient_id FROM admissions WHERE id = $1 AND deleted_at IS NULL) \
           AND v.tenant_id = $2 \
           AND (v.recorded_at >= CURRENT_DATE AND v.recorded_at < CURRENT_DATE + 1) \
         ORDER BY v.recorded_at LIMIT 5000",
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
            recorded_at: v.recorded_at.with_timezone(&tz).format("%H:%M").to_string(),
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
        chart_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
        // Reads the entries the ward actually records. This chart used to
        // select from `intake_output`, which has no INSERT anywhere in the
        // codebase — so it printed an empty fluid balance onto hospital
        // letterhead for every patient, including the ones whose balance is
        // the reason they are being watched. Nursing writes
        // `intake_output_entries` (narrow rows keyed on the encounter); this
        // pivots them into the wide shape the chart was built to render.
        "SELECT e.recorded_at, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'intake' AND e.category = 'oral'), 0)::int AS intake_oral, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'intake' AND e.category = 'iv'), 0)::int AS intake_iv, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'intake' AND e.category = 'ng'), 0)::int AS intake_ng, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'intake' \
              AND e.category NOT IN ('oral', 'iv', 'ng')), 0)::int AS intake_other, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'output' AND e.category = 'urine'), 0)::int AS output_urine, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'output' AND e.category = 'vomit'), 0)::int AS output_vomit, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'output' AND e.category = 'drain'), 0)::int AS output_drain, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'output' AND e.category = 'stool'), 0)::int AS output_stool, \
           COALESCE(SUM(e.volume_ml) FILTER \
             (WHERE e.direction = 'output' \
              AND e.category NOT IN ('urine', 'vomit', 'drain', 'stool')), 0)::int AS output_other, \
           max(u.full_name) AS recorded_by_name \
         FROM admissions a \
         JOIN intake_output_entries e \
           ON e.encounter_id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN users u ON u.id = e.recorded_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
           AND e.deleted_at IS NULL \
           AND (e.recorded_at >= CURRENT_DATE AND e.recorded_at < CURRENT_DATE + 1) \
         GROUP BY e.recorded_at \
         ORDER BY e.recorded_at LIMIT 5000",
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
                recorded_at: io
                    .recorded_at
                    .with_timezone(&tz)
                    .format("%H:%M")
                    .to_string(),
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
        chart_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

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
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
         ORDER BY created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

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
            .unwrap_or_else(|| now.with_timezone(&tz).format("%d-%b-%Y").to_string()),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let attending_doctor: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Attending Physician') \
         FROM admissions a \
         LEFT JOIN users u ON u.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let intake_entries = sqlx::query_as::<_, FluidIntakeEntry>(
        // `fluid_intake` has no INSERT anywhere in the codebase, so this chart
        // printed blank for every patient. The ward records intake on
        // `intake_output_entries`, keyed on the encounter rather than the
        // admission; the join goes through admissions.encounter_id.
        "SELECT e.recorded_at::text AS time, \
           e.category AS intake_type, \
           e.notes AS description, \
           e.volume_ml, \
           e.category AS route, \
           recorder.full_name AS recorded_by \
         FROM admissions a \
         JOIN intake_output_entries e \
           ON e.encounter_id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN users recorder ON recorder.id = e.recorded_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
           AND e.direction = 'intake' AND e.deleted_at IS NULL \
           AND (e.recorded_at >= CURRENT_DATE AND e.recorded_at < CURRENT_DATE + 1) \
         ORDER BY e.recorded_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let output_entries = sqlx::query_as::<_, FluidOutputEntry>(
        // Same as intake above: `fluid_output` has no writer either.
        "SELECT e.recorded_at::text AS time, \
           e.category AS output_type, \
           e.notes AS description, \
           e.volume_ml, \
           e.notes AS characteristics, \
           recorder.full_name AS recorded_by \
         FROM admissions a \
         JOIN intake_output_entries e \
           ON e.encounter_id = a.encounter_id AND e.tenant_id = a.tenant_id \
         LEFT JOIN users recorder ON recorder.id = e.recorded_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
           AND e.direction = 'output' AND e.deleted_at IS NULL \
           AND (e.recorded_at >= CURRENT_DATE AND e.recorded_at < CURRENT_DATE + 1) \
         ORDER BY e.recorded_at LIMIT 5000",
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
        admission_number: row.admission_number.unwrap_or_default(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        chart_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Pain scores are charted against the admission's encounter.
    // ponytail: aggravating/relieving factors, response and reassessment score
    // are not recorded anywhere yet.
    let assessments = sqlx::query_as::<_, PainAssessmentEntry>(
        "SELECT \
           pe.recorded_at::text AS time, \
           pe.score AS pain_score, \
           pe.scale AS pain_scale_used, \
           pe.location AS pain_location, \
           pe.character AS pain_character, \
           NULL::text AS aggravating_factors, \
           NULL::text AS relieving_factors, \
           pe.intervention_taken AS intervention_given, \
           NULL::text AS response_to_intervention, \
           NULL::int4 AS reassessment_score, \
           COALESCE(u.full_name, '') AS assessed_by \
         FROM admissions a \
         JOIN pain_score_entries pe ON pe.encounter_id = a.encounter_id \
           AND pe.tenant_id = a.tenant_id AND pe.deleted_at IS NULL \
         LEFT JOIN users u ON u.id = pe.recorded_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
           AND pe.recorded_at >= CURRENT_DATE AND pe.recorded_at < CURRENT_DATE + 1 \
         ORDER BY pe.recorded_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let assessed_by: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, '') \
         FROM admissions a \
         JOIN pain_score_entries pe ON pe.encounter_id = a.encounter_id \
           AND pe.tenant_id = a.tenant_id AND pe.deleted_at IS NULL \
         LEFT JOIN users u ON u.id = pe.recorded_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
         ORDER BY pe.recorded_at DESC LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_default();

    tx.commit().await?;

    let now = chrono::Utc::now();

    Ok(Json(PainAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number.unwrap_or_default(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        assessment_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FallRiskRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           COALESCE(e.encounter_number, '') AS admission_number, \
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
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN fall_risk_assessments fr ON fr.admission_id = a.id AND fr.tenant_id = a.tenant_id \
         LEFT JOIN users assessor ON assessor.id = fr.assessed_by_id \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let interventions: Vec<String> = sqlx::query_scalar(
        "SELECT intervention_text FROM fall_risk_interventions \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
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
        assessment_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
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
    assessed_at: chrono::DateTime<chrono::Utc>,
    sensory_perception: i32,
    moisture: i32,
    activity: i32,
    mobility: i32,
    nutrition: i32,
    friction_shear: i32,
    risk_level: String,
    repositioning_plan: Option<String>,
    nutritional_plan: Option<String>,
    skin_care_plan: Option<String>,
    assessed_by: String,
}

pub async fn get_pressure_ulcer_risk_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<PressureUlcerRiskPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The latest Braden assessment for the stay. Without one there is nothing
    // honest to print — default subscores would read as a real risk grade.
    let row = sqlx::query_as::<_, PressureUlcerRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           COALESCE(e.encounter_number, '') AS admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           pr.assessed_at, \
           pr.sensory_perception, \
           pr.moisture, \
           pr.activity, \
           pr.mobility, \
           pr.nutrition, \
           pr.friction_shear, \
           pr.risk_level, \
           pr.repositioning_plan, \
           pr.nutritional_plan, \
           pr.skin_care_plan, \
           COALESCE(u.full_name, '') AS assessed_by \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         JOIN LATERAL ( \
           SELECT * FROM nabh_pressure_ulcer_assessments x \
           WHERE x.admission_id = a.id AND x.tenant_id = a.tenant_id \
             AND x.deleted_at IS NULL \
           ORDER BY x.assessed_at DESC LIMIT 1 \
         ) pr ON true \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN users u ON u.id = pr.assessed_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("No Braden assessment has been recorded for this admission".to_owned())
    })?;

    // Wounds charted on the stay's encounter, plus any pressure injury noted
    // on a Braden assessment.
    let skin_assessment = sqlx::query_as::<_, SkinAssessmentEntry>(
        "SELECT body_area, skin_condition, stage, wound_size_cm, notes FROM ( \
           SELECT wa.recorded_at AS at, wa.body_site AS body_area, \
             COALESCE(wa.classification, '') AS skin_condition, wa.stage, \
             NULLIF(concat_ws(' x ', wa.length_cm::text, wa.width_cm::text, \
               wa.depth_cm::text), '') AS wound_size_cm, \
             wa.notes \
           FROM admissions a \
           JOIN wound_assessments wa ON wa.encounter_id = a.encounter_id \
             AND wa.tenant_id = a.tenant_id AND wa.deleted_at IS NULL \
           WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL \
           UNION ALL \
           SELECT pu.assessed_at, COALESCE(pu.injury_location, ''), 'Pressure injury', \
             pu.injury_stage, NULL::text, pu.injury_description \
           FROM nabh_pressure_ulcer_assessments pu \
           WHERE pu.admission_id = $1 AND pu.tenant_id = $2 \
             AND pu.deleted_at IS NULL AND pu.injury_present \
         ) s ORDER BY at DESC LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_score = row.sensory_perception
        + row.moisture
        + row.activity
        + row.mobility
        + row.nutrition
        + row.friction_shear;

    Ok(Json(PressureUlcerRiskPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        admission_number: row.admission_number,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        assessment_date: row
            .assessed_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        sensory_perception: row.sensory_perception,
        moisture: row.moisture,
        activity: row.activity,
        mobility: row.mobility,
        nutrition: row.nutrition,
        friction_shear: row.friction_shear,
        total_score,
        risk_level: row.risk_level,
        skin_assessment,
        repositioning_schedule: row.repositioning_plan,
        // ponytail: support surface, moisture plan and reassessment date are
        // not recorded anywhere yet; the skin-care plan prints as an intervention.
        support_surface: None,
        nutrition_plan: row.nutritional_plan,
        moisture_management: None,
        other_interventions: row.skin_care_plan.into_iter().collect(),
        assessed_by: row.assessed_by,
        next_reassessment_date: None,
    }))
}

// ── Glasgow Coma Scale Chart ─────────────────────────────

pub async fn get_gcs_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<GcsChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdmissionBaseRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at::date::text AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.provisional_diagnosis AS diagnosis, \
           e.encounter_number AS admission_number \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let attending_doctor: String = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, 'Attending Physician') \
         FROM admissions a \
         LEFT JOIN users u ON u.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
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
           AND (ga.recorded_at >= CURRENT_DATE AND ga.recorded_at < CURRENT_DATE + 1) \
         ORDER BY ga.recorded_at LIMIT 5000",
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
        admission_number: row.admission_number.unwrap_or_default(),
        ward_name: row.ward_name.unwrap_or_else(|| "N/A".to_string()),
        bed_number: row.bed_number.unwrap_or_else(|| "N/A".to_string()),
        chart_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
        diagnosis: row.diagnosis,
        entries,
        attending_doctor,
    }))
}

// ── Transfusion Requisition ──────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionReqRow {
    patient_id: Uuid,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    blood_group: Option<String>,
    rh_factor: Option<String>,
    admission_number: Option<String>,
    ward_name: String,
    bed_number: String,
    clinical_indication: String,
    diagnosis: Option<String>,
    product_requested: String,
    units_requested: i32,
    previous_transfusions: Option<String>,
    previous_reactions: Option<String>,
    requested_by: Option<String>,
    requested_at: chrono::DateTime<chrono::Utc>,
}

/// `request_id` is `crossmatch_requests.id` — the blood bank's record of the
/// ward's request. Ward and bed come from the admission open when it was made.
pub async fn get_transfusion_requisition_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<TransfusionRequisitionPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::CROSSMATCH_REQUEST,
        request_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TransfusionReqRow>(
        "SELECT \
           cr.patient_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           NULLIF(upper(split_part(cr.blood_group::text, '_', 1)), 'UNKNOWN') AS blood_group, \
           CASE WHEN cr.blood_group::text LIKE '%_positive' THEN 'Positive' \
                WHEN cr.blood_group::text LIKE '%_negative' THEN 'Negative' END AS rh_factor, \
           e.encounter_number AS admission_number, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           COALESCE(cr.clinical_indication, '') AS clinical_indication, \
           a.provisional_diagnosis AS diagnosis, \
           cr.component_type::text AS product_requested, \
           cr.units_requested, \
           (SELECT NULLIF(count(*), 0)::text FROM transfusion_records t \
             WHERE t.patient_id = cr.patient_id AND t.tenant_id = cr.tenant_id \
               AND t.deleted_at IS NULL AND t.created_at < cr.created_at) \
             AS previous_transfusions, \
           (SELECT string_agg(DISTINCT t.reaction_type, ', ') FROM transfusion_records t \
             WHERE t.patient_id = cr.patient_id AND t.tenant_id = cr.tenant_id \
               AND t.deleted_at IS NULL AND t.has_reaction \
               AND t.created_at < cr.created_at) AS previous_reactions, \
           requester.full_name AS requested_by, \
           cr.created_at AS requested_at \
         FROM crossmatch_requests cr \
         JOIN patients p ON p.id = cr.patient_id AND p.tenant_id = cr.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN LATERAL ( \
           SELECT ad.id, ad.encounter_id, ad.ward_id, ad.bed_id, ad.provisional_diagnosis \
           FROM admissions ad \
           WHERE ad.patient_id = cr.patient_id AND ad.tenant_id = cr.tenant_id \
             AND ad.deleted_at IS NULL AND ad.admitted_at <= cr.created_at \
             AND (ad.discharged_at IS NULL OR ad.discharged_at >= cr.created_at) \
           ORDER BY ad.admitted_at DESC LIMIT 1 \
         ) a ON true \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = cr.tenant_id \
           AND e.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = cr.tenant_id \
           AND w.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = cr.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN users requester ON requester.id = cr.requested_by \
         WHERE cr.id = $1 AND cr.tenant_id = $2 AND cr.deleted_at IS NULL",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Latest pre-transfusion value of each, as of the request, with its date.
    // ponytail: matched on parameter name — switch to LOINC once lab_results carries it.
    let labs: Vec<(String, String)> = sqlx::query_as(
        "SELECT DISTINCT ON (r.k) r.k, \
           r.value || COALESCE(' ' || r.unit, '') \
             || ' (' || to_char(r.created_at, 'DD-Mon-YYYY') || ')' AS v \
         FROM ( \
           SELECT lr.value, lr.unit, lr.created_at, \
             CASE \
               WHEN lower(trim(lr.parameter_name)) IN \
                 ('haemoglobin', 'hemoglobin', 'hb', 'hgb') THEN 'hb' \
               WHEN lower(trim(lr.parameter_name)) IN \
                 ('haematocrit', 'hematocrit', 'hct', 'pcv', 'packed cell volume') THEN 'hct' \
               WHEN lower(trim(lr.parameter_name)) IN \
                 ('platelet count', 'platelets', 'plt') THEN 'plt' \
               WHEN lower(trim(lr.parameter_name)) IN ('inr', 'pt inr', 'pt/inr') THEN 'inr' \
               WHEN lower(trim(lr.parameter_name)) IN \
                 ('aptt', 'ptt', 'activated partial thromboplastin time') THEN 'aptt' \
             END AS k \
           FROM lab_results lr \
           JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
             AND lo.deleted_at IS NULL \
           WHERE lo.patient_id = $1 AND lo.tenant_id = $2 \
             AND lr.deleted_at IS NULL AND lr.created_at <= $3 \
         ) r \
         WHERE r.k IS NOT NULL \
         ORDER BY r.k, r.created_at DESC LIMIT 5",
    )
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .bind(row.requested_at)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let lab = |key: &str| labs.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());

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
        request_id: request_id.to_string(),
        request_date: row
            .requested_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        clinical_indication: row.clinical_indication,
        diagnosis: row.diagnosis,
        hemoglobin: lab("hb"),
        hematocrit: lab("hct"),
        platelet_count: lab("plt"),
        pt_inr: lab("inr"),
        aptt: lab("aptt"),
        product_requested: row.product_requested,
        units_requested: row.units_requested,
        // ponytail: urgency, special requirements, pregnancy history, consent and
        // sample collection are not recorded on a crossmatch request yet.
        urgency: None,
        special_requirements: None,
        previous_transfusions: row.previous_transfusions,
        previous_reactions: row.previous_reactions,
        pregnancy_history: None,
        consent_obtained: None,
        sample_collected_by: None,
        sample_collected_at: None,
        requested_by: row.requested_by.unwrap_or_default(),
        requested_at: row
            .requested_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
    }))
}

/// Print-data MRD routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/mrd/progress-note/{admission_id}",
            get(get_progress_note_print_data),
        )
        .route(
            "/api/print-data/mrd/nursing-assessment/{admission_id}",
            get(get_nursing_assessment_print_data),
        )
        .route(
            "/api/print-data/mrd/mar/{admission_id}",
            get(get_mar_print_data),
        )
        .route(
            "/api/print-data/mrd/vitals-chart/{admission_id}",
            get(get_vitals_chart_print_data),
        )
        .route(
            "/api/print-data/mrd/io-chart/{admission_id}",
            get(get_io_chart_print_data),
        )
        .route(
            "/api/print-data/mrd/discharge-checklist/{admission_id}",
            get(get_discharge_checklist_print_data),
        )
        .route(
            "/api/print-data/fluid-balance-chart/{admission_id}",
            get(get_fluid_balance_chart_print_data),
        )
        .route(
            "/api/print-data/pain-assessment/{admission_id}",
            get(get_pain_assessment_print_data),
        )
        .route(
            "/api/print-data/fall-risk-assessment/{admission_id}",
            get(get_fall_risk_assessment_print_data),
        )
        .route(
            "/api/print-data/pressure-ulcer-risk/{admission_id}",
            get(get_pressure_ulcer_risk_print_data),
        )
        .route(
            "/api/print-data/gcs-chart/{admission_id}",
            get(get_gcs_chart_print_data),
        )
        .route(
            "/api/print-data/transfusion-requisition/{request_id}",
            get(get_transfusion_requisition_print_data),
        )
}
