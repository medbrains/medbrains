//! Shaping a doctor's appointment list for a phone: the ordering and the
//! "what is next" rule are decisions, not formatting.

/// Statuses that mean the patient is not going to be seen.
const CLOSED: [&str; 3] = ["cancelled", "no_show", "completed"];

#[must_use]
pub fn is_still_to_come(status: &str) -> bool {
    !CLOSED.contains(&status)
}

/// Indices of the list ordered by clock time, earliest first.
///
/// An appointment with no time sorts LAST: a missing time usually means a
/// walk-in slotted in, and putting it at the head would tell the doctor their
/// next patient is one nobody has scheduled. Stable, so equal times keep the
/// server's order.
#[must_use]
pub fn clinic_order(start_times: &[Option<String>]) -> Vec<u32> {
    let mut idx: Vec<usize> = (0..start_times.len()).collect();
    idx.sort_by(|&a, &b| match (&start_times[a], &start_times[b]) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (Some(_), None) => std::cmp::Ordering::Less,
        (Some(x), Some(y)) => x.cmp(y),
    });
    idx.into_iter().map(|i| i as u32).collect()
}

/// The one the doctor is about to see: the earliest still-open appointment,
/// as an index into the caller's list; `None` when the clinic is finished.
#[must_use]
pub fn next_patient(start_times: &[Option<String>], statuses: &[String]) -> Option<u32> {
    clinic_order(start_times).into_iter().find(|&i| statuses.get(i as usize).is_some_and(|s| is_still_to_come(s)))
}

#[must_use]
pub fn remaining_count(statuses: &[String]) -> u32 {
    statuses.iter().filter(|s| is_still_to_come(s)).count() as u32
}

#[cfg(test)]
mod tests {
    use super::{clinic_order, is_still_to_come, next_patient, remaining_count};

    fn t(s: &str) -> Option<String> {
        Some(s.to_owned())
    }

    #[test]
    fn orders_by_clock_time() {
        assert_eq!(clinic_order(&[t("14:00"), t("09:00"), t("11:30")]), vec![1, 2, 0]);
    }

    #[test]
    fn no_time_sorts_last_not_first() {
        assert_eq!(clinic_order(&[None, t("09:00")]), vec![1, 0]);
    }

    #[test]
    fn closed_statuses_are_not_coming() {
        assert!(!is_still_to_come("cancelled"));
        assert!(!is_still_to_come("no_show"));
        assert!(!is_still_to_come("completed"));
        assert!(is_still_to_come("scheduled"));
        assert!(is_still_to_come("checked_in"));
    }

    #[test]
    fn next_skips_completed_and_cancelled() {
        let times = [t("09:00"), t("09:30"), t("10:00")];
        let statuses = ["completed".to_owned(), "scheduled".to_owned(), "scheduled".to_owned()];
        assert_eq!(next_patient(&times, &statuses), Some(1));
        let statuses = ["cancelled".to_owned(), "scheduled".to_owned()];
        assert_eq!(next_patient(&[t("09:00"), t("09:15")], &statuses), Some(1));
    }

    #[test]
    fn next_is_none_when_the_clinic_is_finished() {
        assert_eq!(next_patient(&[t("09:00")], &["completed".to_owned()]), None);
    }

    #[test]
    fn remaining_counts_only_what_is_still_to_be_seen() {
        let s = ["completed", "scheduled", "cancelled", "scheduled"].map(str::to_owned);
        assert_eq!(remaining_count(&s), 2);
    }
}
