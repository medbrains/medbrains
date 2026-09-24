//! The front desk's rules for registering a person, once, for every device.
//!
//! Three decisions the desk makes forty times a morning, each of which was a
//! separate TypeScript copy in the outgoing React Native app and the web:
//!
//! * what to do after the duplicate-patient check — `confirm` (somebody
//!   matched), `proceed` (checked, nobody), or `proceed_unverified` (the check
//!   could not run, so nobody was compared). The third was the one that used
//!   to be missing: "checked, no match" and "never checked" led to the same
//!   silent create, and a missed match is a second UHID for someone who
//!   already has one — allergies and results split across two records.
//!   `POST /api/patients/match` is advisory and `create_patient` does no
//!   matching of its own, so the registrar is the last line and has to be told.
//! * what survives between two walk-ins at the same desk — the desk context
//!   (department, consultant, source, referral) is kept because retyping it
//!   is the drudgery, and the person and anything clinical is cleared because
//!   the previous patient's phone number silently becoming this one's is a
//!   patient-safety hazard, not a saved keystroke.
//! * what stops a registration on the field: the two identifiers the NABH
//!   asks for (name and a date of birth, estimated from age if that is all
//!   the person knows), a phone that can receive the portal code, an MLC
//!   number when the case is medico-legal, and a 14-digit ABHA when one is
//!   given. The server enforces the same; this stops the tap.

/// Outcome of the duplicate-patient check, as the desk should act on it.
#[must_use]
pub const fn registration_action(check_unavailable: bool, matches: u32) -> &'static str {
    if check_unavailable {
        return "proceed_unverified";
    }
    if matches > 0 { "confirm" } else { "proceed" }
}

/// Fields describing the desk, kept for the next walk-in. Everything else —
/// the person and their complaint — is cleared.
const DESK_FIELDS: &[&str] = &[
    "department_id",
    "consultant_id",
    "registration_source",
    "referred_by_name",
    "referred_by_facility",
];

/// Whether a form field is desk context (kept between walk-ins) rather than
/// the person or their visit (cleared).
#[must_use]
pub fn registration_carries_over(field: &str) -> bool {
    DESK_FIELDS.contains(&field)
}

/// A refusal on one field, in the desk's words.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistrationProblem {
    pub field: String,
    pub message: String,
}

/// What the desk typed, as the rules see it.
#[derive(Debug, Clone, Default)]
pub struct RegistrationDraft {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    /// ISO date, or empty when the desk gave an age instead.
    pub date_of_birth: String,
    /// Years, when the person does not know their date of birth.
    pub age_years: Option<u32>,
    pub is_medico_legal: bool,
    pub mlc_number: String,
    pub abha_number: String,
}

fn problem(field: &str, message: &str) -> RegistrationProblem {
    RegistrationProblem { field: field.to_owned(), message: message.to_owned() }
}

/// The first thing that stops this registration, or none.
#[must_use]
pub fn registration_problem(draft: &RegistrationDraft) -> Option<RegistrationProblem> {
    if draft.first_name.trim().is_empty() {
        return Some(problem("first_name", "First name is required"));
    }
    if draft.last_name.trim().is_empty() {
        return Some(problem("last_name", "Last name is required"));
    }
    let digits = draft.phone.chars().filter(char::is_ascii_digit).count();
    if !(10..=15).contains(&digits) || draft.phone.chars().any(|c| !(c.is_ascii_digit() || c == '+' || c == ' ')) {
        return Some(problem("phone", "Enter a phone number of 10 to 15 digits"));
    }
    if draft.date_of_birth.trim().is_empty() && draft.age_years.unwrap_or(0) == 0 {
        return Some(problem("date_of_birth", "Date of birth or age is needed — it is the second identifier"));
    }
    if draft.age_years.unwrap_or(0) > 130 {
        return Some(problem("age_years", "Age must be 130 or less"));
    }
    if draft.is_medico_legal && draft.mlc_number.trim().is_empty() {
        return Some(problem("mlc_number", "MLC number is required for a medico-legal registration"));
    }
    let abha: String = draft.abha_number.chars().filter(char::is_ascii_digit).collect();
    if !draft.abha_number.trim().is_empty() && abha.len() != 14 {
        return Some(problem("abha_number", "ABHA number is 14 digits"));
    }
    None
}

/// A date of birth for someone who only knows their age: 1 January of the
/// year they were born, marked estimated by the caller.
#[must_use]
pub fn estimated_date_of_birth(age_years: u32, today_year: i32) -> String {
    format!("{:04}-01-01", today_year - i32::try_from(age_years).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::{RegistrationDraft, estimated_date_of_birth, registration_action, registration_carries_over, registration_problem};

    fn good() -> RegistrationDraft {
        RegistrationDraft {
            first_name: "Asha".into(),
            last_name: "Rao".into(),
            phone: "9876543210".into(),
            date_of_birth: "1988-05-05".into(),
            ..RegistrationDraft::default()
        }
    }

    #[test]
    fn an_unavailable_check_is_not_a_clean_check() {
        assert_eq!(registration_action(true, 0), "proceed_unverified");
        assert_eq!(registration_action(false, 0), "proceed");
        assert_eq!(registration_action(false, 2), "confirm");
    }

    #[test]
    fn the_desk_is_kept_and_the_person_is_cleared() {
        assert!(registration_carries_over("department_id"));
        assert!(registration_carries_over("referred_by_name"));
        assert!(!registration_carries_over("phone"));
        assert!(!registration_carries_over("first_name"));
        assert!(!registration_carries_over("is_medico_legal"));
        assert!(!registration_carries_over("mlc_number"));
    }

    #[test]
    fn a_second_identifier_is_required() {
        let mut d = good();
        d.date_of_birth.clear();
        assert_eq!(registration_problem(&d).map(|p| p.field), Some("date_of_birth".into()));
        d.age_years = Some(36);
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn a_medico_legal_case_needs_its_number() {
        let mut d = good();
        d.is_medico_legal = true;
        assert_eq!(registration_problem(&d).map(|p| p.field), Some("mlc_number".into()));
        d.mlc_number = "MLC/2026/17".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn phone_and_abha_have_shapes() {
        let mut d = good();
        d.phone = "12345".into();
        assert_eq!(registration_problem(&d).map(|p| p.field), Some("phone".into()));
        d.phone = "+91 98765 43210".into();
        assert_eq!(registration_problem(&d), None);
        d.abha_number = "12-3456-7890-12".into();
        assert_eq!(registration_problem(&d).map(|p| p.field), Some("abha_number".into()));
        d.abha_number = "12-3456-7890-1234".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn age_becomes_the_first_of_january() {
        assert_eq!(estimated_date_of_birth(36, 2026), "1990-01-01");
    }
}
