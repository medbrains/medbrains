//! How much of an invoice line one partial return reverses, so that any
//! split of the line into returns sums to the line exactly.

use rust_decimal::Decimal;

/// One partial return's part of an invoice line.
pub struct ReversalShare {
    pub quantity: i32,
    pub of: i32,
    pub completes: bool,
}

impl ReversalShare {
    /// This return's part of `line` (what was charged) when `prior` was
    /// already reversed. The return that completes the quantity takes the
    /// exact remainder, so any split of a line sums to the line; an earlier
    /// one takes q/Q of the line, rounded half away from zero when the
    /// numeric(…, 2) column stores it.
    pub fn of_amount(&self, line: Decimal, prior: Decimal) -> Decimal {
        if self.completes {
            line - prior
        } else {
            line * Decimal::from(self.quantity) / Decimal::from(self.of)
        }
    }
}
