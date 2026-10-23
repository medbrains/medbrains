//! The payout rule engine: pure arithmetic over rate cards, agreements and a
//! bill's state. No database here, so every rule is unit-tested in isolation.

use std::collections::HashMap;

use chrono::{Datelike, NaiveDate};
use rust_decimal::{Decimal, RoundingStrategy};
use uuid::Uuid;

/// When a doctor's share becomes earned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Basis {
    /// When the bill is issued.
    Billed,
    /// As the patient pays, pro rata for part payments.
    Collected,
    /// When the insurer settles, cut down by what it disallowed.
    Realised,
}

impl Basis {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "billed" => Some(Self::Billed),
            "collected" => Some(Self::Collected),
            "realised" => Some(Self::Realised),
            _ => None,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Billed => "billed",
            Self::Collected => "collected",
            Self::Realised => "realised",
        }
    }
}

/// Who absorbs a reduction (a discount, an insurer deduction).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Bearer {
    Hospital,
    Doctor,
    ProRata,
}

impl Bearer {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "hospital" => Some(Self::Hospital),
            "doctor" => Some(Self::Doctor),
            "pro_rata" => Some(Self::ProRata),
            _ => None,
        }
    }
}

/// What a free or fully-discounted (charity) line pays the doctor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Charity {
    Zero,
    /// As if the line had been charged in full.
    Full,
    Fixed(Decimal),
}

/// The agreement terms the engine needs.
#[derive(Debug, Clone, Copy)]
pub struct Terms {
    pub basis: Basis,
    pub share_on_net: bool,
    pub discount_bearer: Bearer,
    pub disallowance_bearer: Bearer,
    pub charity: Charity,
}

/// One rate-card line. `None` matchers match anything.
#[derive(Debug, Clone)]
pub struct Rule {
    pub id: Uuid,
    pub charge_code: Option<String>,
    pub category: Option<String>,
    pub department_id: Option<Uuid>,
    pub payer_class: Option<String>,
    pub visit_kind: Option<String>,
    pub role: String,
    pub is_fixed: bool,
    pub percentage: Option<Decimal>,
    pub fixed_amount: Option<Decimal>,
    pub cap_min: Option<Decimal>,
    pub cap_max: Option<Decimal>,
}

/// One bill line seen from one doctor in one role.
#[derive(Debug, Clone, Copy)]
pub struct Line<'a> {
    pub charge_code: &'a str,
    pub category: &'a str,
    pub department_id: Option<Uuid>,
    pub payer_class: &'a str,
    pub visit_kind: Option<&'a str>,
    pub role: &'a str,
    pub quantity: i32,
    /// Before tax, after any cancelled quantity.
    pub gross: Decimal,
    pub discount: Decimal,
}

/// A computed share and the base it was taken on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Share {
    pub base: Decimal,
    pub amount: Decimal,
}

pub fn money(d: Decimal) -> Decimal {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

fn opt_matches(want: Option<&str>, have: Option<&str>) -> Option<u32> {
    match (want, have) {
        (None, _) => Some(0),
        (Some(w), Some(h)) if w.eq_ignore_ascii_case(h) => Some(1),
        _ => None,
    }
}

/// How specifically `rule` matches `line`; `None` when it does not match.
/// A charge code outranks payer class, which outranks visit kind, then
/// department, then category.
fn specificity(rule: &Rule, line: &Line<'_>) -> Option<u32> {
    if !rule.role.eq_ignore_ascii_case(line.role) {
        return None;
    }
    let code = opt_matches(rule.charge_code.as_deref(), Some(line.charge_code))?;
    let payer = opt_matches(rule.payer_class.as_deref(), Some(line.payer_class))?;
    let visit = opt_matches(rule.visit_kind.as_deref(), line.visit_kind)?;
    let cat = opt_matches(rule.category.as_deref(), Some(line.category))?;
    let dept = match (rule.department_id, line.department_id) {
        (None, _) => 0,
        (Some(w), Some(h)) if w == h => 1,
        _ => return None,
    };
    Some(code * 16 + payer * 8 + visit * 4 + dept * 2 + cat)
}

/// The most specific matching rule; the earliest wins a tie.
pub fn pick_rule<'r>(rules: &'r [Rule], line: &Line<'_>) -> Option<&'r Rule> {
    rules
        .iter()
        .filter_map(|r| specificity(r, line).map(|s| (s, r)))
        .fold(None::<(u32, &'r Rule)>, |best, (s, r)| match best {
            Some((bs, _)) if bs >= s => best,
            _ => Some((s, r)),
        })
        .map(|(_, r)| r)
}

/// The doctor's share of one line under one rule.
pub fn compute_share(rule: &Rule, line: &Line<'_>, terms: &Terms) -> Share {
    let gross = line.gross.max(Decimal::ZERO);
    let mut discount = line.discount.clamp(Decimal::ZERO, gross);
    if gross == Decimal::ZERO || discount == gross {
        match terms.charity {
            Charity::Zero => {
                return Share {
                    base: Decimal::ZERO,
                    amount: Decimal::ZERO,
                };
            }
            Charity::Fixed(a) => {
                return Share {
                    base: Decimal::ZERO,
                    amount: money(a),
                };
            }
            Charity::Full => discount = Decimal::ZERO,
        }
    }
    let net = gross - discount;
    let (base, raw) = if rule.is_fixed {
        let full = rule.fixed_amount.unwrap_or_default() * Decimal::from(line.quantity.max(1));
        let amount = match terms.discount_bearer {
            Bearer::Hospital => full,
            Bearer::ProRata if gross > Decimal::ZERO => full * net / gross,
            Bearer::ProRata => Decimal::ZERO,
            Bearer::Doctor => (full - discount).max(Decimal::ZERO),
        };
        (gross, amount)
    } else {
        let base = if terms.share_on_net { net } else { gross };
        (
            base,
            base * rule.percentage.unwrap_or_default() / Decimal::ONE_HUNDRED,
        )
    };
    let floored = rule.cap_min.map_or(raw, |m| raw.max(m));
    let capped = rule.cap_max.map_or(floored, |m| floored.min(m));
    Share {
        base: money(base),
        amount: money(capped),
    }
}

/// What the bill looks like now, for the earning basis.
#[derive(Debug, Clone, Copy)]
pub struct BillState<'a> {
    pub status: &'a str,
    pub total: Decimal,
    pub paid: Decimal,
    /// The insurer claim, if the bill has one: (claimed, settled when settled).
    pub claim: Option<(Decimal, Option<Decimal>)>,
}

fn ratio(part: Decimal, whole: Decimal) -> Decimal {
    if whole <= Decimal::ZERO {
        return Decimal::ZERO;
    }
    (part / whole).clamp(Decimal::ZERO, Decimal::ONE)
}

fn collected_fraction(bill: &BillState<'_>) -> Decimal {
    if bill.total <= Decimal::ZERO {
        return if bill.status == "draft" {
            Decimal::ZERO
        } else {
            Decimal::ONE
        };
    }
    ratio(bill.paid, bill.total)
}

/// How much of a full `share` is earned now: the target the ledger must sum
/// to for this line, doctor and role. `line_net` is the line's value after
/// discount, used to apportion an insurer deduction the doctor bears.
pub fn earned_now(
    share: Decimal,
    line_net: Decimal,
    bill: &BillState<'_>,
    terms: &Terms,
) -> Decimal {
    if matches!(bill.status, "cancelled" | "refunded") {
        return Decimal::ZERO;
    }
    let target = match terms.basis {
        Basis::Billed if bill.status == "draft" => Decimal::ZERO,
        Basis::Billed => share,
        Basis::Collected => share * collected_fraction(bill),
        Basis::Realised => match bill.claim {
            None => share * collected_fraction(bill),
            Some((_, None)) => Decimal::ZERO,
            Some((claimed, Some(settled))) => match terms.disallowance_bearer {
                Bearer::Hospital => share,
                Bearer::ProRata => share * ratio(settled, claimed),
                Bearer::Doctor => {
                    let disallowed = (claimed - settled).max(Decimal::ZERO);
                    let mine = disallowed * ratio(line_net, bill.total);
                    (share - mine).max(Decimal::ZERO)
                }
            },
        },
    };
    money(target)
}

/// The top-up a sessional doctor is owed for a day that earned less than the
/// guaranteed minimum.
pub fn session_topup(minimum: Decimal, earned: Decimal) -> Decimal {
    money((minimum - earned).max(Decimal::ZERO))
}

/// TDS for one payment, tracked per PAN per financial year.
#[derive(Debug, Clone, Copy)]
pub struct TdsInput {
    pub amount: Decimal,
    /// Gross of this payee's earlier payments this financial year.
    pub paid_before: Decimal,
    /// Of that, the part TDS was already deducted on.
    pub taxed_before: Decimal,
    pub has_pan: bool,
    pub rate: Decimal,
    pub no_pan_rate: Decimal,
    pub threshold: Decimal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tds {
    pub base: Decimal,
    pub rate: Decimal,
    pub amount: Decimal,
}

/// Nothing is deducted while the year's aggregate stays within the threshold.
///
/// Once it crosses, TDS is deducted on the whole aggregate not yet taxed —
/// including the earlier payments that were under it — capped at this payment.
pub fn compute_tds(i: &TdsInput) -> Tds {
    let rate = if i.has_pan { i.rate } else { i.no_pan_rate };
    let aggregate = i.paid_before + i.amount;
    if aggregate <= i.threshold || i.amount <= Decimal::ZERO {
        return Tds {
            base: Decimal::ZERO,
            rate,
            amount: Decimal::ZERO,
        };
    }
    let base = (aggregate - i.taxed_before).max(Decimal::ZERO);
    let amount = money(base * rate / Decimal::ONE_HUNDRED).min(i.amount);
    Tds {
        base: money(base),
        rate,
        amount,
    }
}

/// The s.40A(3) warning for cash above the daily limit. It never blocks.
pub fn cash_warning(paid_today: Decimal, this: Decimal, limit: Decimal) -> Option<String> {
    let total = paid_today + this;
    (total > limit).then(|| {
        format!(
            "Cash to this doctor today comes to Rs {total}, above Rs {limit} a day. \
             Section 40A(3) disallows the expense for cash above that limit; \
             pay by bank or UPI where you can."
        )
    })
}

/// "2026-27" for any date from 1 Apr 2026 to 31 Mar 2027.
pub fn financial_year(d: NaiveDate) -> String {
    let start = if d.month() >= 4 {
        d.year()
    } else {
        d.year() - 1
    };
    format!("{start}-{:02}", (start + 1) % 100)
}

/// Indian TDS quarter: Apr-Jun is Q1.
pub fn tds_quarter(d: NaiveDate) -> &'static str {
    match d.month() {
        4..=6 => "Q1",
        7..=9 => "Q2",
        10..=12 => "Q3",
        _ => "Q4",
    }
}

/// A package split must not give away more than the whole: the percentages
/// of rules that match the same lines in different roles sum to at most 100.
pub fn split_overflow(rules: &[Rule]) -> Option<Decimal> {
    let mut sums: HashMap<String, Decimal> = HashMap::new();
    for r in rules.iter().filter(|r| !r.is_fixed) {
        let key = format!(
            "{:?}|{:?}|{:?}|{:?}|{:?}",
            r.charge_code, r.category, r.payer_class, r.visit_kind, r.department_id
        );
        *sums.entry(key).or_default() += r.percentage.unwrap_or_default();
    }
    sums.into_values().find(|s| *s > Decimal::ONE_HUNDRED)
}

#[cfg(test)]
#[path = "engine_tests.rs"]
mod tests;
