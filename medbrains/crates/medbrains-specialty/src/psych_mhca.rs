//! What the Mental Healthcare Act 2017 requires before a record may exist.
//!
//! Only what the Act clearly specifies is encoded:
//!
//! - s.86 independent: an adult, needing at most minimal support to decide.
//! - s.87 minor: applied for by the nominated representative; examined by
//!   two of {psychiatrist + psychiatrist | MHP | medical practitioner} on the
//!   day of admission or the seven days before; housed apart from adults with
//!   the representative or an attendant present; Board told within 72 hours.
//! - s.89 supported: an adult needing very high support; applied for by the
//!   nominated representative; examined by a psychiatrist and an MHP or a
//!   medical practitioner within those seven days; at least one statutory
//!   criterion; certified least restrictive; at most 30 days; Board told
//!   within 3 days for a woman or minor, otherwise 7; no readmission under
//!   s.89 within 7 days of an s.89 discharge — that is an s.90 question.
//! - s.90 beyond 30 days: two psychiatrists; Board told within 7 days and
//!   decides within 21; periods of 90, then 120, then 180 days.
//! - s.94 emergency: at most 72 hours, and never ECT.
//! - s.95: no ECT for a minor without the guardian's consent and the Board's
//!   prior permission.
//! - s.97: no seclusion at all; physical restraint only as the last means,
//!   authorised by the psychiatrist in charge, method recorded.

use chrono::{DateTime, Duration, Utc};
use medbrains_core::specialty::psychiatry::PsychAdmissionCategory;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

const ADULT_AGE: i32 = 18;
const EXAM_WINDOW_DAYS: i64 = 7;
const S89_MAX_DAYS: i64 = 30;
const S89_READMISSION_BAR_DAYS: i64 = 7;
const S94_MAX_HOURS: i64 = 72;
const MINOR_BOARD_REPORT_HOURS: i64 = 72;
const SHORT_BOARD_REPORT_DAYS: i64 = 3;
const BOARD_REPORT_DAYS: i64 = 7;
const S90_BOARD_DECISION_DAYS: i64 = 21;
const S90_PERIODS_DAYS: [i64; 3] = [90, 120, 180];

/// Who examined the patient for admission.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExaminerRole {
    Psychiatrist,
    MentalHealthProfessional,
    MedicalPractitioner,
}

impl ExaminerRole {
    pub fn parse(code: &str) -> Result<Self, AppError> {
        match code {
            "psychiatrist" => Ok(Self::Psychiatrist),
            "mental_health_professional" => Ok(Self::MentalHealthProfessional),
            "medical_practitioner" => Ok(Self::MedicalPractitioner),
            other => Err(AppError::BadRequest(format!(
                "unknown examiner role '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Examination {
    pub user_id: Uuid,
    pub role: ExaminerRole,
    pub examined_at: DateTime<Utc>,
}

/// What the clinician asserts about this admission.
#[derive(Debug, Clone)]
pub struct AdmissionInput {
    pub category: PsychAdmissionCategory,
    pub admitted_at: DateTime<Utc>,
    pub applicant: String,
    pub criteria: Vec<String>,
    pub least_restrictive_certified: bool,
    pub needs_high_support: bool,
    pub minor_safeguards_confirmed: bool,
    pub examinations: Vec<Examination>,
    pub extension_number: i32,
}

/// What the record says about the patient.
#[derive(Debug, Clone, Copy)]
pub struct AdmissionFacts {
    pub age_years: Option<i32>,
    pub is_woman: bool,
    pub has_nominated_rep: bool,
    pub last_s89_discharge: Option<DateTime<Utc>>,
}

/// The deadlines that follow from a lawful admission.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AdmissionPlan {
    pub period_ends_at: Option<DateTime<Utc>>,
    pub board_report_due_at: Option<DateTime<Utc>>,
    pub board_decision_due_at: Option<DateTime<Utc>>,
}

const SUPPORT_CRITERIA: [&str; 3] = ["self_harm", "harm_to_others", "unable_to_self_care"];
const EMERGENCY_CRITERIA: [&str; 4] = [
    "self_harm",
    "harm_to_others",
    "unable_to_self_care",
    "property_damage",
];

struct Problems(Vec<String>);

impl Problems {
    fn require(&mut self, ok: bool, why: &str) {
        if !ok {
            self.0.push(why.to_owned());
        }
    }
}

fn adult(facts: AdmissionFacts) -> Option<bool> {
    facts.age_years.map(|a| a >= ADULT_AGE)
}

fn check_age(p: &mut Problems, facts: AdmissionFacts, want_adult: bool) {
    match adult(facts) {
        None => p.0.push(
            "Record the patient's date of birth: the section depends on whether they are a minor"
                .to_owned(),
        ),
        Some(is_adult) if is_adult != want_adult => p.0.push(if want_adult {
            "This section is for adults; a minor is admitted under s.87".to_owned()
        } else {
            "s.87 is for minors; this patient is an adult".to_owned()
        }),
        Some(_) => {}
    }
}

fn check_examinations(p: &mut Problems, input: &AdmissionInput, two_psychiatrists: bool) {
    let exams = &input.examinations;
    if exams.len() != 2 {
        p.0.push("Two independent examinations are required".to_owned());
        return;
    }
    p.require(
        exams[0].user_id != exams[1].user_id,
        "The two examinations must be by different people",
    );
    let psychiatrists = exams
        .iter()
        .filter(|e| e.role == ExaminerRole::Psychiatrist)
        .count();
    if two_psychiatrists {
        p.require(psychiatrists == 2, "s.90 requires two psychiatrists");
    } else {
        p.require(
            psychiatrists >= 1,
            "One of the examiners must be a psychiatrist",
        );
    }
    let earliest = input.admitted_at - Duration::days(EXAM_WINDOW_DAYS);
    let latest = input.admitted_at + Duration::days(1);
    p.require(
        exams
            .iter()
            .all(|e| e.examined_at >= earliest && e.examined_at <= latest),
        "Examinations must be on the day of admission or in the seven days before",
    );
}

fn check_criteria(p: &mut Problems, criteria: &[String], allowed: &[&str]) {
    p.require(
        !criteria.is_empty(),
        "Record which statutory criterion the admission rests on",
    );
    p.require(
        criteria.iter().all(|c| allowed.contains(&c.as_str())),
        "A criterion is not one this section recognises",
    );
}

fn check_represented(p: &mut Problems, input: &AdmissionInput, facts: AdmissionFacts) {
    p.require(
        input.applicant == "nominated_representative",
        "This section is applied for by the nominated representative",
    );
    p.require(
        facts.has_nominated_rep,
        "Record the patient's nominated representative (s.14) first",
    );
}

/// Check `input` against its section and work out its deadlines.
///
/// # Errors
/// Every unmet requirement, in one `BadRequest`, so the clinician fixes them
/// together rather than one rejection at a time.
pub fn plan_admission(
    input: &AdmissionInput,
    facts: AdmissionFacts,
) -> Result<AdmissionPlan, AppError> {
    let mut p = Problems(Vec::new());
    let at = input.admitted_at;
    let plan = match input.category {
        PsychAdmissionCategory::Independent => {
            check_age(&mut p, facts, true);
            p.require(
                input.applicant == "self",
                "An independent admission is the patient's own request",
            );
            p.require(
                !input.needs_high_support,
                "A patient needing high support cannot be admitted as independent (s.86(3))",
            );
            AdmissionPlan {
                period_ends_at: None,
                board_report_due_at: None,
                board_decision_due_at: None,
            }
        }
        PsychAdmissionCategory::MinorSupported => {
            check_age(&mut p, facts, false);
            check_represented(&mut p, input, facts);
            check_examinations(&mut p, input, false);
            p.require(
                input.minor_safeguards_confirmed,
                "Confirm the minor is housed apart from adults with the representative or an attendant present",
            );
            AdmissionPlan {
                period_ends_at: None,
                board_report_due_at: Some(at + Duration::hours(MINOR_BOARD_REPORT_HOURS)),
                board_decision_due_at: None,
            }
        }
        PsychAdmissionCategory::Supported => {
            check_age(&mut p, facts, true);
            check_represented(&mut p, input, facts);
            check_examinations(&mut p, input, false);
            check_criteria(&mut p, &input.criteria, &SUPPORT_CRITERIA);
            p.require(
                input.least_restrictive_certified,
                "Both examiners must certify admission is the least restrictive option",
            );
            p.require(
                input.needs_high_support,
                "s.89 is for a patient needing very high support to decide",
            );
            if let Some(last) = facts.last_s89_discharge {
                p.require(
                    at - last >= Duration::days(S89_READMISSION_BAR_DAYS),
                    "Discharged from an s.89 admission in the last seven days: readmit under s.90",
                );
            }
            let report_days = if facts.is_woman || adult(facts) == Some(false) {
                SHORT_BOARD_REPORT_DAYS
            } else {
                BOARD_REPORT_DAYS
            };
            AdmissionPlan {
                period_ends_at: Some(at + Duration::days(S89_MAX_DAYS)),
                board_report_due_at: Some(at + Duration::days(report_days)),
                board_decision_due_at: None,
            }
        }
        PsychAdmissionCategory::SupportedExtended => {
            check_age(&mut p, facts, true);
            check_represented(&mut p, input, facts);
            check_examinations(&mut p, input, true);
            check_criteria(&mut p, &input.criteria, &SUPPORT_CRITERIA);
            p.require(
                input.least_restrictive_certified,
                "Both psychiatrists must certify admission is the least restrictive option",
            );
            p.require(
                input.needs_high_support,
                "s.90 is for a patient needing very high support to decide",
            );
            let step = usize::try_from(input.extension_number)
                .unwrap_or(0)
                .min(S90_PERIODS_DAYS.len() - 1);
            AdmissionPlan {
                period_ends_at: Some(at + Duration::days(S90_PERIODS_DAYS[step])),
                board_report_due_at: Some(at + Duration::days(BOARD_REPORT_DAYS)),
                board_decision_due_at: Some(at + Duration::days(S90_BOARD_DECISION_DAYS)),
            }
        }
        PsychAdmissionCategory::Emergency => {
            check_criteria(&mut p, &input.criteria, &EMERGENCY_CRITERIA);
            AdmissionPlan {
                period_ends_at: Some(at + Duration::hours(S94_MAX_HOURS)),
                board_report_due_at: None,
                board_decision_due_at: None,
            }
        }
    };
    if p.0.is_empty() {
        Ok(plan)
    } else {
        Err(AppError::BadRequest(p.0.join(". ")))
    }
}

/// s.97: seclusion is prohibited outright; restraint needs its method and
/// the last-resort attestation.
///
/// # Errors
/// `BadRequest` naming the requirement.
pub fn validate_restraint(kind: &str, method: &str, last_resort: bool) -> Result<(), AppError> {
    if kind == "seclusion" {
        return Err(AppError::BadRequest(
            "Seclusion and solitary confinement are prohibited (Mental Healthcare Act 2017 s.97(1))"
                .to_owned(),
        ));
    }
    if method.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Record the method and nature of the restraint (s.97(3))".to_owned(),
        ));
    }
    if !last_resort {
        return Err(AppError::BadRequest(
            "Restraint is lawful only as the last means to prevent imminent harm, never as \
             punishment or for want of staff (s.97(1), (4))"
                .to_owned(),
        ));
    }
    Ok(())
}

/// s.94 and s.95 for one ECT session.
///
/// # Errors
/// `BadRequest` during emergency treatment, or for a minor without consent
/// and the Board's permission; a database fault as itself.
pub async fn check_ect_allowed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    psych_patient_id: Uuid,
    consent_recorded: bool,
    board_permission_ref: Option<&str>,
) -> Result<(), AppError> {
    let row = sqlx::query!(
        r#"SELECT (date_part('year', age(p.date_of_birth)) < 18) AS "is_minor?",
                  EXISTS (SELECT 1 FROM psych_admissions a
                           WHERE a.psych_patient_id = pp.id AND a.category = 'emergency'
                             AND a.discharged_at IS NULL AND a.deleted_at IS NULL
                             AND a.period_ends_at > now()) AS "in_emergency!"
             FROM psych_patients pp JOIN patients p ON p.id = pp.patient_id
            WHERE pp.id = $1 AND pp.tenant_id = $2"#,
        psych_patient_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if row.in_emergency {
        return Err(AppError::BadRequest(
            "ECT cannot be given as emergency treatment (s.94). End the emergency admission first."
                .to_owned(),
        ));
    }
    let has_permission = board_permission_ref.is_some_and(|r| !r.trim().is_empty());
    if row.is_minor == Some(true) && !(consent_recorded && has_permission) {
        return Err(AppError::BadRequest(
            "ECT for a minor needs the guardian's informed consent and the Board's prior \
             permission — record the permission reference (s.95(2))."
                .to_owned(),
        ));
    }
    Ok(())
}

#[cfg(test)]
#[path = "psych_mhca_tests.rs"]
mod tests;
