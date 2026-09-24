//! The ward call board's shared vocabulary, so the phone colours a call the
//! way the server judged it and counts the wait the way the wall does.

/// A call still owed a visit. `acknowledged` is open: a nurse pressing "Seen"
/// has taken the call, not answered it.
#[must_use]
pub fn is_open_nurse_call(status: &str) -> bool {
    status == "pending" || status == "acknowledged"
}

/// Calls the server has already escalated past `normal`.
#[must_use]
pub fn is_overdue_nurse_call(escalation: &str) -> bool {
    escalation != "normal"
}

/// `4m 07s`, zero-padded so a column of them does not jitter. Negative input
/// is clamped: a device whose clock runs ahead of the server shows `0m 00s`,
/// not a wait that reads as counting backwards.
#[must_use]
pub fn wait_label(waiting_seconds: i64) -> String {
    let safe = waiting_seconds.max(0);
    format!("{}m {:02}s", safe / 60, safe % 60)
}

#[cfg(test)]
mod tests {
    use super::{is_open_nurse_call, is_overdue_nurse_call, wait_label};

    #[test]
    fn seen_is_still_open() {
        assert!(is_open_nurse_call("pending"));
        assert!(is_open_nurse_call("acknowledged"));
        assert!(!is_open_nurse_call("completed"));
    }

    #[test]
    fn escalated_means_overdue() {
        assert!(!is_overdue_nurse_call("normal"));
        assert!(is_overdue_nurse_call("charge_nurse"));
        assert!(is_overdue_nurse_call("supervisor"));
    }

    #[test]
    fn wait_is_zero_padded_and_clamped() {
        assert_eq!(wait_label(247), "4m 07s");
        assert_eq!(wait_label(-30), "0m 00s");
    }
}
