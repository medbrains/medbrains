//! Westgard multirule evaluation for a quality-control run.
//!
//! `lab_westgard_rule` declares six rules and the results grid renders whatever
//! comes back, but only two were ever computed: `1_3s` and `1_2s`, both read
//! off the single point being saved. The other four need the runs before it,
//! and nothing queried them, so `2_2s`, `r_4s`, `4_1s` and `10x` could not be
//! produced by any code path.
//!
//! Those four are the ones multirule exists for. A single point beyond 3SD is a
//! blunder and shows up on any chart. What multirule catches is the analyzer
//! drifting: four runs in a row a little high, ten runs in a row on one side of
//! the mean. Each of those points passes on its own, and the instrument is
//! reporting patient results that are all slightly wrong. Without them, a
//! systematic shift is accepted run after run.
//!
//! The rules, on the SD index of consecutive runs of the same test, lot and
//! level, newest first:
//!
//!   1_2s   one point beyond 2SD -- a warning, not a rejection
//!   1_3s   one point beyond 3SD
//!   2_2s   two consecutive points beyond the same 2SD limit
//!   r_4s   two consecutive points spanning more than 4SD, one either side
//!   4_1s   four consecutive points beyond the same 1SD limit
//!   10x    ten consecutive points on one side of the mean
//!
//! Rule names are the `lab_westgard_rule` enum's own spelling. `r_4s` is
//! lower-case there; binding `R_4s` fails the cast.

/// The verdict for one run, in `lab_qc_status`' vocabulary.
pub(crate) const ACCEPTED: &str = "accepted";
pub(crate) const WARNING: &str = "warning";
pub(crate) const REJECTED: &str = "rejected";

pub(crate) struct Evaluation {
    pub violations: Vec<&'static str>,
    pub status: &'static str,
}

/// True when the first `n` points are all beyond `limit` on the same side.
fn run_beyond(series: &[f64], n: usize, limit: f64) -> bool {
    if series.len() < n {
        return false;
    }
    let head = &series[..n];
    head.iter().all(|v| *v > limit) || head.iter().all(|v| *v < -limit)
}

/// Evaluate one run against the runs before it.
///
/// `history` is the SD index of previous runs for the same test, lot and
/// level, newest first. A rule that needs more points than exist cannot fire;
/// it is not reported as passing, it simply has nothing to say -- which is why
/// a fresh lot raises nothing until it has a history.
pub(crate) fn evaluate(sdi: f64, history: &[f64]) -> Evaluation {
    let mut series = Vec::with_capacity(history.len() + 1);
    series.push(sdi);
    series.extend_from_slice(history);

    let mut violations: Vec<&'static str> = Vec::new();

    if sdi.abs() > 3.0 {
        violations.push("1_3s");
    } else if sdi.abs() > 2.0 {
        // Reported on its own only when 1_3s did not already fire; both would
        // be true of the same point and the grid would read as two problems.
        violations.push("1_2s");
    }
    if run_beyond(&series, 2, 2.0) {
        violations.push("2_2s");
    }
    if series.len() >= 2 && (series[0] - series[1]).abs() > 4.0 && series[0].signum() != series[1].signum() {
        violations.push("r_4s");
    }
    if run_beyond(&series, 4, 1.0) {
        violations.push("4_1s");
    }
    if series.len() >= 10 && run_beyond(&series, 10, 0.0) {
        violations.push("10x");
    }

    // 1_2s alone is a warning: it is the trigger to look at the other rules,
    // not a reason to stop reporting. Anything else that fired is a rejection.
    let status = if violations.is_empty() {
        ACCEPTED
    } else if violations == ["1_2s"] {
        WARNING
    } else {
        REJECTED
    };

    Evaluation { violations, status }
}

#[cfg(test)]
mod tests {
    use super::{ACCEPTED, REJECTED, WARNING, evaluate};

    #[test]
    fn a_run_inside_two_sd_with_a_quiet_history_is_accepted() {
        let e = evaluate(0.4, &[0.1, -0.3, 0.2, -0.5, 0.6, -0.2, 0.3, -0.1, 0.5]);
        assert!(e.violations.is_empty());
        assert_eq!(e.status, ACCEPTED);
    }

    #[test]
    fn one_point_past_three_sd_is_rejected() {
        let e = evaluate(3.4, &[]);
        assert_eq!(e.violations, vec!["1_3s"]);
        assert_eq!(e.status, REJECTED);
    }

    #[test]
    fn one_point_past_two_sd_warns_rather_than_rejecting() {
        // The instrument is not stopped by a single 2SD point; it is looked at.
        let e = evaluate(2.4, &[0.1]);
        assert_eq!(e.violations, vec!["1_2s"]);
        assert_eq!(e.status, WARNING);
    }

    #[test]
    fn a_point_past_three_sd_does_not_also_report_two_sd() {
        let e = evaluate(3.5, &[0.2]);
        assert_eq!(e.violations, vec!["1_3s"]);
    }

    #[test]
    fn two_consecutive_points_past_the_same_two_sd_limit_reject() {
        // Neither point alone would stop anything: the first was a warning and
        // the second is the same warning again. Together they are a shift.
        let e = evaluate(2.3, &[2.1, 0.4]);
        assert!(e.violations.contains(&"2_2s"));
        assert_eq!(e.status, REJECTED);
    }

    #[test]
    fn two_points_past_two_sd_on_opposite_sides_are_not_a_shift() {
        // Opposite sides is r_4s -- imprecision -- not 2_2s.
        let e = evaluate(2.3, &[-2.2, 0.4]);
        assert!(!e.violations.contains(&"2_2s"));
        assert!(e.violations.contains(&"r_4s"));
        assert_eq!(e.status, REJECTED);
    }

    #[test]
    fn a_four_sd_spread_within_one_side_is_not_r_4s() {
        // 3.5 and -0.6 span more than 4SD but sit either side of the mean by
        // less than 2 on one of them; the rule is about a point beyond +2 and
        // a point beyond -2, so the sign test is what carries it.
        let e = evaluate(3.5, &[3.4]);
        assert!(!e.violations.contains(&"r_4s"));
    }

    #[test]
    fn four_consecutive_points_past_one_sd_reject() {
        // Every one of these passes 1_2s. The instrument has drifted.
        let e = evaluate(1.4, &[1.2, 1.6, 1.1, 0.2]);
        assert!(e.violations.contains(&"4_1s"));
        assert_eq!(e.status, REJECTED);
    }

    #[test]
    fn four_points_past_one_sd_on_mixed_sides_do_not_fire() {
        let e = evaluate(1.4, &[1.2, -1.6, 1.1]);
        assert!(!e.violations.contains(&"4_1s"));
    }

    #[test]
    fn ten_consecutive_points_on_one_side_reject() {
        // None of these is beyond even 1SD. Ten in a row on one side is a
        // calibration that has moved, and no single-point rule can see it.
        let e = evaluate(0.3, &[0.2, 0.5, 0.1, 0.4, 0.6, 0.2, 0.3, 0.1, 0.4]);
        assert!(e.violations.contains(&"10x"));
        assert_eq!(e.status, REJECTED);
    }

    #[test]
    fn nine_points_on_one_side_do_not_yet_fire() {
        let e = evaluate(0.3, &[0.2, 0.5, 0.1, 0.4, 0.6, 0.2, 0.3, 0.1]);
        assert!(!e.violations.contains(&"10x"));
        assert_eq!(e.status, ACCEPTED);
    }

    #[test]
    fn one_point_the_other_side_breaks_the_run_of_ten() {
        let e = evaluate(0.3, &[0.2, 0.5, -0.1, 0.4, 0.6, 0.2, 0.3, 0.1, 0.4]);
        assert!(!e.violations.contains(&"10x"));
    }

    #[test]
    fn a_new_lot_with_no_history_raises_only_single_point_rules() {
        // A rule that needs points it does not have has nothing to say, and
        // must not be reported as having passed.
        let e = evaluate(2.5, &[]);
        assert_eq!(e.violations, vec!["1_2s"]);
        assert_eq!(e.status, WARNING);
    }

    #[test]
    fn the_boundary_itself_does_not_violate() {
        // Exactly 2.0 SD is within 2SD. Comparisons are strict.
        let e = evaluate(2.0, &[2.0]);
        assert!(e.violations.is_empty());
        assert_eq!(e.status, ACCEPTED);
    }

    #[test]
    fn every_rule_name_is_spelled_as_the_database_enum_spells_it() {
        // `lab_westgard_rule` is lower-case `r_4s`; binding `R_4s` fails the
        // cast at run time, which is not something a type can catch here.
        let known = ["1_2s", "1_3s", "2_2s", "r_4s", "4_1s", "10x"];
        let cases = [
            evaluate(3.4, &[]),
            evaluate(2.4, &[0.1]),
            evaluate(2.3, &[2.1]),
            evaluate(2.3, &[-2.2]),
            evaluate(1.4, &[1.2, 1.6, 1.1]),
            evaluate(0.3, &[0.2, 0.5, 0.1, 0.4, 0.6, 0.2, 0.3, 0.1, 0.4]),
        ];
        for case in &cases {
            for rule in &case.violations {
                assert!(known.contains(rule), "unknown rule name {rule}");
            }
        }
    }
}
