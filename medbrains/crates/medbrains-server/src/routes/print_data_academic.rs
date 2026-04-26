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
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;
use medbrains_core::print_data::{
    AccommodationItem,
    AdmissionFeeDetails,
    AntiRaggingUndertakingPrintData,
    AssessmentComponent,
    BudgetSummary,
    CmeCertificatePrintData,
    CmeFaculty,
    CoInvestigator,
    DebriefingPoint,
    DisabilityAccommodationPlanPrintData,
    ExamHallTicketPrintData,
    ExamSubject,
    HospitalBrandingPrintData,
    HospitalRegistration,
    HostelAllotmentOrderPrintData,
    HostelFeeDetails,
    IecApprovalCertificatePrintData,
    InternRotation,
    InternRotationSchedulePrintData,
    InternalAssessmentMarksPrintData,
    InternshipCompletionCertificatePrintData,
    InternshipPosting,
    OsceGlobalRating,
    OsceScoringSheetPrintData,
    OsceTask,
    PgCaseEntry,
    PgLogbookEntryPrintData,
    ResearchProposalFormPrintData,
    ServiceBondAgreementPrintData,
    SimulationDebriefingPrintData,
    SimulationEvent,
    SimulationParticipant,
    StipendComponent,
    StipendPaymentAdvicePrintData,
    StudentAdmissionFormPrintData,
    // Supporting types
    SubmittedDocument,
};

// ── Student Admission Form ────────────────────────────────────────────────────

/// GET /print-data/student-admission-form/{admission_id}
pub async fn get_student_admission_form(
    State(_state): State<AppState>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<StudentAdmissionFormPrintData>, AppError> {
    // Placeholder: In production, fetch from student_admissions table
    let data = StudentAdmissionFormPrintData {
        admission_number: format!(
            "ADM-{}",
            admission_id.to_string().split('-').next().unwrap_or("000")
        ),
        admission_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        academic_year: "2025-2026".to_string(),
        course: "MBBS".to_string(),
        batch_year: 2025,
        student_name: "Student Name".to_string(),
        date_of_birth: "2000-01-01".to_string(),
        gender: "Male".to_string(),
        photo_url: None,
        father_name: "Father Name".to_string(),
        mother_name: "Mother Name".to_string(),
        permanent_address: "Permanent Address".to_string(),
        correspondence_address: "Correspondence Address".to_string(),
        phone: "9876543210".to_string(),
        email: "student@example.com".to_string(),
        emergency_contact: "9876543211".to_string(),
        blood_group: "O+".to_string(),
        nationality: "Indian".to_string(),
        category: "General".to_string(),
        admission_quota: "Government".to_string(),
        neet_score: Some(650),
        neet_rank: Some(5000),
        qualifying_exam: "NEET-UG 2025".to_string(),
        qualifying_marks_percent: 95.5,
        documents_submitted: vec![
            SubmittedDocument {
                document_name: "10th Marksheet".to_string(),
                original_submitted: true,
                verified: true,
            },
            SubmittedDocument {
                document_name: "12th Marksheet".to_string(),
                original_submitted: true,
                verified: true,
            },
        ],
        fee_details: AdmissionFeeDetails {
            tuition_fee: 500000.0,
            hostel_fee: Some(50000.0),
            caution_deposit: 25000.0,
            total_amount: 575000.0,
            payment_mode: "Online".to_string(),
            receipt_number: Some("FEE-2025-001".to_string()),
        },
        hostel_opted: true,
        medical_fitness_certified: true,
        undertaking_signed: true,
        college_name: "Medical College".to_string(),
        university_name: "Health University".to_string(),
        registrar_name: "Dr. Registrar".to_string(),
    };

    Ok(Json(data))
}

// ── Intern Rotation Schedule ──────────────────────────────────────────────────

/// GET /print-data/intern-rotation-schedule/{schedule_id}
pub async fn get_intern_rotation_schedule(
    State(_state): State<AppState>,
    Path(schedule_id): Path<Uuid>,
) -> Result<Json<InternRotationSchedulePrintData>, AppError> {
    let data = InternRotationSchedulePrintData {
        schedule_id: schedule_id.to_string(),
        academic_year: "2025-2026".to_string(),
        intern_name: "Dr. Intern Name".to_string(),
        intern_registration_number: "INT-2025-001".to_string(),
        batch: "2020-2025".to_string(),
        internship_start_date: "2025-03-01".to_string(),
        internship_end_date: "2026-02-28".to_string(),
        rotations: vec![
            InternRotation {
                department: "General Medicine".to_string(),
                unit: Some("Unit I".to_string()),
                start_date: "2025-03-01".to_string(),
                end_date: "2025-04-30".to_string(),
                duration_days: 61,
                posting_type: "Core".to_string(),
                supervisor: "Dr. Supervisor".to_string(),
                status: "Completed".to_string(),
            },
            InternRotation {
                department: "General Surgery".to_string(),
                unit: Some("Unit II".to_string()),
                start_date: "2025-05-01".to_string(),
                end_date: "2025-06-30".to_string(),
                duration_days: 61,
                posting_type: "Core".to_string(),
                supervisor: "Dr. Surgeon".to_string(),
                status: "Ongoing".to_string(),
            },
        ],
        total_days: 365,
        leave_allowed: 20,
        current_posting: Some(InternRotation {
            department: "General Surgery".to_string(),
            unit: Some("Unit II".to_string()),
            start_date: "2025-05-01".to_string(),
            end_date: "2025-06-30".to_string(),
            duration_days: 61,
            posting_type: "Core".to_string(),
            supervisor: "Dr. Surgeon".to_string(),
            status: "Ongoing".to_string(),
        }),
        completed_rotations: 1,
        pending_rotations: 10,
        mentor_name: "Dr. Mentor".to_string(),
        coordinator_name: "Dr. Coordinator".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── PG Logbook Entry ──────────────────────────────────────────────────────────

/// GET /print-data/pg-logbook-entry/{entry_id}
pub async fn get_pg_logbook_entry(
    State(_state): State<AppState>,
    Path(entry_id): Path<Uuid>,
) -> Result<Json<PgLogbookEntryPrintData>, AppError> {
    let data = PgLogbookEntryPrintData {
        entry_id: entry_id.to_string(),
        entry_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        resident_name: "Dr. Resident Name".to_string(),
        resident_registration: "PG-2024-001".to_string(),
        course: "MD General Medicine".to_string(),
        department: "General Medicine".to_string(),
        year_of_training: 2,
        entry_type: "Case".to_string(),
        case_details: Some(PgCaseEntry {
            diagnosis: "Type 2 Diabetes Mellitus with Hypertension".to_string(),
            presenting_complaints: "Polyuria, polydipsia for 2 weeks".to_string(),
            examination_findings: "BMI 28, BP 150/90, fundoscopy normal".to_string(),
            investigations: "FBS 180, HbA1c 8.5%, lipid profile deranged".to_string(),
            treatment_given: "Metformin 500mg BD, Amlodipine 5mg OD".to_string(),
            learning_points: "Importance of early lifestyle modification".to_string(),
            case_outcome: "Stable, discharged with follow-up".to_string(),
        }),
        procedure_details: None,
        academic_activity: None,
        supervisor_name: "Dr. Professor".to_string(),
        supervisor_remarks: Some("Good clinical approach".to_string()),
        verified: true,
        verification_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Internal Assessment Marks ─────────────────────────────────────────────────

/// GET /print-data/internal-assessment-marks/{assessment_id}
pub async fn get_internal_assessment_marks(
    State(_state): State<AppState>,
    Path(assessment_id): Path<Uuid>,
) -> Result<Json<InternalAssessmentMarksPrintData>, AppError> {
    let data = InternalAssessmentMarksPrintData {
        assessment_id: assessment_id.to_string(),
        academic_year: "2025-2026".to_string(),
        term: "II".to_string(),
        student_name: "Student Name".to_string(),
        roll_number: "MBBS-2022-045".to_string(),
        course: "MBBS".to_string(),
        year: 3,
        subject: "Pathology".to_string(),
        theory_marks: vec![
            AssessmentComponent {
                component_name: "IA-1".to_string(),
                marks_obtained: 35.0,
                max_marks: 50.0,
                date: "2025-02-15".to_string(),
            },
            AssessmentComponent {
                component_name: "IA-2".to_string(),
                marks_obtained: 38.0,
                max_marks: 50.0,
                date: "2025-04-20".to_string(),
            },
        ],
        practical_marks: vec![AssessmentComponent {
            component_name: "Practical IA".to_string(),
            marks_obtained: 18.0,
            max_marks: 25.0,
            date: "2025-03-10".to_string(),
        }],
        viva_marks: Some(AssessmentComponent {
            component_name: "Viva".to_string(),
            marks_obtained: 8.0,
            max_marks: 10.0,
            date: "2025-04-25".to_string(),
        }),
        theory_total: 73.0,
        theory_max: 100.0,
        practical_total: 18.0,
        practical_max: 25.0,
        grand_total: 99.0,
        grand_max: 135.0,
        percentage: 73.33,
        attendance_percent: 85.0,
        eligible_for_exam: true,
        remarks: None,
        faculty_name: "Dr. Faculty".to_string(),
        hod_name: "Dr. HOD Pathology".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Exam Hall Ticket ──────────────────────────────────────────────────────────

/// GET /print-data/exam-hall-ticket/{ticket_id}
pub async fn get_exam_hall_ticket(
    State(_state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
) -> Result<Json<ExamHallTicketPrintData>, AppError> {
    let data = ExamHallTicketPrintData {
        hall_ticket_number: format!(
            "HT-{}",
            ticket_id.to_string().split('-').next().unwrap_or("000")
        ),
        exam_name: "III MBBS Part I University Examination".to_string(),
        exam_session: "Summer 2025".to_string(),
        academic_year: "2024-2025".to_string(),
        student_name: "Student Name".to_string(),
        roll_number: "MBBS-2022-045".to_string(),
        photo_url: None,
        course: "MBBS".to_string(),
        year: 3,
        subjects: vec![
            ExamSubject {
                subject_code: "PATH-301".to_string(),
                subject_name: "Pathology".to_string(),
                exam_date: "2025-06-01".to_string(),
                exam_time: "09:00 AM".to_string(),
                paper_type: "Theory".to_string(),
            },
            ExamSubject {
                subject_code: "MICRO-301".to_string(),
                subject_name: "Microbiology".to_string(),
                exam_date: "2025-06-03".to_string(),
                exam_time: "09:00 AM".to_string(),
                paper_type: "Theory".to_string(),
            },
        ],
        exam_center: "Medical College Main Campus".to_string(),
        center_address: "College Road, City".to_string(),
        reporting_time: "08:30 AM".to_string(),
        instructions: vec![
            "Bring valid ID proof".to_string(),
            "No electronic devices allowed".to_string(),
            "Report 30 minutes before exam".to_string(),
        ],
        student_signature_required: true,
        controller_exam_name: "Dr. Controller".to_string(),
        university_name: "Health University".to_string(),
        college_name: "Medical College".to_string(),
        issue_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        barcode: format!(
            "HT{}",
            ticket_id
                .to_string()
                .replace('-', "")
                .chars()
                .take(12)
                .collect::<String>()
        ),
    };

    Ok(Json(data))
}

// ── OSCE Scoring Sheet ────────────────────────────────────────────────────────

/// GET /print-data/osce-scoring-sheet/{exam_id}/{station_number}
pub async fn get_osce_scoring_sheet(
    State(_state): State<AppState>,
    Path((exam_id, station_number)): Path<(Uuid, i32)>,
) -> Result<Json<OsceScoringSheetPrintData>, AppError> {
    let data = OsceScoringSheetPrintData {
        exam_id: exam_id.to_string(),
        exam_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        station_number,
        station_name: "History Taking - Chest Pain".to_string(),
        station_type: "Manned".to_string(),
        time_allowed_minutes: 8,
        candidate_roll: "MBBS-2022-045".to_string(),
        candidate_name: "Candidate Name".to_string(),
        clinical_scenario:
            "A 55-year-old male presents with chest pain for 2 hours. Take relevant history."
                .to_string(),
        tasks: vec![
            OsceTask {
                task_number: 1,
                task_description: "Introduces self and establishes rapport".to_string(),
                max_marks: 2.0,
                marks_obtained: 2.0,
                competency_level: "Done correctly".to_string(),
            },
            OsceTask {
                task_number: 2,
                task_description: "Elicits onset, character, location of pain".to_string(),
                max_marks: 4.0,
                marks_obtained: 3.0,
                competency_level: "Partially done".to_string(),
            },
            OsceTask {
                task_number: 3,
                task_description: "Asks about radiation and associated symptoms".to_string(),
                max_marks: 3.0,
                marks_obtained: 3.0,
                competency_level: "Done correctly".to_string(),
            },
        ],
        global_rating: Some(OsceGlobalRating {
            communication_skills: 4,
            professionalism: 5,
            clinical_judgment: 4,
            overall_performance: "Meets expectations".to_string(),
        }),
        total_marks: 8.0,
        max_marks: 9.0,
        pass_marks: 5.0,
        examiner_comments: Some(
            "Good communication, needs to explore differentials more".to_string(),
        ),
        examiner_name: "Dr. Examiner".to_string(),
        examiner_signature_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Simulation Debriefing ─────────────────────────────────────────────────────

/// GET /print-data/simulation-debriefing/{session_id}
pub async fn get_simulation_debriefing(
    State(_state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<SimulationDebriefingPrintData>, AppError> {
    let data = SimulationDebriefingPrintData {
        session_id: session_id.to_string(),
        session_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        scenario_name: "Cardiac Arrest Management".to_string(),
        scenario_type: "ACLS".to_string(),
        duration_minutes: 30,
        participants: vec![
            SimulationParticipant {
                name: "Dr. Participant 1".to_string(),
                role_assigned: "Team Leader".to_string(),
                course: "MD Emergency Medicine".to_string(),
                year: 2,
            },
            SimulationParticipant {
                name: "Dr. Participant 2".to_string(),
                role_assigned: "Airway Manager".to_string(),
                course: "MD Anesthesia".to_string(),
                year: 1,
            },
        ],
        scenario_objectives: vec![
            "Recognize cardiac arrest promptly".to_string(),
            "Initiate high-quality CPR within 10 seconds".to_string(),
            "Follow ACLS algorithm correctly".to_string(),
        ],
        events_timeline: vec![
            SimulationEvent {
                timestamp_minutes: 0,
                event_description: "Patient found unresponsive".to_string(),
                expected_action: "Check responsiveness, call for help".to_string(),
                actual_action: "Called for help immediately".to_string(),
                was_correct: true,
            },
            SimulationEvent {
                timestamp_minutes: 1,
                event_description: "No pulse detected".to_string(),
                expected_action: "Start CPR".to_string(),
                actual_action: "Started CPR with good technique".to_string(),
                was_correct: true,
            },
        ],
        debriefing_points: vec![
            DebriefingPoint {
                category: "Technical".to_string(),
                observation: "CPR depth and rate were appropriate".to_string(),
                discussion_summary: "Team discussed importance of minimizing interruptions"
                    .to_string(),
            },
            DebriefingPoint {
                category: "Teamwork".to_string(),
                observation: "Clear communication during rhythm checks".to_string(),
                discussion_summary: "Closed-loop communication was effective".to_string(),
            },
        ],
        key_learning_outcomes: vec![
            "Importance of early defibrillation".to_string(),
            "Role clarity improves team performance".to_string(),
        ],
        areas_for_improvement: vec!["Drug dosing confirmation before administration".to_string()],
        participant_feedback: Some("Very realistic scenario, learned a lot".to_string()),
        facilitator_name: "Dr. Facilitator".to_string(),
        technician_name: Some("Sim Tech".to_string()),
        simulation_center: "Advanced Simulation Center".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── CME Certificate ───────────────────────────────────────────────────────────

/// GET /print-data/cme-certificate/{certificate_id}
pub async fn get_cme_certificate(
    State(_state): State<AppState>,
    Path(certificate_id): Path<Uuid>,
) -> Result<Json<CmeCertificatePrintData>, AppError> {
    let data = CmeCertificatePrintData {
        certificate_number: format!(
            "CME-{}",
            certificate_id
                .to_string()
                .split('-')
                .next()
                .unwrap_or("000")
        ),
        program_name: "Recent Advances in Diabetology".to_string(),
        program_date: "2025-05-15".to_string(),
        program_duration_hours: 6.0,
        credit_hours_awarded: 6.0,
        participant_name: "Dr. Participant Name".to_string(),
        participant_registration: "MCI-12345".to_string(),
        participant_designation: "Assistant Professor".to_string(),
        participant_institution: "Medical College".to_string(),
        topics_covered: vec![
            "New oral antidiabetic agents".to_string(),
            "Insulin therapy updates".to_string(),
            "Diabetic nephropathy management".to_string(),
        ],
        faculty_speakers: vec![
            CmeFaculty {
                name: "Dr. Speaker 1".to_string(),
                designation: "Professor".to_string(),
                institution: "AIIMS".to_string(),
                topic: "New oral antidiabetic agents".to_string(),
            },
            CmeFaculty {
                name: "Dr. Speaker 2".to_string(),
                designation: "Associate Professor".to_string(),
                institution: "PGI".to_string(),
                topic: "Insulin therapy updates".to_string(),
            },
        ],
        organizing_department: "Department of Medicine".to_string(),
        accreditation_body: "State Medical Council".to_string(),
        accreditation_number: "SMC/CME/2025/123".to_string(),
        organizing_secretary: "Dr. Secretary".to_string(),
        dean_name: "Dr. Dean".to_string(),
        college_name: "Medical College".to_string(),
        issue_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        qr_code_for_verification: format!("https://verify.medcollege.edu/cme/{certificate_id}"),
    };

    Ok(Json(data))
}

// ── IEC Approval Certificate ──────────────────────────────────────────────────

/// GET /print-data/iec-approval-certificate/{approval_id}
pub async fn get_iec_approval_certificate(
    State(_state): State<AppState>,
    Path(approval_id): Path<Uuid>,
) -> Result<Json<IecApprovalCertificatePrintData>, AppError> {
    let valid_until = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(365))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();

    let data = IecApprovalCertificatePrintData {
        approval_number: format!(
            "IEC/{}/{}",
            chrono::Utc::now().format("%Y"),
            approval_id.to_string().split('-').next().unwrap_or("000")
        ),
        approval_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        study_title: "Efficacy of Novel Drug X in Treatment of Condition Y".to_string(),
        principal_investigator: "Dr. PI Name".to_string(),
        pi_department: "Department of Pharmacology".to_string(),
        pi_designation: "Associate Professor".to_string(),
        co_investigators: vec![
            "Dr. Co-I 1, Dept of Medicine".to_string(),
            "Dr. Co-I 2, Dept of Statistics".to_string(),
        ],
        study_type: "Clinical Trial".to_string(),
        study_design: "Randomized Controlled Trial".to_string(),
        sample_size: 100,
        study_duration_months: 18,
        approval_type: "Full Board".to_string(),
        approval_category: "Initial Approval".to_string(),
        conditions: vec![
            "Submit 6-monthly progress reports".to_string(),
            "Report SAEs within 24 hours".to_string(),
            "Any protocol amendments require prior approval".to_string(),
        ],
        valid_until,
        reporting_requirements: vec![
            "Progress report every 6 months".to_string(),
            "Annual renewal application 30 days before expiry".to_string(),
            "Final study report within 3 months of completion".to_string(),
        ],
        ctri_registration: Some("CTRI/2025/01/012345".to_string()),
        iec_chairman: "Dr. IEC Chairman".to_string(),
        member_secretary: "Dr. Member Secretary".to_string(),
        meeting_date: "2025-05-10".to_string(),
        meeting_number: "IEC/2025/05".to_string(),
        institution_name: "Medical College & Hospital".to_string(),
    };

    Ok(Json(data))
}

// ── Research Proposal Form ────────────────────────────────────────────────────

/// GET /print-data/research-proposal-form/{proposal_id}
pub async fn get_research_proposal_form(
    State(_state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
) -> Result<Json<ResearchProposalFormPrintData>, AppError> {
    let data = ResearchProposalFormPrintData {
        proposal_id: proposal_id.to_string(),
        submission_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        project_title: "Study on Impact of Intervention X on Outcome Y".to_string(),
        principal_investigator: "Dr. PI Name".to_string(),
        pi_designation: "Associate Professor".to_string(),
        pi_department: "Department of Medicine".to_string(),
        pi_email: "pi@medcollege.edu".to_string(),
        pi_phone: "9876543210".to_string(),
        co_investigators: vec![CoInvestigator {
            name: "Dr. Co-I 1".to_string(),
            designation: "Assistant Professor".to_string(),
            department: "Biochemistry".to_string(),
            institution: "Medical College".to_string(),
            role: "Laboratory analysis".to_string(),
        }],
        research_type: "Clinical".to_string(),
        study_design: "Prospective Cohort Study".to_string(),
        objectives: vec![
            "Primary: To determine efficacy of intervention X".to_string(),
            "Secondary: To assess safety profile".to_string(),
        ],
        background_summary: "Brief background of the research problem and rationale".to_string(),
        methodology_summary: "Detailed methodology including study procedures".to_string(),
        sample_size: 150,
        sample_size_justification: "Based on previous studies with 80% power and 5% alpha"
            .to_string(),
        inclusion_criteria: vec![
            "Age 18-65 years".to_string(),
            "Diagnosed with condition Y".to_string(),
            "Willing to provide informed consent".to_string(),
        ],
        exclusion_criteria: vec![
            "Pregnancy or lactation".to_string(),
            "Known allergy to study drug".to_string(),
            "Severe organ dysfunction".to_string(),
        ],
        outcome_measures: vec![
            "Primary: Change in biomarker levels at 12 weeks".to_string(),
            "Secondary: Quality of life scores".to_string(),
        ],
        statistical_methods: "ANOVA for continuous variables, chi-square for categorical"
            .to_string(),
        ethical_considerations: "Study adheres to Declaration of Helsinki guidelines".to_string(),
        informed_consent_process: "Written informed consent in local language".to_string(),
        funding_source: "Institutional Research Grant".to_string(),
        budget_summary: BudgetSummary {
            personnel: 100000.0,
            equipment: 50000.0,
            consumables: 75000.0,
            travel: 25000.0,
            contingency: 25000.0,
            total: 275000.0,
        },
        timeline_months: 24,
        expected_outcomes: vec![
            "Publication in peer-reviewed journal".to_string(),
            "Development of treatment guidelines".to_string(),
        ],
        institution_name: "Medical College & Hospital".to_string(),
    };

    Ok(Json(data))
}

// ── Hostel Allotment Order ────────────────────────────────────────────────────

/// GET /print-data/hostel-allotment-order/{order_id}
pub async fn get_hostel_allotment_order(
    State(_state): State<AppState>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<HostelAllotmentOrderPrintData>, AppError> {
    let data = HostelAllotmentOrderPrintData {
        order_number: format!(
            "HA/{}/{}",
            chrono::Utc::now().format("%Y"),
            order_id.to_string().split('-').next().unwrap_or("000")
        ),
        order_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        academic_year: "2025-2026".to_string(),
        student_name: "Student Name".to_string(),
        student_roll: "MBBS-2025-001".to_string(),
        course: "MBBS".to_string(),
        year: 1,
        hostel_name: "Boys Hostel - Block A".to_string(),
        room_number: "A-101".to_string(),
        room_type: "Double".to_string(),
        block_wing: Some("A".to_string()),
        floor: 1,
        allotment_from: "2025-08-01".to_string(),
        allotment_to: "2026-07-31".to_string(),
        mess_facility: true,
        mess_type: Some("Veg".to_string()),
        fee_details: HostelFeeDetails {
            room_rent: 30000.0,
            mess_charges: 60000.0,
            establishment_charges: 5000.0,
            electricity_advance: 5000.0,
            caution_money: 10000.0,
            total: 110000.0,
            payment_deadline: "2025-07-25".to_string(),
        },
        rules_acknowledged: true,
        emergency_contact: "Parent Name".to_string(),
        emergency_phone: "9876543210".to_string(),
        medical_conditions: None,
        warden_name: "Dr. Warden".to_string(),
        chief_warden_name: "Dr. Chief Warden".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Anti-Ragging Undertaking ──────────────────────────────────────────────────

/// GET /print-data/anti-ragging-undertaking/{undertaking_id}
pub async fn get_anti_ragging_undertaking(
    State(_state): State<AppState>,
    Path(undertaking_id): Path<Uuid>,
) -> Result<Json<AntiRaggingUndertakingPrintData>, AppError> {
    let data = AntiRaggingUndertakingPrintData {
        undertaking_number: format!("ARU/{}/{}", chrono::Utc::now().format("%Y"), undertaking_id.to_string().split('-').next().unwrap_or("000")),
        date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        academic_year: "2025-2026".to_string(),
        student_name: "Student Name".to_string(),
        student_roll: "MBBS-2025-001".to_string(),
        course: "MBBS".to_string(),
        year: 1,
        student_phone: "9876543210".to_string(),
        student_email: "student@medcollege.edu".to_string(),
        parent_guardian_name: "Parent Name".to_string(),
        parent_relationship: "Father".to_string(),
        parent_phone: "9876543211".to_string(),
        parent_email: "parent@email.com".to_string(),
        parent_address: "Parent Address, City, State - PIN".to_string(),
        ugc_regulations_read: true,
        consequences_understood: true,
        student_declaration: "I hereby declare that I have read and understood the UGC Regulations on Curbing the Menace of Ragging in Higher Educational Institutions, 2009 and subsequent amendments. I understand that ragging in any form is a criminal offense and I shall not indulge in any act of ragging.".to_string(),
        parent_declaration: "I, the parent/guardian, hereby declare that I have read and understood the UGC Regulations on Curbing the Menace of Ragging. I shall ensure that my ward does not indulge in any act of ragging. I understand the consequences of ragging as outlined in the regulations.".to_string(),
        student_signature_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        parent_signature_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        aadhar_last_four: "1234".to_string(),
        anti_ragging_helpline: "1800-180-5522".to_string(),
        anti_ragging_email: "helpline@antiragging.in".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Disability Accommodation Plan ─────────────────────────────────────────────

/// GET /print-data/disability-accommodation-plan/{plan_id}
pub async fn get_disability_accommodation_plan(
    State(_state): State<AppState>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<DisabilityAccommodationPlanPrintData>, AppError> {
    let next_review = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(365))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();

    let data = DisabilityAccommodationPlanPrintData {
        plan_id: plan_id.to_string(),
        plan_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        academic_year: "2025-2026".to_string(),
        student_name: "Student Name".to_string(),
        student_roll: "MBBS-2025-001".to_string(),
        course: "MBBS".to_string(),
        year: 1,
        disability_type: "Visual Impairment".to_string(),
        disability_percentage: 75,
        disability_certificate_number: "DC/2024/12345".to_string(),
        issuing_authority: "District Civil Hospital".to_string(),
        functional_limitations: vec![
            "Difficulty reading standard print".to_string(),
            "Requires magnification for visual tasks".to_string(),
        ],
        accommodations_granted: vec![
            AccommodationItem {
                accommodation_type: "Extended Time".to_string(),
                description: "50% extra time for all written examinations".to_string(),
                approved: true,
                effective_from: "2025-08-01".to_string(),
            },
            AccommodationItem {
                accommodation_type: "Scribe".to_string(),
                description: "Provision of scribe for examinations".to_string(),
                approved: true,
                effective_from: "2025-08-01".to_string(),
            },
        ],
        classroom_accommodations: vec![
            "Preferential seating in front row".to_string(),
            "Large print handouts".to_string(),
            "Permission to record lectures".to_string(),
        ],
        examination_accommodations: vec![
            "Enlarged question papers (18 point font)".to_string(),
            "Separate exam room".to_string(),
            "Computer-based examination where available".to_string(),
        ],
        hostel_accommodations: Some(vec![
            "Ground floor room allotment".to_string(),
            "Room near common facilities".to_string(),
        ]),
        assistive_devices_provided: vec![
            "Screen magnification software".to_string(),
            "CCTV magnifier in library".to_string(),
        ],
        support_staff_assigned: Some("Student Buddy Program volunteer".to_string()),
        review_period_months: 12,
        next_review_date: next_review,
        student_consent: true,
        disability_coordinator: "Dr. Disability Coordinator".to_string(),
        dean_academics_name: "Dr. Dean Academics".to_string(),
        college_name: "Medical College".to_string(),
    };

    Ok(Json(data))
}

// ── Internship Completion Certificate ─────────────────────────────────────────

/// GET /print-data/internship-completion-certificate/{certificate_id}
pub async fn get_internship_completion_certificate(
    State(_state): State<AppState>,
    Path(certificate_id): Path<Uuid>,
) -> Result<Json<InternshipCompletionCertificatePrintData>, AppError> {
    let data = InternshipCompletionCertificatePrintData {
        certificate_number: format!(
            "ICC/{}/{}",
            chrono::Utc::now().format("%Y"),
            certificate_id
                .to_string()
                .split('-')
                .next()
                .unwrap_or("000")
        ),
        issue_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        intern_name: "Dr. Intern Name".to_string(),
        intern_registration: "TEMP/MC/2025/001".to_string(),
        parent_name: "Parent Name".to_string(),
        permanent_address: "Permanent Address, City, State - PIN".to_string(),
        date_of_birth: "2000-05-15".to_string(),
        mbbs_pass_year: 2024,
        mbbs_university: "Health University".to_string(),
        internship_start_date: "2024-03-01".to_string(),
        internship_end_date: "2025-02-28".to_string(),
        total_days: 365,
        leave_taken: 15,
        extension_days: 0,
        postings_completed: vec![
            InternshipPosting {
                department: "General Medicine".to_string(),
                duration_days: 60,
                from_date: "2024-03-01".to_string(),
                to_date: "2024-04-30".to_string(),
                supervisor: "Dr. Medicine Prof".to_string(),
                satisfactory: true,
            },
            InternshipPosting {
                department: "General Surgery".to_string(),
                duration_days: 60,
                from_date: "2024-05-01".to_string(),
                to_date: "2024-06-30".to_string(),
                supervisor: "Dr. Surgery Prof".to_string(),
                satisfactory: true,
            },
            InternshipPosting {
                department: "Obstetrics & Gynaecology".to_string(),
                duration_days: 30,
                from_date: "2024-07-01".to_string(),
                to_date: "2024-07-30".to_string(),
                supervisor: "Dr. ObGyn Prof".to_string(),
                satisfactory: true,
            },
        ],
        conduct: "Good".to_string(),
        eligible_for_registration: true,
        state_medical_council: "State Medical Council".to_string(),
        principal_name: "Dr. Principal".to_string(),
        principal_registration: "MC/12345".to_string(),
        dean_name: "Dr. Dean".to_string(),
        university_name: "Health University".to_string(),
        college_name: "Medical College".to_string(),
        college_address: "College Address, City, State - PIN".to_string(),
    };

    Ok(Json(data))
}

// ── Service Bond Agreement ────────────────────────────────────────────────────

/// GET /print-data/service-bond-agreement/{bond_id}
pub async fn get_service_bond_agreement(
    State(_state): State<AppState>,
    Path(bond_id): Path<Uuid>,
) -> Result<Json<ServiceBondAgreementPrintData>, AppError> {
    let data = ServiceBondAgreementPrintData {
        bond_number: format!("SB/{}/{}", chrono::Utc::now().format("%Y"), bond_id.to_string().split('-').next().unwrap_or("000")),
        bond_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        employee_name: "Dr. Employee Name".to_string(),
        employee_designation: "Senior Resident".to_string(),
        employee_department: "Department of Medicine".to_string(),
        employee_address: "Employee Address, City, State - PIN".to_string(),
        employee_phone: "9876543210".to_string(),
        date_of_joining: "2025-01-01".to_string(),
        bond_period_years: 3,
        bond_amount: 1_000_000.0,
        bond_amount_words: "Rupees Ten Lakhs Only".to_string(),
        terms_and_conditions: vec![
            "The employee shall serve the institution for a minimum period of 3 years from the date of joining.".to_string(),
            "In case of resignation before completion of bond period, the employee shall be liable to pay the bond amount.".to_string(),
            "The bond amount shall be reduced proportionately for each completed year of service.".to_string(),
        ],
        leave_rules: "As per institutional leave policy. Extended leave without pay may extend the bond period.".to_string(),
        exit_clause: "3 months notice period required. Relieving order subject to clearance of dues and bond obligations.".to_string(),
        penalty_clause: "Failure to serve notice period will result in recovery of one month's salary in lieu of notice.".to_string(),
        surety_name: "Surety Name".to_string(),
        surety_address: "Surety Address, City, State - PIN".to_string(),
        surety_relationship: "Father".to_string(),
        surety_occupation: "Business".to_string(),
        witness_1_name: "Witness 1 Name".to_string(),
        witness_1_address: "Witness 1 Address".to_string(),
        witness_2_name: "Witness 2 Name".to_string(),
        witness_2_address: "Witness 2 Address".to_string(),
        notarization_required: true,
        notary_name: Some("Notary Public Name".to_string()),
        notary_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
        institution_name: "Medical College & Hospital".to_string(),
        institution_address: "Institution Address, City, State - PIN".to_string(),
        authorized_signatory: "Dr. Director".to_string(),
        authorized_designation: "Director".to_string(),
    };

    Ok(Json(data))
}

// ── Stipend Payment Advice ────────────────────────────────────────────────────

/// GET /print-data/stipend-payment-advice/{advice_id}
pub async fn get_stipend_payment_advice(
    State(_state): State<AppState>,
    Path(advice_id): Path<Uuid>,
) -> Result<Json<StipendPaymentAdvicePrintData>, AppError> {
    let now = chrono::Utc::now();
    let data = StipendPaymentAdvicePrintData {
        advice_number: format!(
            "SPA/{}/{}",
            now.format("%Y-%m"),
            advice_id.to_string().split('-').next().unwrap_or("000")
        ),
        payment_month: now.format("%B").to_string(),
        payment_year: now.format("%Y").to_string().parse().unwrap_or(2025),
        payment_date: now.format("%Y-%m-%d").to_string(),
        recipient_name: "Dr. Resident Name".to_string(),
        recipient_type: "PG Resident".to_string(),
        recipient_registration: "PG/2024/001".to_string(),
        department: "General Medicine".to_string(),
        year_of_training: 2,
        bank_name: "State Bank".to_string(),
        bank_account: "XXXX1234".to_string(),
        ifsc_code: "SBIN0001234".to_string(),
        earnings: vec![
            StipendComponent {
                component_name: "Basic Stipend".to_string(),
                amount: 65000.0,
            },
            StipendComponent {
                component_name: "Non-Practicing Allowance".to_string(),
                amount: 6500.0,
            },
            StipendComponent {
                component_name: "Dearness Allowance".to_string(),
                amount: 3250.0,
            },
        ],
        deductions: vec![
            StipendComponent {
                component_name: "Professional Tax".to_string(),
                amount: 200.0,
            },
            StipendComponent {
                component_name: "Hostel Charges".to_string(),
                amount: 3000.0,
            },
        ],
        gross_stipend: 74750.0,
        total_deductions: 3200.0,
        net_payable: 71550.0,
        attendance_days: 30,
        leave_days: 1,
        working_days_in_month: 31,
        arrears: 0.0,
        remarks: None,
        prepared_by: "Accounts Officer".to_string(),
        verified_by: "Accounts Superintendent".to_string(),
        approved_by: "Finance Controller".to_string(),
        institution_name: "Medical College & Hospital".to_string(),
    };

    Ok(Json(data))
}

// ── Hospital Branding ─────────────────────────────────────────────────────────

/// GET /print-data/hospital-branding
pub async fn get_hospital_branding(
    State(_state): State<AppState>,
) -> Result<Json<HospitalBrandingPrintData>, AppError> {
    // Placeholder: In production, fetch from tenant settings
    let hospital_name = "Hospital Name".to_string();

    let data = HospitalBrandingPrintData {
        hospital_name,
        hospital_tagline: Some("Excellence in Healthcare".to_string()),
        logo_url: "/assets/logo.png".to_string(),
        logo_position: "Left".to_string(),
        logo_size: "Medium".to_string(),
        secondary_logo_url: None,
        header_style: "Standard".to_string(),
        header_background_color: Some("#1a365d".to_string()),
        header_text_color: Some("#ffffff".to_string()),
        footer_style: "Standard".to_string(),
        address_line_1: "Hospital Address Line 1".to_string(),
        address_line_2: Some("Hospital Address Line 2".to_string()),
        city: "City".to_string(),
        state: "State".to_string(),
        pincode: "123456".to_string(),
        phone_numbers: vec!["+91 1234567890".to_string(), "+91 9876543210".to_string()],
        email: "info@hospital.com".to_string(),
        website: Some("www.hospital.com".to_string()),
        registration_numbers: vec![
            HospitalRegistration {
                registration_type: "Clinical Establishment".to_string(),
                registration_number: "CEA/2024/12345".to_string(),
                valid_until: Some("2029-12-31".to_string()),
            },
            HospitalRegistration {
                registration_type: "Drug License".to_string(),
                registration_number: "DL/2024/67890".to_string(),
                valid_until: Some("2027-03-31".to_string()),
            },
        ],
        accreditations: vec![
            "NABH Accredited".to_string(),
            "ISO 9001:2015 Certified".to_string(),
        ],
        iso_certifications: vec!["ISO 9001:2015".to_string()],
        nabh_accredited: true,
        nabl_accredited: true,
        jci_accredited: false,
        watermark_text: Some("CONFIDENTIAL".to_string()),
        watermark_opacity: 0.1,
        footer_disclaimer: Some(
            "This document is computer generated and does not require physical signature."
                .to_string(),
        ),
    };

    Ok(Json(data))
}
