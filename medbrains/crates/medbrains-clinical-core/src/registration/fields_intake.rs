//! Steps 1 and 2: who the person is, how to reach them, who sent them.

use super::catalogue::{Check, Cond, Field, Kind, Options, Rule, Step, cond, plain, rule};
use super::options::{
    ALLERGY_STATUS, BLOOD_GROUP, CONTACT_METHOD, GENDER, PREFIX, REFERRED_BY_KIND,
    REFERRED_BY_SOMEONE, REGISTRATION_SOURCE, REGISTRATION_TYPE,
};

const UNKNOWN: Cond = cond("is_unknown_patient", &["true"]);
const ON: &[&str] = &["true"];

const fn with(field: Field, options: Options, rules: &'static [Rule]) -> Field {
    Field {
        options,
        rules,
        ..field
    }
}

const fn hinted(field: Field, hint: &'static str) -> Field {
    Field {
        hint: Some(hint),
        ..field
    }
}

const fn desk_only(field: Field) -> Field {
    Field {
        sent: false,
        ..field
    }
}

const NAME_LENGTH: Rule = rule(
    Check::MaxLen { max: 100 },
    "Keep the name under 100 characters",
);
const PHONE_SHAPE: Rule = rule(Check::PhoneShape, "Enter a phone number of 10 to 15 digits");

pub(super) const INTAKE: &[Field] = &[
    hinted(
        plain(
            "is_unknown_patient",
            "Unknown patient",
            Step::Intake,
            Kind::Toggle,
        ),
        "Unconscious or unidentified: register now, name them when you can.",
    ),
    with(
        plain("prefix", "Prefix", Step::Intake, Kind::Select),
        Options::Fixed(PREFIX),
        &[],
    ),
    with(
        plain("first_name", "First name", Step::Intake, Kind::Text),
        Options::None,
        &[
            Rule {
                unless: &[UNKNOWN],
                ..rule(Check::Required, "First name is required")
            },
            NAME_LENGTH,
        ],
    ),
    with(
        plain("middle_name", "Middle name", Step::Intake, Kind::Text),
        Options::None,
        &[NAME_LENGTH],
    ),
    hinted(
        with(
            plain("last_name", "Last name", Step::Intake, Kind::Text),
            Options::None,
            &[NAME_LENGTH],
        ),
        "Leave empty for someone with a single name.",
    ),
    desk_only(with(
        plain("age_years", "Age in years", Step::Intake, Kind::Age),
        Options::None,
        &[rule(
            Check::IntRange { min: 0, max: 125 },
            "Age must be between 0 and 125",
        )],
    )),
    with(
        plain("date_of_birth", "Date of birth", Step::Intake, Kind::Date),
        Options::None,
        &[Rule {
            unless: &[UNKNOWN, cond("age_years", &["*"])],
            ..rule(
                Check::Required,
                "Date of birth or age is needed — it is the second identifier",
            )
        }],
    ),
    with(
        plain("gender", "Sex", Step::Intake, Kind::Segmented),
        Options::Fixed(GENDER),
        &[
            Rule {
                unless: &[UNKNOWN],
                ..rule(Check::Required, "Choose the patient's sex")
            },
            // An unknown patient is sent as "unknown" — the one value the
            // desk cannot choose, and the one the record must then carry.
            Rule {
                unless: &[UNKNOWN],
                ..rule(Check::OneOfOptions, "Choose the patient's sex")
            },
        ],
    ),
    with(
        plain("blood_group", "Blood group", Step::Intake, Kind::Select),
        Options::Fixed(BLOOD_GROUP),
        &[],
    ),
    with(
        plain("phone", "Phone", Step::Intake, Kind::Phone),
        Options::None,
        &[
            Rule {
                unless: &[UNKNOWN, cond("attributes.has_no_phone", ON)],
                ..rule(
                    Check::Required,
                    "Enter a phone number, or tick Has no phone",
                )
            },
            PHONE_SHAPE,
        ],
    ),
    hinted(
        plain(
            "attributes.has_no_phone",
            "Has no phone",
            Step::Intake,
            Kind::Toggle,
        ),
        "Many elderly patients have none; the record says so rather than a made-up number.",
    ),
    with(
        plain(
            "phone_secondary",
            "Alternate phone",
            Step::Intake,
            Kind::Phone,
        ),
        Options::None,
        &[PHONE_SHAPE],
    ),
    with(
        plain(
            "registration_type",
            "Registration type",
            Step::Intake,
            Kind::Select,
        ),
        Options::Fixed(REGISTRATION_TYPE),
        &[],
    ),
    with(
        plain(
            "registration_source",
            "Coming from",
            Step::Intake,
            Kind::Select,
        ),
        Options::Fixed(REGISTRATION_SOURCE),
        &[],
    ),
    with(
        plain("camp_id", "Camp", Step::Intake, Kind::Select),
        Options::Camps,
        &[
            Rule {
                when: &[
                    cond("registration_type", &["camp"]),
                    cond("registration_source", &["camp"]),
                ],
                ..rule(
                    Check::AnyFilled {
                        fields: &["camp_id", "camp_name"],
                    },
                    "Choose the camp, or type its name",
                )
            },
            // A typed camp name is enough to register, not to open a camp visit.
            Rule {
                when: &[
                    cond("registration_type", &["camp"]),
                    cond("registration_source", &["camp"]),
                ],
                when_all: &[cond("create_opd_visit", ON)],
                ..rule(
                    Check::Required,
                    "Choose the camp itself before sending a camp patient to OPD",
                )
            },
        ],
    ),
    plain("camp_name", "Camp name", Step::Intake, Kind::Text),
    with(
        plain("department_id", "Department", Step::Intake, Kind::Select),
        Options::Departments,
        &[Rule {
            when: &[cond("create_opd_visit", ON)],
            ..rule(Check::Required, "Choose the department for the OPD visit")
        }],
    ),
    with(
        plain("consultant_id", "Consultant", Step::Intake, Kind::Select),
        Options::Doctors,
        &[],
    ),
    plain("clinical_unit", "Clinical unit", Step::Intake, Kind::Text),
    plain(
        "initial_diagnosis_text",
        "Provisional diagnosis",
        Step::Intake,
        Kind::LongText,
    ),
    desk_only(plain(
        "create_opd_visit",
        "Send to OPD queue",
        Step::Intake,
        Kind::Toggle,
    )),
    with(
        plain(
            "attributes.allergy_status",
            "Allergies",
            Step::Intake,
            Kind::Segmented,
        ),
        Options::Fixed(ALLERGY_STATUS),
        &[
            rule(Check::Required, "Record whether allergies were asked about"),
            rule(
                Check::OneOfOptions,
                "Record whether allergies were asked about",
            ),
        ],
    ),
];

pub(super) const CONTACT_IDENTITY: &[Field] = &[
    with(
        plain("email", "Email", Step::ContactIdentity, Kind::Email),
        Options::None,
        &[
            rule(Check::Email, "Enter a valid email address"),
            Rule {
                when: &[cond("contact.email_opt_in", ON)],
                ..rule(
                    Check::Required,
                    "Add an email address to send email updates",
                )
            },
        ],
    ),
    with(
        plain(
            "contact.preferred_method",
            "Preferred contact",
            Step::ContactIdentity,
            Kind::Select,
        ),
        Options::Fixed(CONTACT_METHOD),
        &[],
    ),
    with(
        plain(
            "contact.whatsapp_opt_in",
            "Hospital updates on WhatsApp",
            Step::ContactIdentity,
            Kind::Toggle,
        ),
        Options::None,
        &[Rule {
            when: &[cond("contact.preferred_method", &["whatsapp"])],
            ..rule(
                Check::Checked,
                "Ask for WhatsApp consent before preferring WhatsApp",
            )
        }],
    ),
    with(
        plain(
            "contact.email_opt_in",
            "Hospital updates by email",
            Step::ContactIdentity,
            Kind::Toggle,
        ),
        Options::None,
        &[Rule {
            when: &[cond("contact.preferred_method", &["email"])],
            ..rule(
                Check::Checked,
                "Ask for email consent before preferring email",
            )
        }],
    ),
    with(
        plain(
            "abha_number",
            "ABHA number",
            Step::ContactIdentity,
            Kind::Digits,
        ),
        Options::None,
        &[rule(
            Check::Digits { min: 14, max: 14 },
            "ABHA number is 14 digits",
        )],
    ),
    plain(
        "abha_address",
        "ABHA address",
        Step::ContactIdentity,
        Kind::Text,
    ),
    with(
        plain(
            "aadhaar_number",
            "Aadhaar",
            Step::ContactIdentity,
            Kind::Digits,
        ),
        Options::None,
        &[rule(
            Check::Digits { min: 12, max: 12 },
            "Aadhaar is 12 digits",
        )],
    ),
    with(
        plain(
            "attributes.referred_by_kind",
            "Referred by",
            Step::ContactIdentity,
            Kind::Select,
        ),
        Options::Fixed(REFERRED_BY_KIND),
        &[],
    ),
    with(
        plain(
            "attributes.referred_by_user_id",
            "Referring doctor",
            Step::ContactIdentity,
            Kind::Select,
        ),
        Options::Doctors,
        &[],
    ),
    with(
        plain(
            "referred_by_name",
            "Referrer's name",
            Step::ContactIdentity,
            Kind::Text,
        ),
        Options::None,
        &[Rule {
            when: &[
                cond("registration_source", &["referral"]),
                cond("registration_type", &["referral"]),
                cond("attributes.referred_by_kind", REFERRED_BY_SOMEONE),
            ],
            ..rule(
                Check::AnyFilled {
                    fields: &[
                        "referred_by_name",
                        "referred_by_facility",
                        "attributes.referred_by_user_id",
                    ],
                },
                "Name the doctor or facility that referred them",
            )
        }],
    ),
    with(
        plain(
            "referred_by_phone",
            "Referrer's phone",
            Step::ContactIdentity,
            Kind::Phone,
        ),
        Options::None,
        &[PHONE_SHAPE],
    ),
    plain(
        "referred_by_facility",
        "Referring facility",
        Step::ContactIdentity,
        Kind::Text,
    ),
];
