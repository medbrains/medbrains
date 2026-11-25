//! A sterile pack is refused once its labelled expiry is behind the
//! hospital's own date. The UTC date is yesterday's from 00:00 to 05:30 IST,
//! so checked against it a pack that expired yesterday was still accepted.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;

/// Refuse a pack whose labelled `expiry` is before the hospital's `today`.
///
/// # Errors
/// `BadRequest` naming the label when the pack has expired.
pub(crate) fn refuse_expired(expiry: NaiveDate, today: NaiveDate) -> Result<(), AppError> {
    if expiry < today {
        return Err(AppError::BadRequest(
            "The pack expiry date is in the past. Check the label.".to_owned(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::refuse_expired;
    use chrono::{FixedOffset, NaiveDate, TimeZone, Utc};

    #[test]
    fn at_one_in_the_morning_ist_yesterdays_pack_is_refused() {
        // 01:00 IST on 26 Nov is 19:30 UTC on 25 Nov.
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 19, 30, 0).unwrap();
        let ist = FixedOffset::east_opt(5 * 3600 + 1800).unwrap();
        let hospital_today = now.with_timezone(&ist).date_naive();
        let expired_yesterday = NaiveDate::from_ymd_opt(2026, 11, 25).unwrap();
        // The UTC date (the old check) let it through.
        assert!(refuse_expired(expired_yesterday, now.date_naive()).is_ok());
        assert!(refuse_expired(expired_yesterday, hospital_today).is_err());
        assert!(refuse_expired(hospital_today, hospital_today).is_ok());
    }
}
