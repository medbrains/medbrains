//! What the bedside transfusion chart owes next.
//!
//! A transfusion is not "running" or "done", it is a sequence of observations
//! at fixed points, and the one at fifteen minutes is the one that catches an
//! acute haemolytic reaction while there is still something to do about it.

/// The four points a transfusion is charted at, in order.
pub const PHASES: [&str; 4] = ["baseline", "fifteen_min", "periodic", "completion"];

/// Minutes after the start each phase falls due; completion is due when the
/// nurse ends the unit, not on a clock.
fn due_minutes(phase: &str) -> i64 {
    match phase {
        "fifteen_min" => 15,
        "periodic" => 60,
        _ => 0,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhaseState {
    pub phase: String,
    pub recorded: bool,
    /// Past its time and not recorded — the state worth colouring.
    pub overdue: bool,
}

/// Whether the unit is still running: an end time is the only thing that
/// closes it. A completed observation does not.
#[must_use]
pub const fn is_running(started_unix: Option<i64>, ended: bool) -> bool {
    started_unix.is_some() && !ended
}

/// The chart, phase by phase.
///
/// `periodic` may be recorded any number of times, so it counts as recorded
/// once and never as overdue afterwards. Completion is never overdue: flagging
/// it would put a red mark on every transfusion that is simply still running.
#[must_use]
pub fn phase_states(started_unix: Option<i64>, ended: bool, recorded: &[String], now_unix: i64) -> Vec<PhaseState> {
    let running = is_running(started_unix, ended);
    let elapsed_minutes = started_unix.map_or(0, |s| (now_unix - s) / 60);
    PHASES
        .iter()
        .map(|&phase| {
            let done = recorded.iter().any(|r| r == phase);
            let overdue = !done && phase != "completion" && running && elapsed_minutes >= due_minutes(phase);
            PhaseState { phase: phase.to_owned(), recorded: done, overdue }
        })
        .collect()
}

/// A bag with no number is not identifiable, and identity is the whole check.
#[must_use]
pub fn can_start_transfusion(
    bag_number: &str,
    blood_group: &str,
    product_type: &str,
    expiry_date: &str,
    consent_on_file: bool,
    crossmatch_compatible: bool,
    second_nurse_id: Option<&str>,
) -> bool {
    !bag_number.trim().is_empty()
        && !blood_group.trim().is_empty()
        && !product_type.trim().is_empty()
        && !expiry_date.trim().is_empty()
        && consent_on_file
        && crossmatch_compatible
        && second_nurse_id.is_some_and(|n| !n.is_empty())
}

/// Whether a unit of `unit_group` may be given to a patient of `patient_group`.
///
/// Lifted out of the blood-bank handler so the bedside path and both native
/// apps answer with the same matrix. The bedside path had no compatibility
/// check at all: it took the nurse's word for `crossmatch_compatible` and
/// never looked the bag up.
///
/// Group strings arrive in two spellings — `"A+"` from a label, `"a_positive"`
/// from the enum — and both are accepted. An unknown or empty spelling is not
/// compatible: a group nobody can read is a reason to stop, not to proceed.
#[must_use]
pub fn abo_compatible(patient_group: &str, unit_group: &str) -> bool {
    let p = patient_group.trim().to_ascii_lowercase();
    let u = unit_group.trim().to_ascii_lowercase();
    if p.is_empty() || u.is_empty() {
        return false;
    }
    let positive = |g: &str| g.ends_with('+') || g.contains("positive");
    let letters = |g: &str| -> Option<&'static str> {
        match g.trim_end_matches(['+', '-']).trim_end_matches("_positive").trim_end_matches("_negative") {
            "ab" => Some("ab"),
            "a" => Some("a"),
            "b" => Some("b"),
            "o" => Some("o"),
            _ => None,
        }
    };
    let (Some(pl), Some(ul)) = (letters(&p), letters(&u)) else {
        return false;
    };
    // Rh: a negative patient may not receive a positive unit.
    if positive(&u) && !positive(&p) {
        return false;
    }
    match (pl, ul) {
        (_, "o") => true,
        ("ab", _) => true,
        (a, b) => a == b,
    }
}

#[cfg(test)]
mod tests {
    use super::{PhaseState, abo_compatible, can_start_transfusion, is_running, phase_states};

    const START: i64 = 1_787_306_400; // 2026-08-21T10:00:00Z

    // A missing phase is a failed test, and a test may say so loudly.
    #[allow(clippy::panic)]
    fn state<'a>(states: &'a [PhaseState], phase: &str) -> &'a PhaseState {
        states.iter().find(|s| s.phase == phase).unwrap_or_else(|| panic!("no {phase}"))
    }

    #[test]
    fn running_until_an_end_time() {
        assert!(is_running(Some(START), false));
        assert!(!is_running(Some(START), true));
        assert!(!is_running(None, false));
    }

    #[test]
    fn fifteen_minute_check_goes_overdue_once_its_time_has_passed() {
        // If this stops flagging, the screen looks calm through the exact
        // window it exists for.
        let s = phase_states(Some(START), false, &["baseline".into()], START + 20 * 60);
        assert_eq!(state(&s, "fifteen_min"), &PhaseState { phase: "fifteen_min".into(), recorded: false, overdue: true });
    }

    #[test]
    fn not_before_its_time() {
        let s = phase_states(Some(START), false, &["baseline".into()], START + 5 * 60);
        assert!(!state(&s, "fifteen_min").overdue);
    }

    #[test]
    fn completion_is_never_overdue_on_a_running_unit() {
        let s = phase_states(Some(START), false, &[], START + 5 * 3600);
        assert!(!state(&s, "completion").overdue);
    }

    #[test]
    fn a_charted_phase_stops_flagging() {
        let s = phase_states(Some(START), false, &["baseline".into(), "fifteen_min".into()], START + 90 * 60);
        assert_eq!(state(&s, "fifteen_min"), &PhaseState { phase: "fifteen_min".into(), recorded: true, overdue: false });
    }

    #[test]
    fn nothing_flags_on_an_ended_unit() {
        let s = phase_states(Some(START), true, &[], START + 3600);
        assert!(s.iter().all(|p| !p.overdue));
    }

    #[test]
    fn hanging_a_unit_needs_consent_compatibility_and_a_second_nurse() {
        assert!(can_start_transfusion("BAG-1", "O", "PRBC", "2026-09-01", true, true, Some("n2")));
        assert!(!can_start_transfusion("BAG-1", "O", "PRBC", "2026-09-01", false, true, Some("n2")));
        assert!(!can_start_transfusion("BAG-1", "O", "PRBC", "2026-09-01", true, false, Some("n2")));
        assert!(!can_start_transfusion("BAG-1", "O", "PRBC", "2026-09-01", true, true, None));
        assert!(!can_start_transfusion("   ", "O", "PRBC", "2026-09-01", true, true, Some("n2")));
    }


    #[test]
    fn o_negative_goes_to_anyone_and_ab_positive_takes_anything() {
        for group in ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] {
            assert!(abo_compatible(group, "O-"), "{group} must accept O-");
            assert!(abo_compatible("AB+", group), "AB+ must accept {group}");
        }
    }

    #[test]
    fn a_negative_patient_never_takes_a_positive_unit() {
        // The Rh mistake that sensitises a woman of childbearing age.
        assert!(!abo_compatible("A-", "A+"));
        assert!(!abo_compatible("O-", "O+"));
        assert!(!abo_compatible("AB-", "AB+"));
        assert!(abo_compatible("A+", "A-"), "the other direction is fine");
    }

    #[test]
    fn the_lethal_pairs_are_refused() {
        // Group A blood into a group O patient is the classic fatal
        // haemolytic reaction.
        assert!(!abo_compatible("O+", "A+"));
        assert!(!abo_compatible("O+", "B+"));
        assert!(!abo_compatible("A+", "B+"));
        assert!(!abo_compatible("B+", "A+"));
        assert!(!abo_compatible("A+", "AB+"));
    }

    #[test]
    fn both_spellings_agree_and_an_unreadable_group_is_not_compatible() {
        assert_eq!(abo_compatible("a_positive", "o_negative"), abo_compatible("A+", "O-"));
        assert!(!abo_compatible("", "O-"), "no patient group is a reason to stop");
        assert!(!abo_compatible("A+", ""), "no unit group is a reason to stop");
        assert!(!abo_compatible("A+", "banana"));
    }
}
