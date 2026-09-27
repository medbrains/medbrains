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
//!   the person knows), a sex the desk actually chose (a default recorded
//!   every untouched patient as female), an answer to "any allergies?" —
//!   even if it is "not asked yet" — so nobody reads a silence as none, a
//!   phone that can receive the portal code, an MLC number when the case is
//!   medico-legal, who referred a referral, and a 14-digit ABHA when one is
//!   given. The server enforces the same; this stops the tap.

pub mod catalogue;
mod fields_intake;
mod fields_more;
pub mod fixtures;
pub mod options;
pub mod rules;

pub use catalogue::{Catalogue, Field, STEPS, StepTitle};
pub use rules::Draft;

#[cfg(test)]
mod tests_rules;

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
    /// One of the catalogue's sexes; empty until the desk chooses.
    pub gender: String,
    /// One of the catalogue's allergy answers.
    pub allergy_status: String,
    /// What they are allergic to, when the answer is "known allergies".
    pub known_allergies: String,
    pub registration_source: String,
    pub referred_by_name: String,
    pub is_medico_legal: bool,
    pub mlc_number: String,
    pub abha_number: String,
}

/// The whole form: every step and field, in order.
#[must_use]
pub fn catalogue() -> Catalogue {
    Catalogue {
        steps: STEPS
            .iter()
            .map(|&(step, title)| StepTitle { step, title })
            .collect(),
        fields: fields().copied().collect(),
    }
}

/// Every field, step by step.
pub fn fields() -> impl Iterator<Item = &'static Field> {
    fields_intake::INTAKE
        .iter()
        .chain(fields_intake::CONTACT_IDENTITY)
        .chain(fields_more::FAMILY_ADDRESS_SAFETY)
        .chain(fields_more::PREFERENCES_BILLING)
}

/// The catalogue as JSON, for the native apps and the web generator.
#[must_use]
pub fn catalogue_json() -> String {
    serde_json::to_string(&catalogue()).unwrap_or_default()
}

/// Every problem with a draft (field id → value), in the form's order.
#[must_use]
pub fn registration_problems(draft: &Draft) -> Vec<RegistrationProblem> {
    let all: Vec<Field> = fields().copied().collect();
    rules::problems(&all, draft)
}

impl RegistrationDraft {
    /// The same answers as field id → value, for the catalogue's rules.
    #[must_use]
    pub fn to_draft(&self) -> Draft {
        let flag = |b: bool| if b { "true" } else { "false" }.to_owned();
        [
            ("first_name", self.first_name.clone()),
            ("last_name", self.last_name.clone()),
            ("phone", self.phone.clone()),
            ("date_of_birth", self.date_of_birth.clone()),
            (
                "age_years",
                self.age_years.map(|a| a.to_string()).unwrap_or_default(),
            ),
            ("gender", self.gender.clone()),
            ("attributes.allergy_status", self.allergy_status.clone()),
            ("attributes.known_allergies", self.known_allergies.clone()),
            ("registration_source", self.registration_source.clone()),
            ("referred_by_name", self.referred_by_name.clone()),
            ("is_medico_legal", flag(self.is_medico_legal)),
            ("mlc_number", self.mlc_number.clone()),
            ("abha_number", self.abha_number.clone()),
        ]
        .into_iter()
        .map(|(k, v)| (k.to_owned(), v))
        .collect()
    }
}

/// The first thing that stops this registration, or none — the one-screen
/// intake's question, answered by the same rules as the full form.
#[must_use]
pub fn registration_problem(draft: &RegistrationDraft) -> Option<RegistrationProblem> {
    registration_problems(&draft.to_draft())
        .into_iter()
        .next()
        .map(|p| RegistrationProblem {
            // The one-screen intake names this field without its `attributes.` path.
            field: p
                .field
                .strip_prefix("attributes.")
                .unwrap_or(&p.field)
                .to_owned(),
            message: p.message,
        })
}

/// A date of birth for someone who only knows their age: 1 January of the
/// year they were born, marked estimated by the caller.
#[must_use]
pub fn estimated_date_of_birth(age_years: u32, today_year: i32) -> String {
    format!(
        "{:04}-01-01",
        today_year - i32::try_from(age_years).unwrap_or(0)
    )
}

#[cfg(test)]
mod tests {
    use super::{
        RegistrationDraft, estimated_date_of_birth, registration_action, registration_carries_over,
        registration_problem,
    };

    fn good() -> RegistrationDraft {
        RegistrationDraft {
            first_name: "Asha".into(),
            last_name: "Rao".into(),
            phone: "9876543210".into(),
            date_of_birth: "1988-05-05".into(),
            gender: "female".into(),
            allergy_status: "not_asked_yet".into(),
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
        // Consent is the person's own answer. Carrying it to the next walk-in
        // would record a yes that patient never gave.
        assert!(!registration_carries_over("whatsapp_opt_in"));
        assert!(!registration_carries_over("email_opt_in"));
    }

    #[test]
    fn a_second_identifier_is_required() {
        let mut d = good();
        d.date_of_birth.clear();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("date_of_birth".into())
        );
        d.age_years = Some(36);
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn a_medico_legal_case_needs_its_number() {
        let mut d = good();
        d.is_medico_legal = true;
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("mlc_number".into())
        );
        d.mlc_number = "MLC/2026/17".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn phone_and_abha_have_shapes() {
        let mut d = good();
        d.phone = "12345".into();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("phone".into())
        );
        d.phone = "+91 98765 43210".into();
        assert_eq!(registration_problem(&d), None);
        d.abha_number = "12-3456-7890-12".into();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("abha_number".into())
        );
        d.abha_number = "12-3456-7890-1234".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn the_desk_must_choose_a_sex() {
        let mut d = good();
        d.gender.clear();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("gender".into())
        );
        d.gender = "unknown".into();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("gender".into())
        );
        d.gender = "male".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn allergies_are_answered_even_if_not_asked_yet() {
        let mut d = good();
        d.allergy_status.clear();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("allergy_status".into())
        );
        // "Known allergies" and none named tells the next clinician nothing.
        d.allergy_status = "known_allergies".into();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("known_allergies".into())
        );
        d.known_allergies = "Penicillin — rash".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn a_referral_names_who_referred() {
        let mut d = good();
        d.registration_source = "referral".into();
        assert_eq!(
            registration_problem(&d).map(|p| p.field),
            Some("referred_by_name".into())
        );
        d.referred_by_name = "Dr Iyer, PHC Kottur".into();
        assert_eq!(registration_problem(&d), None);
    }

    #[test]
    fn age_becomes_the_first_of_january() {
        assert_eq!(estimated_date_of_birth(36, 2026), "1990-01-01");
    }
}
