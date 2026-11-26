//! Whether a patient's consent still stands on the hospital's own date.
//! "Valid until 25 November" is valid through that day; checked against the
//! UTC date it still read valid from 00:00 to 05:30 IST on the 26th.

use chrono::NaiveDate;

/// The status that overrides a consent's own on `today` (the hospital's
/// date): withdrawn if revoked, expired once `valid_until` is behind today;
/// `None` when its recorded status stands.
pub(crate) fn status_on(
    revoked: bool,
    valid_until: Option<NaiveDate>,
    today: NaiveDate,
) -> Option<&'static str> {
    if revoked {
        Some("withdrawn")
    } else if valid_until.is_some_and(|d| d < today) {
        Some("expired")
    } else {
        None
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::status_on;
    use chrono::{FixedOffset, NaiveDate, TimeZone, Utc};

    #[test]
    fn at_one_in_the_morning_ist_yesterdays_consent_has_expired() {
        // 01:00 IST on 26 Nov is 19:30 UTC on 25 Nov.
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 19, 30, 0).unwrap();
        let ist = FixedOffset::east_opt(5 * 3600 + 1800).unwrap();
        let hospital_today = now.with_timezone(&ist).date_naive();
        let until = NaiveDate::from_ymd_opt(2026, 11, 25);
        // The UTC date (the old check) still called it valid.
        assert_eq!(status_on(false, until, now.date_naive()), None);
        assert_eq!(status_on(false, until, hospital_today), Some("expired"));
        assert_eq!(status_on(true, until, hospital_today), Some("withdrawn"));
    }
}
