export type BillingHandoffAction = "discharge_bill" | "payment";
export type BillingInvoiceAction = "payment";

export function billingHandoffActionFromSearchParams(
  searchParams: URLSearchParams,
): BillingHandoffAction | null {
  if (searchParams.get("action") === "payment") {
    return "payment";
  }
  if (
    searchParams.get("action") === "discharge_bill" ||
    searchParams.get("source") === "ipd_discharge"
  ) {
    return "discharge_bill";
  }
  return null;
}

export function billingInvoiceActionFromSearchParams(
  searchParams: URLSearchParams,
): BillingInvoiceAction | null {
  return searchParams.get("action") === "payment" ? "payment" : null;
}

export function billingInvoiceWorkspaceRoute(invoiceId: string): string {
  return `/billing/invoices/${invoiceId}`;
}

export function billingInvoicePaymentRoute(invoiceId: string): string {
  return `${billingInvoiceWorkspaceRoute(invoiceId)}?action=payment`;
}

export function billingAdmissionFilterFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  return searchParams.get("admission_id")?.trim() || null;
}
