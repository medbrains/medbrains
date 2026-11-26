//! The dates an OT screen shows when none are asked for: the hospital's own
//! today, never the UTC date. From 00:00 to 05:30 IST the UTC date is
//! yesterday's, so the theatre board opened on yesterday's list.

use chrono::{Days, NaiveDate};

/// `from`..`to` for a report: what was asked for, else the `days` before
/// `today` (the hospital's date) up to today.
pub(crate) fn range(
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
    today: NaiveDate,
    days: u64,
) -> (NaiveDate, NaiveDate) {
    let start = today
        .checked_sub_days(Days::new(days))
        .unwrap_or(NaiveDate::MIN);
    (from.unwrap_or(start), to.unwrap_or(today))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::range;
    use chrono::{FixedOffset, NaiveDate, TimeZone, Utc};

    #[test]
    fn at_one_in_the_morning_ist_the_default_range_ends_today() {
        // 01:00 IST on 26 Nov is 19:30 UTC on 25 Nov.
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 19, 30, 0).unwrap();
        let ist = FixedOffset::east_opt(5 * 3600 + 1800).unwrap();
        let hospital_today = now.with_timezone(&ist).date_naive();
        let day = |d| NaiveDate::from_ymd_opt(2026, 11, d).unwrap();
        assert_ne!(
            now.date_naive(),
            hospital_today,
            "the old default was yesterday"
        );
        assert_eq!(
            range(None, None, hospital_today, 30),
            (day(26) - chrono::Days::new(30), day(26))
        );
        assert_eq!(
            range(Some(day(1)), Some(day(2)), hospital_today, 30),
            (day(1), day(2))
        );
    }
}
