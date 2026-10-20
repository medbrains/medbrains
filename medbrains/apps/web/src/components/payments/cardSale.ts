import type { PaymentTerminal, PosSaleStage, PosSaleView, PosTender } from "@medbrains/types";

/** How often the counter asks the machine (it never polls faster). */
export const CARD_POLL = {
  initialDelayMs: 1_500,
  maxDelayMs: 2_000,
  // The server closes an unanswered sale after six minutes; this outlasts it.
  maxAttempts: 200,
} as const;

/** Where a sale is shown in the three steps sent → waiting → result. */
export type StepState = "done" | "current" | "todo" | "failed";

export interface CardSaleStep {
  label: string;
  state: StepState;
}

/** What the patient may pay with at the machine; either is the default. */
export const TENDERS: { value: PosTender; label: string }[] = [
  { value: "either", label: "Card or UPI" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI on machine" },
];

const RESULT_LABEL: Record<PosSaleStage, string> = {
  sent: "Result",
  waiting: "Result",
  cancelling: "Cancelling",
  cancel_refused: "Result",
  unknown: "Outcome unknown",
  approved: "Approved",
  declined: "Declined",
  timed_out: "Timed out",
  cancelled: "Cancelled",
  failed: "Not sent",
  refunded: "Refunded",
};

/** The three steps, each marked for the stage the sale is at. */
export function cardSaleSteps(stage: PosSaleStage): CardSaleStep[] {
  const failed = ["declined", "timed_out", "cancelled", "failed"].includes(stage);
  const result: StepState =
    stage === "approved" || stage === "refunded"
      ? "done"
      : failed
        ? "failed"
        : stage === "unknown"
          ? "current"
          : "todo";
  return [
    { label: "Sent to machine", state: stage === "sent" ? "current" : "done" },
    {
      label: "Waiting for card",
      state:
        stage === "sent"
          ? "todo"
          : stage === "waiting" || stage === "cancelling" || stage === "cancel_refused"
            ? "current"
            : "done",
    },
    { label: RESULT_LABEL[stage], state: result },
  ];
}

/**
 * A sale nobody knows the outcome of — the machine refused the cancel, or
 * gave no definite answer in time. A supervisor resolves it from the slip;
 * the card is never charged again meanwhile.
 */
export function needsResolving(sale: PosSaleView): boolean {
  return sale.stage === "unknown" || sale.stage === "cancel_refused";
}

/** A finished sale the cashier may run again. */
export function canRetry(sale: PosSaleView): boolean {
  return sale.is_final && sale.stage !== "approved" && sale.stage !== "refunded";
}

/** What the card covered, in rupees. */
export function approvedRupees(sale: PosSaleView): number {
  return Number(sale.approved_amount ?? sale.amount);
}

/** The counters that have a card machine, for the counter picker. */
export function countersWithMachines(
  terminals: readonly PaymentTerminal[],
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const t of terminals) {
    if (t.kind === "pos" && t.station_id && !seen.has(t.station_id)) {
      seen.set(t.station_id, t.station_name ?? "Counter");
    }
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}

export function machineStatusLabel(t: PaymentTerminal): string {
  if (t.status === "online") return "Online";
  if (t.status === "offline") return t.last_error ? `Offline — ${t.last_error}` : "Offline";
  return "Not checked yet";
}
