//! Medication dose-safety — derive a daily dose from a per-dose amount and a
//! frequency, and compare it against the catalogue's `max_dose_per_day`.
//!
//! Pure and dependency-free so it can be unit-tested and reused on both the CDS
//! advisory path (`cds::check_drug_safety`) and the prescribe-time backstop
//! (`medbrains-opd::create_prescription`). Amounts are normalised before they
//! are compared — mcg / mg / g to one mass unit, mL / L to one volume unit —
//! so "1 g" four times a day is caught against a 3000 mg maximum. A line that
//! cannot be compared (unreadable amount, mass against volume, a frequency we
//! do not know) is reported as **not checked**, never as within the limit: an
//! unknown is not a pass (ENGINEERING.md, "a fault is not a refusal").

use crate::mar_schedule;

/// A confirmed daily-dose overage for one prescription line.
#[derive(Debug, Clone, PartialEq)]
pub struct DoseExceedance {
    /// Prescribed total for the day, in the maximum's unit.
    pub total_per_day: f64,
    /// The unit the catalogue maximum is written in (e.g. "mg").
    pub unit: String,
    /// Catalogue maximum daily dose, in `unit`.
    pub max_per_day: f64,
    /// `total_per_day / max_per_day` (> 1.0 when exceeded).
    pub ratio: f64,
    /// Doses per day the total was derived from (1 for an as-needed line).
    pub doses_per_day: u32,
}

/// Why a line's daily dose could not be compared with the catalogue maximum.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DoseNotChecked {
    /// The per-dose amount has no readable number and unit.
    UnreadableDose,
    /// The catalogue maximum has no readable number and unit.
    UnreadableMaximum,
    /// The dose and the maximum measure different things (e.g. mL against mg).
    UnitsDiffer { dose_unit: String, max_unit: String },
    /// The frequency is not one we can turn into doses per day.
    UnknownFrequency,
    /// As needed: one dose is within the daily maximum, but the day's total
    /// depends on how often it is given. `max_doses` doses keep within it.
    AsNeeded { max_doses: u32 },
}

impl DoseNotChecked {
    /// The sentence the prescriber sees for this line, saying what to fix.
    #[must_use]
    pub fn reason(&self) -> String {
        match self {
            Self::UnreadableDose => {
                "Dose could not be read; write it as an amount and unit, e.g. 500 mg".to_owned()
            }
            Self::UnreadableMaximum => "The catalogue maximum could not be read".to_owned(),
            Self::UnitsDiffer {
                dose_unit,
                max_unit,
            } => format!("Dose is in {dose_unit}, the catalogue maximum is in {max_unit}"),
            Self::UnknownFrequency => {
                "Frequency not recognised, so the daily total is unknown".to_owned()
            }
            Self::AsNeeded { max_doses } => {
                format!("As needed: up to {max_doses} doses a day stay within the maximum")
            }
        }
    }
}

/// The three outcomes of a max-dose check. `NotChecked` is never "safe".
#[derive(Debug, Clone, PartialEq)]
pub enum MaxDoseOutcome {
    /// The daily total is at or under the catalogue maximum.
    Within,
    /// The daily total is over the catalogue maximum.
    Exceeded(DoseExceedance),
    /// The line could not be compared; the prescriber must see that.
    NotChecked(DoseNotChecked),
}

/// What an amount measures, so only like is compared with like.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Dimension {
    /// Normalised to micrograms.
    Mass,
    /// Normalised to millilitres.
    Volume,
    /// Anything else (tab, puff, IU) — compared only with the same word.
    Count(String),
}

/// A parsed amount: its value in the base unit of its dimension, plus how
/// to turn it back into the unit it was written in.
#[derive(Debug, Clone, PartialEq)]
struct Quantity {
    base: f64,
    dimension: Dimension,
    unit: String,
    factor: f64,
}

/// Words that may follow the unit of a per-dose amount without changing it.
const FORM_WORDS: &[&str] = &[
    "tab",
    "tabs",
    "tablet",
    "tablets",
    "cap",
    "caps",
    "capsule",
    "capsules",
    "inj",
    "injection",
    "syrup",
    "susp",
    "suspension",
    "sachet",
    "oral",
    "po",
    "iv",
    "im",
    "sc",
];
/// Words that may follow the unit of a daily maximum ("3 g per day", "4 g/24h").
const DAILY_WORDS: &[&str] = &[
    "day", "daily", "per", "a", "in", "24", "24h", "24hr", "24hrs", "h", "hr", "hrs", "hour",
    "hours", "d",
];

/// The base-unit factor for a unit word: micrograms for mass, millilitres for
/// volume; `None` means a counted unit compared by name only.
fn unit_factor(unit: &str) -> Option<(Dimension, f64)> {
    let mass = |f| Some((Dimension::Mass, f));
    let volume = |f| Some((Dimension::Volume, f));
    match unit {
        "mcg" | "µg" | "μg" | "ug" | "microgram" | "micrograms" => mass(1.0),
        "mg" | "milligram" | "milligrams" => mass(1_000.0),
        "g" | "gm" | "gms" | "gram" | "grams" => mass(1_000_000.0),
        "ml" | "millilitre" | "millilitres" | "milliliter" | "milliliters" | "cc" => volume(1.0),
        "l" | "litre" | "litres" | "liter" | "liters" => volume(1_000.0),
        _ => None,
    }
}

/// The numeric prefix of `text`, with thousands separators ("1,000") removed.
/// A comma that is not a thousands separator ("1,5") is refused, not guessed.
fn leading_number(text: &str) -> Option<(f64, &str)> {
    let end = text
        .find(|c: char| !(c.is_ascii_digit() || c == '.' || c == ','))
        .unwrap_or(text.len());
    let (digits, rest) = text.split_at(end);
    let mut groups = digits.split(',');
    let first = groups.next().filter(|g| !g.is_empty())?;
    let mut plain = first.to_owned();
    for group in groups {
        if group.len() != 3 || !group.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        plain.push_str(group);
    }
    let value: f64 = plain.parse().ok()?;
    (value.is_finite() && value > 0.0).then_some((value, rest))
}

/// Parse "500 mg", "1,000 mg tab", "3 g/day" into a normalised quantity.
/// `daily` allows a per-day suffix (the catalogue maximum); any other
/// trailing word or denominator ("mg/kg", "mg/5ml") makes it unreadable.
fn parse_quantity(value: &str, daily: bool) -> Option<Quantity> {
    let lower = value.trim().to_lowercase();
    let (amount, rest) = leading_number(&lower)?;
    let (unit_part, per) = match rest.split_once('/') {
        Some((unit, per)) => (unit, Some(per.trim())),
        None => (rest, None),
    };
    let allowed = |word: &str| FORM_WORDS.contains(&word) || (daily && DAILY_WORDS.contains(&word));
    if per.is_some_and(|p| !(daily && p.split_whitespace().all(|w| DAILY_WORDS.contains(&w)))) {
        return None;
    }
    let mut words = unit_part.split_whitespace();
    let unit = words.next()?.to_owned();
    if !words.all(allowed) {
        return None;
    }
    let (dimension, factor) = unit_factor(&unit).unwrap_or_else(|| (Dimension::Count(unit.clone()), 1.0));
    Some(Quantity {
        base: amount * factor,
        dimension,
        unit,
        factor,
    })
}

/// Doses per day for a frequency: the eMAR codes ("TDS", "1-0-1", "Q6H")
/// plus the "N×/day" form the prescription writer sends for 5+ doses.
fn daily_doses(frequency: &str) -> Option<u32> {
    if let Some(doses) = mar_schedule::doses_per_day(frequency) {
        return Some(doses);
    }
    let compact: String = frequency
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_lowercase();
    let count = ["/day", "perday", "aday"]
        .iter()
        .find_map(|suffix| compact.strip_suffix(suffix))?
        .trim_end_matches(['x', '×']);
    count.parse().ok().filter(|n| (1..=24).contains(n))
}

/// Compare a per-dose amount at `frequency` with the catalogue maximum.
///
/// `max_per_day` is free text. As-needed and STAT lines are checked one dose
/// against the daily maximum. Anything that cannot be compared is `NotChecked`.
#[must_use]
pub fn evaluate_max_dose(per_dose: &str, frequency: &str, max_per_day: &str) -> MaxDoseOutcome {
    use MaxDoseOutcome::{Exceeded, NotChecked, Within};
    let Some(dose) = parse_quantity(per_dose, false) else {
        return NotChecked(DoseNotChecked::UnreadableDose);
    };
    let Some(max) = parse_quantity(max_per_day, true) else {
        return NotChecked(DoseNotChecked::UnreadableMaximum);
    };
    if dose.dimension != max.dimension {
        return NotChecked(DoseNotChecked::UnitsDiffer {
            dose_unit: dose.unit,
            max_unit: max.unit,
        });
    }
    let as_needed = mar_schedule::is_prn(frequency);
    let single = as_needed || mar_schedule::is_stat(frequency);
    let doses = if single {
        Some(1)
    } else {
        daily_doses(frequency)
    };
    let Some(doses) = doses else {
        return NotChecked(DoseNotChecked::UnknownFrequency);
    };
    let total = dose.base * f64::from(doses);
    if total > max.base {
        return Exceeded(exceedance(total, &max, doses));
    }
    if as_needed {
        // ponytail: f64 floor of a small positive ratio; saturates, never panics.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let max_doses = (max.base / dose.base).floor() as u32;
        return NotChecked(DoseNotChecked::AsNeeded { max_doses });
    }
    Within
}

/// The overage of a daily `total` (base units) over `max`, in `max`'s unit.
fn exceedance(total: f64, max: &Quantity, doses_per_day: u32) -> DoseExceedance {
    DoseExceedance {
        total_per_day: total / max.factor,
        unit: max.unit.clone(),
        max_per_day: max.base / max.factor,
        ratio: total / max.base,
        doses_per_day,
    }
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
    use super::{DoseDirection, evaluate_weight_dose, parse_amount};

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

#[cfg(test)]
mod max_dose_tests {
    use super::{DoseNotChecked, MaxDoseOutcome, evaluate_max_dose};

    /// The shape of an outcome, for table rows.
    #[derive(Debug, PartialEq)]
    enum Want {
        Within,
        Exceeded,
        NotChecked,
    }

    /// Reduce an outcome to its shape.
    fn shape(outcome: &MaxDoseOutcome) -> Want {
        match outcome {
            MaxDoseOutcome::Within => Want::Within,
            MaxDoseOutcome::Exceeded(_) => Want::Exceeded,
            MaxDoseOutcome::NotChecked(_) => Want::NotChecked,
        }
    }

    #[test]
    fn table() {
        let cases = [
            // The audit's nine realistic overdoses, four times a day.
            ("1000 mg", "QID", "3000 mg", Want::Exceeded),
            ("1 g", "QID", "3000 mg", Want::Exceeded),
            ("1 gm", "QID", "3 g", Want::Exceeded),
            ("1,000 mg", "QID", "3000 mg", Want::Exceeded),
            ("500 mcg", "QID", "1 mg", Want::Exceeded),
            ("500 µg", "QID", "0.5 mg", Want::Exceeded),
            ("1000 MG", "QID", "3000mg", Want::Exceeded),
            ("1000 mg tab", "QID", "3000 mg", Want::Exceeded),
            ("1000mg", "QID", "3 g/day", Want::Exceeded),
            // Within, across units, and exactly at the limit.
            ("500 mg", "TDS", "3 g", Want::Within),
            ("1 g", "TDS", "3000 mg per day", Want::Within),
            ("250 mcg", "1-0-1", "0.5 mg", Want::Within),
            ("5 ml", "QID", "0.02 L", Want::Within),
            ("2 tab", "BD", "8 tab", Want::Within),
            ("1 g", "5×/day", "4 g", Want::Exceeded),
            // As needed: one dose over the daily maximum is an overdose.
            ("4 g", "SOS", "3 g", Want::Exceeded),
            ("1 g", "PRN", "4 g", Want::NotChecked),
            ("1 g", "STAT", "4 g", Want::Within),
            // Cannot compare: say so, never pass silently.
            ("5 ml", "QID", "3000 mg", Want::NotChecked),
            ("1 g", "as directed", "3 g", Want::NotChecked),
            ("1,5 mg", "OD", "3 mg", Want::NotChecked),
            ("15 mg/kg", "TDS", "3 g", Want::NotChecked),
            ("2 x 500 mg", "TDS", "3 g", Want::NotChecked),
            ("1000 mg", "QID", "", Want::NotChecked),
            ("", "QID", "3000 mg", Want::NotChecked),
            ("1000", "QID", "3000 mg", Want::NotChecked),
        ];
        let wrong: Vec<_> = cases
            .iter()
            .filter(|(dose, freq, max, want)| shape(&evaluate_max_dose(dose, freq, max)) != *want)
            .collect();
        assert!(wrong.is_empty(), "wrong outcomes: {wrong:?}");
    }

    #[test]
    fn exceedance_is_reported_in_the_maximum_unit() {
        let outcome = evaluate_max_dose("1 g", "QID", "3000 mg");
        assert!(
            matches!(&outcome, MaxDoseOutcome::Exceeded(hit) if hit.unit == "mg"
                && (hit.total_per_day - 4000.0).abs() < 1e-9
                && (hit.max_per_day - 3000.0).abs() < 1e-9
                && hit.doses_per_day == 4),
            "{outcome:?}"
        );
    }

    #[test]
    fn as_needed_names_the_dose_ceiling() {
        let outcome = evaluate_max_dose("500 mg", "SOS", "3 g");
        assert_eq!(
            outcome,
            MaxDoseOutcome::NotChecked(DoseNotChecked::AsNeeded { max_doses: 6 })
        );
    }
}
