//! The meter's arithmetic: shares from counts, and the one sentence that
//! says what moved. Pure, so every rule is tested without a database.
//!
//! A share with nothing under it is unknown (`None`), never 0%: a department
//! that made no documents is not "0% signed".

use std::ops::AddAssign;

use serde::Serialize;

/// Counts behind the shares, for any slice of the meter.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Counts {
    /// Clinical documents made in the system.
    pub created: i64,
    /// Of those, signed digitally.
    pub signed: i64,
    /// Paper case sheets scanned in.
    pub scanned: i64,
    /// System documents printed for the first time.
    pub printed: i64,
}

impl AddAssign for Counts {
    /// Sum two slices' counts.
    fn add_assign(&mut self, o: Self) {
        self.created += o.created;
        self.signed += o.signed;
        self.scanned += o.scanned;
        self.printed += o.printed;
    }
}

/// `100 × num / den`, or unknown when there is nothing under it.
#[allow(clippy::cast_precision_loss)] // counts far below 2^52
pub fn pct(num: i64, den: i64) -> Option<f64> {
    (den > 0).then(|| 100.0 * num as f64 / den as f64)
}

impl Counts {
    /// Documents made in the system, over those plus paper scanned in.
    pub fn digital_pct(&self) -> Option<f64> {
        pct(self.created, self.created + self.scanned)
    }

    /// Documents signed digitally, over documents made in the system.
    pub fn signed_pct(&self) -> Option<f64> {
        pct(self.signed, self.created)
    }
}

/// One department's counts in the earlier and later half of the days read.
#[derive(Debug, Clone)]
pub struct Halves {
    pub name: String,
    pub before: Counts,
    pub after: Counts,
}

/// A movement smaller than this many points "held".
const HELD_POINTS: f64 = 1.0;

/// One plain sentence on how the signed share moved between the earlier and
/// later half of the days counted, from the counts alone.
pub fn sentence(measured_days: usize, before: Counts, after: Counts, depts: &[Halves]) -> String {
    let mut all = before;
    all += after;
    if measured_days == 0 {
        return "These days have not been counted yet, so how paperless they were is unknown."
            .to_owned();
    }
    if all.created == 0 {
        return if all.scanned == 0 {
            "No clinical documents were made in the system or scanned on the days counted."
                .to_owned()
        } else {
            format!(
                "{} paper case sheets were scanned and no clinical document was made in the system on the days counted.",
                all.scanned
            )
        };
    }
    let (Some(b), Some(a)) = (before.signed_pct(), after.signed_pct()) else {
        return format!(
            "{} of {} clinical documents made in the system on the days counted were signed digitally ({:.0}%).",
            all.signed,
            all.created,
            all.signed_pct().unwrap_or_default()
        );
    };
    if (a - b).abs() < HELD_POINTS {
        return format!(
            "The signed share held at {a:.0}% between the earlier and later half of these days."
        );
    }
    let verb = if a > b { "rose" } else { "fell" };
    format!(
        "The signed share {verb} from {b:.0}% to {a:.0}% between the earlier and later half of these days{}.",
        driver(a > b, depts)
    )
}

/// ", most in X (p% to q%)": the department whose signed share moved furthest
/// the same way as the whole, among those with documents in both halves.
fn driver(rose: bool, depts: &[Halves]) -> String {
    depts
        .iter()
        .filter_map(|d| Some((d, d.before.signed_pct()?, d.after.signed_pct()?)))
        .filter(|(_, b, a)| (a > b) == rose && (a - b).abs() >= HELD_POINTS)
        .max_by(|x, y| (x.2 - x.1).abs().total_cmp(&(y.2 - y.1).abs()))
        .map(|(d, b, a)| format!(", most in {} ({b:.0}% to {a:.0}%)", d.name))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{Counts, Halves, sentence};

    const fn c(created: i64, signed: i64, scanned: i64) -> Counts {
        Counts {
            created,
            signed,
            scanned,
            printed: 0,
        }
    }

    #[test]
    fn nothing_under_a_share_is_unknown_not_zero() {
        assert_eq!(c(0, 0, 0).signed_pct(), None);
        assert_eq!(c(0, 0, 0).digital_pct(), None);
        assert_eq!(
            c(0, 0, 3).digital_pct(),
            Some(0.0),
            "all paper is 0% digital"
        );
        assert_eq!(c(3, 0, 1).digital_pct(), Some(75.0));
    }

    #[test]
    fn days_never_counted_say_unknown() {
        let s = sentence(0, Counts::default(), Counts::default(), &[]);
        assert!(s.contains("not been counted"), "{s}");
    }

    #[test]
    fn a_rise_names_the_department_that_moved_most_the_same_way() {
        let depts = [
            Halves {
                name: "Cardiology".into(),
                before: c(10, 2, 0),
                after: c(10, 9, 0),
            },
            Halves {
                name: "Surgery".into(),
                before: c(10, 5, 0),
                after: c(10, 6, 0),
            },
            Halves {
                name: "ENT".into(),
                before: c(10, 8, 0),
                after: c(10, 1, 0),
            },
        ];
        let s = sentence(14, c(30, 15, 0), c(30, 16, 0), &depts);
        assert_eq!(
            s,
            "The signed share rose from 50% to 53% between the earlier and later half of these days, most in Cardiology (20% to 90%)."
        );
    }

    #[test]
    fn a_small_move_held_and_one_half_alone_reads_as_a_count() {
        let held = sentence(14, c(100, 50, 0), c(100, 50, 0), &[]);
        assert!(held.starts_with("The signed share held at 50%"), "{held}");
        let one = sentence(1, Counts::default(), c(4, 1, 0), &[]);
        assert_eq!(
            one,
            "1 of 4 clinical documents made in the system on the days counted were signed digitally (25%)."
        );
    }

    #[test]
    fn counted_days_with_only_paper_or_nothing_say_so() {
        assert!(sentence(3, c(0, 0, 0), c(0, 0, 2), &[]).starts_with("2 paper case sheets"));
        assert!(sentence(3, c(0, 0, 0), c(0, 0, 0), &[]).starts_with("No clinical documents"));
    }
}
