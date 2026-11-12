//! What makes a manual journal entry acceptable before it touches the ledger.
//!
//! Debits equal to credits is necessary and not sufficient: an entry of two empty lines, or of
//! one line carrying −₹500 on both sides, balances and still means nothing (or hides a sign
//! error). Every line moves money one way, by a positive amount, and the entry moves some.

use rust_decimal::Decimal;

/// Why a set of journal lines was refused, in words the accountant can act on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JournalLineError {
    /// Fewer than two lines: one account cannot balance against itself.
    TooFewLines,
    /// Line `n` (1-based) has a negative debit or credit.
    Negative(usize),
    /// Line `n` has both a debit and a credit, or neither.
    NotOneSided(usize),
    /// Debits and credits differ.
    Unbalanced { debit: Decimal, credit: Decimal },
}

impl std::fmt::Display for JournalLineError {
    /// The refusal as the accountant reads it.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooFewLines => write!(f, "A journal entry needs at least two lines"),
            Self::Negative(n) => write!(f, "Line {n}: amounts cannot be negative"),
            Self::NotOneSided(n) => {
                write!(
                    f,
                    "Line {n}: enter either a debit or a credit, not both or neither"
                )
            }
            Self::Unbalanced { debit, credit } => {
                write!(f, "Debits ({debit}) must equal credits ({credit})")
            }
        }
    }
}

/// Check `lines` given as `(debit, credit)` pairs; the entry's total when they are acceptable.
pub fn check_journal_lines(lines: &[(Decimal, Decimal)]) -> Result<Decimal, JournalLineError> {
    if lines.len() < 2 {
        return Err(JournalLineError::TooFewLines);
    }
    let (mut debit, mut credit) = (Decimal::ZERO, Decimal::ZERO);
    for (i, &(dr, cr)) in lines.iter().enumerate() {
        let n = i + 1;
        if dr < Decimal::ZERO || cr < Decimal::ZERO {
            return Err(JournalLineError::Negative(n));
        }
        if (dr > Decimal::ZERO) == (cr > Decimal::ZERO) {
            return Err(JournalLineError::NotOneSided(n));
        }
        debit += dr;
        credit += cr;
    }
    if debit != credit {
        return Err(JournalLineError::Unbalanced { debit, credit });
    }
    Ok(debit)
}

#[cfg(test)]
mod tests {
    use super::{JournalLineError, check_journal_lines};
    use rust_decimal::Decimal;

    fn d(n: i64) -> Decimal {
        Decimal::from(n)
    }

    #[test]
    fn a_balanced_two_line_entry_is_accepted_with_its_total() {
        assert_eq!(
            check_journal_lines(&[(d(1000), d(0)), (d(0), d(1000))]),
            Ok(d(1000))
        );
        assert_eq!(
            check_journal_lines(&[(d(700), d(0)), (d(300), d(0)), (d(0), d(1000))]),
            Ok(d(1000))
        );
    }

    #[test]
    fn entries_that_balance_but_mean_nothing_are_refused() {
        assert_eq!(
            check_journal_lines(&[(d(0), d(0)), (d(0), d(0))]),
            Err(JournalLineError::NotOneSided(1))
        );
        assert_eq!(
            check_journal_lines(&[(d(-500), d(0)), (d(0), d(-500))]),
            Err(JournalLineError::Negative(1))
        );
        assert_eq!(
            check_journal_lines(&[(d(100), d(0)), (d(50), d(50)), (d(0), d(100))]),
            Err(JournalLineError::NotOneSided(2))
        );
        assert_eq!(
            check_journal_lines(&[(d(100), d(0))]),
            Err(JournalLineError::TooFewLines)
        );
        assert_eq!(check_journal_lines(&[]), Err(JournalLineError::TooFewLines));
    }

    #[test]
    fn an_unbalanced_entry_names_both_totals() {
        let err = check_journal_lines(&[(d(1000), d(0)), (d(0), d(900))]);
        assert_eq!(
            err,
            Err(JournalLineError::Unbalanced {
                debit: d(1000),
                credit: d(900)
            })
        );
        assert_eq!(
            err.map_err(|e| e.to_string()),
            Err("Debits (1000) must equal credits (900)".to_owned())
        );
    }
}
