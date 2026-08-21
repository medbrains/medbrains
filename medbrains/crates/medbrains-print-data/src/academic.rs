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

use axum::{
    Json,
    extract::{Path, State},
};
use axum::routing::{get};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use medbrains_core::print_data::{
    AntiRaggingUndertakingPrintData,
    CmeCertificatePrintData,
    DisabilityAccommodationPlanPrintData,
    ExamHallTicketPrintData,
    HospitalBrandingPrintData,
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

/// GET /print-data/pg-logbook-entry/{entry_id}
pub async fn get_pg_logbook_entry(
    State(_state): State<AppState>,
    Path(_entry_id): Path<Uuid>,
) -> Result<Json<PgLogbookEntryPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
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
pub async fn get_hospital_branding(
    State(_state): State<AppState>,
) -> Result<Json<HospitalBrandingPrintData>, AppError> {
    // No data source exists for this document yet. It previously returned a
    // hardcoded sample — invented names, marks, and in bme.rs a fabricated
    // fire-inspection record — which a print template renders onto hospital
    // letterhead. A missing document is recoverable; a wrong one signed and
    // filed is not. The sample body is deleted rather than left unreachable,
    // so nothing here can be revived by accident.
    Err(AppError::NotImplemented)
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
