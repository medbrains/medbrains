//! A patient's age in whole years on the hospital's own date. On a birthday
//! the UTC date is still the day before until 05:30 IST, so the age read one
//! year short through the night.

use chrono::NaiveDate;

/// Whole years from `dob` to `today` (the hospital's date); 0 before birth.
pub(crate) fn years_on(dob: NaiveDate, today: NaiveDate) -> i32 {
    today
        .years_since(dob)
        .and_then(|y| i32::try_from(y).ok())
        .unwrap_or(0)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::years_on;
    use chrono::{FixedOffset, NaiveDate, TimeZone, Utc};

    #[test]
    fn at_one_in_the_morning_ist_on_a_birthday_the_patient_is_a_year_older() {
        // 01:00 IST on 26 Nov is 19:30 UTC on 25 Nov; born 26 Nov 2008.
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 19, 30, 0).unwrap();
        let ist = FixedOffset::east_opt(5 * 3600 + 1800).unwrap();
        let hospital_today = now.with_timezone(&ist).date_naive();
        let dob = NaiveDate::from_ymd_opt(2008, 11, 26).unwrap();
        // The UTC date (the old count) said 17: a minor, for consent.
        assert_eq!(years_on(dob, now.date_naive()), 17);
        assert_eq!(years_on(dob, hospital_today), 18);
        assert_eq!(years_on(hospital_today, dob), 0);
    }
}
