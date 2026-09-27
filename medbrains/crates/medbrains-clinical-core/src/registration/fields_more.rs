//! Steps 3 and 4: family, address and safety flags; preferences and billing.

use super::catalogue::{Check, Field, Kind, Options, Rule, Step, cond, plain, rule};
use super::options::{CATEGORY, DIET, FINANCIAL_CLASS, MARITAL_STATUS, ROOM_CLASS};

const ON: &[&str] = &["true"];

const fn with(field: Field, options: Options, rules: &'static [Rule]) -> Field {
    Field {
        options,
        rules,
        ..field
    }
}

const PHONE_SHAPE: Rule = rule(Check::PhoneShape, "Enter a phone number of 10 to 15 digits");

const fn family(id: &'static str, label: &'static str, kind: Kind) -> Field {
    plain(id, label, Step::FamilyAddressSafety, kind)
}

const fn prefs(id: &'static str, label: &'static str, kind: Kind) -> Field {
    plain(id, label, Step::PreferencesBilling, kind)
}

pub(super) const FAMILY_ADDRESS_SAFETY: &[Field] = &[
    family("is_medico_legal", "Medico-legal case", Kind::Toggle),
    with(
        family("mlc_number", "MLC number", Kind::Text),
        Options::None,
        &[Rule {
            when: &[cond("is_medico_legal", ON)],
            ..rule(
                Check::Required,
                "MLC number is required for a medico-legal registration",
            )
        }],
    ),
    family("is_vip", "VIP", Kind::Toggle),
    family("father_name", "Father's name", Kind::Text),
    family("guardian_name", "Guardian's name", Kind::Text),
    family("guardian_relation", "Guardian's relation", Kind::Text),
    with(
        family("marital_status", "Marital status", Kind::Select),
        Options::Fixed(MARITAL_STATUS),
        &[],
    ),
    family("religion", "Religion", Kind::Text),
    family("occupation", "Occupation", Kind::Text),
    family("address.line1", "Address line 1", Kind::Text),
    family("address.line2", "Address line 2", Kind::Text),
    family("address.landmark", "Landmark", Kind::Text),
    family("address.city", "City / village", Kind::Text),
    family("address.district", "District", Kind::Text),
    family("address.state", "State", Kind::Text),
    family("address.postal_code", "PIN code", Kind::Digits),
    family("address.country", "Country", Kind::Text),
    family("attributes.next_of_kin.name", "Next of kin", Kind::Text),
    family(
        "attributes.next_of_kin.relation",
        "Next of kin's relation",
        Kind::Text,
    ),
    with(
        family(
            "attributes.next_of_kin.phone",
            "Next of kin's phone",
            Kind::Phone,
        ),
        Options::None,
        &[PHONE_SHAPE],
    ),
    family(
        "attributes.emergency_contact.name",
        "Emergency contact",
        Kind::Text,
    ),
    family(
        "attributes.emergency_contact.relation",
        "Emergency contact's relation",
        Kind::Text,
    ),
    with(
        family(
            "attributes.emergency_contact.phone",
            "Emergency contact's phone",
            Kind::Phone,
        ),
        Options::None,
        &[PHONE_SHAPE],
    ),
];

pub(super) const PREFERENCES_BILLING: &[Field] = &[
    // Said "known allergies" and named none: the next clinician learns nothing.
    with(
        prefs(
            "attributes.known_allergies",
            "Known allergies",
            Kind::LongText,
        ),
        Options::None,
        &[Rule {
            when: &[cond("attributes.allergy_status", &["known_allergies"])],
            ..rule(Check::Required, "List the known allergies")
        }],
    ),
    with(
        prefs("attributes.drug_allergies", "Drug allergies", Kind::Tags),
        Options::DrugCatalogue,
        &[],
    ),
    with(
        prefs(
            "attributes.preferred_room_class",
            "Preferred room",
            Kind::Select,
        ),
        Options::Fixed(ROOM_CLASS),
        &[],
    ),
    with(
        prefs("attributes.dietary_preference", "Diet", Kind::Select),
        Options::Fixed(DIET),
        &[],
    ),
    prefs(
        "attributes.dietary_restrictions",
        "Dietary restrictions",
        Kind::Text,
    ),
    prefs(
        "attributes.religious_observances",
        "Religious observances",
        Kind::Text,
    ),
    prefs(
        "attributes.language_preference",
        "Preferred language",
        Kind::Text,
    ),
    with(
        prefs(
            "attributes.primary_physician_id",
            "Primary physician",
            Kind::Select,
        ),
        Options::Doctors,
        &[],
    ),
    prefs(
        "attributes.primary_physician_name",
        "Primary physician (outside)",
        Kind::Text,
    ),
    prefs(
        "attributes.secondary_insurance.provider",
        "Secondary insurance",
        Kind::Text,
    ),
    prefs(
        "attributes.secondary_insurance.policy_no",
        "Policy number",
        Kind::Text,
    ),
    with(
        prefs(
            "attributes.attendant_passes_count",
            "Attendant passes",
            Kind::Number,
        ),
        Options::None,
        &[rule(
            // A guard against a stray keystroke, not a policy on visitors.
            Check::IntRange {
                min: 0,
                max: 1_000_000,
            },
            "Attendant passes is a whole number",
        )],
    ),
    with(
        prefs("category", "Patient category", Kind::Select),
        Options::Fixed(CATEGORY),
        &[],
    ),
    with(
        prefs("financial_class", "Financial class", Kind::Select),
        Options::Fixed(FINANCIAL_CLASS),
        &[],
    ),
];
