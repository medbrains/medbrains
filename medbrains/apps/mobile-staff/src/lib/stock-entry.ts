/**
 * What counts as a usable quantity on a stock movement.
 *
 * Extracted from the scan screen so the rule is testable and stated once. It
 * guards a write that changes inventory, and a wrong number here becomes a
 * wrong shelf count that somebody later reconciles by hand.
 */

export interface QuantityCheck {
  /** Parsed value, or null when the input cannot be used. */
  quantity: number | null;
  /** Message to show under the field, or null when there is nothing to say. */
  error: string | null;
}

/**
 * Empty is not an error — it is someone who has not typed yet, and shouting at
 * them before they start is how a form feels hostile. Everything else that is
 * not a whole number above zero is refused, including decimals: stock moves in
 * whole units, and "1.5 strips" silently truncating is worse than a refusal.
 */
export function checkQuantity(raw: string): QuantityCheck {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { quantity: null, error: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { quantity: null, error: "Enter a whole number of units, more than zero." };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { quantity: null, error: "Enter a whole number of units, more than zero." };
  }
  return { quantity: parsed, error: null };
}
