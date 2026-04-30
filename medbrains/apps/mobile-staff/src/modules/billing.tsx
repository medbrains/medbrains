/**
 * Billing module — invoices, payments, GST, journal entries. GST is
 * mandatory on healthcare services; GSTR summaries auto-generated.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function BillingScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Billing"
      description="Invoices, payments, credit, reconciliation."
      summaries={[
        { eyebrow: "OPEN", count: "—", title: "Outstanding invoices" },
        { eyebrow: "TODAY", count: "—", title: "Collections so far" },
      ]}
      actions={[
        {
          id: "invoices",
          label: "Invoices",
          description: "View, edit, finalize, void.",
          permission: P.BILLING.INVOICES_LIST,
        },
        {
          id: "payments",
          label: "Receive payment",
          description: "Cash / card / UPI / Razorpay.",
          permission: P.BILLING.PAYMENTS_CREATE,
        },
        {
          id: "credit",
          label: "Credit patients",
          description: "Aging report and reminder dispatch.",
          permission: P.BILLING.CREDIT_LIST,
        },
        {
          id: "tds",
          label: "TDS deductions",
          description: "Quarterly deposit + certificate generation.",
          permission: P.BILLING.TDS_LIST,
        },
        {
          id: "concession",
          label: "Concession / waiver",
          description: "Tier-approved patient concession workflow.",
          permission: P.BILLING.CONCESSIONS_APPROVE,
        },
      ]}
    />
  );
}

export const billingModule: Module = {
  id: "billing",
  displayName: "Billing",
  icon: () => null,
  requiredPermissions: [P.BILLING.INVOICES_LIST],
  navigator: BillingScreen,
  offlineDocTypes: ["payment_event"],
};
