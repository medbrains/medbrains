import type { PaymentTerminal, PosSaleStage, PosSaleView } from "@medbrains/types";

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

const RESULT_LABEL: Record<PosSaleStage, string> = {
  sent: "Result",
  waiting: "Result",
  cancelling: "Cancelling",
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
    stage === "approved" || stage === "refunded" ? "done" : failed ? "failed" : "todo";
  return [
    { label: "Sent to machine", state: stage === "sent" ? "current" : "done" },
    {
      label: "Waiting for card",
      state:
        stage === "sent"
          ? "todo"
          : stage === "waiting" || stage === "cancelling"
            ? "current"
            : "done",
    },
    { label: RESULT_LABEL[stage], state: result },
  ];
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
