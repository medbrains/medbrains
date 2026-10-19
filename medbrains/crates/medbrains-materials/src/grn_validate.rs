//! Deterministic checks on a goods receipt, shared by manual entry, scan
//! review and posting (#4861). Each finding blocks or warns; nothing is
//! silently passed. Blocks stop the GRN; warnings travel with it to the
//! screen.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::Serialize;

/// Hospital setting (category `operations`): days of shelf life a received
/// batch must still have. Default 180 (research brief §12.6(b),
/// `grn.min_shelf_life_days`; a contract norm, not a statute — inferred).
pub const MIN_SHELF_LIFE_DAYS_KEY: &str = "grn_min_shelf_life_days";
pub const MIN_SHELF_LIFE_DAYS_DEFAULT: i32 = 180;
/// Hospital setting: rupees the bill total may differ from the lines by
/// (round-off). Default ₹1 (brief §12.4).
pub const TOTAL_TOLERANCE_KEY: &str = "grn_invoice_tolerance_inr";
pub const TOTAL_TOLERANCE_DEFAULT: i32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Block,
    Warn,
}

#[derive(Debug, Clone, Serialize)]
pub struct Issue {
    pub field: String,
    pub severity: Severity,
    pub message: String,
}

/// What the checks need to know about one line.
#[derive(Debug, Clone, Default)]
pub struct LineFacts {
    pub name: String,
    pub rate: Decimal,
    pub mrp: Option<Decimal>,
    pub expiry: Option<NaiveDate>,
    pub manufacture: Option<NaiveDate>,
    pub received: i32,
    pub accepted: i32,
    pub discount: Decimal,
    pub gst_rate: Option<Decimal>,
    pub hsn: Option<String>,
    /// The catalogue's (HSN, GST rate) for this item, when it has an HSN.
    pub catalogue_gst: Option<(String, Decimal)>,
}

#[derive(Debug, Clone, Copy)]
pub struct Rules {
    pub today: NaiveDate,
    pub min_shelf_life_days: i64,
    pub total_tolerance: Decimal,
}

fn issue(field: String, severity: Severity, message: String) -> Issue {
    Issue {
        field,
        severity,
        message,
    }
}

/// Billed value of a line: (received × rate − discount) plus GST, to paise.
#[must_use]
pub fn billed_value(line: &LineFacts) -> Decimal {
    let taxable = Decimal::from(line.received) * line.rate - line.discount;
    let gst = line.gst_rate.unwrap_or_default();
    (taxable + taxable * gst / Decimal::ONE_HUNDRED).round_dp(2)
}

/// Value of what was accepted: the discount shared pro rata, plus GST.
#[must_use]
pub fn accepted_value(line: &LineFacts) -> Decimal {
    if line.received <= 0 {
        return Decimal::ZERO;
    }
    let share = Decimal::from(line.accepted) / Decimal::from(line.received);
    (billed_value(line) * share).round_dp(2)
}

fn check_prices(at: &str, line: &LineFacts, out: &mut Vec<Issue>) {
    if let Some(mrp) = line.mrp
        && mrp < line.rate
    {
        out.push(issue(
            format!("{at}.mrp"),
            Severity::Block,
            format!(
                "{}: MRP ₹{mrp} is below the rate ₹{}. MRP and rate are often read the \
                 wrong way round; check the bill.",
                line.name, line.rate
            ),
        ));
    }
    if line.discount > Decimal::from(line.received) * line.rate {
        out.push(issue(
            format!("{at}.discount_amount"),
            Severity::Block,
            format!(
                "{}: the discount is more than the line is worth.",
                line.name
            ),
        ));
    }
}

fn check_dates(at: &str, line: &LineFacts, rules: &Rules, out: &mut Vec<Issue>) {
    if let Some(mfg) = line.manufacture {
        if mfg > rules.today {
            out.push(issue(
                format!("{at}.manufacture_date"),
                Severity::Block,
                format!("{}: the manufacture date is in the future.", line.name),
            ));
        }
        if line.expiry.is_some_and(|exp| exp <= mfg) {
            out.push(issue(
                format!("{at}.expiry_date"),
                Severity::Block,
                format!(
                    "{}: expiry is not after manufacture — dates swapped?",
                    line.name
                ),
            ));
        }
    }
    let Some(expiry) = line.expiry else { return };
    let floor = rules.today + chrono::Duration::days(rules.min_shelf_life_days);
    if line.accepted > 0 && expiry <= floor {
        out.push(issue(
            format!("{at}.expiry_date"),
            Severity::Block,
            format!(
                "{}: expires {expiry}, within the hospital's {} days minimum shelf life. \
                 Reject the batch or return it to the supplier.",
                line.name, rules.min_shelf_life_days
            ),
        ));
    }
}

fn check_gst(at: &str, line: &LineFacts, out: &mut Vec<Issue>) {
    let (Some(rate), Some((hsn, expected))) = (line.gst_rate, line.catalogue_gst.as_ref()) else {
        return;
    };
    let same_hsn = line.hsn.as_deref().is_none_or(|h| h == hsn);
    if same_hsn && rate != *expected {
        out.push(issue(
            format!("{at}.gst_rate"),
            Severity::Warn,
            format!(
                "{}: GST {rate}% on the bill, {expected}% for HSN {hsn} in the catalogue. \
                 Bills dated before 22 Sep 2025 may legitimately show the old rate.",
                line.name
            ),
        ));
    }
}

/// Every finding for one line; `index` names the field (`items[i].…`).
#[must_use]
pub fn check_line(index: usize, line: &LineFacts, rules: &Rules) -> Vec<Issue> {
    let at = format!("items[{index}]");
    let mut out = Vec::new();
    check_prices(&at, line, &mut out);
    check_dates(&at, line, rules, &mut out);
    check_gst(&at, line, &mut out);
    out
}

/// The lines must add up to the bill, within the tolerance.
#[must_use]
pub fn check_total(
    lines: &[LineFacts],
    invoice_amount: Option<Decimal>,
    rules: &Rules,
) -> Option<Issue> {
    let invoice = invoice_amount?;
    let sum: Decimal = lines.iter().map(billed_value).sum();
    ((sum - invoice).abs() > rules.total_tolerance).then(|| {
        issue(
            "invoice_amount".to_owned(),
            Severity::Block,
            format!(
                "The lines add up to ₹{sum}, the bill says ₹{invoice}. A line was missed, \
                 read twice, or a figure is wrong."
            ),
        )
    })
}

/// All findings for a bill.
#[must_use]
pub fn check_bill(
    lines: &[LineFacts],
    invoice_amount: Option<Decimal>,
    rules: &Rules,
) -> Vec<Issue> {
    let mut out: Vec<Issue> = lines
        .iter()
        .enumerate()
        .flat_map(|(i, line)| check_line(i, line, rules))
        .collect();
    out.extend(check_total(lines, invoice_amount, rules));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules() -> Rules {
        Rules {
            today: NaiveDate::from_ymd_opt(2026, 10, 19).unwrap_or_default(),
            min_shelf_life_days: 180,
            total_tolerance: Decimal::ONE,
        }
    }

    fn line() -> LineFacts {
        LineFacts {
            name: "Paracetamol 500".into(),
            rate: Decimal::from(20),
            mrp: Some(Decimal::from(30)),
            expiry: NaiveDate::from_ymd_opt(2028, 6, 30),
            received: 10,
            accepted: 10,
            gst_rate: Some(Decimal::from(5)),
            ..LineFacts::default()
        }
    }

    fn fields(issues: &[Issue]) -> Vec<&str> {
        issues.iter().map(|i| i.field.as_str()).collect()
    }

    #[test]
    fn a_clean_line_passes() {
        assert!(check_line(0, &line(), &rules()).is_empty());
    }

    #[test]
    fn mrp_below_rate_blocks() {
        let l = LineFacts {
            mrp: Some(Decimal::from(15)),
            ..line()
        };
        let found = check_line(2, &l, &rules());
        assert_eq!(fields(&found), ["items[2].mrp"]);
        assert_eq!(found[0].severity, Severity::Block);
    }

    #[test]
    fn expiry_inside_the_shelf_life_floor_blocks_but_a_rejected_line_does_not() {
        let near = LineFacts {
            expiry: NaiveDate::from_ymd_opt(2027, 3, 1),
            ..line()
        };
        assert_eq!(
            fields(&check_line(0, &near, &rules())),
            ["items[0].expiry_date"]
        );
        let rejected = LineFacts {
            accepted: 0,
            ..near
        };
        assert!(check_line(0, &rejected, &rules()).is_empty());
    }

    #[test]
    fn gst_disagreeing_with_the_catalogue_hsn_warns() {
        let l = LineFacts {
            gst_rate: Some(Decimal::from(12)),
            hsn: Some("3004".into()),
            catalogue_gst: Some(("3004".into(), Decimal::from(5))),
            ..line()
        };
        let found = check_line(0, &l, &rules());
        assert_eq!(fields(&found), ["items[0].gst_rate"]);
        assert_eq!(found[0].severity, Severity::Warn);
        let other_hsn = LineFacts {
            hsn: Some("3003".into()),
            ..l
        };
        assert!(check_line(0, &other_hsn, &rules()).is_empty());
    }

    #[test]
    fn totals_reconcile_within_the_tolerance() {
        // 10 × 20 = 200 + 5% = 210.
        let lines = [line()];
        assert!(check_total(&lines, Some(Decimal::from(211)), &rules()).is_none());
        assert!(check_total(&lines, Some(Decimal::from(212)), &rules()).is_some());
        assert!(check_total(&lines, None, &rules()).is_none());
    }

    #[test]
    fn accepted_value_shares_the_discount() {
        let l = LineFacts {
            accepted: 5,
            discount: Decimal::from(20),
            ..line()
        };
        // (200 − 20) × 1.05 = 189, half accepted.
        assert_eq!(accepted_value(&l), Decimal::new(9450, 2));
    }
}
