//! The arithmetic of a day close, without the database: what the counted
//! notes add up to, and when a variance needs a reason.

use std::collections::BTreeMap;

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;

/// Rupee notes and coins a counter can hold. ₹2000 is still legal tender.
const DENOMINATIONS: &[&str] = &["2000", "500", "200", "100", "50", "20", "10", "5", "2", "1"];

/// More pieces of one denomination than a counter could hold in a day: a
/// typo (an amount typed into the count box), not a count.
const MAX_PIECES: i64 = 100_000;

/// A reason short enough to say nothing is refused.
pub const REASON_MIN_CHARS: usize = 5;

/// What the counted notes and coins add up to.
pub fn counted_total(counts: &BTreeMap<String, i64>) -> Result<Decimal, AppError> {
    let mut total = Decimal::ZERO;
    for (denomination, &pieces) in counts {
        if !DENOMINATIONS.contains(&denomination.as_str()) {
            return Err(AppError::BadRequest(format!(
                "₹{denomination} is not a note or coin the counter takes"
            )));
        }
        if !(0..=MAX_PIECES).contains(&pieces) {
            return Err(AppError::BadRequest(format!(
                "Count of ₹{denomination} must be between 0 and {MAX_PIECES}"
            )));
        }
        let face: Decimal = denomination
            .parse()
            .map_err(|_| AppError::BadRequest(format!("₹{denomination} is not a number")))?;
        total += face * Decimal::from(pieces);
    }
    Ok(total)
}

/// Any difference between counted and expected cash is explained.
pub fn variance_reason(variance: Decimal, reason: Option<&str>) -> Result<Option<String>, AppError> {
    let reason = reason
        .map(str::trim)
        .filter(|r| r.chars().count() >= REASON_MIN_CHARS);
    if variance != Decimal::ZERO && reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "The count is {variance} against what the drawers should hold: say why"
        )));
    }
    Ok(reason.map(str::to_owned))
}

/// Cash kept back as tomorrow's float comes out of what was counted.
pub fn check_float(float: Decimal, counted: Decimal) -> Result<(), AppError> {
    if float < Decimal::ZERO || float > counted {
        return Err(AppError::BadRequest(format!(
            "The float carried forward must be between 0 and the {counted} counted"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn counts(pairs: &[(&str, i64)]) -> BTreeMap<String, i64> {
        pairs.iter().map(|(d, n)| ((*d).to_owned(), *n)).collect()
    }

    #[test]
    fn notes_and_coins_add_up() {
        let total = counted_total(&counts(&[("500", 3), ("100", 7), ("10", 4), ("1", 2)]));
        assert_eq!(total.ok(), Some(Decimal::from(2242)));
    }

    #[test]
    fn an_unknown_denomination_or_absurd_count_is_refused() {
        assert!(counted_total(&counts(&[("300", 1)])).is_err());
        assert!(counted_total(&counts(&[("100", -1)])).is_err());
        assert!(counted_total(&counts(&[("100", MAX_PIECES + 1)])).is_err());
    }

    #[test]
    fn a_variance_needs_a_reason_and_an_exact_count_does_not() {
        assert!(variance_reason(Decimal::from(-20), None).is_err());
        assert!(variance_reason(Decimal::from(-20), Some(" ok ")).is_err());
        assert_eq!(
            variance_reason(Decimal::from(-20), Some("Change given twice")).ok(),
            Some(Some("Change given twice".to_owned()))
        );
        assert_eq!(variance_reason(Decimal::ZERO, None).ok(), Some(None));
    }

    #[test]
    fn the_float_comes_out_of_what_was_counted() {
        assert!(check_float(Decimal::from(500), Decimal::from(2000)).is_ok());
        assert!(check_float(Decimal::from(2500), Decimal::from(2000)).is_err());
        assert!(check_float(Decimal::from(-1), Decimal::from(2000)).is_err());
    }
}
