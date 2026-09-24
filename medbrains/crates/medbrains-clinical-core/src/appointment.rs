//! The desk's appointment rules, once, for every device.
//!
//! * Which actions a booking offers: check-in and no-show belong to the day
//!   of the appointment and to a booking that has not moved on. A row for
//!   another day, or one already checked in, cancelled or completed, offers
//!   nothing — the server would refuse, and a button the server refuses is a
//!   lie on the screen.
//! * Which slots the desk may offer: a slot that has already passed, or one
//!   the schedule says is full, is not offered at all rather than refused
//!   after the tap.
//!
//! Dates are ISO `YYYY-MM-DD` and times `HH:MM:SS`, which compare as text.

/// The actions a booking offers the desk, in the order they are shown.
#[must_use]
pub fn appointment_actions(status: &str, is_today: bool) -> Vec<&'static str> {
    if is_today && matches!(status, "scheduled" | "confirmed") {
        vec!["check_in", "no_show"]
    } else {
        Vec::new()
    }
}

/// Whether a slot may be offered: available, and not already behind us.
#[must_use]
pub fn slot_is_bookable(date: &str, start_time: &str, today: &str, now_time: &str, is_available: bool) -> bool {
    if !is_available {
        return false;
    }
    match date.cmp(today) {
        std::cmp::Ordering::Greater => true,
        std::cmp::Ordering::Equal => start_time > now_time,
        std::cmp::Ordering::Less => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{appointment_actions, slot_is_bookable};

    #[test]
    fn only_todays_open_bookings_can_be_checked_in_or_missed() {
        assert_eq!(appointment_actions("scheduled", true), vec!["check_in", "no_show"]);
        assert_eq!(appointment_actions("confirmed", true), vec!["check_in", "no_show"]);
        assert!(appointment_actions("scheduled", false).is_empty());
        assert!(appointment_actions("checked_in", true).is_empty());
        assert!(appointment_actions("no_show", true).is_empty());
        assert!(appointment_actions("cancelled", true).is_empty());
    }

    #[test]
    fn a_slot_behind_us_or_full_is_not_offered() {
        assert!(slot_is_bookable("2026-09-17", "09:00:00", "2026-09-16", "15:00:00", true));
        assert!(slot_is_bookable("2026-09-16", "16:00:00", "2026-09-16", "15:00:00", true));
        assert!(!slot_is_bookable("2026-09-16", "09:00:00", "2026-09-16", "15:00:00", true));
        assert!(!slot_is_bookable("2026-09-15", "16:00:00", "2026-09-16", "15:00:00", true));
        assert!(!slot_is_bookable("2026-09-17", "09:00:00", "2026-09-16", "15:00:00", false));
    }
}
