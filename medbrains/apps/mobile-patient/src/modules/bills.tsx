/**
 * Patient → bills. View invoices, pay via Razorpay, download
 * receipts. Backed by `/api/portal/bills`.
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function BillsScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Bills"
      description="Invoices, payments, and receipts."
      summaries={[
        { eyebrow: "DUE", count: "—", title: "Outstanding balance" },
        { eyebrow: "PAID", count: "—", title: "Last 12 months" },
      ]}
      actions={[
        {
          id: "outstanding",
          label: "Outstanding bills",
          description: "Invoices awaiting payment.",
        },
        {
          id: "pay",
          label: "Pay now",
          description: "Razorpay / UPI / card.",
        },
        {
          id: "history",
          label: "Payment history",
          description: "Receipts and refunds.",
        },
        {
          id: "estimate",
          label: "Treatment estimate",
          description: "Pre-procedure cost estimate.",
        },
      ]}
    />
  );
}

export const billsModule: Module = {
  id: "bills",
  displayName: "Bills",
  icon: () => null,
  requiredPermissions: [],
  navigator: BillsScreen,
};
