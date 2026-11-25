//! Paediatric weight-based dosing: compare a prescribed dose with the
//! catalogue's dose per kilogram for the child's weight.
//!
//! Amounts are normalised before they are compared (mcg / mg / g, mL / L,
//! through `dose_safety`'s parser), so "250 mcg" against "0.01 mg/kg" is
//! checked, not skipped. The per-kg rule may be per day ("15 mg/kg/day", or
//! the legacy bare "15 mg") or per dose ("10 mg/kg/dose"). Every line ends in
//! one of three outcomes: within ±25% of the recommendation, over or under
//! it, or **not checked** with the reason — never silently "fine".

use crate::dose_safety::{Quantity, daily_doses, parse_quantity};
use crate::mar_schedule;

/// Direction of a weight-based dose deviation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoseDirection {
    Over,
    Under,
}

/// Whether a per-kg rule is a total for the day or an amount per dose.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoseBasis {
    PerDay,
    PerDose,
}

impl DoseBasis {
    /// "day" or "dose", for "250 mg/day" style labels.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::PerDay => "day",
            Self::PerDose => "dose",
        }
    }
}

/// A prescribed dose more than 25% over or under the weight-based one.
#[derive(Debug, Clone, PartialEq)]
pub struct WeightDoseAdvice {
    /// Prescribed amount per `basis`, in `unit`.
    pub prescribed: f64,
    /// Weight × dose per kg, per `basis`, in `unit`.
    pub recommended: f64,
    /// The unit the per-kg rule is written in (e.g. "mg").
    pub unit: String,
    pub basis: DoseBasis,
    pub direction: DoseDirection,
    /// `prescribed / recommended`.
    pub ratio: f64,
}

/// Why a line could not be checked against its per-kg rule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WeightNotChecked {
    /// The dose has no readable amount and unit.
    UnreadableDose,
    /// The per-kg rule is not "N unit", "N unit/kg", "N unit/kg/day" or "N unit/kg/dose".
    UnreadablePerKg,
    /// Dose and rule measure different things (e.g. mL against mg).
    UnitsDiffer {
        dose_unit: String,
        rule_unit: String,
    },
    /// A per-day rule with a frequency that gives no doses per day.
    UnknownFrequency,
}

impl WeightNotChecked {
    /// The sentence the prescriber sees, saying what to fix.
    #[must_use]
    pub fn reason(&self) -> String {
        match self {
            Self::UnreadableDose => "Dose could not be read as an amount and unit".to_owned(),
            Self::UnreadablePerKg => "The catalogue dose per kg could not be read".to_owned(),
            Self::UnitsDiffer {
                dose_unit,
                rule_unit,
            } => format!("Dose is in {dose_unit}, the dose per kg is in {rule_unit}"),
            Self::UnknownFrequency => {
                "Frequency not recognised, so the daily total is unknown".to_owned()
            }
        }
    }
}

/// The three outcomes of a weight-based check. `NotChecked` is never "safe".
#[derive(Debug, Clone, PartialEq)]
pub enum WeightDoseOutcome {
    Within,
    Advice(WeightDoseAdvice),
    NotChecked(WeightNotChecked),
}

/// Deviation beyond ±25% of the weight-based recommendation is advised.
const WEIGHT_DOSE_TOLERANCE: f64 = 0.25;

/// Split "15 mg/kg/day", "10 mcg/kg/dose" or the legacy "15 mg" (per day)
/// into the amount and its basis. Anything else is unreadable.
fn parse_per_kg(rule: &str) -> Option<(Quantity, DoseBasis)> {
    let lower = rule.trim().to_lowercase();
    let mut parts = lower.split('/').map(str::trim);
    let amount = parse_quantity(parts.next()?, false)?;
    let rest: Vec<&str> = parts.collect();
    let basis = match rest.as_slice() {
        [] | ["kg"] | ["kg", "day" | "d" | "24h"] => DoseBasis::PerDay,
        ["kg", "dose"] => DoseBasis::PerDose,
        _ => return None,
    };
    Some((amount, basis))
}

/// Compare `per_dose` at `frequency` with `weight_kg × dose_per_kg`.
///
/// A per-day rule needs doses per day: as-needed lines and unknown
/// frequencies are not checked. A per-dose rule compares one dose.
#[must_use]
pub fn evaluate_weight_dose(
    per_dose: &str,
    frequency: &str,
    weight_kg: f64,
    dose_per_kg: &str,
) -> WeightDoseOutcome {
    use WeightDoseOutcome::NotChecked;
    let Some(dose) = parse_quantity(per_dose, false) else {
        return NotChecked(WeightNotChecked::UnreadableDose);
    };
    let Some((rule, basis)) = parse_per_kg(dose_per_kg) else {
        return NotChecked(WeightNotChecked::UnreadablePerKg);
    };
    if dose.dimension != rule.dimension {
        return NotChecked(WeightNotChecked::UnitsDiffer {
            dose_unit: dose.unit,
            rule_unit: rule.unit,
        });
    }
    let doses = match basis {
        DoseBasis::PerDose => 1,
        DoseBasis::PerDay if mar_schedule::is_prn(frequency) => {
            return NotChecked(WeightNotChecked::UnknownFrequency);
        }
        DoseBasis::PerDay => match daily_doses(frequency) {
            Some(n) => n,
            None => return NotChecked(WeightNotChecked::UnknownFrequency),
        },
    };
    compare(
        dose.base * f64::from(doses),
        weight_kg * rule.base,
        &rule,
        basis,
    )
}

/// The outcome of a prescribed against a recommended amount (base units).
fn compare(
    prescribed: f64,
    recommended: f64,
    rule: &Quantity,
    basis: DoseBasis,
) -> WeightDoseOutcome {
    let ratio = prescribed / recommended;
    if (ratio - 1.0).abs() <= WEIGHT_DOSE_TOLERANCE {
        return WeightDoseOutcome::Within;
    }
    WeightDoseOutcome::Advice(WeightDoseAdvice {
        prescribed: prescribed / rule.factor,
        recommended: recommended / rule.factor,
        unit: rule.unit.clone(),
        basis,
        direction: if ratio > 1.0 {
            DoseDirection::Over
        } else {
            DoseDirection::Under
        },
        ratio,
    })
}

#[cfg(test)]
#[allow(clippy::panic)]
mod tests {
    use super::{
        DoseBasis, DoseDirection, WeightDoseOutcome, WeightNotChecked, evaluate_weight_dose,
    };

    /// Shape of an outcome for table rows.
    fn shape(o: &WeightDoseOutcome) -> &'static str {
        match o {
            WeightDoseOutcome::Within => "within",
            WeightDoseOutcome::Advice(a) if a.direction == DoseDirection::Over => "over",
            WeightDoseOutcome::Advice(_) => "under",
            WeightDoseOutcome::NotChecked(_) => "not_checked",
        }
    }

    #[test]
    fn table() {
        // (dose, frequency, weight kg, rule, expected)
        let cases = [
            // 20 kg × 15 mg/kg/day = 300 mg/day.
            ("100 mg", "TDS", 20.0, "15 mg", "within"),
            ("100 mg", "TDS", 20.0, "15 mg/kg/day", "within"),
            ("250 mg", "BD", 20.0, "15 mg/kg", "over"),
            ("50 mg", "OD", 20.0, "15 mg/kg/day", "under"),
            // Units normalised: 0.1 g TDS = 300 mg/day.
            ("0.1 g", "TDS", 20.0, "15 mg/kg/day", "within"),
            // Preterm 1.2 kg × 10 mcg/kg/dose = 12 mcg a dose; 0.012 mg is the same.
            ("12 mcg", "BD", 1.2, "10 mcg/kg/dose", "within"),
            ("0.012 mg", "BD", 1.2, "10 mcg/kg/dose", "within"),
            ("0.12 mg", "BD", 1.2, "10 mcg/kg/dose", "over"),
            // Per dose ignores the frequency.
            ("150 mg", "QID", 10.0, "15 mg/kg/dose", "within"),
            // Cannot compare: say so.
            ("5 ml", "TDS", 20.0, "15 mg/kg/day", "not_checked"),
            ("100 mg", "as directed", 20.0, "15 mg/kg/day", "not_checked"),
            ("100 mg", "SOS", 20.0, "15 mg/kg/day", "not_checked"),
            ("100 mg", "TDS", 20.0, "15 mg/m2", "not_checked"),
            ("100 mg", "TDS", 20.0, "", "not_checked"),
            ("", "TDS", 20.0, "15 mg/kg/day", "not_checked"),
        ];
        let wrong: Vec<_> = cases
            .iter()
            .filter(|(d, f, w, r, want)| shape(&evaluate_weight_dose(d, f, *w, r)) != *want)
            .collect();
        assert!(wrong.is_empty(), "wrong outcomes: {wrong:?}");
    }

    #[test]
    fn advice_is_in_the_rule_unit_and_basis() {
        let WeightDoseOutcome::Advice(a) = evaluate_weight_dose("0.5 g", "BD", 20.0, "15 mg/kg")
        else {
            panic!("expected advice");
        };
        assert_eq!((a.unit.as_str(), a.basis), ("mg", DoseBasis::PerDay));
        assert!((a.prescribed - 1000.0).abs() < 1e-9 && (a.recommended - 300.0).abs() < 1e-9);
    }

    #[test]
    fn mass_against_volume_names_both_units() {
        assert_eq!(
            evaluate_weight_dose("5 ml", "TDS", 20.0, "15 mg/kg/day"),
            WeightDoseOutcome::NotChecked(WeightNotChecked::UnitsDiffer {
                dose_unit: "ml".to_owned(),
                rule_unit: "mg".to_owned(),
            })
        );
    }
}
