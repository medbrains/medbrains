//! Picking the patient a discovery request describes when no ABHA matches.
//!
//! NHA `USER_INIT_LINK_603`/`606`: among the patients registered on the
//! requester's mobile with the same gender, the one whose name agrees by the
//! registration desk's matcher (`patient_match::names`: spellings, typos,
//! initials, word order) and whose age is within five years.

use medbrains_server_services::patient_match::names::{NameAgreement, compare};
use uuid::Uuid;

/// NHA `USER_INIT_LINK_606`: age agrees within five years either way.
const AGE_TOLERANCE_YEARS: i32 = 5;

/// A patient on the requester's mobile, already of their gender.
#[derive(Debug)]
pub(super) struct Candidate {
    pub(super) id: Uuid,
    pub(super) name: String,
    /// Year of birth; `None` when the record has no date of birth.
    pub(super) year: Option<i32>,
}

/// The one candidate whose name agrees (any agreement short of different)
/// and whose age is within [`AGE_TOLERANCE_YEARS`] of `year`. Two or none
/// is no match: guessing between relatives would link one person's records
/// to another's ABHA.
pub(super) fn pick_by_demographics(
    name: &str,
    year: i32,
    candidates: &[Candidate],
) -> Option<Uuid> {
    let mut agreeing = candidates.iter().filter(|c| {
        c.year
            .is_some_and(|y| (y - year).abs() <= AGE_TOLERANCE_YEARS)
            && compare(name, &c.name) != NameAgreement::Different
    });
    match (agreeing.next(), agreeing.next()) {
        (Some(one), None) => Some(one.id),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{Candidate, pick_by_demographics};

    fn person(name: &str, year: Option<i32>) -> Candidate {
        Candidate {
            id: Uuid::new_v4(),
            name: name.to_owned(),
            year,
        }
    }

    /// Near-miss spellings of the same person are found: a romanisation
    /// variant, a typo, an initial, words in another order.
    #[test]
    fn near_miss_names_of_the_same_person_match() {
        for (typed, registered) in [
            ("Laxmi Devi", "Lakshmi Devi"),
            ("Mohammed Rafi", "Muhammad Rafi"),
            ("Kumar Vijay", "Vijay Kumar"),
            ("K Ravindran", "Kumar Ravindran"),
            ("Sureshh Babu", "Suresh Babu"),
        ] {
            let one = person(registered, Some(1990));
            assert_eq!(
                pick_by_demographics(typed, 1990, std::slice::from_ref(&one)),
                Some(one.id),
                "{typed} / {registered}"
            );
        }
    }

    /// A different person on the same phone is never matched, however close
    /// the surname: "Ram Prasad" is not "Shyam Prasad".
    #[test]
    fn a_different_name_on_the_same_mobile_is_not_matched() {
        let brother = person("Shyam Prasad", Some(1990));
        assert_eq!(pick_by_demographics("Ram Prasad", 1990, &[brother]), None);
        let other = person("Anita Sharma", Some(1990));
        assert_eq!(pick_by_demographics("Sunita Verma", 1990, &[other]), None);
    }

    /// Age agrees within five years either way, and not at six (USER_INIT_LINK_606).
    #[test]
    fn age_within_five_years_either_way() {
        let p = person("Lakshmi Devi", Some(1990));
        let one = std::slice::from_ref(&p);
        for year in [1985, 1990, 1995] {
            assert_eq!(
                pick_by_demographics("Lakshmi Devi", year, one),
                Some(p.id),
                "{year}"
            );
        }
        for year in [1984, 1996] {
            assert_eq!(
                pick_by_demographics("Lakshmi Devi", year, one),
                None,
                "{year}"
            );
        }
        let undated = person("Lakshmi Devi", None);
        assert_eq!(pick_by_demographics("Lakshmi Devi", 1990, &[undated]), None);
    }

    /// Two people on one phone who both fit (twins, a namesake relative):
    /// no guess, not found.
    #[test]
    fn two_who_both_fit_is_no_match() {
        let a = person("Lakshmi Devi", Some(1990));
        let b = person("Laxmi Devi", Some(1993));
        assert_eq!(pick_by_demographics("Lakshmi Devi", 1991, &[a, b]), None);
        // A relative with the same name but outside the age window is no rival.
        let c = person("Lakshmi Devi", Some(1990));
        let d = person("Lakshmi Devi", Some(1970));
        let id = c.id;
        assert_eq!(
            pick_by_demographics("Lakshmi Devi", 1991, &[c, d]),
            Some(id)
        );
    }
}
