//! The full form's rules, one scenario each. The fixtures the web port is
//! held to are written from these same cases (`fixtures.rs`).

use super::{Draft, catalogue, registration_problems};

pub(super) fn draft(pairs: &[(&str, &str)]) -> Draft {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
        .collect()
}

/// A walk-in the desk has finished: nothing wrong with it.
pub(super) const WALK_IN: &[(&str, &str)] = &[
    ("first_name", "Asha"),
    ("phone", "98765 43210"),
    ("age_years", "36"),
    ("gender", "female"),
    ("attributes.allergy_status", "not_asked_yet"),
];

fn walk_in_with(extra: &[(&str, &str)]) -> Draft {
    let mut d = draft(WALK_IN);
    for (k, v) in extra {
        d.insert((*k).to_owned(), (*v).to_owned());
    }
    d
}

pub(super) fn fields_wrong(d: &Draft) -> Vec<String> {
    registration_problems(d)
        .into_iter()
        .map(|p| p.field)
        .collect()
}

#[test]
fn a_finished_walk_in_passes() {
    assert!(fields_wrong(&draft(WALK_IN)).is_empty());
}

#[test]
fn a_single_name_is_a_whole_name() {
    // No last name: many patients have one name.
    assert!(fields_wrong(&walk_in_with(&[("last_name", "")])).is_empty());
}

#[test]
fn no_phone_is_said_not_invented() {
    let d = walk_in_with(&[("phone", "")]);
    assert_eq!(fields_wrong(&d), ["phone"]);
    let d = walk_in_with(&[("phone", ""), ("attributes.has_no_phone", "true")]);
    assert!(fields_wrong(&d).is_empty());
}

#[test]
fn an_unknown_patient_is_registered_without_a_name() {
    let d = draft(&[
        ("is_unknown_patient", "true"),
        ("attributes.allergy_status", "not_asked_yet"),
    ]);
    assert!(fields_wrong(&d).is_empty());
}

#[test]
fn every_problem_is_reported_at_once_in_form_order() {
    let d = draft(&[]);
    assert_eq!(
        fields_wrong(&d),
        [
            "first_name",
            "date_of_birth",
            "gender",
            "phone",
            "attributes.allergy_status"
        ]
    );
}

#[test]
fn a_camp_patient_names_the_camp() {
    let d = walk_in_with(&[("registration_source", "camp")]);
    assert_eq!(fields_wrong(&d), ["camp_id"]);
    assert!(
        fields_wrong(&walk_in_with(&[
            ("registration_source", "camp"),
            ("camp_name", "Kottur school")
        ]))
        .is_empty()
    );
}

#[test]
fn email_updates_need_an_address_and_a_preferred_channel_needs_consent() {
    assert_eq!(
        fields_wrong(&walk_in_with(&[("contact.email_opt_in", "true")])),
        ["email"]
    );
    assert_eq!(
        fields_wrong(&walk_in_with(&[("email", "asha@")])),
        ["email"]
    );
    let d = walk_in_with(&[
        ("contact.preferred_method", "whatsapp"),
        ("contact.whatsapp_opt_in", "false"),
    ]);
    assert_eq!(fields_wrong(&d), ["contact.whatsapp_opt_in"]);
}

#[test]
fn a_referral_by_any_route_names_who_referred() {
    for (k, v) in [
        ("registration_source", "referral"),
        ("registration_type", "referral"),
        ("attributes.referred_by_kind", "asha"),
    ] {
        assert_eq!(
            fields_wrong(&walk_in_with(&[(k, v)])),
            ["referred_by_name"],
            "{k}={v}"
        );
    }
    assert!(fields_wrong(&walk_in_with(&[("attributes.referred_by_kind", "self")])).is_empty());
    let d = walk_in_with(&[
        ("registration_source", "referral"),
        ("referred_by_facility", "PHC Kottur"),
    ]);
    assert!(fields_wrong(&d).is_empty());
}

#[test]
fn known_allergies_are_named() {
    let d = walk_in_with(&[("attributes.allergy_status", "known_allergies")]);
    assert_eq!(fields_wrong(&d), ["attributes.known_allergies"]);
}

#[test]
fn shapes_and_ranges() {
    assert_eq!(
        fields_wrong(&walk_in_with(&[("age_years", "126")])),
        ["age_years"]
    );
    assert_eq!(
        fields_wrong(&walk_in_with(&[("aadhaar_number", "1234 5678 901")])),
        ["aadhaar_number"]
    );
    assert!(fields_wrong(&walk_in_with(&[("aadhaar_number", "1234 5678 9012")])).is_empty());
    assert!(fields_wrong(&walk_in_with(&[("phone", "+91 (98765) 43210")])).is_empty());
    assert_eq!(
        fields_wrong(&walk_in_with(&[("gender", "unknown")])),
        ["gender"]
    );
}

#[test]
fn every_id_is_unique_and_every_rule_names_real_fields() {
    let c = catalogue();
    let ids: std::collections::BTreeSet<&str> = c.fields.iter().map(|f| f.id).collect();
    assert_eq!(ids.len(), c.fields.len(), "duplicate field id");
    for f in &c.fields {
        for r in f.rules {
            for cond in r.when.iter().chain(r.unless) {
                assert!(
                    ids.contains(cond.field),
                    "{} refers to unknown {}",
                    f.id,
                    cond.field
                );
            }
        }
    }
}
