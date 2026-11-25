//! The reference band a lab result is judged against, from the patient's age
//! in days on the hospital's own date. A newborn turns 28 days old (neonate
//! to infant) at local midnight; counted on the UTC date the band changed
//! 5 h 30 min late in India, and a result in that window got the wrong range.

use chrono::NaiveDate;

/// The band for a patient born on `dob` (if known) of `sex`, on `today`.
pub(crate) fn band(dob: Option<NaiveDate>, sex: Option<&str>, today: NaiveDate) -> &'static str {
    let female = sex == Some("female");
    let adult = if female { "adult_f" } else { "adult_m" };
    let Some(dob) = dob else {
        return adult;
    };
    let age_days = today.signed_duration_since(dob).num_days();
    if age_days < 28 {
        "neonate"
    } else if age_days < 365 {
        "infant"
    } else if age_days < 365 * 12 {
        "child"
    } else if age_days >= 365 * 65 {
        if female { "elderly_f" } else { "elderly_m" }
    } else {
        adult
    }
}

#[cfg(test)]
mod tests {
    use super::band;
    use chrono::{FixedOffset, NaiveDate, TimeZone, Utc};

    #[test]
    fn at_one_in_the_morning_ist_a_28_day_old_is_an_infant() {
        // 01:00 IST on 26 Nov is 19:30 UTC on 25 Nov; born 29 Oct, 28 days old locally.
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 19, 30, 0).unwrap();
        let ist = FixedOffset::east_opt(5 * 3600 + 1800).unwrap();
        let hospital_today = now.with_timezone(&ist).date_naive();
        let dob = NaiveDate::from_ymd_opt(2026, 10, 29);
        // The UTC date (the old count) still said neonate.
        assert_eq!(band(dob, Some("male"), now.date_naive()), "neonate");
        assert_eq!(band(dob, Some("male"), hospital_today), "infant");
    }

    #[test]
    fn bands_by_age_and_sex() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 26).unwrap();
        let born = |y| NaiveDate::from_ymd_opt(y, 1, 1);
        assert_eq!(band(None, Some("female"), today), "adult_f");
        assert_eq!(band(born(2020), Some("female"), today), "child");
        assert_eq!(band(born(1990), None, today), "adult_m");
        assert_eq!(band(born(1950), Some("female"), today), "elderly_f");
    }
}
