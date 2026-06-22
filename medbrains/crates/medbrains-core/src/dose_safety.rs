//! Medication dose-safety — derive a daily dose from a per-dose amount and a
//! frequency, and compare it against the catalogue's `max_dose_per_day`.
//!
//! Pure and dependency-free so it can be unit-tested and reused on both the CDS
//! advisory path (`routes/cds.rs`) and the prescribe-time backstop
//! (`routes/opd.rs::create_prescription`). It is deliberately conservative: it
//! only flags an exceedance when both amounts parse cleanly, their **units
//! match**, and a fixed daily dose is derivable — otherwise it stays silent
//! rather than raise a false alarm.

/// A confirmed daily-dose overage for one prescription line.
#[derive(Debug, Clone, PartialEq)]
pub struct DoseExceedance {
    /// Prescribed total for the day (per-dose amount × doses/day).
    pub total_per_day: f64,
    /// Shared unit of the per-dose amount and the catalogue maximum.
    pub unit: String,
    /// Catalogue maximum daily dose, in the same unit.
    pub max_per_day: f64,
    /// `total_per_day / max_per_day` (> 1.0 when exceeded).
    pub ratio: f64,
}

/// Parse a dose string like `"500 mg"`, `"5ml"`, `"2 puff"` into a numeric
/// amount and a lowercased unit. Returns `None` when no number is present.
#[must_use]
pub fn parse_amount(value: &str) -> Option<(f64, String)> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    // The numeric prefix: digits, one decimal point, leading sign.
    let mut split = 0;
    for (idx, ch) in trimmed.char_indices() {
        if ch.is_ascii_digit() || ch == '.' || (idx == 0 && (ch == '+' || ch == '-')) {
            split = idx + ch.len_utf8();
        } else {
            break;
        }
    }
    if split == 0 {
        return None;
    }

    let amount: f64 = trimmed[..split].parse().ok()?;
    let unit = trimmed[split..].trim().to_lowercase();
    Some((amount, unit))
}

/// Compare a per-dose amount taken `doses_per_day` times against the
/// catalogue's free-text `max_per_day`. Returns `Some` only when the daily
/// total strictly exceeds the maximum and the units agree.
#[must_use]
pub fn evaluate_max_dose(
    per_dose: &str,
    doses_per_day: u32,
    max_per_day: &str,
) -> Option<DoseExceedance> {
    if doses_per_day == 0 {
        return None;
    }
    let (dose_amount, dose_unit) = parse_amount(per_dose)?;
    let (max_amount, max_unit) = parse_amount(max_per_day)?;
    if dose_unit != max_unit || dose_unit.is_empty() || max_amount <= 0.0 {
        return None;
    }

    let total = dose_amount * f64::from(doses_per_day);
    if total <= max_amount {
        return None;
    }
    Some(DoseExceedance {
        total_per_day: total,
        unit: dose_unit,
        max_per_day: max_amount,
        ratio: total / max_amount,
    })
}

#[cfg(test)]
mod tests {
    use super::{evaluate_max_dose, parse_amount};

    #[test]
    fn parses_amount_and_unit() {
        assert_eq!(parse_amount("500 mg"), Some((500.0, "mg".to_owned())));
        assert_eq!(parse_amount("5ml"), Some((5.0, "ml".to_owned())));
        assert_eq!(parse_amount("2.5 mg"), Some((2.5, "mg".to_owned())));
        assert_eq!(parse_amount("1 tab"), Some((1.0, "tab".to_owned())));
        assert_eq!(parse_amount("  "), None);
        assert_eq!(parse_amount("mg"), None);
    }

    #[test]
    fn within_limit_is_silent() {
        // 500 mg TID = 1500 mg/day, under 3000.
        assert!(evaluate_max_dose("500 mg", 3, "3000 mg").is_none());
        // Exactly at the limit is not an exceedance.
        assert!(evaluate_max_dose("1000 mg", 3, "3000 mg").is_none());
    }

    #[test]
    fn over_limit_flags_with_ratio() {
        // 1000 mg QID = 4000 mg/day > 3000.
        let hit = evaluate_max_dose("1000 mg", 4, "3000 mg").expect("should exceed");
        assert!((hit.total_per_day - 4000.0).abs() < f64::EPSILON);
        assert_eq!(hit.unit, "mg");
        assert!((hit.max_per_day - 3000.0).abs() < f64::EPSILON);
        assert!(hit.ratio > 1.3);
    }

    #[test]
    fn unit_mismatch_is_silent() {
        // ml per-dose vs mg max — cannot compare, do not guess.
        assert!(evaluate_max_dose("5 ml", 4, "3000 mg").is_none());
    }

    #[test]
    fn missing_or_zero_inputs_are_silent() {
        assert!(evaluate_max_dose("1000 mg", 4, "").is_none());
        assert!(evaluate_max_dose("1000 mg", 0, "3000 mg").is_none());
        assert!(evaluate_max_dose("", 4, "3000 mg").is_none());
    }
}
