//! The one rounding rule for money.
//!
//! Every rupee amount is rounded to the paisa half away from zero (2.345 →
//! 2.35, −2.345 → −2.35), the conventional commercial rule and the direction
//! CGST Act s.170 uses when it rounds tax to the rupee (fifty paise or more
//! goes up). Line-level paise rounding is not prescribed by the Act or the
//! CGST Rules; see `docs/decisions/2026-11-25-money-rounding-rule.md`.
//! `scripts/check_money_rounding.py` refuses a `round_dp` anywhere else.

use rust_decimal::{Decimal, RoundingStrategy};

/// Rounding a money amount, written after the value (`total.to_paisa()`).
///
/// ponytail: a trait only so call sites read like the `round_dp(2)` they replace.
pub trait RoundMoney {
    /// Round to the paisa, half away from zero: the only place money is
    /// rounded, so a bill, its receipt, its credit note and its ledger row
    /// agree to the paisa.
    #[must_use]
    fn to_paisa(self) -> Self;
}

impl RoundMoney for Decimal {
    fn to_paisa(self) -> Self {
        to_paisa(self)
    }
}

/// [`RoundMoney::to_paisa`] as a plain function, for `map(money::to_paisa)`
/// and call sites with no room for an import.
#[must_use]
pub fn to_paisa(value: Decimal) -> Decimal {
    value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

#[cfg(test)]
mod tests {
    use super::RoundMoney;
    use rust_decimal::Decimal;

    fn to_paisa(d: Decimal) -> Decimal {
        d.to_paisa()
    }

    #[test]
    fn rounds_half_away_from_zero_not_to_even() {
        // Banker's rounding gives 2.34 and 2.36 here; the rule gives 2.35 and 2.37.
        assert_eq!(to_paisa(Decimal::new(2345, 3)), Decimal::new(235, 2));
        assert_eq!(to_paisa(Decimal::new(2365, 3)), Decimal::new(237, 2));
        assert_eq!(to_paisa(Decimal::new(-2345, 3)), Decimal::new(-235, 2));
        assert_eq!(to_paisa(Decimal::new(2344, 3)), Decimal::new(234, 2));
    }
}
