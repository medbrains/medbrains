/**
 * The counter's refund arithmetic, mirrored from
 * `crates/medbrains-pharmacy/src/return_rules.rs` so the split the cashier
 * confirms is the split the server accepts — it refuses parts that do not add
 * up to the return to the paisa. All money here is integer paisa.
 */
import type { TenderBalance } from "@medbrains/types";

/** "123.45" → 12345. The server sends money as decimal strings. */
export function toPaisa(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function fromPaisa(paisa: number): number {
  return paisa / 100;
}

/** numerator / denominator rounded to an integer, half to even (rust_decimal's `round_dp`). */
function divideHalfEven(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const twiceRemainder = 2 * (numerator - quotient * denominator);
  if (twiceRemainder > denominator) return quotient + 1;
  if (twiceRemainder < denominator) return quotient;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

/** What returning `qty` more units of a line refunds: share(after) − share(before). */
export function lineRefundPaisa(
  lineTotal: string,
  sold: number,
  alreadyReturned: number,
  qty: number,
): number {
  if (sold <= 0 || qty <= 0) return 0;
  const total = toPaisa(lineTotal);
  const share = (units: number) => divideHalfEven(total * units, sold);
  return share(alreadyReturned + qty) - share(alreadyReturned);
}

export interface RefundSplit {
  mode: string;
  paisa: number;
}

/**
 * Back to the tenders the sale was paid with, in proportion to what each still
 * holds; the paisa left by rounding goes to the largest part with room (the last of
 * equals, as `Iterator::max_by` picks).
 */
export function splitRefund(totalPaisa: number, tenders: TenderBalance[]): RefundSplit[] {
  const room = new Map(
    tenders.map((t) => [t.mode, Math.max(0, toPaisa(t.paid) - toPaisa(t.refunded))]),
  );
  const pool = [...room.values()].reduce((a, b) => a + b, 0);
  if (totalPaisa <= 0 || pool <= 0 || totalPaisa > pool) return [];
  const parts = [...room.entries()]
    .filter(([, left]) => left > 0)
    .map(([mode, left]) => ({
      mode,
      paisa: Math.min(divideHalfEven(totalPaisa * left, pool), left),
    }));
  const gap = totalPaisa - parts.reduce((a, p) => a + p.paisa, 0);
  if (gap !== 0) {
    const target = parts
      .filter((p) => gap < 0 || (room.get(p.mode) ?? 0) - p.paisa >= gap)
      .reduce<RefundSplit | null>((best, p) => (best && best.paisa > p.paisa ? best : p), null);
    if (target) target.paisa += gap;
  }
  return parts.filter((p) => p.paisa > 0);
}

/** Card and UPI refunds carry the terminal's or the UPI app's reference. */
export function needsReference(mode: string): boolean {
  return mode === "card" || mode === "upi";
}
