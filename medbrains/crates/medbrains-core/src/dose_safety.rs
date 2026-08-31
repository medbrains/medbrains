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

/// Direction of a weight-based dose deviation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoseDirection {
    Over,
    Under,
}

/// A paediatric weight-based (mg/kg/day) dose advisory.
#[derive(Debug, Clone, PartialEq)]
pub struct WeightDoseAdvice {
    pub prescribed_per_day: f64,
    pub recommended_per_day: f64,
    pub unit: String,
    pub direction: DoseDirection,
    /// `prescribed / recommended`.
    pub ratio: f64,
}

/// Deviation beyond ±25% of the weight-based recommendation is advised.
const WEIGHT_DOSE_TOLERANCE: f64 = 0.25;

/// Compare a prescribed daily dose against the weight-based recommendation
/// (`weight_kg × dose_per_kg`). Advisory only — over **and** under dosing both
/// matter in paediatrics. Returns `None` when inputs are missing, units differ,
/// or the prescribed dose is within tolerance of the recommendation.
#[must_use]
pub fn evaluate_weight_dose(
    per_dose: &str,
    doses_per_day: u32,
    weight_kg: f64,
    dose_per_kg: &str,
) -> Option<WeightDoseAdvice> {
    if doses_per_day == 0 || weight_kg <= 0.0 {
        return None;
    }
    let (dose_amount, dose_unit) = parse_amount(per_dose)?;
    let (per_kg_amount, per_kg_unit) = parse_amount(dose_per_kg)?;
    if dose_unit != per_kg_unit || dose_unit.is_empty() || per_kg_amount <= 0.0 {
        return None;
    }

    let recommended = weight_kg * per_kg_amount;
    if recommended <= 0.0 {
        return None;
    }
    let prescribed = dose_amount * f64::from(doses_per_day);
    let ratio = prescribed / recommended;
    if (ratio - 1.0).abs() <= WEIGHT_DOSE_TOLERANCE {
        return None;
    }
    Some(WeightDoseAdvice {
        prescribed_per_day: prescribed,
        recommended_per_day: recommended,
        unit: dose_unit,
        direction: if ratio > 1.0 {
            DoseDirection::Over
        } else {
            DoseDirection::Under
        },
        ratio,
    })
}

#[cfg(test)]
mod tests {
    use super::{DoseDirection, evaluate_max_dose, evaluate_weight_dose, parse_amount};

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

    #[test]
    fn weight_dose_within_tolerance_is_silent() {
        // 20 kg × 15 mg/kg = 300 mg/day recommended; 100 mg TID = 300 → on target.
        assert!(evaluate_weight_dose("100 mg", 3, 20.0, "15 mg").is_none());
        // 110 mg TID = 330 → within +25%.
        assert!(evaluate_weight_dose("110 mg", 3, 20.0, "15 mg").is_none());
    }

    #[test]
    fn weight_dose_over_and_under_flag() {
        // 20 kg × 15 = 300; 250 mg BD = 500 → over (+67%).
        let over = evaluate_weight_dose("250 mg", 2, 20.0, "15 mg").expect("over");
        assert_eq!(over.direction, DoseDirection::Over);
        assert!((over.recommended_per_day - 300.0).abs() < f64::EPSILON);
        assert!((over.prescribed_per_day - 500.0).abs() < f64::EPSILON);
        // 50 mg OD = 50 → well under 300.
        let under = evaluate_weight_dose("50 mg", 1, 20.0, "15 mg").expect("under");
        assert_eq!(under.direction, DoseDirection::Under);
    }

    #[test]
    fn weight_dose_missing_inputs_silent() {
        assert!(evaluate_weight_dose("100 mg", 3, 0.0, "15 mg").is_none());
        assert!(evaluate_weight_dose("100 mg", 3, 20.0, "").is_none());
        assert!(evaluate_weight_dose("5 ml", 3, 20.0, "15 mg").is_none());
    }
}
