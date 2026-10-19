//! The rules of a counter return, without the database: how long a sale stays
//! returnable, which medicines never come back, what each returned unit is
//! worth, and which tenders the money goes back to.

use chrono::{Days, NaiveDate};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::pos_counter::TenderMode;

/// A sale is returnable for this many days unless the hospital says otherwise
/// (`pharmacy.return_window_days`).
pub(crate) const DEFAULT_RETURN_WINDOW_DAYS: i32 = 15;

/// Categories the counter never takes back unless the hospital removes them
/// from `pharmacy.non_returnable`.
pub(crate) const DEFAULT_NON_RETURNABLE: &[&str] = &["cold_chain", "controlled"];

/// Where the return window stands for one sale, in the hospital's own dates.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct ReturnWindow {
    pub sale_date: NaiveDate,
    pub today: NaiveDate,
    pub window_days: i32,
    /// The first day the sale can no longer be returned.
    pub locks_on: NaiveDate,
    pub locked: bool,
}

/// The sale day is day 0; the last returnable day is day `window_days`.
pub(crate) fn return_window(
    sale_date: NaiveDate,
    today: NaiveDate,
    window_days: i32,
) -> ReturnWindow {
    let days = u64::try_from(window_days.max(0)).unwrap_or(0) + 1;
    let locks_on = sale_date
        .checked_add_days(Days::new(days))
        .unwrap_or(NaiveDate::MAX);
    ReturnWindow {
        sale_date,
        today,
        window_days,
        locks_on,
        locked: today >= locks_on,
    }
}

/// Why a line cannot come back at the counter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "snake_case")]
pub enum LineBlock {
    /// Never taken back.
    Refused(String),
    /// Taken back only by the pharmacist-in-charge, with a reason.
    NeedsControlledRight(String),
}

pub(crate) fn line_block(
    drug_name: &str,
    cold_chain: bool,
    controlled: bool,
    non_returnable: &[String],
) -> Option<LineBlock> {
    let listed = |category: &str| non_returnable.iter().any(|c| c == category);
    if cold_chain && listed("cold_chain") {
        return Some(LineBlock::Refused(format!(
            "{drug_name} needs cold storage; once it has left the pharmacy its storage cannot be vouched for"
        )));
    }
    if controlled && listed("controlled") {
        return Some(LineBlock::NeedsControlledRight(format!(
            "{drug_name} is a controlled drug; only the pharmacist-in-charge may take it back"
        )));
    }
    None
}

/// What returning `qty` more units of a line refunds, and the GST in it.
///
/// Worked as the difference between "returned so far + qty" and "returned so
/// far", each rounded, so the refunds of a line always add up to exactly what
/// the line was paid — never a paisa more or less.
pub(crate) fn line_refund(
    line_total: Decimal,
    line_gst: Decimal,
    quantity: i32,
    already_returned: i32,
    qty: i32,
) -> (Decimal, Decimal) {
    if quantity <= 0 {
        return (Decimal::ZERO, Decimal::ZERO);
    }
    let sold = Decimal::from(quantity);
    let share = |amount: Decimal, units: i32| (amount * Decimal::from(units) / sold).round_dp(2);
    let after = already_returned + qty;
    (
        share(line_total, after) - share(line_total, already_returned),
        share(line_gst, after) - share(line_gst, already_returned),
    )
}

/// What a sale took by one tender, and what of it has gone back already.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TenderBalance {
    pub mode: String,
    pub paid: Decimal,
    pub refunded: Decimal,
}

impl TenderBalance {
    pub(crate) fn refundable(&self) -> Decimal {
        (self.paid - self.refunded).max(Decimal::ZERO)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RefundPart {
    pub mode: String,
    pub amount: Decimal,
    pub reference: Option<String>,
}

/// Back to the tenders the sale was paid with, in proportion to what each
/// still holds; the paisa left by rounding goes to the largest.
pub(crate) fn allocate_refund(
    total: Decimal,
    tenders: &[TenderBalance],
) -> Result<Vec<RefundPart>, AppError> {
    let pool: Decimal = tenders.iter().map(TenderBalance::refundable).sum();
    if total > pool {
        return Err(AppError::Conflict(format!(
            "Only {pool} of this sale is left to refund"
        )));
    }
    if total <= Decimal::ZERO {
        return Ok(Vec::new());
    }
    let mut parts: Vec<RefundPart> = tenders
        .iter()
        .filter(|t| t.refundable() > Decimal::ZERO)
        .map(|t| RefundPart {
            mode: t.mode.clone(),
            amount: (total * t.refundable() / pool)
                .round_dp(2)
                .min(t.refundable()),
            reference: None,
        })
        .collect();
    let allocated: Decimal = parts.iter().map(|p| p.amount).sum();
    let gap = total - allocated;
    if gap != Decimal::ZERO {
        let room = |p: &RefundPart| {
            tenders
                .iter()
                .find(|t| t.mode == p.mode)
                .map_or(Decimal::ZERO, |t| t.refundable() - p.amount)
        };
        let target = parts
            .iter_mut()
            .filter(|p| gap < Decimal::ZERO || room(p) >= gap)
            .max_by(|a, b| a.amount.cmp(&b.amount));
        if let Some(part) = target {
            part.amount += gap;
        }
    }
    parts.retain(|p| p.amount > Decimal::ZERO);
    Ok(parts)
}

/// A refund the cashier chose: each tender only up to what it still holds,
/// adding up to the refund, card and UPI with the refund's reference.
pub(crate) fn validate_chosen_refund(
    total: Decimal,
    tenders: &[TenderBalance],
    chosen: &[RefundPart],
) -> Result<(), AppError> {
    let mut sum = Decimal::ZERO;
    for part in chosen {
        let mode = TenderMode::parse(&part.mode)?;
        let Some(tender) = tenders.iter().find(|t| t.mode == part.mode) else {
            return Err(AppError::BadRequest(format!(
                "This sale was not paid by {}; refund to how it was paid",
                part.mode
            )));
        };
        if part.amount <= Decimal::ZERO || part.amount > tender.refundable() {
            return Err(AppError::BadRequest(format!(
                "At most {} can go back by {}",
                tender.refundable(),
                part.mode
            )));
        }
        if matches!(mode, TenderMode::Card | TenderMode::Upi)
            && part
                .reference
                .as_deref()
                .is_none_or(|r| r.trim().is_empty())
        {
            return Err(AppError::BadRequest(format!(
                "A {} refund needs its reference",
                part.mode
            )));
        }
        sum += part.amount;
    }
    if sum != total {
        return Err(AppError::BadRequest(format!(
            "The refund parts add up to {sum}; the return is worth {total}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or(NaiveDate::MIN)
    }

    fn tender(mode: &str, paid: i64, refunded: i64) -> TenderBalance {
        TenderBalance {
            mode: mode.to_owned(),
            paid: Decimal::from(paid),
            refunded: Decimal::from(refunded),
        }
    }

    #[test]
    fn day_fifteen_is_returnable_and_day_sixteen_is_not() {
        let w15 = return_window(day("2026-10-01"), day("2026-10-16"), 15);
        assert!(!w15.locked);
        let w16 = return_window(day("2026-10-01"), day("2026-10-17"), 15);
        assert!(w16.locked);
        assert_eq!(w16.locks_on, day("2026-10-17"));
    }

    #[test]
    fn cold_chain_is_refused_and_controlled_needs_the_right() {
        let list: Vec<String> = DEFAULT_NON_RETURNABLE
            .iter()
            .map(|s| (*s).to_owned())
            .collect();
        assert!(matches!(
            line_block("Insulin", true, false, &list),
            Some(LineBlock::Refused(_))
        ));
        assert!(matches!(
            line_block("Morphine", false, true, &list),
            Some(LineBlock::NeedsControlledRight(_))
        ));
        assert_eq!(line_block("Paracetamol", false, false, &list), None);
        assert_eq!(line_block("Insulin", true, false, &[]), None);
    }

    #[test]
    fn a_line_refunds_exactly_what_it_was_paid_across_returns() {
        let total = Decimal::new(1000, 2);
        let (a, _) = line_refund(total, Decimal::ZERO, 3, 0, 1);
        let (b, _) = line_refund(total, Decimal::ZERO, 3, 1, 1);
        let (c, _) = line_refund(total, Decimal::ZERO, 3, 2, 1);
        assert_eq!(a + b + c, total);
    }

    #[test]
    fn refunds_split_in_proportion_and_never_exceed_a_tender() -> Result<(), AppError> {
        let parts = allocate_refund(
            Decimal::from(40),
            &[tender("credit", 70, 0), tender("upi", 30, 0)],
        )?;
        assert_eq!(
            parts.iter().map(|p| p.amount).sum::<Decimal>(),
            Decimal::from(40)
        );
        assert_eq!(
            parts.iter().find(|p| p.mode == "credit").map(|p| p.amount),
            Some(Decimal::from(28))
        );
        assert!(allocate_refund(Decimal::from(101), &[tender("cash", 100, 0)]).is_err());
        Ok(())
    }

    #[test]
    fn a_chosen_refund_must_fit_the_tenders_it_names() {
        let tenders = [tender("card", 60, 0), tender("cash", 40, 0)];
        let part = |mode: &str, amount: i64, reference: Option<&str>| RefundPart {
            mode: mode.to_owned(),
            amount: Decimal::from(amount),
            reference: reference.map(str::to_owned),
        };
        assert!(
            validate_chosen_refund(Decimal::from(50), &tenders, &[part("cash", 50, None)]).is_err()
        );
        assert!(
            validate_chosen_refund(Decimal::from(50), &tenders, &[part("card", 50, None)]).is_err()
        );
        assert!(
            validate_chosen_refund(Decimal::from(50), &tenders, &[part("upi", 50, Some("R"))])
                .is_err()
        );
        assert!(
            validate_chosen_refund(
                Decimal::from(50),
                &tenders,
                &[part("card", 30, Some("RRN1")), part("cash", 20, None)]
            )
            .is_ok()
        );
    }
}
