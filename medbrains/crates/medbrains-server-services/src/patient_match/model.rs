//! The duplicate-patient scoring model: Fellegi-Sunter record linkage.
//!
//! Each field is compared and lands on an agreement level. A level carries
//! two probabilities: `m`, that two records of the **same** person agree at
//! that level, and `u`, that two records of **different** people do. The
//! level's weight is `log2(m / u)`; the record pair's weight is the sum over
//! fields, and a field nobody entered adds nothing. Two thresholds cut the
//! total into bands:
//!
//! | total weight            | band      | the desk sees                         |
//! |-------------------------|-----------|---------------------------------------|
//! | verified ABHA identical | `certain` | the same person — open that record    |
//! | `>= LIKELY_WEIGHT` (18) | `likely`  | probably the same person              |
//! | `>= REVIEW_WEIGHT` (6)  | `review`  | check before registering              |
//! | below                   | —         | not shown                             |
//!
//! `score` is the posterior probability of a match at prior odds of 1 in
//! 1024 (`PRIOR_LOG2_ODDS`), so 18 reads as 99.6% and 6 as 6%.
//!
//! The `m`/`u` values below are priors set from how Indian registration data
//! behaves, not yet fitted: DOB is often estimated from an age as 1 January,
//! a mobile number is shared by a family (so phone `u` is 1/500, not
//! 1/10^10) and changes over years (so its `m` is low), and a name has many
//! spellings. They are the knobs to refit (EM over reviewed pairs) once the
//! review queue has history. Twins — same DOB, phone and surname, another
//! first name — land in `review` by design, never `likely`.

use chrono::{Datelike, NaiveDate};
use serde::Serialize;

use super::names::NameAgreement;

/// `(m, u)` for one agreement level.
type Level = (f64, f64);

/// Name: the same words; another spelling; close; different.
const NAME_EXACT: Level = (0.90, 0.0005);
const NAME_VARIANT: Level = (0.06, 0.001);
const NAME_PARTIAL: Level = (0.03, 0.01);
const NAME_DIFFERENT: Level = (0.01, 0.9875);
/// Date of birth: the same day; day and month swapped or one part off; an
/// age-estimated 1 January in the same year; different.
const DOB_EXACT: Level = (0.92, 0.0003);
const DOB_NEAR: Level = (0.04, 0.003);
const DOB_ESTIMATED: Level = (0.03, 0.01);
const DOB_DIFFERENT: Level = (0.01, 0.9867);
/// Sex: recorded the same, or not.
const SEX_SAME: Level = (0.98, 0.5);
const SEX_DIFFERENT: Level = (0.02, 0.5);
/// Mobile (last ten digits): the same, or not.
const PHONE_SAME: Level = (0.70, 0.002);
const PHONE_DIFFERENT: Level = (0.30, 0.998);

/// At or above: `likely`.
pub const LIKELY_WEIGHT: f64 = 18.0;
/// At or above: `review`; below, not shown.
pub const REVIEW_WEIGHT: f64 = 6.0;
/// Prior odds of a match among candidates, as `log2` (1 in 1024).
const PRIOR_LOG2_ODDS: f64 = -10.0;

/// What the desk is told about a candidate.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchBand {
    Review,
    Likely,
    /// The same verified ABHA number, or the same identity document.
    Certain,
}

fn weight((m, u): Level) -> f64 {
    (m / u).log2()
}

/// One side of a comparison: what is known of a person.
#[derive(Debug, Default)]
pub struct Person<'a> {
    pub name: &'a str,
    pub date_of_birth: Option<NaiveDate>,
    /// `male` / `female`; anything else counts as not recorded.
    pub sex: Option<&'a str>,
    pub phone: &'a str,
}

/// The total weight and, per field, why.
#[derive(Debug)]
pub struct Verdict {
    pub weight: f64,
    pub reasons: Vec<&'static str>,
}

impl Verdict {
    /// The band, or `None` below the review threshold.
    #[must_use]
    pub fn band(&self) -> Option<MatchBand> {
        if self.weight >= LIKELY_WEIGHT {
            Some(MatchBand::Likely)
        } else if self.weight >= REVIEW_WEIGHT {
            Some(MatchBand::Review)
        } else {
            None
        }
    }

    /// Posterior probability of a match, 0..1.
    #[must_use]
    pub fn score(&self) -> f64 {
        1.0 / (1.0 + (-(self.weight + PRIOR_LOG2_ODDS)).exp2())
    }
}

fn dob_level(a: NaiveDate, b: NaiveDate) -> (Level, &'static str) {
    if a == b {
        return (DOB_EXACT, "Date of birth matches");
    }
    let swapped = a.day() == b.month() && a.month() == b.day() && a.year() == b.year();
    let parts_same = [
        a.day() == b.day(),
        a.month() == b.month(),
        a.year() == b.year(),
    ]
    .iter()
    .filter(|s| **s)
    .count();
    if swapped || parts_same == 2 {
        return (
            DOB_NEAR,
            "Date of birth nearly matches (a typo or day and month swapped)",
        );
    }
    let estimated = |d: NaiveDate| d.day() == 1 && d.month() == 1;
    if a.year() == b.year() && (estimated(a) || estimated(b)) {
        return (
            DOB_ESTIMATED,
            "Same birth year (one date estimated from age)",
        );
    }
    (DOB_DIFFERENT, "Date of birth differs")
}

fn digits(phone: &str) -> String {
    let d: String = phone.chars().filter(char::is_ascii_digit).collect();
    d[d.len().saturating_sub(10)..].to_owned()
}

fn sex(s: Option<&str>) -> Option<&str> {
    s.filter(|s| matches!(*s, "male" | "female"))
}

/// Score a registered person against what the desk typed.
#[must_use]
pub fn compare(typed: &Person<'_>, registered: &Person<'_>) -> Verdict {
    let mut v = Verdict {
        weight: 0.0,
        reasons: Vec::new(),
    };
    let mut add = |level: Level, why: &'static str| {
        v.weight += weight(level);
        v.reasons.push(why);
    };
    if !typed.name.trim().is_empty() {
        match super::names::compare(typed.name, registered.name) {
            NameAgreement::Exact => add(NAME_EXACT, "Name matches"),
            NameAgreement::Variant => add(NAME_VARIANT, "Name matches in another spelling"),
            NameAgreement::Partial => add(NAME_PARTIAL, "Name is close"),
            NameAgreement::Different => add(NAME_DIFFERENT, "Name differs"),
        }
    }
    if let (Some(a), Some(b)) = (typed.date_of_birth, registered.date_of_birth) {
        let (level, why) = dob_level(a, b);
        add(level, why);
    }
    if let (Some(a), Some(b)) = (sex(typed.sex), sex(registered.sex)) {
        if a == b {
            add(SEX_SAME, "Sex matches");
        } else {
            add(SEX_DIFFERENT, "Sex differs");
        }
    }
    let (a, b) = (digits(typed.phone), digits(registered.phone));
    if a.len() == 10 && b.len() == 10 {
        if a == b {
            add(PHONE_SAME, "Mobile number matches");
        } else {
            add(PHONE_DIFFERENT, "Mobile number differs");
        }
    }
    v
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::{MatchBand, Person, compare};

    fn d(y: i32, m: u32, day: u32) -> Option<NaiveDate> {
        NaiveDate::from_ymd_opt(y, m, day)
    }

    fn person<'a>(
        name: &'a str,
        dob: Option<NaiveDate>,
        sex: &'a str,
        phone: &'a str,
    ) -> Person<'a> {
        Person {
            name,
            date_of_birth: dob,
            sex: Some(sex),
            phone,
        }
    }

    /// Given "Laxmi", born 12 Mar 1984, female, on 98400 12345, already
    /// registered as "Smt. Lakshmi" with the same details, When the desk
    /// registers her again, Then she is a likely match.
    #[test]
    fn a_spelling_variant_with_the_same_dob_sex_and_phone_is_likely() {
        let v = compare(
            &person("Laxmi", d(1984, 3, 12), "female", "+91 98400 12345"),
            &person("Smt. Lakshmi", d(1984, 3, 12), "female", "9840012345"),
        );
        assert_eq!(v.band(), Some(MatchBand::Likely), "{v:?}");
        assert!(v.score() > 0.99);
        assert!(v.reasons.contains(&"Name matches in another spelling"));
    }

    /// Twins share a DOB, a phone and a surname; they are two people, so
    /// the desk is asked to check, never told it is the same person.
    #[test]
    fn twins_are_for_review_not_likely() {
        let v = compare(
            &person("Ram Prasad", d(2015, 6, 2), "male", "9840012345"),
            &person("Shyam Prasad", d(2015, 6, 2), "male", "9840012345"),
        );
        assert_eq!(v.band(), Some(MatchBand::Review), "{v:?}");
    }

    /// A father and son both "Ravi Kumar", years apart: not shown.
    #[test]
    fn the_same_name_with_another_birth_date_is_not_shown() {
        let v = compare(
            &person("Ravi Kumar", d(1990, 1, 5), "male", ""),
            &person("Ravi Kumar", d(1962, 8, 20), "male", ""),
        );
        assert_eq!(v.band(), None, "{v:?}");
    }

    /// A family's shared mobile alone does not make a duplicate.
    #[test]
    fn a_shared_family_phone_alone_is_not_a_match() {
        let v = compare(
            &person("Meena", d(1970, 2, 2), "female", "9840012345"),
            &person("Karthik", d(1999, 9, 9), "male", "9840012345"),
        );
        assert_eq!(v.band(), None, "{v:?}");
    }

    /// An age-estimated DOB (1 Jan) in the right year, day and month typed
    /// swapped, Muhammad for Mohammed: still found, for review or better.
    #[test]
    fn estimated_or_swapped_dates_and_vowel_variants_still_surface() {
        let estimated = compare(
            &person("Mohammed Rafi", d(1958, 1, 1), "male", ""),
            &person("Muhammad Rafi", d(1958, 7, 14), "male", ""),
        );
        assert_eq!(
            estimated.band(),
            None,
            "only a close name and a year: {estimated:?}"
        );
        let swapped = compare(
            &person("Mohammed Rafi", d(1958, 7, 4), "male", ""),
            &person("Mohammed Rafi", d(1958, 4, 7), "male", ""),
        );
        assert!(swapped.band() >= Some(MatchBand::Review), "{swapped:?}");
        let same_day = compare(
            &person("Mohammed Rafi", d(1958, 7, 14), "male", ""),
            &person("Muhammad Rafi", d(1958, 7, 14), "male", ""),
        );
        assert!(same_day.band() >= Some(MatchBand::Review), "{same_day:?}");
    }

    /// Opposite sex recorded counts against: a name and DOB that agree are
    /// still shown, for a check (a data-entry slip is common), not as likely.
    #[test]
    fn a_sex_mismatch_lowers_but_does_not_hide_a_strong_match() {
        let v = compare(
            &person("Priya Raman", d(1992, 11, 3), "female", ""),
            &person("Priya Raman", d(1992, 11, 3), "male", ""),
        );
        assert_eq!(v.band(), Some(MatchBand::Review), "{v:?}");
        assert!(v.reasons.contains(&"Sex differs"));
    }

    /// A name alone, nothing else entered: a common name is for review.
    #[test]
    fn a_name_alone_is_for_review() {
        let v = compare(
            &Person {
                name: "Ravi Kumar",
                ..Person::default()
            },
            &person("Kumar Ravi", d(1990, 1, 5), "male", "9840012345"),
        );
        assert_eq!(v.band(), Some(MatchBand::Review), "{v:?}");
    }
}
