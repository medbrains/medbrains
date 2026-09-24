//! Who the building believes is inside it, once, for every device.
//!
//! A visitor pass has three stored states — active, expired, revoked — and
//! the stored one is not the whole truth. Nothing sweeps the table, so a pass
//! whose hours ran out an hour ago still reads `active`, and the person it
//! belongs to is very likely still upstairs. Lumping that in with "expired
//! and gone" is how somebody stays on a ward after visiting hours with nobody
//! counting them, so the desk gets a fourth state of its own: **overdue**.
//!
//! The states, and what the desk may do in each, are decided here rather than
//! on two screens that could drift.

/// What the desk should call this pass right now.
///
/// `status` is what the server stored; `valid_until` and `now` are RFC 3339
/// instants, which compare as text while both carry the same offset — the
/// server sends UTC throughout.
#[must_use]
pub fn pass_state(status: &str, valid_until: &str, now: &str) -> &'static str {
    match status {
        "revoked" => "revoked",
        "expired" => "expired",
        _ if valid_until <= now => "overdue",
        _ => "active",
    }
}

/// Whether this pass should be counted among the people inside the building.
///
/// Overdue counts: the hours lapsed, nobody signed them out, and the desk is
/// the only place that finds out.
#[must_use]
pub fn pass_is_inside(state: &str, checked_out: bool) -> bool {
    !checked_out && matches!(state, "active" | "overdue")
}

/// What the desk may do with a pass, in the order it is offered.
///
/// A revoked or expired pass offers nothing: the server refuses the
/// check-in, and a button that fails teaches the desk that the screen lies.
#[must_use]
pub fn pass_actions(state: &str, inside: bool) -> Vec<&'static str> {
    if !matches!(state, "active" | "overdue") {
        return Vec::new();
    }
    let mut actions = if inside { vec!["check_out"] } else { vec!["check_in"] };
    actions.push("revoke");
    actions
}

/// How long a pass runs when the desk does not say. Long enough for a normal
/// visit, short enough that forgetting to sign somebody out shows up today.
pub const DEFAULT_PASS_HOURS: u32 = 4;

#[cfg(test)]
mod tests {
    use super::{pass_actions, pass_is_inside, pass_state};

    const NOW: &str = "2026-09-16T14:00:00Z";

    #[test]
    fn a_pass_past_its_hours_is_overdue_not_expired() {
        assert_eq!(pass_state("active", "2026-09-16T18:00:00Z", NOW), "active");
        assert_eq!(pass_state("active", "2026-09-16T13:00:00Z", NOW), "overdue");
        assert_eq!(pass_state("expired", "2026-09-16T13:00:00Z", NOW), "expired");
        assert_eq!(pass_state("revoked", "2026-09-16T18:00:00Z", NOW), "revoked");
    }

    #[test]
    fn an_overdue_visitor_is_still_counted_as_inside() {
        assert!(pass_is_inside("overdue", false));
        assert!(pass_is_inside("active", false));
        assert!(!pass_is_inside("active", true), "signed out is out");
        assert!(!pass_is_inside("revoked", false));
    }

    #[test]
    fn a_dead_pass_offers_nothing() {
        assert_eq!(pass_actions("active", false), vec!["check_in", "revoke"]);
        assert_eq!(pass_actions("active", true), vec!["check_out", "revoke"]);
        assert_eq!(pass_actions("overdue", true), vec!["check_out", "revoke"], "the way to end an overdue visit is to sign them out");
        assert!(pass_actions("revoked", false).is_empty());
        assert!(pass_actions("expired", false).is_empty());
    }
}
