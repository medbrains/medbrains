//! The lab priority vocabulary, and how it translates to the token queue's.
//!
//! These are two different vocabularies for the same idea and they do not use
//! the same words. A lab order is `routine`, `urgent` or `stat`; the unified
//! token queue orders by `token_priority_weight`, which knows `stat` (0),
//! `urgent` (1), the vulnerability categories, and `normal` (5) -- and sorts
//! anything it has never heard of last, deliberately, so a newer server's
//! vocabulary cannot jump the queue on an older one.
//!
//! `routine` is one of the words it has never heard of. Passing it through
//! unmapped would sort correctly today, by landing in the same bucket as
//! `normal`, but only by accident: it would be an unrecognised value stored in
//! `tokens.priority`, right where the weight function's fallback is the only
//! thing keeping it in order.

use medbrains_core::lab::LabPriority;
use medbrains_server_core::error::AppError;

/// Validate a caller-supplied priority into the `lab_priority` enum's words.
pub(crate) fn normalize_lab_priority(priority: Option<&str>) -> Result<&'static str, AppError> {
    let Some(priority) = priority.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok("routine");
    };

    if priority.eq_ignore_ascii_case("routine") {
        Ok("routine")
    } else if priority.eq_ignore_ascii_case("urgent") {
        Ok("urgent")
    } else if priority.eq_ignore_ascii_case("stat") {
        Ok("stat")
    } else {
        Err(AppError::BadRequest(format!(
            "unsupported lab priority: {priority}"
        )))
    }
}

/// The token-queue word for a lab order's priority.
///
/// The sample-collection token used to be issued at a hardcoded `"normal"`,
/// discarding the priority the clinician had just set, so a STAT blood draw
/// queued behind every routine patient already waiting.
pub(crate) const fn token_priority(priority: LabPriority) -> &'static str {
    match priority {
        LabPriority::Routine => "normal",
        LabPriority::Urgent => "urgent",
        LabPriority::Stat => "stat",
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_lab_priority, token_priority};
    use medbrains_core::lab::LabPriority;

    /// `unwrap` is denied crate-wide, and the error case has its own test.
    fn normalized(input: Option<&str>) -> Option<&'static str> {
        normalize_lab_priority(input).ok()
    }

    #[test]
    fn a_stat_order_keeps_its_urgency_at_the_collection_counter() {
        // The regression: this used to be "normal" for every order.
        assert_eq!(token_priority(LabPriority::Stat), "stat");
        assert_eq!(token_priority(LabPriority::Urgent), "urgent");
    }

    #[test]
    fn routine_becomes_the_word_the_queue_actually_knows() {
        // Not "routine": that is not in token_priority_weight's CASE, so it
        // would sit on the fallback rather than on a rule.
        assert_eq!(token_priority(LabPriority::Routine), "normal");
    }

    #[test]
    fn an_absent_priority_is_routine() {
        assert_eq!(normalized(None), Some("routine"));
        assert_eq!(normalized(Some("   ")), Some("routine"));
    }

    #[test]
    fn priority_is_accepted_in_any_case() {
        assert_eq!(normalized(Some("STAT")), Some("stat"));
        assert_eq!(normalized(Some(" Urgent ")), Some("urgent"));
    }

    #[test]
    fn an_unknown_priority_is_refused_rather_than_defaulted() {
        // Defaulting would silently downgrade a word the caller meant.
        assert!(normalize_lab_priority(Some("emergency")).is_err());
    }
}
