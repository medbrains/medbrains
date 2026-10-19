/**
 * Why the counter cannot take payment yet — or null when it can.
 *
 * The counter used to grey its button out with no word of why. The commonest
 * reason was that "Received" defaulted to zero, so every priced basket was
 * blocked until the cashier guessed at a field. Tender now lives in the
 * payment step; what is left here are the reasons a sale truly cannot go,
 * each phrased as the fix.
 */
export interface PosCheckoutLine {
  drugName: string;
  quantity: number;
  unitPrice: number;
  /** Catalogue schedule; H/H1/X/NDPS are refused over the counter by the server. */
  schedule?: string | null;
  isControlled?: boolean;
  /** Catalogue stock when the line was added; the server re-checks it. */
  stock?: number | null;
  /** MRP of the batch the line will come from; nothing may sell above it. */
  mrp?: number | null;
}

/** A discount off MRP over the hospital's limit needs a reason and an approver. */
export interface PosDiscountCheck {
  offMrpPercent: number;
  /** `null` when the limit could not be loaded — then any discount waits. */
  limitPercent: number | null;
  canApprove: boolean;
  reason: string;
}

export interface PosCheckoutState {
  canEditAmounts: boolean;
  lines: readonly PosCheckoutLine[];
  allergyBlocked: boolean;
  /** A server safety refusal stands and no override reason can clear it. */
  safetyBlocked: boolean;
  discount?: PosDiscountCheck;
}

/** Mirrors the server's OTC rule in `create_pos_sale` (D&C Act / NDPS Act). */
const PRESCRIPTION_ONLY = new Set(["H", "H1", "X", "NDPS"]);

export function isPrescriptionOnly(line: Pick<PosCheckoutLine, "schedule" | "isControlled">) {
  return Boolean(line.isControlled) || PRESCRIPTION_ONLY.has(line.schedule ?? "");
}

function lineBlocker(line: PosCheckoutLine): string | null {
  if (isPrescriptionOnly(line)) {
    const label = line.schedule ? `Schedule ${line.schedule}` : "a controlled drug";
    return `${line.drugName} is ${label} — dispense it against a prescription from the Rx queue.`;
  }
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    return `Set a quantity of at least 1 for ${line.drugName}.`;
  }
  if (line.stock != null && line.quantity > line.stock) {
    return `Only ${line.stock} of ${line.drugName} in stock — lower the quantity.`;
  }
  if (!(line.unitPrice > 0)) {
    return `${line.drugName} has no selling price — enter the price on its line.`;
  }
  if (line.mrp && line.unitPrice > line.mrp + 1e-9) {
    return `${line.drugName} is priced above its MRP of ₹${line.mrp} — the most it may sell for.`;
  }
  return null;
}

const DISCOUNT_REASON_MIN = 5;

function discountBlocker(check: PosDiscountCheck): string | null {
  if (check.offMrpPercent <= 0) return null;
  if (check.limitPercent === null) {
    return "The discount limit could not be checked — remove the discount or try again.";
  }
  if (check.offMrpPercent <= check.limitPercent + 1e-9) return null;
  const over = `A ${check.offMrpPercent.toFixed(2)}% discount is over the ${check.limitPercent}% limit`;
  if (!check.canApprove) return `${over} — a supervisor with discount approval must ring it.`;
  if (check.reason.trim().length < DISCOUNT_REASON_MIN) return `${over} — give the reason.`;
  return null;
}

/** Discount off MRP across the bill, price cuts and bill discount together. */
export function offMrpPercent(mrpValue: number, netBeforeTax: number): number {
  if (!(mrpValue > 0)) return 0;
  return Math.max(0, Math.round(((mrpValue - netBeforeTax) * 10000) / mrpValue) / 100);
}

export function posCheckoutBlocker(state: PosCheckoutState): string | null {
  if (!state.canEditAmounts)
    return "Your role cannot edit sale amounts, so it cannot take payment.";
  if (state.lines.length === 0) return "Add a medicine to start the sale.";
  for (const line of state.lines) {
    const reason = lineBlocker(line);
    if (reason) return reason;
  }
  if (state.discount) {
    const reason = discountBlocker(state.discount);
    if (reason) return reason;
  }
  if (state.allergyBlocked) return "Record the allergy override reason first.";
  if (state.safetyBlocked) return "Resolve the medication safety stop above first.";
  return null;
}

/**
 * The amount to collect, rounded up to the paisa. The server totals in exact
 * decimals and refuses a sale whose amount received is short by any fraction,
 * so a float total that rounds down (or lands at 9.8999…) would be refused.
 */
export function toPayable(total: number): number {
  const paise = Math.round(total * 1e4) / 1e2;
  return Math.ceil(paise) / 100;
}

export interface PosTotalsLine {
  quantity: number;
  /** Selling price per unit, GST included — MRP at most. */
  unitPrice: number;
  /** The drug's own GST rate from the catalogue — medicines are 0, 5, 12 or 18%. */
  gstRate: number;
}

/**
 * What a basket comes to.
 *
 * MRP includes GST (Legal Metrology (Packaged Commodities) Rules, r.2(m)), so
 * the customer pays the price on the strip less any discount — GST is the part
 * of that which is tax, worked out on the value after discount (CGST Act
 * s.15(3)), not added on top. The server computes the same.
 */
export function posTotals(lines: readonly PosTotalsLine[], discountPercent: number) {
  const keep = 1 - Math.min(Math.max(discountPercent, 0), 100) / 100;
  let gross = 0;
  let gst = 0;
  for (const line of lines) {
    const value = line.quantity * line.unitPrice;
    gross += value;
    gst += (value * keep * line.gstRate) / (100 + line.gstRate);
  }
  const total = toPayable(gross * keep);
  return { gross, discount: gross - gross * keep, gst, total };
}
