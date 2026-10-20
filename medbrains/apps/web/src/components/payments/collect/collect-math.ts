// The Collect drawer's arithmetic and the request it sends — pure, so the
// money rules are tested without a screen.
import type { BillingLaneName, CollectRequest, CollectTender, DueBill } from "@medbrains/types";

/** Where the drawer was opened from: which of the patient's bills it is about. */
export interface CollectFocus {
  lane?: BillingLaneName;
  encounterId?: string;
  invoiceIds?: string[];
}

export type CollectScopeChoice = "focus" | "all";

/** A way of paying already decided: typed in, or approved by a machine or gateway. */
export interface TenderPart {
  id: string;
  mode: string;
  amount: number;
  reference?: string;
  /** Cash handed over; change is this less `amount`. */
  tendered?: number;
  /** An approved card-machine, QR or online payment: real money, never removed. */
  gatewayTransactionId?: string;
  label: string;
}

export const toPaise = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const fromPaise = (paise: number): number => paise / 100;

export const rupees = (value: number): string =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The bills the drawer was opened for: named bills, else this visit's and this department's. */
export function focusBills(bills: DueBill[], focus: CollectFocus): DueBill[] {
  if (focus.invoiceIds && focus.invoiceIds.length > 0) {
    const ids = new Set(focus.invoiceIds);
    return bills.filter((b) => ids.has(b.invoice_id));
  }
  const { encounterId, lane } = focus;
  // No department named: the bills this desk collects.
  if (!encounterId && !lane) return bills.filter((b) => b.can_collect);
  return bills.filter(
    (b) => (!encounterId || b.encounter_id === encounterId) && (!lane || b.lanes.includes(lane)),
  );
}

export const billsDue = (bills: DueBill[]): number =>
  fromPaise(bills.reduce((sum, b) => sum + toPaise(b.balance), 0));

/** What is still to take once the parts are counted. */
export function remainingAfter(due: number, parts: TenderPart[]): number {
  const taken = parts.reduce((sum, p) => sum + toPaise(p.amount), 0);
  return fromPaise(Math.max(0, toPaise(due) - taken));
}

/** Change to hand back for a cash tender. */
export function changeDue(amount: number, tendered: number): number {
  return fromPaise(Math.max(0, toPaise(tendered) - toPaise(amount)));
}

/** The parts as the server's tenders. */
export function tendersOf(parts: TenderPart[]): CollectTender[] {
  return parts
    .filter((p) => p.gatewayTransactionId || toPaise(p.amount) > 0)
    .map((p) =>
      p.gatewayTransactionId
        ? {
            mode: p.mode,
            amount: p.amount,
            reference: p.reference,
            gateway_transaction_id: p.gatewayTransactionId,
          }
        : { mode: p.mode, amount: p.amount, reference: p.reference?.trim() || undefined },
    );
}

/** The one collection request: these bills, these tenders, this key. */
export function buildCollectRequest(args: {
  patientId: string;
  focus: CollectFocus;
  scope: CollectScopeChoice;
  bills: DueBill[];
  parts: TenderPart[];
  idempotencyKey: string;
  stationId?: string | null;
}): CollectRequest {
  const byLane = args.scope === "focus" && args.focus.lane;
  return {
    patient_id: args.patientId,
    scope: byLane ? "department" : "all",
    lane: byLane ? args.focus.lane : undefined,
    invoice_ids: args.bills.map((b) => b.invoice_id),
    tenders: tendersOf(args.parts),
    station_id: args.stationId ?? undefined,
    idempotency_key: args.idempotencyKey,
  };
}

/** What a collection left: everything paid, or some still due. */
export function outcomeOf(due: number, collected: number): "paid" | "partial" {
  return toPaise(collected) >= toPaise(due) ? "paid" : "partial";
}
