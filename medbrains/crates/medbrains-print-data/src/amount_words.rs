//! Money read out in words on receipts and bills: Indian numbering (lakh,
//! crore), exact to the paisa, read from a decimal and never from a float.
//! An amount that cannot be read fails the print; a receipt that says
//! "Rupees Zero" for money it could not read is worse than no receipt.

use medbrains_server_core::error::AppError;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, RoundingStrategy};

const ONES: [&str; 20] = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
];
const TENS: [&str; 10] = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

/// A number below a hundred in words; empty for zero.
fn below_hundred(n: u64) -> String {
    let word = |list: &[&'static str], i: u64| {
        usize::try_from(i)
            .ok()
            .and_then(|i| list.get(i).copied())
            .unwrap_or_default()
    };
    if n < 20 {
        return word(&ONES, n).to_owned();
    }
    match word(&ONES, n % 10) {
        "" => word(&TENS, n / 10).to_owned(),
        one => format!("{} {one}", word(&TENS, n / 10)),
    }
}

/// A whole number in words with Indian grouping: crore, lakh, thousand, hundred.
fn indian(n: u64) -> String {
    if n == 0 {
        return "Zero".to_owned();
    }
    let groups = [
        (n / 10_000_000, " Crore"),
        ((n % 10_000_000) / 100_000, " Lakh"),
        ((n % 100_000) / 1_000, " Thousand"),
        ((n % 1_000) / 100, " Hundred"),
        (n % 100, ""),
    ];
    groups
        .iter()
        .filter(|(count, _)| *count > 0)
        .map(|(count, unit)| format!("{}{unit}", below_hundred(*count)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Rupees from which the crore count reaches a hundred, which the grouping
/// below cannot say ("One Hundred Crore" would need a fourth word group).
const CRORE_100: u64 = 1_000_000_000;

/// "Rupees … and … Paise Only" for a money amount, rounded to the paisa first
/// so 0.289999… (a float's 0.29) reads as 29 paise, not 28.
///
/// # Errors
/// A negative amount (the old `f64 as u64` cast turned it into "Rupees Zero"),
/// or ₹100 crore or more, refused with a message saying so.
pub(crate) fn amount_in_words(amount: Decimal) -> Result<String, AppError> {
    let unreadable =
        || AppError::Internal(format!("the amount {amount} cannot be written in words"));
    if amount < Decimal::ZERO {
        return Err(unreadable());
    }
    let amount = amount.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
    let rupees = amount.trunc().to_u64().ok_or_else(unreadable)?;
    if rupees >= CRORE_100 {
        return Err(AppError::Conflict(format!(
            "₹{amount} is ₹100 crore or more, which a receipt cannot write in words. \
             Split the amount, or print it without the words."
        )));
    }
    let paise = (amount.fract() * Decimal::ONE_HUNDRED)
        .trunc()
        .to_u64()
        .ok_or_else(unreadable)?;
    Ok(match paise {
        0 => format!("Rupees {} Only", indian(rupees)),
        p => format!(
            "Rupees {} and {} Paise Only",
            indian(rupees),
            below_hundred(p)
        ),
    })
}

/// [`amount_in_words`] for an amount the database wrote as text (`numeric::text`).
///
/// # Errors
/// Text that is not a decimal (`NaN`, empty, garbled), or what `amount_in_words` refuses.
pub(crate) fn text_amount_in_words(amount: &str) -> Result<String, AppError> {
    let value: Decimal = amount.trim().parse().map_err(|_| {
        AppError::Internal(format!(
            "the amount {amount:?} could not be read, so nothing was printed"
        ))
    })?;
    amount_in_words(value)
}

/// [`amount_in_words`] for an amount fetched as `float8`.
///
/// # Errors
/// A value that is not a finite number, or what `amount_in_words` refuses.
pub(crate) fn float_amount_in_words(amount: f64) -> Result<String, AppError> {
    let value = Decimal::try_from(amount)
        .map_err(|_| AppError::Internal(format!("the amount {amount} could not be read")))?;
    amount_in_words(value)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{amount_in_words, float_amount_in_words, text_amount_in_words};
    use rust_decimal::Decimal;

    #[test]
    fn an_amount_that_cannot_be_read_fails_instead_of_printing_zero() {
        // numeric can hold NaN; the old parse().unwrap_or(0.0) printed "Rupees Zero Only".
        assert!(text_amount_in_words("NaN").is_err());
        assert!(text_amount_in_words("").is_err());
        assert!(text_amount_in_words("-500.00").is_err());
        assert!(float_amount_in_words(f64::NAN).is_err());
    }

    #[test]
    fn an_amount_is_read_out_exactly_to_the_paisa() {
        assert_eq!(
            text_amount_in_words("1234.56").ok().as_deref(),
            Some("Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only")
        );
        assert_eq!(
            text_amount_in_words("12500000.05").ok().as_deref(),
            Some("Rupees One Crore Twenty Five Lakh and Five Paise Only")
        );
        assert_eq!(
            amount_in_words(Decimal::ZERO).ok().as_deref(),
            Some("Rupees Zero Only")
        );
    }

    #[test]
    fn an_amount_is_rounded_to_the_paisa_before_it_is_cut() {
        // 0.29 as a float is 0.28999…; cut first, it printed 28 paise.
        assert_eq!(
            float_amount_in_words(0.29).ok().as_deref(),
            Some("Rupees Zero and Twenty Nine Paise Only")
        );
        assert_eq!(
            text_amount_in_words("10.999").ok().as_deref(),
            Some("Rupees Eleven Only")
        );
    }

    #[test]
    fn a_hundred_crore_or_more_is_refused_with_a_message() {
        assert!(text_amount_in_words("999999999.99").is_ok());
        let refused = text_amount_in_words("1000000000.00");
        assert!(
            matches!(&refused, Err(medbrains_server_core::error::AppError::Conflict(m)) if m.contains("100 crore")),
            "{refused:?}"
        );
    }
}
