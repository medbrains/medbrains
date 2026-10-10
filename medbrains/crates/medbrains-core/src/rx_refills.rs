//! Refills and validity of a prescription.
//!
//! What the doctor may authorise, and when the pharmacy may issue a refill
//! against it. Pure rules, so the writer's check and the pharmacy's check are
//! the same code.

use chrono::{DateTime, Duration, NaiveDate, Utc};

/// The most refills one prescription may authorise.
pub const MAX_REFILLS: i32 = 12;
/// The longest gap between refills a doctor may set.
pub const MAX_INTERVAL_DAYS: i32 = 365;

/// What the doctor wrote about refills and validity.
#[derive(Debug, Clone, Copy)]
pub struct RefillTerms {
    pub refills: i32,
    pub interval_days: Option<i32>,
    pub valid_until: Option<NaiveDate>,
}

/// Why a doctor's refill terms are refused, or `None` when they stand.
///
/// `controlled` names the lines that are Schedule X, H1 or NDPS — drugs the
/// D&C and NDPS rules allow only against a fresh prescription each time.
#[must_use]
pub fn terms_problem(
    terms: RefillTerms,
    today: NaiveDate,
    controlled: &[String],
) -> Option<String> {
    if terms.valid_until.is_some_and(|d| d < today) {
        return Some("A prescription can't expire before today".to_owned());
    }
    if !(0..=MAX_REFILLS).contains(&terms.refills) {
        return Some(format!("Refills are 0 to {MAX_REFILLS}"));
    }
    if terms.refills == 0 {
        return None;
    }
    if !controlled.is_empty() {
        return Some(format!(
            "Controlled drugs can't be refilled: {}. Write a new prescription each time.",
            controlled.join(", ")
        ));
    }
    let Some(interval) = terms
        .interval_days
        .filter(|d| (1..=MAX_INTERVAL_DAYS).contains(d))
    else {
        return Some(format!(
            "Say how often it may be refilled: every 1 to {MAX_INTERVAL_DAYS} days"
        ));
    };
    let last_refill = today + Duration::days(i64::from(terms.refills * interval));
    match terms.valid_until {
        Some(until) if until >= last_refill => None,
        _ => Some(format!(
            "Valid until must cover all {} refills: {} or later",
            terms.refills,
            last_refill.format("%d %b %Y")
        )),
    }
}

/// Where a prescription stands for its next refill.
#[derive(Debug, Clone, Copy)]
pub struct RefillState {
    pub refills: i32,
    pub used: i32,
    pub interval_days: Option<i32>,
    pub valid_until: Option<NaiveDate>,
    pub issued_at: DateTime<Utc>,
    pub last_refill_at: Option<DateTime<Utc>>,
}

impl RefillState {
    #[must_use]
    pub fn remaining(self) -> i32 {
        (self.refills - self.used).max(0)
    }

    /// The earliest moment the next refill may be issued: one interval after
    /// the last issue — the original prescription counts as the first.
    #[must_use]
    pub fn next_eligible_at(self) -> Option<DateTime<Utc>> {
        let days = self.interval_days?;
        Some(self.last_refill_at.unwrap_or(self.issued_at) + Duration::days(i64::from(days)))
    }

    /// Why a refill can't be issued now, or `None` when it can.
    #[must_use]
    pub fn refusal(self, now: DateTime<Utc>) -> Option<String> {
        if self.refills == 0 {
            return Some("This prescription has no refills".to_owned());
        }
        if self.remaining() == 0 {
            return Some(format!("All {} refills have been used", self.refills));
        }
        if let Some(until) = self.valid_until.filter(|d| *d < now.date_naive()) {
            return Some(format!(
                "This prescription expired on {}",
                until.format("%d %b %Y")
            ));
        }
        match self.next_eligible_at() {
            Some(next) if next > now => Some(format!(
                "The next refill is due on {}",
                next.format("%d %b %Y")
            )),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap_or_default()
    }

    fn at(date: NaiveDate) -> DateTime<Utc> {
        date.and_hms_opt(10, 0, 0).unwrap_or_default().and_utc()
    }

    const TODAY: (i32, u32, u32) = (2026, 10, 10);

    fn terms(refills: i32, interval: Option<i32>, until: Option<NaiveDate>) -> RefillTerms {
        RefillTerms {
            refills,
            interval_days: interval,
            valid_until: until,
        }
    }

    #[test]
    fn a_plain_prescription_needs_no_refill_terms() {
        let today = day(TODAY.0, TODAY.1, TODAY.2);
        assert_eq!(terms_problem(terms(0, None, None), today, &[]), None);
        assert!(terms_problem(terms(0, None, Some(day(2026, 10, 9))), today, &[]).is_some());
    }

    #[test]
    fn refills_need_an_interval_and_a_validity_that_covers_them() {
        let today = day(TODAY.0, TODAY.1, TODAY.2);
        assert!(terms_problem(terms(2, None, Some(day(2027, 1, 1))), today, &[]).is_some());
        // Two refills, 30 days apart: the last falls on 9 Dec.
        let short = terms_problem(terms(2, Some(30), Some(day(2026, 12, 8))), today, &[]);
        assert!(short.is_some_and(|m| m.contains("09 Dec 2026")));
        assert_eq!(
            terms_problem(terms(2, Some(30), Some(day(2026, 12, 9))), today, &[]),
            None
        );
        assert!(terms_problem(terms(13, Some(30), Some(day(2028, 1, 1))), today, &[]).is_some());
    }

    #[test]
    fn controlled_drugs_are_never_refillable() {
        let today = day(TODAY.0, TODAY.1, TODAY.2);
        let refused = terms_problem(
            terms(1, Some(30), Some(day(2027, 1, 1))),
            today,
            &["Tramadol".to_owned()],
        );
        assert!(refused.is_some_and(|m| m.contains("Tramadol")));
        // Without refills the same drug is prescribed as usual.
        assert_eq!(
            terms_problem(terms(0, None, None), today, &["Tramadol".to_owned()]),
            None
        );
    }

    fn state(used: i32, last: Option<NaiveDate>) -> RefillState {
        RefillState {
            refills: 2,
            used,
            interval_days: Some(30),
            valid_until: Some(day(2026, 12, 31)),
            issued_at: at(day(2026, 9, 1)),
            last_refill_at: last.map(at),
        }
    }

    #[test]
    fn the_first_refill_waits_one_interval_after_the_prescription() {
        assert!(state(0, None).refusal(at(day(2026, 9, 15))).is_some());
        assert_eq!(state(0, None).refusal(at(day(2026, 10, 1))), None);
    }

    #[test]
    fn later_refills_wait_from_the_last_one_and_stop_when_used_up() {
        let after_first = state(1, Some(day(2026, 10, 1)));
        assert!(after_first.refusal(at(day(2026, 10, 20))).is_some());
        assert_eq!(after_first.refusal(at(day(2026, 10, 31))), None);
        assert!(
            state(2, Some(day(2026, 10, 31)))
                .refusal(at(day(2026, 12, 1)))
                .is_some()
        );
    }

    #[test]
    fn an_expired_prescription_is_not_refilled() {
        let refusal = state(1, Some(day(2026, 10, 1))).refusal(at(day(2027, 1, 2)));
        assert!(refusal.is_some_and(|m| m.contains("expired")));
    }
}
