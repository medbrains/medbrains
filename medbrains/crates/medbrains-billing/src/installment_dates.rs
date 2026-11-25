//! When each payment installment falls due.
//!
//! Counted from the hospital's own date, not the UTC one (a plan made at
//! 01:00 IST is made "today", not yesterday), and in calendar months: the
//! 31st of January plus a month is the last day of February, not 2 or 3
//! March as thirty days gave.

use chrono::{Days, Months, NaiveDate};

/// Installment `n` (1-based) of a plan started on `start`, by `frequency`
/// (`weekly`, `biweekly`, `quarterly`, else monthly). A month that has no
/// such day lands on its last day. `None` only past the end of the calendar.
#[must_use]
pub(crate) fn due_date(start: NaiveDate, frequency: &str, n: u32) -> Option<NaiveDate> {
    match frequency {
        "weekly" => start.checked_add_days(Days::new(7 * u64::from(n))),
        "biweekly" => start.checked_add_days(Days::new(14 * u64::from(n))),
        "quarterly" => start.checked_add_months(Months::new(3 * n)),
        _ => start.checked_add_months(Months::new(n)),
    }
}

#[cfg(test)]
mod tests {
    use super::due_date;
    use chrono::NaiveDate;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap_or_default()
    }

    #[test]
    fn a_month_without_the_day_lands_on_its_last_day() {
        assert_eq!(due_date(d(2027, 1, 31), "monthly", 1), Some(d(2027, 2, 28)));
        assert_eq!(due_date(d(2028, 1, 31), "monthly", 1), Some(d(2028, 2, 29)));
        assert_eq!(due_date(d(2027, 1, 31), "monthly", 3), Some(d(2027, 4, 30)));
        assert_eq!(
            due_date(d(2027, 1, 31), "monthly", 12),
            Some(d(2028, 1, 31))
        );
    }

    #[test]
    fn quarters_are_three_calendar_months() {
        assert_eq!(
            due_date(d(2027, 11, 30), "quarterly", 1),
            Some(d(2028, 2, 29))
        );
        assert_eq!(
            due_date(d(2027, 1, 15), "quarterly", 4),
            Some(d(2028, 1, 15))
        );
    }

    #[test]
    fn weeks_stay_seven_days() {
        assert_eq!(due_date(d(2027, 12, 28), "weekly", 1), Some(d(2028, 1, 4)));
        assert_eq!(
            due_date(d(2027, 12, 28), "biweekly", 2),
            Some(d(2028, 1, 25))
        );
    }
}
