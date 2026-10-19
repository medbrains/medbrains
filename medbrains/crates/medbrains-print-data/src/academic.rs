//! Print data endpoints for Academic/Medical College forms (Phase 6).
//!
//! Endpoints:
//! - GET /print-data/student-admission-form/{admission_id}
//! - GET /print-data/intern-rotation-schedule/{schedule_id}
//! - GET /print-data/pg-logbook-entry/{entry_id}
//! - GET /print-data/internal-assessment-marks/{assessment_id}
//! - GET /print-data/exam-hall-ticket/{ticket_id}
//! - GET /print-data/osce-scoring-sheet/{exam_id}/{station_number}
//! - GET /print-data/simulation-debriefing/{session_id}
//! - GET /print-data/cme-certificate/{certificate_id}
//! - GET /print-data/iec-approval-certificate/{approval_id}
//! - GET /print-data/research-proposal-form/{proposal_id}
//! - GET /print-data/hostel-allotment-order/{order_id}
//! - GET /print-data/anti-ragging-undertaking/{undertaking_id}
//! - GET /print-data/disability-accommodation-plan/{plan_id}
//! - GET /print-data/internship-completion-certificate/{certificate_id}
//! - GET /print-data/service-bond-agreement/{bond_id}
//! - GET /print-data/stipend-payment-advice/{advice_id}
//! - GET /print-data/hospital-branding

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AntiRaggingUndertakingPrintData,
    CmeCertificatePrintData,
    DisabilityAccommodationPlanPrintData,
    ExamHallTicketPrintData,
    HospitalBrandingPrintData,
    HospitalRegistration,
    HostelAllotmentOrderPrintData,
    IecApprovalCertificatePrintData,
    InternRotationSchedulePrintData,
    InternalAssessmentMarksPrintData,
    InternshipCompletionCertificatePrintData,
    OsceScoringSheetPrintData,
    PgLogbookEntryPrintData,
    ResearchProposalFormPrintData,
    ServiceBondAgreementPrintData,
    SimulationDebriefingPrintData,
    StipendPaymentAdvicePrintData,
    StudentAdmissionFormPrintData,
    // Supporting types
};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── Student Admission Form ────────────────────────────────────────────────────

/// GET /print-data/student-admission-form/{admission_id}
pub async fn get_student_admission_form(
    State(_state): State<AppState>,
    Path(_admission_id): Path<Uuid>,
) -> Result<Json<StudentAdmissionFormPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Intern Rotation Schedule ──────────────────────────────────────────────────

/// GET /print-data/intern-rotation-schedule/{schedule_id}
pub async fn get_intern_rotation_schedule(
    State(_state): State<AppState>,
    Path(_schedule_id): Path<Uuid>,
) -> Result<Json<InternRotationSchedulePrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── PG Logbook Entry ──────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct PgLogbookRow {
    id: Uuid,
    entry_date: NaiveDate,
    entry_type: String,
    title: String,
    description: Option<String>,
    diagnosis_codes: Option<Vec<String>>,
    procedure_codes: Option<Vec<String>>,
    supervisor_verified: bool,
    verified_at: Option<DateTime<Utc>>,
    encounter_id: Option<Uuid>,
    resident_name: String,
    resident_registration: Option<String>,
    department: Option<String>,
    supervisor_name: Option<String>,
    patient_uhid: Option<String>,
    college_name: String,
}

/// GET /print-data/pg-logbook-entry/{entry_id}
pub async fn get_pg_logbook_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(entry_id): Path<Uuid>,
) -> Result<Json<PgLogbookEntryPrintData>, AppError> {
    // Same gate as GET /api/cds/pg-logbook, the logbook's own list.
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PgLogbookRow>(
        "SELECT l.id, l.entry_date, l.entry_type, l.title, l.description, \
           l.diagnosis_codes, l.procedure_codes, l.supervisor_verified, l.verified_at, \
           l.encounter_id, r.full_name AS resident_name, \
           r.medical_registration_number AS resident_registration, \
           d.name AS department, s.full_name AS supervisor_name, \
           p.uhid AS patient_uhid, t.name AS college_name \
         FROM pg_logbook_entries l \
         JOIN users r ON r.id = l.user_id \
         JOIN tenants t ON t.id = l.tenant_id \
         LEFT JOIN departments d ON d.id = l.department_id AND d.tenant_id = l.tenant_id \
         LEFT JOIN users s ON s.id = l.supervisor_id \
         LEFT JOIN encounters e ON e.id = l.encounter_id AND e.tenant_id = l.tenant_id \
         LEFT JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         WHERE l.id = $1 AND l.tenant_id = $2 AND l.deleted_at IS NULL",
    )
    .bind(entry_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    // The entry names a patient's encounter; printing it discloses that
    // patient's UHID, so the caller needs access to that care.
    if let Some(encounter_id) = row.encounter_id {
        medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    }

    Ok(Json(PgLogbookEntryPrintData {
        entry_id: row.id.to_string(),
        entry_date: row.entry_date.format("%d-%b-%Y").to_string(),
        entry_type: row.entry_type,
        title: row.title,
        description: row.description,
        diagnosis_codes: row.diagnosis_codes.unwrap_or_default(),
        procedure_codes: row.procedure_codes.unwrap_or_default(),
        resident_name: row.resident_name,
        resident_registration: row.resident_registration,
        department: row.department,
        patient_uhid: row.patient_uhid,
        supervisor_name: row.supervisor_name,
        verified: row.supervisor_verified,
        verification_date: row
            .verified_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        college_name: row.college_name,
    }))
}

// ── Internal Assessment Marks ─────────────────────────────────────────────────

/// GET /print-data/internal-assessment-marks/{assessment_id}
pub async fn get_internal_assessment_marks(
    State(_state): State<AppState>,
    Path(_assessment_id): Path<Uuid>,
) -> Result<Json<InternalAssessmentMarksPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Exam Hall Ticket ──────────────────────────────────────────────────────────

/// GET /print-data/exam-hall-ticket/{ticket_id}
pub async fn get_exam_hall_ticket(
    State(_state): State<AppState>,
    Path(_ticket_id): Path<Uuid>,
) -> Result<Json<ExamHallTicketPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── OSCE Scoring Sheet ────────────────────────────────────────────────────────

/// GET /print-data/osce-scoring-sheet/{exam_id}/{station_number}
pub async fn get_osce_scoring_sheet(
    State(_state): State<AppState>,
    Path((_exam_id, _station_number)): Path<(Uuid, i32)>,
) -> Result<Json<OsceScoringSheetPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Simulation Debriefing ─────────────────────────────────────────────────────

/// GET /print-data/simulation-debriefing/{session_id}
pub async fn get_simulation_debriefing(
    State(_state): State<AppState>,
    Path(_session_id): Path<Uuid>,
) -> Result<Json<SimulationDebriefingPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── CME Certificate ───────────────────────────────────────────────────────────

/// GET /print-data/cme-certificate/{certificate_id}
pub async fn get_cme_certificate(
    State(_state): State<AppState>,
    Path(_certificate_id): Path<Uuid>,
) -> Result<Json<CmeCertificatePrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── IEC Approval Certificate ──────────────────────────────────────────────────

/// GET /print-data/iec-approval-certificate/{approval_id}
pub async fn get_iec_approval_certificate(
    State(_state): State<AppState>,
    Path(_approval_id): Path<Uuid>,
) -> Result<Json<IecApprovalCertificatePrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Research Proposal Form ────────────────────────────────────────────────────

/// GET /print-data/research-proposal-form/{proposal_id}
pub async fn get_research_proposal_form(
    State(_state): State<AppState>,
    Path(_proposal_id): Path<Uuid>,
) -> Result<Json<ResearchProposalFormPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Hostel Allotment Order ────────────────────────────────────────────────────

/// GET /print-data/hostel-allotment-order/{order_id}
pub async fn get_hostel_allotment_order(
    State(_state): State<AppState>,
    Path(_order_id): Path<Uuid>,
) -> Result<Json<HostelAllotmentOrderPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Anti-Ragging Undertaking ──────────────────────────────────────────────────

/// GET /print-data/anti-ragging-undertaking/{undertaking_id}
pub async fn get_anti_ragging_undertaking(
    State(_state): State<AppState>,
    Path(_undertaking_id): Path<Uuid>,
) -> Result<Json<AntiRaggingUndertakingPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Disability Accommodation Plan ─────────────────────────────────────────────

/// GET /print-data/disability-accommodation-plan/{plan_id}
pub async fn get_disability_accommodation_plan(
    State(_state): State<AppState>,
    Path(_plan_id): Path<Uuid>,
) -> Result<Json<DisabilityAccommodationPlanPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Internship Completion Certificate ─────────────────────────────────────────

/// GET /print-data/internship-completion-certificate/{certificate_id}
pub async fn get_internship_completion_certificate(
    State(_state): State<AppState>,
    Path(_certificate_id): Path<Uuid>,
) -> Result<Json<InternshipCompletionCertificatePrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Service Bond Agreement ────────────────────────────────────────────────────

/// GET /print-data/service-bond-agreement/{bond_id}
pub async fn get_service_bond_agreement(
    State(_state): State<AppState>,
    Path(_bond_id): Path<Uuid>,
) -> Result<Json<ServiceBondAgreementPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Stipend Payment Advice ────────────────────────────────────────────────────

/// GET /print-data/stipend-payment-advice/{advice_id}
pub async fn get_stipend_payment_advice(
    State(_state): State<AppState>,
    Path(_advice_id): Path<Uuid>,
) -> Result<Json<StipendPaymentAdvicePrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
}

// ── Hospital Branding ─────────────────────────────────────────────────────────

/// GET /print-data/hospital-branding
///
/// The caller's own hospital. Not PHI, and every document's letterhead needs
/// it, so it is gated on `dashboard.view`, which every built-in role holds.
pub async fn get_hospital_branding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<HospitalBrandingPrintData>, AppError> {
    require_permission(&claims, permissions::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut branding = sqlx::query_as::<_, HospitalBrandingPrintData>(
        "SELECT t.name AS hospital_name, t.logo_url, t.address_line1 AS address_line_1, \
           t.address_line2 AS address_line_2, t.city, gs.name AS state, t.pincode, \
           t.phone, t.email, t.website, t.accreditation, t.nabl_accredited \
         FROM tenants t \
         LEFT JOIN geo_states gs ON gs.id = t.state_id \
         WHERE t.id = $1 AND t.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // One row per registration the hospital has actually recorded.
    branding.registration_numbers = sqlx::query_as::<_, HospitalRegistration>(
        "SELECT r.registration_type, btrim(r.registration_number) AS registration_number, \
           r.valid_until \
         FROM tenants t \
         CROSS JOIN LATERAL (VALUES \
           ('Hospital registration', t.registration_no, NULL::text), \
           ('NABH', t.nabh_certificate_number, to_char(t.nabh_valid_until, 'DD-Mon-YYYY')), \
           ('NABL', t.nabl_certificate_number, NULL), \
           ('NMC', t.nmc_registration_number, NULL), \
           ('PCPNDT', t.pcpndt_registration_number, NULLIF(t.pcpndt_valid_until, '')), \
           ('PESO', t.peso_license_number, t.peso_valid_until), \
           ('ABDM facility ID', (SELECT f.hfr_facility_id FROM facilities f \
                      WHERE f.tenant_id = t.id AND f.deleted_at IS NULL \
                        AND f.parent_id IS NULL AND f.hfr_facility_id IS NOT NULL \
                      ORDER BY (f.facility_type = 'main_hospital') DESC, f.created_at \
                      LIMIT 1), NULL), \
           ('GSTIN', (SELECT s.value #>> '{}' FROM tenant_settings s \
                      WHERE s.tenant_id = t.id AND s.category = 'billing' \
                        AND s.key = 'gst_number' AND s.deleted_at IS NULL), NULL) \
         ) AS r (registration_type, registration_number, valid_until) \
         WHERE t.id = $1 AND NULLIF(btrim(r.registration_number), '') IS NOT NULL",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(branding))
}

/// Print-data academic routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/student-admission-form/{admission_id}",
            get(get_student_admission_form),
        )
        .route(
            "/api/print-data/intern-rotation-schedule/{schedule_id}",
            get(get_intern_rotation_schedule),
        )
        .route(
            "/api/print-data/pg-logbook-entry/{entry_id}",
            get(get_pg_logbook_entry),
        )
        .route(
            "/api/print-data/internal-assessment-marks/{assessment_id}",
            get(get_internal_assessment_marks),
        )
        .route(
            "/api/print-data/exam-hall-ticket/{ticket_id}",
            get(get_exam_hall_ticket),
        )
        .route(
            "/api/print-data/osce-scoring-sheet/{exam_id}/{station_number}",
            get(get_osce_scoring_sheet),
        )
        .route(
            "/api/print-data/simulation-debriefing/{session_id}",
            get(get_simulation_debriefing),
        )
        .route(
            "/api/print-data/cme-certificate/{certificate_id}",
            get(get_cme_certificate),
        )
        .route(
            "/api/print-data/iec-approval-certificate/{approval_id}",
            get(get_iec_approval_certificate),
        )
        .route(
            "/api/print-data/research-proposal-form/{proposal_id}",
            get(get_research_proposal_form),
        )
        .route(
            "/api/print-data/hostel-allotment-order/{order_id}",
            get(get_hostel_allotment_order),
        )
        .route(
            "/api/print-data/anti-ragging-undertaking/{undertaking_id}",
            get(get_anti_ragging_undertaking),
        )
        .route(
            "/api/print-data/disability-accommodation-plan/{plan_id}",
            get(get_disability_accommodation_plan),
        )
        .route(
            "/api/print-data/internship-completion-certificate/{certificate_id}",
            get(get_internship_completion_certificate),
        )
        .route(
            "/api/print-data/service-bond-agreement/{bond_id}",
            get(get_service_bond_agreement),
        )
        .route(
            "/api/print-data/stipend-payment-advice/{advice_id}",
            get(get_stipend_payment_advice),
        )
        .route(
            "/api/print-data/hospital-branding",
            get(get_hospital_branding),
        )
}
