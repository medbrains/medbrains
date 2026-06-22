//! Medication-round scheduling — explode a prescription item's free-text
//! frequency + duration into concrete dose slots for the eMAR.
//!
//! Pure, dependency-free (chrono only) and unit-tested. The caller persists
//! each [`DoseSlot`] as an `ipd_medication_administration` row.
//!
//! Times are computed in UTC from the `start` anchor's calendar date. Ward
//! timezone + ward-configurable round times are a follow-up; the defaults
//! below match common Indian-hospital drug-round practice.

use chrono::{DateTime, Duration, TimeZone, Utc};

/// A single scheduled administration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DoseSlot {
    pub scheduled_at: DateTime<Utc>,
    /// The frequency or duration could not be parsed confidently; the nurse
    /// should review/adjust this schedule.
    pub needs_review: bool,
}

/// Standard drug-round hours (24h, UTC) for each cadence.
fn round_hours(freq: &str) -> Option<Vec<u32>> {
    // Normalise: uppercase, strip spaces/dots.
    let f: String = freq
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '.')
        .collect::<String>()
        .to_uppercase();

    // Indian "1-0-1" morning-noon-night (optionally a 4th bedtime slot).
    if let Some(hours) = parse_dash_pattern(&f) {
        return Some(hours);
    }

    let hours = match f.as_str() {
        "OD" | "QD" | "QID1" | "DAILY" | "ONCEDAILY" | "OM" | "MANE" => vec![8],
        "BD" | "BID" | "Q12H" | "TWICEDAILY" => vec![8, 20],
        "TID" | "TDS" | "Q8H" => vec![8, 14, 20],
        "QID" | "QDS" | "Q6H" => vec![6, 12, 18, 22],
        "Q4H" => vec![6, 10, 14, 18, 22],
        "HS" | "QHS" | "NOCTE" | "ON" => vec![22],
        _ => return None,
    };
    Some(hours)
}

/// Parse an Indian dosing pattern like "1-0-1" or "1-1-1-1" into round hours.
/// A nonzero token enables that slot; slots map to morning/noon/evening/night.
fn parse_dash_pattern(f: &str) -> Option<Vec<u32>> {
    if !f.contains('-') {
        return None;
    }
    let parts: Vec<&str> = f.split('-').collect();
    if !(3..=4).contains(&parts.len()) {
        return None;
    }
    let slot_hours = [8u32, 14, 20, 22];
    let mut hours = Vec::new();
    for (idx, part) in parts.iter().enumerate() {
        // Each token must be a small integer (0, 1, 2 ...). Reject anything else.
        let n: u32 = part.parse().ok()?;
        if n > 0 {
            if let Some(h) = slot_hours.get(idx) {
                hours.push(*h);
            }
        }
    }
    if hours.is_empty() { None } else { Some(hours) }
}

/// Number of days a course runs, parsed from free-text like "5 days", "5d",
/// "1 week", "x 5/7". Returns `None` if no integer is found.
fn parse_duration_days(duration: &str) -> Option<i64> {
    let lower = duration.to_lowercase();
    // First run of digits.
    let digits: String = lower
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(|c| c.is_ascii_digit())
        .collect();
    let n: i64 = digits.parse().ok()?;
    if n <= 0 {
        return None;
    }
    let days = if lower.contains("week") || lower.contains("/7") {
        n * 7
    } else if lower.contains("month") {
        n * 30
    } else {
        n
    };
    Some(days.min(366))
}

/// True if the frequency means "as needed" — no fixed schedule is generated.
pub fn is_prn(frequency: &str) -> bool {
    let f = frequency.trim().to_uppercase();
    f.contains("PRN") || f.contains("SOS") || f.contains("ASNEEDED") || f.contains("AS NEEDED")
}

/// Number of scheduled administrations per day for a recurring frequency.
///
/// Returns `None` for as-needed (PRN/SOS) — which has no fixed daily total —
/// and for frequencies we do not recognise. Used by dose-safety to derive the
/// daily dose from a per-dose amount.
#[must_use]
pub fn doses_per_day(frequency: &str) -> Option<u32> {
    if is_prn(frequency) {
        return None;
    }
    round_hours(frequency).map(|hours| hours.len() as u32)
}

/// True if the frequency means a single immediate dose.
fn is_stat(frequency: &str) -> bool {
    let f: String = frequency
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    f == "STAT" || f == "ONCE" || f == "X1" || f == "1X"
}

/// Explode a frequency + duration into concrete dose slots.
///
/// - PRN/SOS → empty (doses are created on demand at the bedside).
/// - STAT/once → a single slot at `start`.
/// - Unknown frequency → one daily morning slot per day, flagged for review.
/// - Unknown duration → a single day, flagged for review.
#[must_use]
pub fn schedule_doses(frequency: &str, duration: &str, start: DateTime<Utc>) -> Vec<DoseSlot> {
    if is_prn(frequency) {
        return Vec::new();
    }
    if is_stat(frequency) {
        return vec![DoseSlot { scheduled_at: start, needs_review: false }];
    }

    let (hours, freq_unknown) = match round_hours(frequency) {
        Some(h) => (h, false),
        None => (vec![8], true),
    };
    let (days, dur_unknown) = match parse_duration_days(duration) {
        Some(d) => (d, false),
        None => (1, true),
    };
    let needs_review = freq_unknown || dur_unknown;

    let base = start.date_naive();
    let mut slots = Vec::new();
    for day in 0..days {
        let Some(date) = base.checked_add_signed(Duration::days(day)) else {
            continue;
        };
        for &h in &hours {
            let Some(naive) = date.and_hms_opt(h, 0, 0) else {
                continue;
            };
            if let chrono::LocalResult::Single(at) = Utc.from_local_datetime(&naive) {
                slots.push(DoseSlot { scheduled_at: at, needs_review });
            }
        }
    }
    slots.sort_by_key(|s| s.scheduled_at);
    slots
}

#[cfg(test)]
mod tests {
    use super::*;

    fn start() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 6, 21, 9, 30, 0).single().expect("valid date")
    }

    #[test]
    fn tid_five_days_makes_fifteen_slots() {
        let slots = schedule_doses("TID", "5 days", start());
        assert_eq!(slots.len(), 15);
        assert!(slots.iter().all(|s| !s.needs_review));
    }

    #[test]
    fn bd_one_week_makes_fourteen() {
        assert_eq!(schedule_doses("BD", "1 week", start()).len(), 14);
    }

    #[test]
    fn dash_pattern_one_zero_one_is_bd() {
        let slots = schedule_doses("1-0-1", "3 days", start());
        assert_eq!(slots.len(), 6);
        assert!(!slots[0].needs_review);
    }

    #[test]
    fn dash_pattern_one_one_one_one_is_qid() {
        assert_eq!(schedule_doses("1-1-1-1", "1 day", start()).len(), 4);
    }

    #[test]
    fn stat_is_single_immediate_dose() {
        let slots = schedule_doses("STAT", "", start());
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].scheduled_at, start());
        assert!(!slots[0].needs_review);
    }

    #[test]
    fn prn_makes_no_slots() {
        assert!(schedule_doses("PRN", "5 days", start()).is_empty());
        assert!(schedule_doses("Q6H PRN", "5 days", start()).is_empty());
        assert!(is_prn("SOS"));
    }

    #[test]
    fn hs_once_at_night() {
        let slots = schedule_doses("HS", "2 days", start());
        assert_eq!(slots.len(), 2);
        assert_eq!(slots[0].scheduled_at.format("%H").to_string(), "22");
    }

    #[test]
    fn q6h_four_times() {
        assert_eq!(schedule_doses("Q6H", "1 day", start()).len(), 4);
    }

    #[test]
    fn unknown_frequency_flags_review() {
        let slots = schedule_doses("when the moon is full", "2 days", start());
        assert_eq!(slots.len(), 2); // fallback: one morning dose/day
        assert!(slots.iter().all(|s| s.needs_review));
    }

    #[test]
    fn unknown_duration_flags_review_single_day() {
        let slots = schedule_doses("TID", "until better", start());
        assert_eq!(slots.len(), 3);
        assert!(slots.iter().all(|s| s.needs_review));
    }

    #[test]
    fn slots_are_sorted() {
        let slots = schedule_doses("TID", "2 days", start());
        for w in slots.windows(2) {
            assert!(w[0].scheduled_at <= w[1].scheduled_at);
        }
    }
}
