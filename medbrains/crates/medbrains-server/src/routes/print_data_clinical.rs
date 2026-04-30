//! Print-data endpoints — wristband, appointment, death certificate, discharge.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AppointmentSlipPrintData, CumulativeLabReportPrintData, DeathCertificatePrintData,
    DischargeSummaryPrintData, EducationSection, InfantWristbandPrintData, KeyImage, LabParameter,
    LabReportFullPrintData, OpdPrescriptionPrintData, OpdVitals, ParameterTrend,
    PatientEducationPrintData, PrescriptionMedication, RadiologyReportFullPrintData,
    RegistrationCardPrintData, StatOrder, TokenSlipPrintData, TransferSummaryPrintData,
    TreatmentChartIvFluid, TreatmentChartMedication, TreatmentChartPrintData, TrendValue,
    VisitorPassPrintData, WristbandPrintData,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Wristband ────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct WristbandRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    blood_group: Option<String>,
    admitted_at: chrono::DateTime<Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
}

pub async fn get_wristband_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<WristbandPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, WristbandRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.blood_group::text AS blood_group, \
           a.admitted_at, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

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

    tx.commit().await?;

    Ok(Json(WristbandPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        blood_group: row.blood_group,
        admission_date: row.admitted_at.format("%d-%b-%Y").to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        doctor_name: row.doctor_name,
        allergies,
    }))
}

// ── Discharge Summary ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DischargeSummaryRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admitted_at: chrono::DateTime<Utc>,
    discharged_at: Option<chrono::DateTime<Utc>>,
    department: Option<String>,
    doctor_name: Option<String>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    discharge_type: Option<String>,
    discharge_summary: Option<String>,
    diagnosis: Option<String>,
}

pub async fn get_discharge_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<DischargeSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, DischargeSummaryRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at, \
           a.discharged_at, \
           dept.name AS department, \
           doc.full_name AS doctor_name, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.discharge_type::text AS discharge_type, \
           a.discharge_summary, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN encounters e ON e.id = a.encounter_id \
                                AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id \
                                    AND dept.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch signatures (primary + co-signers) for the discharge summary.
    let sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "discharge_summary",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    let fmt_ts =
        |dt: Option<chrono::DateTime<Utc>>| dt.map(|d| d.format("%d-%b-%Y %H:%M").to_string());

    Ok(Json(DischargeSummaryPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_date: row.admitted_at.format("%d-%b-%Y").to_string(),
        discharge_date: fmt_ts(row.discharged_at),
        department: row.department,
        doctor_name: row.doctor_name,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        discharge_type: row.discharge_type,
        discharge_summary: row.discharge_summary,
        diagnosis: row.diagnosis,
        signatures: sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── Token Slip ──────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TokenSlipRow {
    token_number: String,
    created_at: chrono::DateTime<Utc>,
    patient_name: Option<String>,
    uhid: Option<String>,
    department_name: String,
    doctor_name: Option<String>,
    room_number: Option<String>,
    priority: String,
}

pub async fn get_token_slip_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(token_id): Path<Uuid>,
) -> Result<Json<TokenSlipPrintData>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TokenSlipRow>(
        "SELECT \
           qt.token_number, \
           qt.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           dept.name AS department_name, \
           doc.full_name AS doctor_name, \
           td.room_number, \
           qt.priority::text AS priority \
         FROM queue_tokens qt \
         LEFT JOIN patients p ON p.id = qt.patient_id AND p.tenant_id = qt.tenant_id \
         LEFT JOIN departments dept ON dept.id = qt.department_id \
                                    AND dept.tenant_id = qt.tenant_id \
         LEFT JOIN users doc ON doc.id = qt.doctor_id \
         LEFT JOIN tv_displays td ON td.department_id = qt.department_id \
                                  AND td.tenant_id = qt.tenant_id \
                                  AND td.is_active = true \
         WHERE qt.id = $1 AND qt.tenant_id = $2",
    )
    .bind(token_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Generate QR code data (token ID for verification)
    let qr_data = format!("MBTOKEN:{token_id}");

    Ok(Json(TokenSlipPrintData {
        token_number: row.token_number,
        token_date: row.created_at.format("%d-%b-%Y").to_string(),
        token_time: row.created_at.format("%H:%M").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        department_name: row.department_name,
        doctor_name: row.doctor_name,
        room_number: row.room_number,
        estimated_wait_minutes: None, // Can be calculated from queue position
        priority: row.priority,
        qr_code_data: qr_data,
        instructions: "Please wait for your token to be called. Listen for announcements or watch the display screen.".to_string(),
    }))
}

// ── Visitor Pass ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct VisitorPassRow {
    pass_number: String,
    visitor_name: String,
    visitor_phone: String,
    visitor_id_type: Option<String>,
    visitor_id_number: Option<String>,
    patient_name: String,
    patient_uhid: String,
    ward_name: Option<String>,
    bed_number: Option<String>,
    relation: Option<String>,
    valid_from: chrono::DateTime<Utc>,
    valid_until: chrono::DateTime<Utc>,
    created_at: chrono::DateTime<Utc>,
    issued_by_name: Option<String>,
}

pub async fn get_visitor_pass_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pass_id): Path<Uuid>,
) -> Result<Json<VisitorPassPrintData>, AppError> {
    require_permission(&claims, permissions::front_office::passes::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, VisitorPassRow>(
        "SELECT \
           vp.pass_number, \
           vp.visitor_name, \
           vp.visitor_phone, \
           vp.visitor_id_type, \
           vp.visitor_id_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid AS patient_uhid, \
           w.name AS ward_name, \
           l.name AS bed_number, \
           vp.relation, \
           vp.valid_from, \
           vp.valid_until, \
           vp.created_at, \
           u.full_name AS issued_by_name \
         FROM visitor_passes vp \
         JOIN patients p ON p.id = vp.patient_id AND p.tenant_id = vp.tenant_id \
         LEFT JOIN admissions a ON a.patient_id = p.id \
                                AND a.tenant_id = vp.tenant_id \
                                AND a.discharged_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = vp.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = vp.tenant_id \
         LEFT JOIN users u ON u.id = vp.issued_by \
         WHERE vp.id = $1 AND vp.tenant_id = $2",
    )
    .bind(pass_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Generate QR code data (pass ID for verification)
    let qr_data = format!("MBVISITOR:{pass_id}");

    Ok(Json(VisitorPassPrintData {
        pass_number: row.pass_number,
        visitor_name: row.visitor_name,
        visitor_phone: row.visitor_phone,
        visitor_id_type: row.visitor_id_type,
        visitor_id_number: row.visitor_id_number,
        patient_name: row.patient_name,
        patient_uhid: row.patient_uhid,
        patient_ward: row.ward_name,
        patient_bed: row.bed_number,
        relation: row.relation,
        valid_from: row.valid_from.format("%d-%b-%Y %H:%M").to_string(),
        valid_until: row.valid_until.format("%d-%b-%Y %H:%M").to_string(),
        issued_at: row.created_at.format("%d-%b-%Y %H:%M").to_string(),
        issued_by: row.issued_by_name,
        photo_url: None,
        qr_code_data: qr_data,
    }))
}

// ── Treatment Chart ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TreatmentChartRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: chrono::DateTime<Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    diagnosis: Option<String>,
    treating_doctor: Option<String>,
}

pub async fn get_treatment_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<TreatmentChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TreatmentChartRow>(
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

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get active medications
    let medications: Vec<TreatmentChartMedication> = sqlx::query_as(
        "SELECT \
           pi.drug_name, \
           pi.dosage AS dose, \
           pi.route, \
           pi.frequency, \
           COALESCE(pi.time_slots, ARRAY['08:00', '14:00', '20:00']) AS time_slots, \
           pr.created_at::date::text AS start_date, \
           pi.end_date::text AS end_date, \
           pi.instructions AS special_instructions \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id AND pr.tenant_id = pi.tenant_id \
         WHERE pr.admission_id = $1 AND pr.tenant_id = $2 \
           AND pi.status = 'active' \
         ORDER BY pi.created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get IV fluids
    let iv_fluids: Vec<TreatmentChartIvFluid> = sqlx::query_as(
        "SELECT \
           fluid_name, \
           volume_ml, \
           rate, \
           COALESCE(additives, '{}') AS additives, \
           start_time::text AS start_time, \
           duration_hours \
         FROM iv_fluid_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND status = 'active' \
         ORDER BY created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get stat orders
    let stat_orders: Vec<StatOrder> = sqlx::query_as(
        "SELECT \
           order_type, \
           description, \
           created_at::text AS ordered_at, \
           u.full_name AS ordered_by \
         FROM stat_orders so \
         LEFT JOIN users u ON u.id = so.ordered_by \
         WHERE so.admission_id = $1 AND so.tenant_id = $2 \
           AND so.created_at::date = CURRENT_DATE \
         ORDER BY so.created_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let chart_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(TreatmentChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        diagnosis: row.diagnosis,
        allergies,
        chart_date: Utc::now().format("%d-%b-%Y").to_string(),
        medications,
        iv_fluids,
        stat_orders,
        treating_doctor: row.treating_doctor,
        signatures: super::signed_documents::to_print_signatures(chart_sigs),
    }))
}

// ── Transfer Summary ───────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransferSummaryRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    transfer_date: chrono::DateTime<Utc>,
    from_ward: String,
    from_bed: Option<String>,
    to_ward: String,
    to_bed: Option<String>,
    transfer_reason: String,
    diagnosis: Option<String>,
    current_condition: String,
    vital_signs: Option<String>,
    handover_notes: Option<String>,
    transferring_doctor: Option<String>,
    receiving_doctor: Option<String>,
    transferring_nurse: Option<String>,
    receiving_nurse: Option<String>,
}

pub async fn get_transfer_summary_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfer_id): Path<Uuid>,
) -> Result<Json<TransferSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TransferSummaryRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth)) AS age, \
           p.gender::text AS gender, \
           pt.transferred_at AS transfer_date, \
           fw.name AS from_ward, \
           fb.bed_number AS from_bed, \
           tw.name AS to_ward, \
           tb.bed_number AS to_bed, \
           pt.transfer_reason, \
           a.primary_diagnosis AS diagnosis, \
           pt.patient_condition AS current_condition, \
           pt.vital_signs::text AS vital_signs, \
           pt.handover_notes, \
           td.full_name AS transferring_doctor, \
           rd.full_name AS receiving_doctor, \
           tn.full_name AS transferring_nurse, \
           rn.full_name AS receiving_nurse \
         FROM patient_transfers pt \
         JOIN admissions a ON a.id = pt.admission_id AND a.tenant_id = pt.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         JOIN wards fw ON fw.id = pt.from_ward_id AND fw.tenant_id = pt.tenant_id \
         JOIN wards tw ON tw.id = pt.to_ward_id AND tw.tenant_id = pt.tenant_id \
         LEFT JOIN beds fb ON fb.id = pt.from_bed_id AND fb.tenant_id = pt.tenant_id \
         LEFT JOIN beds tb ON tb.id = pt.to_bed_id AND tb.tenant_id = pt.tenant_id \
         LEFT JOIN users td ON td.id = pt.transferring_doctor_id \
         LEFT JOIN users rd ON rd.id = pt.receiving_doctor_id \
         LEFT JOIN users tn ON tn.id = pt.transferring_nurse_id \
         LEFT JOIN users rn ON rn.id = pt.receiving_nurse_id \
         WHERE pt.id = $1 AND pt.tenant_id = $2",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get current medications
    let medications: Vec<String> = sqlx::query_scalar(
        "SELECT pi.drug_name || ' ' || pi.dosage || ' ' || pi.frequency \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id AND pr.tenant_id = pi.tenant_id \
         WHERE pr.admission_id = (SELECT admission_id FROM patient_transfers WHERE id = $1) \
           AND pr.tenant_id = $2 AND pi.status = 'active'",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get pending investigations
    let pending_investigations: Vec<String> = sqlx::query_scalar(
        "SELECT tc.name FROM lab_orders lo \
         JOIN lab_test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
         WHERE lo.admission_id = (SELECT admission_id FROM patient_transfers WHERE id = $1) \
           AND lo.tenant_id = $2 AND lo.status IN ('ordered', 'collected')",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get pending consultations
    let pending_consultations: Vec<String> = sqlx::query_scalar(
        "SELECT d.name || ' - ' || COALESCE(u.full_name, 'Pending') \
         FROM consultation_requests cr \
         JOIN departments d ON d.id = cr.to_department_id AND d.tenant_id = cr.tenant_id \
         LEFT JOIN users u ON u.id = cr.consultant_id \
         WHERE cr.admission_id = (SELECT admission_id FROM patient_transfers WHERE id = $1) \
           AND cr.tenant_id = $2 AND cr.status = 'pending'",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get special precautions
    let special_precautions: Vec<String> = sqlx::query_scalar(
        "SELECT precaution_type FROM patient_precautions \
         WHERE admission_id = (SELECT admission_id FROM patient_transfers WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let transfer_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "discharge_summary",
        transfer_id,
    )
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(TransferSummaryPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        transfer_date: row.transfer_date.format("%d-%b-%Y").to_string(),
        transfer_time: row.transfer_date.format("%H:%M").to_string(),
        from_ward: row.from_ward,
        from_bed: row.from_bed,
        to_ward: row.to_ward,
        to_bed: row.to_bed,
        transfer_reason: row.transfer_reason,
        diagnosis: row.diagnosis,
        current_condition: row.current_condition,
        vital_signs: row.vital_signs,
        current_medications: medications,
        pending_investigations,
        pending_consultations,
        special_precautions,
        handover_notes: row.handover_notes,
        transferring_doctor: row.transferring_doctor,
        receiving_doctor: row.receiving_doctor,
        transferring_nurse: row.transferring_nurse,
        receiving_nurse: row.receiving_nurse,
        signatures: super::signed_documents::to_print_signatures(transfer_sigs),
    }))
}

// ── Patient Education Material ─────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PatientEducationRow {
    patient_name: String,
    uhid: String,
    material_title: String,
    material_code: String,
    category: String,
    language: String,
    provided_date: chrono::DateTime<Utc>,
    provided_by: Option<String>,
}

pub async fn get_patient_education_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(material_id): Path<Uuid>,
) -> Result<Json<PatientEducationPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PatientEducationRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           em.title AS material_title, \
           em.code AS material_code, \
           em.category, \
           COALESCE(pe.language, 'en') AS language, \
           pe.provided_at AS provided_date, \
           u.full_name AS provided_by \
         FROM patient_education pe \
         JOIN patients p ON p.id = pe.patient_id AND p.tenant_id = pe.tenant_id \
         JOIN education_materials em ON em.id = pe.material_id AND em.tenant_id = pe.tenant_id \
         LEFT JOIN users u ON u.id = pe.provided_by \
         WHERE pe.id = $1 AND pe.tenant_id = $2",
    )
    .bind(material_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get content sections
    let sections: Vec<EducationSection> = sqlx::query_as(
        "SELECT heading, content, COALESCE(bullet_points, '{}') AS bullet_points \
         FROM education_material_sections \
         WHERE material_id = (SELECT material_id FROM patient_education WHERE id = $1) \
           AND tenant_id = $2 \
         ORDER BY sort_order",
    )
    .bind(material_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get hospital name
    let h_name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

    tx.commit().await?;

    Ok(Json(PatientEducationPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        material_title: row.material_title,
        material_code: row.material_code,
        category: row.category,
        content_sections: sections,
        language: row.language,
        provided_date: row.provided_date.format("%d-%b-%Y").to_string(),
        provided_by: row.provided_by,
        hospital_name: h_name,
    }))
}

// ── Registration Card (Enhanced) ───────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RegistrationCardRow {
    patient_name: String,
    uhid: String,
    date_of_birth: Option<chrono::NaiveDate>,
    age: Option<f64>,
    gender: String,
    blood_group: Option<String>,
    phone: String,
    email: Option<String>,
    address: Option<String>,
    emergency_contact_name: Option<String>,
    emergency_contact_phone: Option<String>,
    photo_url: Option<String>,
    created_at: chrono::DateTime<Utc>,
}

pub async fn get_registration_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<RegistrationCardPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, RegistrationCardRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           date_of_birth, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           blood_group::text AS blood_group, \
           phone, \
           email, \
           COALESCE((address->>'line1') || ', ' || (address->>'city'), NULL) AS address, \
           emergency_contact_name, \
           emergency_contact_phone, \
           photo_url, \
           created_at \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = true \
         ORDER BY severity DESC",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get hospital name
    let h_name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

    tx.commit().await?;

    // Generate QR code data
    let qr_data = format!("MBPATIENT:{patient_id}");

    Ok(Json(RegistrationCardPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        age: row.age.map(|a| format!("{} Y", a as i32)),
        gender: row.gender,
        blood_group: row.blood_group,
        phone: row.phone,
        email: row.email,
        address: row.address,
        emergency_contact_name: row.emergency_contact_name,
        emergency_contact_phone: row.emergency_contact_phone,
        allergies,
        photo_url: row.photo_url,
        qr_code_data: qr_data,
        registration_date: row.created_at.format("%d-%b-%Y").to_string(),
        hospital_name: h_name,
    }))
}

// ── Infant Wristband (NICU) ────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct InfantWristbandRow {
    mother_name: String,
    mother_uhid: String,
    baby_id: String,
    baby_gender: String,
    date_of_birth: chrono::NaiveDate,
    time_of_birth: chrono::NaiveTime,
    birth_weight_grams: i32,
    delivery_type: String,
    ward_name: Option<String>,
    bed_number: Option<String>,
    attending_doctor: Option<String>,
}

pub async fn get_infant_wristband_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(newborn_id): Path<Uuid>,
) -> Result<Json<InfantWristbandPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, InfantWristbandRow>(
        "SELECT \
           (m.first_name || ' ' || m.last_name) AS mother_name, \
           m.uhid AS mother_uhid, \
           nb.baby_id, \
           nb.gender AS baby_gender, \
           nb.date_of_birth, \
           nb.time_of_birth, \
           nb.birth_weight_grams, \
           nb.delivery_type, \
           w.name AS ward_name, \
           b.bed_number, \
           doc.full_name AS attending_doctor \
         FROM newborn_records nb \
         JOIN patients m ON m.id = nb.mother_id AND m.tenant_id = nb.tenant_id \
         LEFT JOIN admissions a ON a.id = nb.mother_admission_id AND a.tenant_id = nb.tenant_id \
         LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = nb.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = nb.tenant_id \
         LEFT JOIN users doc ON doc.id = nb.attending_doctor_id \
         WHERE nb.id = $1 AND nb.tenant_id = $2",
    )
    .bind(newborn_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Generate barcode data for infant tracking
    let barcode_data = format!("MBNB:{}", row.baby_id);

    Ok(Json(InfantWristbandPrintData {
        mother_name: row.mother_name,
        mother_uhid: row.mother_uhid,
        baby_id: row.baby_id,
        baby_gender: row.baby_gender,
        date_of_birth: row.date_of_birth.format("%d-%b-%Y").to_string(),
        time_of_birth: row.time_of_birth.format("%H:%M").to_string(),
        birth_weight_grams: row.birth_weight_grams,
        delivery_type: row.delivery_type,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        attending_doctor: row.attending_doctor,
        barcode_data,
        rfid_tag: None,
    }))
}

// ══════════════════════════════════════════════════════════
// Phase 4: Clinical Delivery Prints
// ══════════════════════════════════════════════════════════

// ── OPD Prescription ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OpdPrescriptionRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    phone: Option<String>,
    address: Option<String>,
    encounter_date: chrono::DateTime<Utc>,
    encounter_number: Option<String>,
    department_name: Option<String>,
    doctor_name: String,
    doctor_reg_number: Option<String>,
    doctor_qualification: Option<String>,
    chief_complaints: Option<String>,
    examination_findings: Option<String>,
    diagnosis: Option<String>,
    advice: Option<String>,
    follow_up_date: Option<chrono::NaiveDate>,
    follow_up_instructions: Option<String>,
    referral_notes: Option<String>,
    bp_systolic: Option<i32>,
    bp_diastolic: Option<i32>,
    pulse: Option<i32>,
    temperature: Option<f64>,
    spo2: Option<i32>,
    respiratory_rate: Option<i32>,
    height_cm: Option<f64>,
    weight_kg: Option<f64>,
}

#[derive(Debug, sqlx::FromRow)]
struct PrescriptionMedicationRow {
    drug_name: String,
    generic_name: Option<String>,
    dose: String,
    route: String,
    frequency: String,
    duration: String,
    quantity: Option<i32>,
    instructions: Option<String>,
    is_controlled: bool,
    schedule: Option<String>,
}

pub async fn get_opd_prescription_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<OpdPrescriptionPrintData>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, OpdPrescriptionRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.phone, \
           p.address_line1 AS address, \
           e.encounter_date, \
           e.encounter_number, \
           d.name AS department_name, \
           doc.full_name AS doctor_name, \
           doc.registration_number AS doctor_reg_number, \
           doc.qualification AS doctor_qualification, \
           e.chief_complaints, \
           e.examination_findings, \
           e.diagnosis, \
           e.advice, \
           e.follow_up_date, \
           e.follow_up_instructions, \
           e.referral_notes, \
           v.bp_systolic, \
           v.bp_diastolic, \
           v.pulse, \
           v.temperature, \
           v.spo2, \
           v.respiratory_rate, \
           v.height_cm, \
           v.weight_kg \
         FROM encounters e \
         JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN users doc ON doc.id = e.doctor_id \
         LEFT JOIN vitals v ON v.encounter_id = e.id AND v.tenant_id = e.tenant_id \
         WHERE e.id = $1 AND e.tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let medications = sqlx::query_as::<_, PrescriptionMedicationRow>(
        "SELECT \
           COALESCE(dc.brand_name, pm.drug_name) AS drug_name, \
           dc.generic_name, \
           pm.dose, \
           pm.route, \
           pm.frequency, \
           pm.duration, \
           pm.quantity, \
           pm.instructions, \
           COALESCE(dc.is_controlled, false) AS is_controlled, \
           dc.schedule::text AS schedule \
         FROM prescription_medications pm \
         LEFT JOIN drug_catalog dc ON dc.id = pm.drug_catalog_id AND dc.tenant_id = pm.tenant_id \
         WHERE pm.encounter_id = $1 AND pm.tenant_id = $2 \
         ORDER BY pm.created_at",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let icd_codes: Vec<String> = sqlx::query_scalar(
        "SELECT icd_code FROM encounter_diagnoses \
         WHERE encounter_id = $1 AND tenant_id = $2 AND icd_code IS NOT NULL \
         ORDER BY is_primary DESC",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1, phone FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "prescription",
        encounter_id,
    )
    .await?;
    let preview_signature_url: Option<String> =
        sigs.iter().find_map(|s| s.display_image_url.clone());

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let bmi = match (row.height_cm, row.weight_kg) {
        (Some(h), Some(w)) if h > 0.0 => Some((w / (h / 100.0).powi(2) * 10.0).round() / 10.0),
        _ => None,
    };

    Ok(Json(OpdPrescriptionPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        phone: row.phone,
        address: row.address,
        encounter_date: row.encounter_date.format("%d-%b-%Y %H:%M").to_string(),
        encounter_number: row.encounter_number,
        department: row.department_name,
        doctor_name: row.doctor_name,
        doctor_registration_number: row.doctor_reg_number,
        doctor_qualification: row.doctor_qualification,
        chief_complaints: row.chief_complaints,
        examination_findings: row.examination_findings,
        diagnosis: row.diagnosis,
        icd_codes,
        medications: medications
            .into_iter()
            .map(|m| PrescriptionMedication {
                drug_name: m.drug_name,
                generic_name: m.generic_name,
                dose: m.dose,
                route: m.route,
                frequency: m.frequency,
                duration: m.duration,
                quantity: m.quantity,
                instructions: m.instructions,
                is_controlled: m.is_controlled,
                schedule: m.schedule,
            })
            .collect(),
        advice: row.advice,
        follow_up_date: row.follow_up_date.map(|d| d.format("%d-%b-%Y").to_string()),
        follow_up_instructions: row.follow_up_instructions,
        referral_notes: row.referral_notes,
        vitals: Some(OpdVitals {
            bp_systolic: row.bp_systolic,
            bp_diastolic: row.bp_diastolic,
            pulse: row.pulse,
            temperature: row.temperature,
            spo2: row.spo2,
            respiratory_rate: row.respiratory_rate,
            height_cm: row.height_cm,
            weight_kg: row.weight_kg,
            bmi,
        }),
        doctor_signature_url: preview_signature_url,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        hospital_address: tenant.2,
        hospital_phone: tenant.3,
        signatures: sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── Full Lab Report (NABL Compliant) ────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct LabReportFullRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    sample_id: String,
    accession_number: String,
    order_date: chrono::DateTime<Utc>,
    collection_date: Option<chrono::DateTime<Utc>>,
    report_date: chrono::DateTime<Utc>,
    referring_doctor: Option<String>,
    department_name: Option<String>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    test_name: String,
    test_code: Option<String>,
    loinc_code: Option<String>,
    specimen_type: Option<String>,
    interpretation: Option<String>,
    comments: Option<String>,
    pathologist_name: Option<String>,
    pathologist_reg_number: Option<String>,
    technician_name: Option<String>,
    verified_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
struct LabParameterRow {
    parameter_name: String,
    result_value: String,
    unit: Option<String>,
    reference_range: Option<String>,
    is_abnormal: bool,
    is_critical: bool,
    critical_flag: Option<String>,
    method: Option<String>,
}

pub async fn get_lab_report_full_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabReportFullPrintData>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, LabReportFullRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           lo.sample_id, \
           lo.accession_number, \
           lo.order_date, \
           lo.collection_date, \
           lo.report_date, \
           doc.full_name AS referring_doctor, \
           d.name AS department_name, \
           w.name AS ward_name, \
           b.bed_number, \
           tc.name AS test_name, \
           tc.code AS test_code, \
           tc.loinc_code, \
           tc.specimen_type, \
           lo.interpretation, \
           lo.comments, \
           path.full_name AS pathologist_name, \
           path.registration_number AS pathologist_reg_number, \
           tech.full_name AS technician_name, \
           lo.verified_at \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         JOIN test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
         LEFT JOIN users doc ON doc.id = lo.ordering_doctor_id \
         LEFT JOIN departments d ON d.id = lo.department_id AND d.tenant_id = lo.tenant_id \
         LEFT JOIN admissions a ON a.patient_id = lo.patient_id AND a.status = 'admitted' AND a.tenant_id = lo.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = lo.tenant_id \
         LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = lo.tenant_id \
         LEFT JOIN users path ON path.id = lo.verified_by_id \
         LEFT JOIN users tech ON tech.id = lo.performed_by_id \
         WHERE lo.id = $1 AND lo.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let parameters = sqlx::query_as::<_, LabParameterRow>(
        "SELECT \
           lr.parameter_name, \
           lr.result_value, \
           lr.unit, \
           lr.reference_range, \
           lr.is_abnormal, \
           lr.is_critical, \
           lr.critical_flag, \
           lr.method \
         FROM lab_results lr \
         WHERE lr.order_id = $1 AND lr.tenant_id = $2 \
         ORDER BY lr.display_order, lr.parameter_name",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<bool>, Option<String>)>(
        "SELECT name, logo_url, nabl_accredited, nabl_certificate_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let lab_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "lab_report",
        order_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let barcode_data = format!("LAB:{}", row.accession_number);

    Ok(Json(LabReportFullPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        sample_id: row.sample_id,
        accession_number: row.accession_number,
        order_date: row.order_date.format("%d-%b-%Y").to_string(),
        collection_date: row
            .collection_date
            .map(|d| d.format("%d-%b-%Y %H:%M").to_string()),
        report_date: row.report_date.format("%d-%b-%Y %H:%M").to_string(),
        referring_doctor: row.referring_doctor,
        department: row.department_name,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        test_name: row.test_name,
        test_code: row.test_code,
        loinc_code: row.loinc_code,
        specimen_type: row.specimen_type,
        parameters: parameters
            .into_iter()
            .map(|p| LabParameter {
                parameter_name: p.parameter_name,
                result_value: p.result_value,
                unit: p.unit,
                reference_range: p.reference_range,
                is_abnormal: p.is_abnormal,
                is_critical: p.is_critical,
                critical_flag: p.critical_flag,
                method: p.method,
            })
            .collect(),
        interpretation: row.interpretation,
        comments: row.comments,
        pathologist_name: row.pathologist_name.unwrap_or_default(),
        pathologist_registration_number: row.pathologist_reg_number,
        pathologist_signature_url: None,
        technician_name: row.technician_name,
        verified_at: row
            .verified_at
            .map(|d| d.format("%d-%b-%Y %H:%M").to_string()),
        nabl_accredited: tenant.2.unwrap_or(false),
        nabl_certificate_number: tenant.3,
        nabl_logo_url: None,
        barcode_data,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: lab_sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── Cumulative Lab Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CumulativeLabRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
}

#[derive(Debug, sqlx::FromRow)]
struct CumulativeTrendRow {
    parameter_name: String,
    unit: Option<String>,
    reference_range: Option<String>,
    result_date: chrono::DateTime<Utc>,
    result_value: String,
    is_abnormal: bool,
}

pub async fn get_cumulative_lab_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<CumulativeLabReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let patient = sqlx::query_as::<_, CumulativeLabRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender \
         FROM patients p \
         WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get all lab results for the patient in the last 6 months
    let trends = sqlx::query_as::<_, CumulativeTrendRow>(
        "SELECT \
           lr.parameter_name, \
           lr.unit, \
           lr.reference_range, \
           lo.report_date AS result_date, \
           lr.result_value, \
           lr.is_abnormal \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = $1 AND lo.tenant_id = $2 \
           AND lo.report_date >= NOW() - INTERVAL '6 months' \
           AND lo.status = 'verified' \
         ORDER BY lr.parameter_name, lo.report_date",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, NULL AS pathologist FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Group trends by parameter
    let mut parameter_map: std::collections::HashMap<String, Vec<CumulativeTrendRow>> =
        std::collections::HashMap::new();
    for trend in trends {
        parameter_map
            .entry(trend.parameter_name.clone())
            .or_default()
            .push(trend);
    }

    let parameter_trends: Vec<ParameterTrend> = parameter_map
        .into_iter()
        .map(|(name, rows)| {
            let unit = rows.first().and_then(|r| r.unit.clone());
            let reference_range = rows.first().and_then(|r| r.reference_range.clone());
            let values: Vec<TrendValue> = rows
                .into_iter()
                .map(|r| TrendValue {
                    date: r.result_date.format("%d-%b-%Y").to_string(),
                    value: r.result_value,
                    is_abnormal: r.is_abnormal,
                })
                .collect();
            ParameterTrend {
                parameter_name: name,
                unit,
                reference_range,
                values,
            }
        })
        .collect();

    let age_display = patient
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let now = Utc::now();
    let six_months_ago = now - chrono::Duration::days(180);

    Ok(Json(CumulativeLabReportPrintData {
        patient_name: patient.patient_name,
        uhid: patient.uhid,
        age_display,
        gender: patient.gender,
        report_date: now.format("%d-%b-%Y").to_string(),
        date_range_start: six_months_ago.format("%d-%b-%Y").to_string(),
        date_range_end: now.format("%d-%b-%Y").to_string(),
        test_name: "Cumulative Report".to_string(),
        parameter_trends,
        pathologist_name: String::new(),
        pathologist_registration_number: None,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: Vec::new(), // cumulative trend report — not signed per-record
    }))
}

// ── Full Radiology Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RadiologyReportFullRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    accession_number: String,
    order_date: chrono::DateTime<Utc>,
    exam_date: chrono::DateTime<Utc>,
    report_date: chrono::DateTime<Utc>,
    referring_doctor: Option<String>,
    department_name: Option<String>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    modality: String,
    exam_name: String,
    exam_code: Option<String>,
    body_part: Option<String>,
    laterality: Option<String>,
    clinical_history: Option<String>,
    contrast_used: bool,
    contrast_details: Option<String>,
    technique: Option<String>,
    findings: String,
    impression: String,
    recommendations: Option<String>,
    radiologist_name: Option<String>,
    radiologist_reg_number: Option<String>,
    technologist_name: Option<String>,
    verified_at: Option<chrono::DateTime<Utc>>,
    pacs_study_uid: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct KeyImageRow {
    image_url: String,
    series_description: Option<String>,
    annotation: Option<String>,
}

pub async fn get_radiology_report_full_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<RadiologyReportFullPrintData>, AppError> {
    require_permission(&claims, permissions::radiology::reports::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, RadiologyReportFullRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           ro.accession_number, \
           ro.order_date, \
           ro.exam_date, \
           ro.report_date, \
           doc.full_name AS referring_doctor, \
           d.name AS department_name, \
           w.name AS ward_name, \
           b.bed_number, \
           ro.modality, \
           ec.name AS exam_name, \
           ec.code AS exam_code, \
           ec.body_part, \
           ro.laterality, \
           ro.clinical_history, \
           ro.contrast_used, \
           ro.contrast_details, \
           ro.technique, \
           ro.findings, \
           ro.impression, \
           ro.recommendations, \
           rad.full_name AS radiologist_name, \
           rad.registration_number AS radiologist_reg_number, \
           tech.full_name AS technologist_name, \
           ro.verified_at, \
           ro.pacs_study_uid \
         FROM radiology_orders ro \
         JOIN patients p ON p.id = ro.patient_id AND p.tenant_id = ro.tenant_id \
         JOIN exam_catalog ec ON ec.id = ro.exam_id AND ec.tenant_id = ro.tenant_id \
         LEFT JOIN users doc ON doc.id = ro.ordering_doctor_id \
         LEFT JOIN departments d ON d.id = ro.department_id AND d.tenant_id = ro.tenant_id \
         LEFT JOIN admissions a ON a.patient_id = ro.patient_id AND a.status = 'admitted' AND a.tenant_id = ro.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = ro.tenant_id \
         LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = ro.tenant_id \
         LEFT JOIN users rad ON rad.id = ro.reported_by_id \
         LEFT JOIN users tech ON tech.id = ro.performed_by_id \
         WHERE ro.id = $1 AND ro.tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let key_images = sqlx::query_as::<_, KeyImageRow>(
        "SELECT image_url, series_description, annotation \
         FROM radiology_key_images \
         WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY display_order",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let tenant = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let rad_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "radiology_report",
        order_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));

    Ok(Json(RadiologyReportFullPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        accession_number: row.accession_number,
        order_date: row.order_date.format("%d-%b-%Y").to_string(),
        exam_date: row.exam_date.format("%d-%b-%Y %H:%M").to_string(),
        report_date: row.report_date.format("%d-%b-%Y %H:%M").to_string(),
        referring_doctor: row.referring_doctor,
        department: row.department_name,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        modality: row.modality,
        exam_name: row.exam_name,
        exam_code: row.exam_code,
        body_part: row.body_part,
        laterality: row.laterality,
        clinical_history: row.clinical_history,
        contrast_used: row.contrast_used,
        contrast_details: row.contrast_details,
        technique: row.technique,
        findings: row.findings,
        impression: row.impression,
        recommendations: row.recommendations,
        key_images: key_images
            .into_iter()
            .map(|i| KeyImage {
                image_url: i.image_url,
                series_description: i.series_description,
                annotation: i.annotation,
            })
            .collect(),
        radiologist_name: row.radiologist_name.unwrap_or_default(),
        radiologist_registration_number: row.radiologist_reg_number,
        radiologist_signature_url: None,
        technologist_name: row.technologist_name,
        verified_at: row
            .verified_at
            .map(|d| d.format("%d-%b-%Y %H:%M").to_string()),
        pacs_study_uid: row.pacs_study_uid,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: rad_sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── Death Certificate (Form 4/4A) ────────────────────────────

#[derive(Debug, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
struct DeathCertRow {
    certificate_number: Option<String>,
    registration_number: Option<String>,
    registration_date: Option<chrono::NaiveDate>,
    deceased_name: String,
    uhid: Option<String>,
    age_at_death: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    father_name: Option<String>,
    mother_name: Option<String>,
    spouse_name: Option<String>,
    permanent_address: Option<String>,
    place_of_death: Option<String>,
    date_of_death: chrono::NaiveDate,
    time_of_death: chrono::NaiveTime,
    manner_of_death: Option<String>,
    cause_immediate: Option<String>,
    cause_antecedent: Option<String>,
    cause_underlying: Option<String>,
    duration_of_illness: Option<String>,
    icd_code_immediate: Option<String>,
    icd_code_underlying: Option<String>,
    attended_by_doctor: bool,
    attending_doctor_name: Option<String>,
    doctor_registration_number: Option<String>,
    hospital_admission_date: Option<chrono::NaiveDate>,
    pregnancy_status: Option<String>,
    pregnancy_contributed: Option<bool>,
    mlc_case: bool,
    mlc_number: Option<String>,
    autopsy_performed: bool,
    autopsy_findings: Option<String>,
    informant_name: Option<String>,
    informant_relationship: Option<String>,
    informant_address: Option<String>,
    certifying_doctor_name: Option<String>,
    certifying_doctor_registration: Option<String>,
    certification_date: chrono::NaiveDate,
}

pub async fn get_death_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<DeathCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, DeathCertRow>(
        "SELECT \
           dr.certificate_number, \
           dr.registration_number, \
           dr.registration_date, \
           (p.first_name || ' ' || p.last_name) AS deceased_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(dr.date_of_death, p.date_of_birth))::float8 AS age_at_death, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.father_name, \
           p.mother_name, \
           p.spouse_name, \
           p.address_line1 AS permanent_address, \
           dr.place_of_death, \
           dr.date_of_death, \
           dr.time_of_death, \
           dr.manner_of_death, \
           dr.cause_immediate, \
           dr.cause_antecedent, \
           dr.cause_underlying, \
           dr.duration_of_illness, \
           dr.icd_code_immediate, \
           dr.icd_code_underlying, \
           dr.attended_by_doctor, \
           doc.full_name AS attending_doctor_name, \
           doc.registration_number AS doctor_registration_number, \
           a.admitted_at::date AS hospital_admission_date, \
           dr.pregnancy_status, \
           dr.pregnancy_contributed, \
           dr.mlc_case, \
           dr.mlc_number, \
           dr.autopsy_performed, \
           dr.autopsy_findings, \
           dr.informant_name, \
           dr.informant_relationship, \
           dr.informant_address, \
           cert.full_name AS certifying_doctor_name, \
           cert.registration_number AS certifying_doctor_registration, \
           dr.certification_date \
         FROM death_records dr \
         JOIN patients p ON p.id = dr.patient_id AND p.tenant_id = dr.tenant_id \
         LEFT JOIN admissions a ON a.patient_id = dr.patient_id AND a.tenant_id = dr.tenant_id \
         LEFT JOIN users doc ON doc.id = dr.attending_doctor_id \
         LEFT JOIN users cert ON cert.id = dr.certified_by_id \
         WHERE dr.patient_id = $1 AND dr.tenant_id = $2 \
         ORDER BY dr.created_at DESC \
         LIMIT 1",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let other_conditions: Vec<String> = sqlx::query_scalar(
        "SELECT condition_description FROM death_other_conditions \
         WHERE death_record_id = (SELECT id FROM death_records WHERE patient_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1) \
           AND tenant_id = $2 \
         ORDER BY display_order",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1 FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let death_sigs = super::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "death_certificate",
        patient_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age_at_death
        .map_or("Unknown".to_string(), |a| format!("{a:.0} years"));

    Ok(Json(DeathCertificatePrintData {
        certificate_number: row
            .certificate_number
            .unwrap_or_else(|| "PENDING".to_string()),
        registration_number: row.registration_number,
        registration_date: row
            .registration_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        deceased_name: row.deceased_name,
        uhid: row.uhid,
        age_at_death: age_display,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        father_name: row.father_name,
        mother_name: row.mother_name,
        spouse_name: row.spouse_name,
        permanent_address: row.permanent_address,
        place_of_death: row.place_of_death.unwrap_or_else(|| tenant.0.clone()),
        date_of_death: row.date_of_death.format("%d-%b-%Y").to_string(),
        time_of_death: row.time_of_death.format("%H:%M").to_string(),
        manner_of_death: row.manner_of_death.unwrap_or_else(|| "Natural".to_string()),
        cause_of_death_immediate: row.cause_immediate.unwrap_or_default(),
        cause_of_death_antecedent: row.cause_antecedent,
        cause_of_death_underlying: row.cause_underlying,
        other_significant_conditions: other_conditions,
        duration_of_illness: row.duration_of_illness,
        icd_code_immediate: row.icd_code_immediate,
        icd_code_underlying: row.icd_code_underlying,
        attended_by_doctor: row.attended_by_doctor,
        attending_doctor_name: row.attending_doctor_name,
        doctor_registration_number: row.doctor_registration_number,
        hospital_admission_date: row
            .hospital_admission_date
            .map(|d| d.format("%d-%b-%Y").to_string()),
        pregnancy_status: row.pregnancy_status,
        pregnancy_contributed: row.pregnancy_contributed,
        mlc_case: row.mlc_case,
        mlc_number: row.mlc_number,
        autopsy_performed: row.autopsy_performed,
        autopsy_findings: row.autopsy_findings,
        informant_name: row.informant_name,
        informant_relationship: row.informant_relationship,
        informant_address: row.informant_address,
        certifying_doctor_name: row.certifying_doctor_name.unwrap_or_default(),
        certifying_doctor_registration: row.certifying_doctor_registration,
        certification_date: row.certification_date.format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_logo_url: tenant.1,
        signatures: death_sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: OT Register, Blood Bank, Identity/Clinical Forms
// ══════════════════════════════════════════════════════════════════════════════

use chrono::Utc;
use sqlx::PgPool;

use medbrains_core::print_data::{
    BloodDonorFormPrintData, CrossMatchRequisitionPrintData, DataCategory, DataSharingEntity,
    DonorMedicalHistory, DonorPhysicalExam, DpdpConsentPrintData, GrievanceOfficer,
    OtRegisterPrintData, OtSurgeryEntry, ProcessingPurpose, RestraintDocumentationPrintData,
    RestraintMonitoring, VideoConsentPrintData,
};

// ── Helper Functions (Phase 5) ────────────────────────────────────────────────

async fn get_tenant_info(
    pool: &PgPool,
) -> Result<(String, Option<String>, Option<String>), AppError> {
    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1 FROM tenants WHERE is_active = true LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .unwrap_or(("Hospital".to_string(), None, None));

    Ok(tenant)
}

// ── OT Register ───────────────────────────────────────────────────────────────

/// GET /print-data/ot-register/{ot_id}/{date}
pub async fn get_ot_register_print_data(
    State(state): State<AppState>,
    Path((ot_id, date)): Path<(Uuid, String)>,
) -> Result<Json<OtRegisterPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    let register_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());

    #[derive(sqlx::FromRow)]
    struct OtRow {
        ot_name: String,
        ot_number: String,
    }

    let ot = sqlx::query_as::<_, OtRow>(
        "SELECT name as ot_name, ot_number FROM operation_theatres WHERE id = $1",
    )
    .bind(ot_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(OtRow {
        ot_name: "Operation Theatre".to_string(),
        ot_number: "OT-1".to_string(),
    });

    #[derive(sqlx::FromRow)]
    struct SurgeryRow {
        patient_name: String,
        uhid: String,
        age: Option<f64>,
        gender: String,
        ip_number: Option<String>,
        diagnosis: Option<String>,
        procedure_name: String,
        surgery_type: String,
        surgeon_name: String,
        assistant_surgeon: Option<String>,
        anesthesiologist: Option<String>,
        anesthesia_type: Option<String>,
        scrub_nurse: Option<String>,
        circulating_nurse: Option<String>,
        scheduled_time: chrono::DateTime<Utc>,
        actual_start: Option<chrono::DateTime<Utc>>,
        actual_end: Option<chrono::DateTime<Utc>>,
        outcome: Option<String>,
        complications: Option<String>,
    }

    let surgeries_raw = sqlx::query_as::<_, SurgeryRow>(
        r"
        SELECT
            p.full_name as patient_name,
            p.uhid,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age,
            p.gender,
            a.ip_number,
            s.diagnosis,
            s.procedure_name,
            s.surgery_type,
            surgeon.full_name as surgeon_name,
            asst.full_name as assistant_surgeon,
            anesth.full_name as anesthesiologist,
            s.anesthesia_type,
            s.scrub_nurse,
            s.circulating_nurse,
            s.scheduled_time,
            s.actual_start_time as actual_start,
            s.actual_end_time as actual_end,
            s.outcome,
            s.complications
        FROM surgeries s
        JOIN patients p ON s.patient_id = p.id
        LEFT JOIN admissions a ON s.admission_id = a.id
        LEFT JOIN users surgeon ON s.surgeon_id = surgeon.id
        LEFT JOIN users asst ON s.assistant_surgeon_id = asst.id
        LEFT JOIN users anesth ON s.anesthesiologist_id = anesth.id
        WHERE s.ot_id = $1 AND DATE(s.scheduled_time) = $2
        ORDER BY s.scheduled_time
        ",
    )
    .bind(ot_id)
    .bind(register_date)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut elective = 0;
    let mut emergency = 0;

    let surgeries: Vec<OtSurgeryEntry> = surgeries_raw
        .into_iter()
        .enumerate()
        .map(|(idx, s)| {
            if s.surgery_type.to_lowercase().contains("emergency") {
                emergency += 1;
            } else {
                elective += 1;
            }

            let duration = match (s.actual_start, s.actual_end) {
                (Some(start), Some(end)) => Some((end - start).num_minutes() as i32),
                _ => None,
            };

            let age_gender = format!(
                "{}/{}",
                s.age.map(|a| format!("{a:.0}Y")).unwrap_or_default(),
                s.gender.chars().next().unwrap_or('?')
            );

            OtSurgeryEntry {
                serial_no: (idx + 1) as i32,
                patient_name: s.patient_name,
                uhid: s.uhid,
                age_gender,
                ip_number: s.ip_number,
                diagnosis: s.diagnosis.unwrap_or_default(),
                procedure: s.procedure_name,
                surgery_type: s.surgery_type,
                surgeon: s.surgeon_name,
                assistant_surgeon: s.assistant_surgeon,
                anesthesiologist: s.anesthesiologist.unwrap_or_else(|| "N/A".to_string()),
                anesthesia_type: s.anesthesia_type.unwrap_or_else(|| "GA".to_string()),
                scrub_nurse: s.scrub_nurse,
                circulating_nurse: s.circulating_nurse,
                scheduled_time: s.scheduled_time.format("%H:%M").to_string(),
                actual_start: s.actual_start.map(|t| t.format("%H:%M").to_string()),
                actual_end: s.actual_end.map(|t| t.format("%H:%M").to_string()),
                duration_minutes: duration,
                outcome: s.outcome,
                complications: s.complications,
            }
        })
        .collect();

    let total = surgeries.len() as i32;
    let tenant = get_tenant_info(pool).await?;

    Ok(Json(OtRegisterPrintData {
        register_date: register_date.format("%d-%m-%Y").to_string(),
        ot_name: ot.ot_name,
        ot_number: ot.ot_number,
        surgeries,
        total_surgeries: total,
        total_elective: elective,
        total_emergency: emergency,
        printed_by: "System".to_string(),
        hospital_name: tenant.0,
    }))
}

// ── Blood Bank Donor Registration ─────────────────────────────────────────────

/// GET /print-data/blood-donor-form/{donor_id}
pub async fn get_blood_donor_form_print_data(
    State(state): State<AppState>,
    Path(donor_id): Path<Uuid>,
) -> Result<Json<BloodDonorFormPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct DonorRow {
        registration_number: String,
        registration_date: chrono::DateTime<Utc>,
        donor_name: String,
        age: i32,
        gender: String,
        blood_group: String,
        rh_factor: String,
        father_husband_name: Option<String>,
        address: String,
        phone: String,
        email: Option<String>,
        id_proof_type: String,
        id_proof_number: String,
        occupation: Option<String>,
        donation_type: String,
        previous_donations: i32,
        last_donation_date: Option<chrono::NaiveDate>,
        weight_kg: Option<f64>,
        blood_pressure: Option<String>,
        pulse: Option<i32>,
        temperature: Option<f64>,
        hemoglobin: Option<f64>,
        fit_to_donate: bool,
        deferral_reason: Option<String>,
        consent_given: bool,
        consent_date: Option<chrono::NaiveDate>,
        medical_officer: Option<String>,
    }

    let donor = sqlx::query_as::<_, DonorRow>(
        r"
        SELECT
            d.registration_number,
            d.created_at as registration_date,
            d.donor_name,
            d.age,
            d.gender,
            d.blood_group,
            d.rh_factor,
            d.father_husband_name,
            d.address,
            d.phone,
            d.email,
            d.id_proof_type,
            d.id_proof_number,
            d.occupation,
            d.donation_type,
            d.previous_donations,
            d.last_donation_date,
            d.weight_kg,
            d.blood_pressure,
            d.pulse,
            d.temperature,
            d.hemoglobin,
            d.fit_to_donate,
            d.deferral_reason,
            d.consent_given,
            d.consent_date,
            mo.full_name as medical_officer
        FROM blood_donors d
        LEFT JOIN users mo ON d.medical_officer_id = mo.id
        WHERE d.id = $1
        ",
    )
    .bind(donor_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    Ok(Json(BloodDonorFormPrintData {
        registration_number: donor.registration_number,
        registration_date: donor.registration_date.format("%d-%m-%Y").to_string(),
        donor_name: donor.donor_name,
        age: donor.age,
        gender: donor.gender,
        blood_group: donor.blood_group,
        rh_factor: donor.rh_factor,
        father_husband_name: donor.father_husband_name,
        address: donor.address,
        phone: donor.phone,
        email: donor.email,
        id_proof_type: donor.id_proof_type,
        id_proof_number: donor.id_proof_number,
        occupation: donor.occupation,
        donation_type: donor.donation_type,
        previous_donations: donor.previous_donations,
        last_donation_date: donor
            .last_donation_date
            .map(|d| d.format("%d-%m-%Y").to_string()),
        medical_history: DonorMedicalHistory {
            recent_illness: false,
            recent_surgery: false,
            recent_transfusion: false,
            chronic_disease: false,
            on_medication: false,
            pregnant_or_lactating: false,
            high_risk_behavior: false,
            tattoo_recent: false,
            details: None,
        },
        physical_exam: DonorPhysicalExam {
            weight_kg: donor.weight_kg.unwrap_or(60.0),
            blood_pressure: donor.blood_pressure.unwrap_or_else(|| "120/80".to_string()),
            pulse: donor.pulse.unwrap_or(72),
            temperature: donor.temperature.unwrap_or(98.6),
            hemoglobin: donor.hemoglobin.unwrap_or(14.0),
            fit_to_donate: donor.fit_to_donate,
            deferral_reason: donor.deferral_reason,
        },
        consent_given: donor.consent_given,
        consent_date: donor.consent_date.map(|d| d.format("%d-%m-%Y").to_string()),
        medical_officer: donor.medical_officer,
        hospital_name: tenant.0,
    }))
}

// ── Blood Bank Cross-Match Requisition ────────────────────────────────────────

/// GET /print-data/cross-match-requisition/{requisition_id}
pub async fn get_cross_match_requisition_print_data(
    State(state): State<AppState>,
    Path(requisition_id): Path<Uuid>,
) -> Result<Json<CrossMatchRequisitionPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct ReqRow {
        requisition_number: String,
        requisition_date: chrono::DateTime<Utc>,
        urgency: String,
        patient_name: String,
        uhid: String,
        age: Option<f64>,
        gender: String,
        ip_number: Option<String>,
        ward_bed: String,
        blood_group: String,
        rh_factor: String,
        diagnosis: String,
        indication: String,
        units_required: i32,
        component_type: String,
        previous_transfusions: i32,
        reaction_history: bool,
        reaction_details: Option<String>,
        sample_collected_by: String,
        sample_collected_at: chrono::DateTime<Utc>,
        requesting_doctor: String,
        signature_date: chrono::DateTime<Utc>,
    }

    let req = sqlx::query_as::<_, ReqRow>(
        r"
        SELECT
            cr.requisition_number,
            cr.created_at as requisition_date,
            cr.urgency,
            p.full_name as patient_name,
            p.uhid,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age,
            p.gender,
            a.ip_number,
            COALESCE(cr.ward_bed, 'N/A') as ward_bed,
            p.blood_group,
            COALESCE(p.rh_factor, '+') as rh_factor,
            cr.diagnosis,
            cr.indication,
            cr.units_required,
            cr.component_type,
            COALESCE(cr.previous_transfusions, 0) as previous_transfusions,
            COALESCE(cr.transfusion_reaction_history, false) as reaction_history,
            cr.reaction_details,
            collector.full_name as sample_collected_by,
            cr.sample_collected_at,
            doctor.full_name as requesting_doctor,
            cr.created_at as signature_date
        FROM cross_match_requisitions cr
        JOIN patients p ON cr.patient_id = p.id
        LEFT JOIN admissions a ON cr.admission_id = a.id
        LEFT JOIN users collector ON cr.sample_collected_by = collector.id
        LEFT JOIN users doctor ON cr.requesting_doctor_id = doctor.id
        WHERE cr.id = $1
        ",
    )
    .bind(requisition_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    let age_gender = format!(
        "{}/{}",
        req.age.map(|a| format!("{a:.0}Y")).unwrap_or_default(),
        req.gender.chars().next().unwrap_or('?')
    );

    Ok(Json(CrossMatchRequisitionPrintData {
        requisition_number: req.requisition_number,
        requisition_date: req.requisition_date.format("%d-%m-%Y %H:%M").to_string(),
        urgency: req.urgency,
        patient_name: req.patient_name,
        uhid: req.uhid,
        age_gender,
        ip_number: req.ip_number,
        ward_bed: req.ward_bed,
        blood_group: req.blood_group,
        rh_factor: req.rh_factor,
        diagnosis: req.diagnosis,
        indication_for_transfusion: req.indication,
        units_required: req.units_required,
        component_type: req.component_type,
        previous_transfusions: req.previous_transfusions,
        transfusion_reactions_history: req.reaction_history,
        reaction_details: req.reaction_details,
        sample_collected_by: req.sample_collected_by,
        sample_collected_at: req.sample_collected_at.format("%d-%m-%Y %H:%M").to_string(),
        requesting_doctor: req.requesting_doctor,
        doctor_signature_date: req.signature_date.format("%d-%m-%Y").to_string(),
        hospital_name: tenant.0,
    }))
}

// ── Appointment Slip ──────────────────────────────────────────────────────────

/// GET /print-data/appointment-slip/{appointment_id}
pub async fn get_appointment_slip_print_data(
    State(state): State<AppState>,
    Path(appointment_id): Path<Uuid>,
) -> Result<Json<AppointmentSlipPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct ApptRow {
        appointment_number: String,
        appointment_date: chrono::NaiveDate,
        appointment_time: chrono::NaiveTime,
        patient_name: String,
        uhid: String,
        phone: Option<String>,
        doctor_name: String,
        doctor_designation: Option<String>,
        department_name: String,
        clinic_location: Option<String>,
        visit_type: String,
        preparation_instructions: Option<String>,
    }

    let appt = sqlx::query_as::<_, ApptRow>(
        r"
        SELECT
            a.appointment_number,
            a.appointment_date,
            a.appointment_time,
            p.full_name as patient_name,
            p.uhid,
            p.phone,
            d.full_name as doctor_name,
            des.name as doctor_designation,
            dept.name as department_name,
            l.name as clinic_location,
            a.visit_type,
            a.preparation_instructions
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        LEFT JOIN designations des ON d.designation_id = des.id
        LEFT JOIN departments dept ON a.department_id = dept.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.id = $1
        ",
    )
    .bind(appointment_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    Ok(Json(AppointmentSlipPrintData {
        appointment_number: appt.appointment_number,
        appointment_date: appt.appointment_date.format("%d-%m-%Y").to_string(),
        appointment_time: appt.appointment_time.format("%H:%M").to_string(),
        patient_name: appt.patient_name,
        uhid: appt.uhid,
        phone: appt.phone,
        doctor_name: appt.doctor_name,
        doctor_designation: appt.doctor_designation,
        department: appt.department_name,
        clinic_location: appt.clinic_location,
        visit_type: appt.visit_type,
        preparation_instructions: appt.preparation_instructions,
        documents_to_bring: vec![
            "Photo ID".to_string(),
            "Previous Reports".to_string(),
            "Insurance Card (if applicable)".to_string(),
        ],
        estimated_wait_time: Some("15-20 minutes".to_string()),
        contact_for_queries: Some("Reception: 1800-XXX-XXXX".to_string()),
        cancellation_policy: Some("Please cancel at least 24 hours in advance".to_string()),
        qr_code_data: Some(format!("APPT:{appointment_id}")),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_logo_url: tenant.1,
    }))
}

// ── DPDP Act Consent ──────────────────────────────────────────────────────────

/// GET /print-data/dpdp-consent/{consent_id}
pub async fn get_dpdp_consent_print_data(
    State(state): State<AppState>,
    Path(consent_id): Path<Uuid>,
) -> Result<Json<DpdpConsentPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct ConsentRow {
        consent_number: String,
        consent_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        guardian_name: Option<String>,
        retention_period: String,
        consent_given: bool,
        consent_method: String,
        witness_name: Option<String>,
    }

    let consent = sqlx::query_as::<_, ConsentRow>(
        r"
        SELECT
            c.consent_number,
            c.created_at as consent_date,
            p.full_name as patient_name,
            p.uhid,
            c.guardian_name,
            COALESCE(c.retention_period, '5 years or as per legal requirement') as retention_period,
            c.consent_given,
            COALESCE(c.consent_method, 'Physical') as consent_method,
            c.witness_name
        FROM dpdp_consents c
        JOIN patients p ON c.patient_id = p.id
        WHERE c.id = $1
        ",
    )
    .bind(consent_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    let data_categories = vec![
        DataCategory {
            category: "Personal Identifiers".to_string(),
            description: "Name, Address, Phone, Email, Aadhaar/ID".to_string(),
            is_sensitive: false,
        },
        DataCategory {
            category: "Health Data".to_string(),
            description: "Medical history, diagnoses, treatments, prescriptions".to_string(),
            is_sensitive: true,
        },
        DataCategory {
            category: "Financial Data".to_string(),
            description: "Billing, insurance, payment information".to_string(),
            is_sensitive: true,
        },
    ];

    let processing_purposes = vec![
        ProcessingPurpose {
            purpose: "Treatment and Care".to_string(),
            legal_basis: "Vital Interest / Consent".to_string(),
        },
        ProcessingPurpose {
            purpose: "Billing and Insurance Claims".to_string(),
            legal_basis: "Contractual Necessity".to_string(),
        },
        ProcessingPurpose {
            purpose: "Legal and Regulatory Compliance".to_string(),
            legal_basis: "Legal Obligation".to_string(),
        },
    ];

    let data_sharing = vec![
        DataSharingEntity {
            entity_type: "Insurance TPA".to_string(),
            entity_name: None,
            purpose: "Claim processing".to_string(),
        },
        DataSharingEntity {
            entity_type: "Government Authority".to_string(),
            entity_name: Some("MoHFW / ABDM".to_string()),
            purpose: "Public health reporting".to_string(),
        },
        DataSharingEntity {
            entity_type: "Lab / Diagnostic Partner".to_string(),
            entity_name: None,
            purpose: "Sample processing".to_string(),
        },
    ];

    let patient_rights = vec![
        "Right to Access: Request a copy of your personal data".to_string(),
        "Right to Correction: Request correction of inaccurate data".to_string(),
        "Right to Erasure: Request deletion of your data (subject to legal retention)".to_string(),
        "Right to Withdraw Consent: Withdraw consent at any time".to_string(),
        "Right to Grievance Redressal: Lodge complaints with Data Protection Officer".to_string(),
    ];

    Ok(Json(DpdpConsentPrintData {
        consent_number: consent.consent_number,
        consent_date: consent.consent_date.format("%d-%m-%Y").to_string(),
        patient_name: consent.patient_name,
        uhid: consent.uhid,
        guardian_name: consent.guardian_name,
        data_categories,
        processing_purposes,
        data_sharing,
        retention_period: consent.retention_period,
        patient_rights,
        grievance_officer: GrievanceOfficer {
            name: "Data Protection Officer".to_string(),
            email: "dpo@hospital.com".to_string(),
            phone: Some("1800-XXX-XXXX".to_string()),
        },
        consent_given: consent.consent_given,
        consent_method: consent.consent_method,
        witness_name: consent.witness_name,
        hospital_name: tenant.0,
        hospital_dpo_contact: Some("dpo@hospital.com".to_string()),
    }))
}

// ── Video Consent Recording ───────────────────────────────────────────────────

/// GET /print-data/video-consent/{video_consent_id}
pub async fn get_video_consent_print_data(
    State(state): State<AppState>,
    Path(video_consent_id): Path<Uuid>,
) -> Result<Json<VideoConsentPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct VideoRow {
        consent_number: String,
        consent_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        consent_type: String,
        procedure_name: Option<String>,
        video_reference_id: String,
        video_duration_seconds: i32,
        video_recorded_at: chrono::DateTime<Utc>,
        video_url: String,
        video_verified: bool,
        patient_visible: bool,
        verbal_consent: bool,
        witness_name: Option<String>,
        witness_relationship: Option<String>,
        recording_staff: String,
    }

    let video = sqlx::query_as::<_, VideoRow>(
        r"
        SELECT
            vc.consent_number,
            vc.created_at as consent_date,
            p.full_name as patient_name,
            p.uhid,
            vc.consent_type,
            vc.procedure_name,
            vc.video_reference_id,
            vc.video_duration_seconds,
            vc.video_recorded_at,
            vc.video_url,
            vc.video_verified,
            vc.patient_visible_in_video as patient_visible,
            vc.verbal_consent_given as verbal_consent,
            vc.witness_name,
            vc.witness_relationship,
            recorder.full_name as recording_staff
        FROM video_consents vc
        JOIN patients p ON vc.patient_id = p.id
        LEFT JOIN users recorder ON vc.recorded_by = recorder.id
        WHERE vc.id = $1
        ",
    )
    .bind(video_consent_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    Ok(Json(VideoConsentPrintData {
        consent_number: video.consent_number,
        consent_date: video.consent_date.format("%d-%m-%Y").to_string(),
        patient_name: video.patient_name,
        uhid: video.uhid,
        consent_type: video.consent_type,
        procedure_name: video.procedure_name,
        video_reference_id: video.video_reference_id.clone(),
        video_duration_seconds: video.video_duration_seconds,
        video_recorded_at: video.video_recorded_at.format("%d-%m-%Y %H:%M").to_string(),
        qr_code_to_video: format!(
            "https://hospital.com/video-consent/{}",
            video.video_reference_id
        ),
        video_url: video.video_url,
        video_verified: video.video_verified,
        patient_visible_in_video: video.patient_visible,
        verbal_consent_given: video.verbal_consent,
        witness_name: video.witness_name,
        witness_relationship: video.witness_relationship,
        recording_staff: video.recording_staff,
        hospital_name: tenant.0,
    }))
}

// ── Restraint Documentation Form ──────────────────────────────────────────────

/// GET /print-data/restraint-documentation/{restraint_id}
pub async fn get_restraint_documentation_print_data(
    State(state): State<AppState>,
    Path(restraint_id): Path<Uuid>,
) -> Result<Json<RestraintDocumentationPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct RestraintRow {
        form_number: String,
        form_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        ip_number: Option<String>,
        ward: String,
        diagnosis: String,
        restraint_type: String,
        restraint_device: Option<String>,
        indication: String,
        start_datetime: chrono::DateTime<Utc>,
        planned_duration: String,
        actual_end: Option<chrono::DateTime<Utc>>,
        ordering_physician: String,
        physician_assessment: String,
        patient_condition_on_release: Option<String>,
        family_notified: bool,
        family_notification_datetime: Option<chrono::DateTime<Utc>>,
        patient_rights_explained: bool,
        consent_obtained: bool,
        consent_from: Option<String>,
        review_by_psychiatrist: bool,
        psychiatrist_name: Option<String>,
        mhca_compliance_verified: bool,
    }

    let restraint = sqlx::query_as::<_, RestraintRow>(
        r"
        SELECT
            r.form_number,
            r.created_at as form_date,
            p.full_name as patient_name,
            p.uhid,
            a.ip_number,
            COALESCE(w.name, 'Ward') as ward,
            r.diagnosis,
            r.restraint_type,
            r.restraint_device,
            r.indication,
            r.start_datetime,
            r.planned_duration,
            r.actual_end_datetime as actual_end,
            physician.full_name as ordering_physician,
            r.physician_assessment,
            r.patient_condition_on_release,
            r.family_notified,
            r.family_notification_datetime,
            r.patient_rights_explained,
            r.consent_obtained,
            r.consent_from,
            r.review_by_psychiatrist,
            psych.full_name as psychiatrist_name,
            r.mhca_compliance_verified
        FROM restraint_documentation r
        JOIN patients p ON r.patient_id = p.id
        LEFT JOIN admissions a ON r.admission_id = a.id
        LEFT JOIN wards w ON r.ward_id = w.id
        LEFT JOIN users physician ON r.ordering_physician_id = physician.id
        LEFT JOIN users psych ON r.psychiatrist_id = psych.id
        WHERE r.id = $1
        ",
    )
    .bind(restraint_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let tenant = get_tenant_info(pool).await?;

    // Sample monitoring records
    let monitoring = vec![
        RestraintMonitoring {
            datetime: (restraint.start_datetime + chrono::Duration::minutes(30))
                .format("%d-%m-%Y %H:%M")
                .to_string(),
            nurse_name: "Nurse on duty".to_string(),
            patient_condition: "Calm, vitals stable".to_string(),
            circulation_checked: true,
            hydration_offered: true,
            toileting_offered: true,
            position_changed: true,
            continued_need_assessed: true,
            remarks: None,
        },
        RestraintMonitoring {
            datetime: (restraint.start_datetime + chrono::Duration::hours(1))
                .format("%d-%m-%Y %H:%M")
                .to_string(),
            nurse_name: "Nurse on duty".to_string(),
            patient_condition: "Resting, no distress".to_string(),
            circulation_checked: true,
            hydration_offered: true,
            toileting_offered: false,
            position_changed: true,
            continued_need_assessed: true,
            remarks: None,
        },
    ];

    Ok(Json(RestraintDocumentationPrintData {
        form_number: restraint.form_number,
        form_date: restraint.form_date.format("%d-%m-%Y").to_string(),
        patient_name: restraint.patient_name,
        uhid: restraint.uhid,
        ip_number: restraint.ip_number,
        ward: restraint.ward,
        diagnosis: restraint.diagnosis,
        restraint_type: restraint.restraint_type,
        restraint_device: restraint.restraint_device,
        indication: restraint.indication,
        alternatives_tried: vec![
            "Verbal de-escalation".to_string(),
            "Environmental modification".to_string(),
            "PRN medication offered".to_string(),
        ],
        start_datetime: restraint
            .start_datetime
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        planned_duration: restraint.planned_duration,
        actual_end_datetime: restraint
            .actual_end
            .map(|t| t.format("%d-%m-%Y %H:%M").to_string()),
        ordering_physician: restraint.ordering_physician,
        physician_assessment: restraint.physician_assessment,
        nursing_monitoring: monitoring,
        patient_condition_on_release: restraint.patient_condition_on_release,
        family_notified: restraint.family_notified,
        family_notification_datetime: restraint
            .family_notification_datetime
            .map(|t| t.format("%d-%m-%Y %H:%M").to_string()),
        patient_rights_explained: restraint.patient_rights_explained,
        consent_obtained: restraint.consent_obtained,
        consent_from: restraint.consent_from,
        review_by_psychiatrist: restraint.review_by_psychiatrist,
        psychiatrist_name: restraint.psychiatrist_name,
        mhca_compliance_verified: restraint.mhca_compliance_verified,
        hospital_name: tenant.0,
    }))
}
