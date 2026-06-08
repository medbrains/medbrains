export type BillingInvoiceStatus =
  | "cancelled"
  | "draft"
  | "issued"
  | "paid"
  | "partially_paid"
  | "refunded";
export type BillingInvoiceSignalShape = "diamond" | "pill" | "token";
export type BillingInvoiceSignalTone = "active" | "blocked" | "neutral" | "ready" | "risk";
export type BillingInvoiceSignalPhase =
  | "cancelled"
  | "draft"
  | "partially_paid"
  | "payable"
  | "refunded"
  | "restricted"
  | "settled";

export interface BillingInvoiceSignal {
  phase: BillingInvoiceSignalPhase;
  shape: BillingInvoiceSignalShape;
  tone: BillingInvoiceSignalTone;
}

interface BillingInvoiceJourneyRow {
  id: string;
  paid_amount: number | string | null | undefined;
  status: string;
  total_amount: number | string | null | undefined;
}

export const BILLING_INVOICE_STATUS_VALUES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "cancelled",
  "refunded",
] as const satisfies readonly BillingInvoiceStatus[];

const BILLING_INVOICE_DEFAULT_SIGNAL = {
  phase: "draft",
  shape: "token",
  tone: "neutral",
} as const satisfies BillingInvoiceSignal;

const BILLING_INVOICE_STATUS_SIGNALS: Readonly<Record<BillingInvoiceStatus, BillingInvoiceSignal>> =
  {
    cancelled: {
      phase: "cancelled",
      shape: "diamond",
      tone: "risk",
    },
    draft: {
      phase: "draft",
      shape: "token",
      tone: "blocked",
    },
    issued: {
      phase: "payable",
      shape: "token",
      tone: "active",
    },
    paid: {
      phase: "settled",
      shape: "pill",
      tone: "ready",
    },
    partially_paid: {
      phase: "partially_paid",
      shape: "diamond",
      tone: "blocked",
    },
    refunded: {
      phase: "refunded",
      shape: "diamond",
      tone: "risk",
    },
  };

function amountNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBillingInvoiceStatus(status: string): status is BillingInvoiceStatus {
  return (BILLING_INVOICE_STATUS_VALUES as readonly string[]).includes(status);
}

export function billingInvoiceBalance(
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): number {
  return Math.max(0, amountNumber(totalAmount) - amountNumber(paidAmount));
}

export function billingInvoiceDisplayStatus(
  status: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): BillingInvoiceStatus {
  const currentStatus = isBillingInvoiceStatus(status) ? status : "draft";
  const total = amountNumber(totalAmount);
  const paid = amountNumber(paidAmount);
  const balance = billingInvoiceBalance(totalAmount, paidAmount);

  if (currentStatus === "issued" && paid > 0 && balance > 0) {
    return "partially_paid";
  }
  if (currentStatus !== "cancelled" && currentStatus !== "refunded" && balance <= 0 && total > 0) {
    return "paid";
  }
  return currentStatus;
}

export function billingInvoiceIsPayable(
  status: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): boolean {
  const displayStatus = billingInvoiceDisplayStatus(status, totalAmount, paidAmount);
  return (
    billingInvoiceBalance(totalAmount, paidAmount) > 0 &&
    (displayStatus === "issued" || displayStatus === "partially_paid")
  );
}

export function billingInvoiceIsFinalized(
  status: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): boolean {
  const displayStatus = billingInvoiceDisplayStatus(status, totalAmount, paidAmount);
  return (
    displayStatus === "issued" || displayStatus === "partially_paid" || displayStatus === "paid"
  );
}

export function billingInvoiceHasReceivedPayment(
  status: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): boolean {
  const displayStatus = billingInvoiceDisplayStatus(status, totalAmount, paidAmount);
  return (
    displayStatus === "partially_paid" || displayStatus === "paid" || amountNumber(paidAmount) > 0
  );
}

export function billingInvoiceRequiresFollowUp(
  status: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined,
): boolean {
  const displayStatus = billingInvoiceDisplayStatus(status, totalAmount, paidAmount);
  return (
    displayStatus === "draft" || displayStatus === "issued" || displayStatus === "partially_paid"
  );
}

export function activeBillingInvoiceIdForJourney<TInvoice extends BillingInvoiceJourneyRow>(
  invoices: readonly TInvoice[],
): string | null {
  return (
    invoices.find((invoice) =>
      billingInvoiceIsPayable(invoice.status, invoice.total_amount, invoice.paid_amount),
    )?.id ??
    invoices.find((invoice) =>
      billingInvoiceRequiresFollowUp(invoice.status, invoice.total_amount, invoice.paid_amount),
    )?.id ??
    invoices.find((invoice) => {
      const displayStatus = billingInvoiceDisplayStatus(
        invoice.status,
        invoice.total_amount,
        invoice.paid_amount,
      );
      return displayStatus !== "cancelled" && displayStatus !== "refunded";
    })?.id ??
    null
  );
}

export function billingInvoiceStatusSignal(status: string): BillingInvoiceSignal {
  return isBillingInvoiceStatus(status)
    ? BILLING_INVOICE_STATUS_SIGNALS[status]
    : BILLING_INVOICE_DEFAULT_SIGNAL;
}

export function billingInvoiceBalanceSignal(
  balance: number,
  amountVisible: boolean,
): BillingInvoiceSignal {
  if (!amountVisible) {
    return {
      phase: "restricted",
      shape: "diamond",
      tone: "blocked",
    };
  }
  if (balance > 0) {
    return {
      phase: "payable",
      shape: "diamond",
      tone: "risk",
    };
  }
  return {
    phase: "settled",
    shape: "pill",
    tone: "ready",
  };
}
