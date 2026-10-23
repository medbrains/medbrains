//! Unit tests for `psych_mhca` — each encodes a clause of the Act.
use super::*;

fn at() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-20T10:00:00Z")
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_default()
}

fn exam(role: ExaminerRole, days_before: i64) -> Examination {
    Examination {
        user_id: Uuid::new_v4(),
        role,
        examined_at: at() - Duration::days(days_before),
    }
}

fn supported() -> AdmissionInput {
    AdmissionInput {
        category: PsychAdmissionCategory::Supported,
        admitted_at: at(),
        applicant: "nominated_representative".to_owned(),
        criteria: vec!["self_harm".to_owned()],
        least_restrictive_certified: true,
        needs_high_support: true,
        minor_safeguards_confirmed: false,
        examinations: vec![
            exam(ExaminerRole::Psychiatrist, 1),
            exam(ExaminerRole::MentalHealthProfessional, 2),
        ],
        extension_number: 0,
    }
}

fn adult_man() -> AdmissionFacts {
    AdmissionFacts {
        age_years: Some(34),
        is_woman: false,
        has_nominated_rep: true,
        last_s89_discharge: None,
    }
}

#[test]
fn a_lawful_s89_runs_30_days_and_reports_in_7() {
    let plan = plan_admission(&supported(), adult_man()).map_err(|e| e.to_string());
    assert_eq!(
        plan.map(|p| (p.period_ends_at, p.board_report_due_at)),
        Ok((
            Some(at() + Duration::days(30)),
            Some(at() + Duration::days(7))
        ))
    );
}

#[test]
fn a_woman_on_s89_is_reported_in_3_days() {
    let facts = AdmissionFacts {
        is_woman: true,
        ..adult_man()
    };
    let plan = plan_admission(&supported(), facts).map_err(|e| e.to_string());
    assert_eq!(
        plan.map(|p| p.board_report_due_at),
        Ok(Some(at() + Duration::days(3)))
    );
}

#[test]
fn s89_without_a_representative_or_psychiatrist_is_refused() {
    let mut input = supported();
    input.examinations[0].role = ExaminerRole::MedicalPractitioner;
    let facts = AdmissionFacts {
        has_nominated_rep: false,
        ..adult_man()
    };
    let err = plan_admission(&input, facts)
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default();
    assert!(err.contains("nominated representative"), "{err}");
    assert!(err.contains("psychiatrist"), "{err}");
}

#[test]
fn an_examination_older_than_seven_days_does_not_count() {
    let mut input = supported();
    input.examinations[1] = exam(ExaminerRole::MedicalPractitioner, 8);
    assert!(plan_admission(&input, adult_man()).is_err());
}

#[test]
fn the_same_person_cannot_be_both_examiners() {
    let mut input = supported();
    input.examinations[1].user_id = input.examinations[0].user_id;
    assert!(plan_admission(&input, adult_man()).is_err());
}

#[test]
fn s89_readmission_within_7_days_must_go_to_s90() {
    let facts = AdmissionFacts {
        last_s89_discharge: Some(at() - Duration::days(3)),
        ..adult_man()
    };
    let err = plan_admission(&supported(), facts)
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default();
    assert!(err.contains("s.90"), "{err}");
}

#[test]
fn s90_needs_two_psychiatrists_and_steps_90_120_180() {
    let mut input = supported();
    input.category = PsychAdmissionCategory::SupportedExtended;
    assert!(plan_admission(&input, adult_man()).is_err());
    input.examinations[1].role = ExaminerRole::Psychiatrist;
    for (ext, days) in [(0, 90), (1, 120), (2, 180), (5, 180)] {
        input.extension_number = ext;
        let plan = plan_admission(&input, adult_man()).map_err(|e| e.to_string());
        assert_eq!(
            plan.map(|p| p.period_ends_at),
            Ok(Some(at() + Duration::days(days)))
        );
    }
}

#[test]
fn a_minor_cannot_be_independent_and_s87_reports_in_72_hours() {
    let child = AdmissionFacts {
        age_years: Some(15),
        ..adult_man()
    };
    let mut input = supported();
    input.category = PsychAdmissionCategory::Independent;
    input.applicant = "self".to_owned();
    input.needs_high_support = false;
    assert!(plan_admission(&input, child).is_err());

    let mut minor = supported();
    minor.category = PsychAdmissionCategory::MinorSupported;
    minor.minor_safeguards_confirmed = true;
    let plan = plan_admission(&minor, child).map_err(|e| e.to_string());
    assert_eq!(
        plan.map(|p| p.board_report_due_at),
        Ok(Some(at() + Duration::hours(72)))
    );
}

#[test]
fn emergency_lasts_72_hours() {
    let mut input = supported();
    input.category = PsychAdmissionCategory::Emergency;
    input.examinations.clear();
    let plan = plan_admission(
        &input,
        AdmissionFacts {
            age_years: None,
            ..adult_man()
        },
    );
    assert_eq!(
        plan.map_err(|e| e.to_string()).map(|p| p.period_ends_at),
        Ok(Some(at() + Duration::hours(72)))
    );
}

#[test]
fn seclusion_is_refused_and_restraint_needs_method_and_last_resort() {
    assert!(validate_restraint("seclusion", "room", true).is_err());
    assert!(validate_restraint("physical", " ", true).is_err());
    assert!(validate_restraint("physical", "four-point", false).is_err());
    assert!(validate_restraint("physical", "four-point", true).is_ok());
}
