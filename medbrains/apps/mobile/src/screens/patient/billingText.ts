import type { InvoiceStatus } from "@medbrains/types";

type MobileBillingTextValues = Record<string, string | number | boolean>;

const MOBILE_BILLING_MESSAGES: Record<string, string> = {
  "billing.button.payAll": "Pay All",
  "billing.button.payNow": "Pay Now",
  "billing.context.admissionLinked": "IPD admission-linked",
  "billing.context.encounterLinked": "Encounter-linked",
  "billing.date.notDated": "Not dated",
  "billing.empty.history": "No billing history",
  "billing.empty.noBills": "No bills",
  "billing.empty.paid": "No paid bills found",
  "billing.empty.pending": "You have no pending bills",
  "billing.empty.pendingDischargeBills": "No pending discharge bills found for this admission",
  "billing.filter.all": "All",
  "billing.filter.paid": "Paid",
  "billing.filter.pending": "Pending",
  "billing.handoff.default.hint": "Reviewing invoices for the selected patient context.",
  "billing.handoff.default.title": "Patient billing",
  "billing.handoff.dischargeBill.hint":
    "Reviewing invoices linked to this IPD admission so unrelated patient bills stay out of the discharge queue.",
  "billing.handoff.dischargeBill.title": "Discharge billing handoff",
  "billing.handoff.ipd.hint": "Reviewing invoices linked to the active IPD admission.",
  "billing.handoff.opd.hint": "Reviewing invoices linked to the active encounter.",
  "billing.handoff.payment.title": "Payment handoff",
  "billing.invoice.fallbackNumber": "INV-{{id}}",
  "billing.itemCount.many": "{{count}} items",
  "billing.itemCount.one": "{{count}} item",
  "billing.label.acceptedPaymentMethods": "Accepted Payment Methods",
  "billing.label.due": "Due",
  "billing.label.paid": "Paid",
  "billing.label.total": "Total",
  "billing.label.totalOutstanding": "Total Outstanding",
  "billing.loading.bills": "Loading bills...",
  "billing.paymentMethod.card": "Card",
  "billing.paymentMethod.cash": "Cash",
  "billing.paymentMethod.netBanking": "Net Banking",
  "billing.paymentMethod.upi": "UPI",
  "billing.status.cancelled": "Cancelled",
  "billing.status.draft": "Draft",
  "billing.status.issued": "Issued",
  "billing.status.paid": "Paid",
  "billing.status.partial": "Partially paid",
  "billing.status.partially_paid": "Partially paid",
  "billing.status.pending": "Pending",
  "billing.status.refunded": "Refunded",
  "billing.status.unpaid": "Unpaid",
};

function interpolate(template: string, values?: MobileBillingTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileBillingText(key: string, values?: MobileBillingTextValues): string {
  const template = MOBILE_BILLING_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobileBillingStatusText(status: InvoiceStatus): string {
  return mobileBillingText(`billing.status.${status}`);
}
