//! When a field is on the screen at all. The rules decide what is required;
//! this decides what is asked — the MLC number only with a medico-legal
//! case, the camp only for a camp patient, nothing personal for an unknown
//! patient. One table, so web, iOS and Android hide the same things.

use super::catalogue::{Cond, Field, Kind, cond};
use super::options::REFERRED_BY_SOMEONE;
use super::{Draft, fields};

const UNKNOWN: &[Cond] = &[cond("is_unknown_patient", &["true"])];
const CAMP: &[Cond] = &[
    cond("registration_type", &["camp"]),
    cond("registration_source", &["camp"]),
];
const REFERRAL: &[Cond] = &[
    cond("registration_source", &["referral"]),
    cond("registration_type", &["referral"]),
    cond("attributes.referred_by_kind", REFERRED_BY_SOMEONE),
];

/// Field id → shown only when (any of) · hidden when (any of).
const TABLE: &[(&str, &[Cond], &[Cond])] = &[
    ("prefix", &[], UNKNOWN),
    ("first_name", &[], UNKNOWN),
    ("middle_name", &[], UNKNOWN),
    ("last_name", &[], UNKNOWN),
    ("age_years", &[], UNKNOWN),
    ("date_of_birth", &[], UNKNOWN),
    ("gender", &[], UNKNOWN),
    ("phone", &[], UNKNOWN),
    ("attributes.has_no_phone", &[], UNKNOWN),
    ("phone_secondary", &[], UNKNOWN),
    ("camp_id", CAMP, &[]),
    ("camp_name", CAMP, &[]),
    ("attributes.referred_by_user_id", REFERRAL, &[]),
    ("referred_by_name", REFERRAL, &[]),
    ("referred_by_phone", REFERRAL, &[]),
    ("referred_by_facility", REFERRAL, &[]),
    ("mlc_number", &[cond("is_medico_legal", &["true"])], &[]),
    (
        "attributes.known_allergies",
        &[cond("attributes.allergy_status", &["known_allergies"])],
        &[],
    ),
];

/// What a new draft starts with — the web form's own starting values.
/// "Not asked yet" is honest; it is not "none".
const DEFAULTS: &[(&str, &str)] = &[
    ("registration_type", "new"),
    ("registration_source", "walk_in"),
    ("attributes.referred_by_kind", "self"),
    ("attributes.allergy_status", "not_asked_yet"),
];

/// `field` with its visibility and starting value from the tables.
#[must_use]
pub(super) fn with_visibility(field: Field) -> Field {
    let default = DEFAULTS
        .iter()
        .find(|(id, _)| *id == field.id)
        .map(|&(_, v)| v);
    let field = Field { default, ..field };
    TABLE
        .iter()
        .find(|(id, ..)| *id == field.id)
        .map_or(field, |&(_, show_when, hide_when)| Field {
            show_when,
            hide_when,
            ..field
        })
}

fn matches(draft: &Draft, c: &Cond) -> bool {
    let v = draft.get(c.field).map_or("", |v| v.trim());
    c.is.iter().any(|want| {
        if *want == "*" {
            !v.is_empty()
        } else {
            v == *want
        }
    })
}

/// The ids of the fields on screen for `draft`, in the form's order.
#[must_use]
pub fn visible_fields(draft: &Draft) -> Vec<String> {
    fields()
        .map(|f| with_visibility(*f))
        .filter(|f| {
            f.kind != Kind::Hidden
                && (f.show_when.is_empty() || f.show_when.iter().any(|c| matches(draft, c)))
                && !f.hide_when.iter().any(|c| matches(draft, c))
        })
        .map(|f| f.id.to_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{TABLE, visible_fields};
    use crate::registration::fields;
    use crate::registration::tests_rules::draft;

    #[test]
    fn an_unknown_patient_is_asked_nothing_personal() {
        let shown = visible_fields(&draft(&[("is_unknown_patient", "true")]));
        assert!(
            !shown
                .iter()
                .any(|f| f == "first_name" || f == "phone" || f == "gender")
        );
        assert!(shown.iter().any(|f| f == "attributes.allergy_status"));
    }

    #[test]
    fn the_mlc_number_comes_with_the_case() {
        assert!(!visible_fields(&draft(&[])).contains(&"mlc_number".to_owned()));
        assert!(
            visible_fields(&draft(&[("is_medico_legal", "true")]))
                .contains(&"mlc_number".to_owned())
        );
    }

    #[test]
    fn every_row_names_a_real_field() {
        for id in TABLE
            .iter()
            .map(|(id, ..)| *id)
            .chain(super::DEFAULTS.iter().map(|(id, _)| *id))
        {
            assert!(
                fields().any(|f| f.id == id),
                "visibility for unknown field {id}"
            );
        }
    }
}
