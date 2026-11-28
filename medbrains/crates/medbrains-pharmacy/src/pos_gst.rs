//! GST on a POS counter line, split between the Centre (CGST) and the
//! State (SGST) so the two halves always add up to the line's tax.

use rust_decimal::{Decimal, RoundingStrategy};

/// One POS line's GST, split between the Centre and the State.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GstSplit {
    pub(crate) cgst: Decimal,
    pub(crate) sgst: Decimal,
}

/// Split a line's GST so the halves add up to the line's tax: the tax is
/// rounded to the paisa once, CGST is half of it rounded, SGST the rest.
/// Rounding each half on its own (the old way) put a paisa too much or too
/// little on every line whose tax had an odd paisa, as #6244 found for the
/// storefront. Half away from zero, the rule every other bill uses.
pub(crate) fn split_gst(line_gst: Decimal) -> GstSplit {
    // rounding: money, half away from zero (medbrains_core::money once #6262 lands)
    let paisa = |v: Decimal| v.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
    let tax = paisa(line_gst);
    let cgst = paisa(tax / Decimal::from(2));
    GstSplit {
        cgst,
        sgst: tax - cgst,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every MRP from ₹0.01 to ₹30.00 at 5%, 12% and 18%, one to three units,
    /// with and without a 10% bill discount, priced as `create_pos_sale` does:
    /// CGST + SGST is the line's tax rounded once, the halves differ by at most
    /// a paisa, and the tax never exceeds the line, which never exceeds MRP.
    #[test]
    fn cgst_plus_sgst_is_the_line_tax_and_never_above_mrp() {
        let hundred = Decimal::from(100);
        let mut wrong = 0;
        for paise in 1..=3000_i64 {
            for rate in [5, 12, 18].map(Decimal::from) {
                for (qty, keep) in [(1, "1"), (2, "1"), (3, "0.9")] {
                    let mrp = Decimal::new(paise, 2);
                    let keep: Decimal = keep.parse().unwrap_or(Decimal::ONE);
                    let inclusive = Decimal::from(qty) * mrp * keep;
                    let line_gst = inclusive * rate / (hundred + rate);
                    let line_total = inclusive.round_dp(2); // rounding: as create_pos_sale
                    let tax =
                        line_gst.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
                    let g = split_gst(line_gst);
                    let ok = g.cgst + g.sgst == tax
                        && (g.cgst - g.sgst).abs() <= Decimal::new(1, 2)
                        && tax <= line_total
                        && line_total <= Decimal::from(qty) * mrp;
                    wrong += usize::from(!ok);
                }
            }
        }
        assert_eq!(wrong, 0, "lines whose GST halves do not add up to the tax");
    }
}
