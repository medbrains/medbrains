//! Drafts with the problems the rules find in them, written out for the web's
//! TypeScript port of the evaluator to be held to — case for case, so the
//! two can only disagree by failing a test.

use serde::Serialize;

use super::{Draft, RegistrationProblem, registration_problems};

/// A walk-in the desk has finished: the base most cases change one thing in.
const WALK_IN: &[(&str, &str)] = &[
    ("first_name", "Asha"),
    ("phone", "98765 43210"),
    ("age_years", "36"),
    ("gender", "female"),
    ("attributes.allergy_status", "not_asked_yet"),
];

/// Each case changes the finished walk-in, or (when it does not start from
/// it) is the whole draft.
/// A case's name, whether it starts from [`WALK_IN`], and what it changes.
type Case = (&'static str, bool, &'static [(&'static str, &'static str)]);

const CASES: &[Case] = &[
    ("finished walk-in", true, &[]),
    ("empty form", false, &[]),
    ("single name", true, &[("last_name", "")]),
    ("no phone, not said", true, &[("phone", "")]),
    (
        "no phone, said",
        true,
        &[("phone", ""), ("attributes.has_no_phone", "true")],
    ),
    (
        "unknown patient",
        false,
        &[
            ("is_unknown_patient", "true"),
            ("attributes.allergy_status", "not_asked_yet"),
        ],
    ),
    ("sex unknown", true, &[("gender", "unknown")]),
    ("age too high", true, &[("age_years", "126")]),
    (
        "date of birth instead of age",
        true,
        &[("age_years", ""), ("date_of_birth", "1990-01-01")],
    ),
    (
        "phone with punctuation",
        true,
        &[("phone", "+91 (98765) 43210")],
    ),
    ("phone too short", true, &[("phone", "12345")]),
    (
        "camp without camp",
        true,
        &[("registration_source", "camp")],
    ),
    (
        "camp named",
        true,
        &[
            ("registration_type", "camp"),
            ("camp_name", "Kottur school"),
        ],
    ),
    (
        "email updates, no email",
        true,
        &[("contact.email_opt_in", "true")],
    ),
    ("email malformed", true, &[("email", "asha@")]),
    (
        "prefers WhatsApp without consent",
        true,
        &[
            ("contact.preferred_method", "whatsapp"),
            ("contact.whatsapp_opt_in", "false"),
        ],
    ),
    (
        "referral, nobody named",
        true,
        &[("registration_source", "referral")],
    ),
    (
        "ASHA referral, facility named",
        true,
        &[
            ("attributes.referred_by_kind", "asha"),
            ("referred_by_facility", "PHC Kottur"),
        ],
    ),
    (
        "medico-legal without number",
        true,
        &[("is_medico_legal", "true")],
    ),
    (
        "known allergies unnamed",
        true,
        &[("attributes.allergy_status", "known_allergies")],
    ),
    (
        "aadhaar 11 digits",
        true,
        &[("aadhaar_number", "1234 5678 901")],
    ),
    (
        "abha 14 digits",
        true,
        &[("abha_number", "12-3456-7890-1234")],
    ),
    (
        "OPD without department",
        true,
        &[("create_opd_visit", "true")],
    ),
    (
        "camp OPD with only a camp name",
        true,
        &[
            ("registration_source", "camp"),
            ("camp_name", "Kottur"),
            ("create_opd_visit", "true"),
            ("department_id", "d1"),
        ],
    ),
    (
        "long name",
        true,
        &[(
            "first_name",
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        )],
    ),
    (
        "passes not a number",
        true,
        &[("attributes.attendant_passes_count", "two")],
    ),
];

#[derive(Debug, Serialize)]
pub struct Fixture {
    pub name: &'static str,
    pub draft: Draft,
    pub problems: Vec<Problem>,
}

#[derive(Debug, Serialize)]
pub struct Problem {
    pub field: String,
    pub message: String,
}

impl From<RegistrationProblem> for Problem {
    fn from(p: RegistrationProblem) -> Self {
        Self {
            field: p.field,
            message: p.message,
        }
    }
}

/// Every case with the problems the Rust rules find.
#[must_use]
pub fn fixtures() -> Vec<Fixture> {
    CASES
        .iter()
        .map(|&(name, base, changes)| {
            let mut draft: Draft = if base { WALK_IN } else { &[] }
                .iter()
                .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
                .collect();
            for (k, v) in changes {
                draft.insert((*k).to_owned(), (*v).to_owned());
            }
            let problems = registration_problems(&draft)
                .into_iter()
                .map(Problem::from)
                .collect();
            Fixture {
                name,
                draft,
                problems,
            }
        })
        .collect()
}

/// The fixtures as JSON, for the web's test.
#[must_use]
pub fn fixtures_json() -> String {
    serde_json::to_string_pretty(&fixtures()).unwrap_or_default()
}
