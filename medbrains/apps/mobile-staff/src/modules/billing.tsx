/**
 * Billing module — invoices, payments, GST, journal entries. GST is
 * mandatory on healthcare services; GSTR summaries auto-generated.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listInvoices } from "../api/billing.js";

const STATUS_TONE: Record<string, IntentTone> = {
  draft: "neutral",
  finalized: "info",
  paid: "success",
  partially_paid: "warn",
  cancelled: "alert",
  void: "alert",
};

function BillingHome(): ReactNode {
  const router = useModuleRouter();
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
          onPress: () => router.push("invoices"),
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

function InvoicesScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BILLING"
      title="Invoices"
      fetcher={async () => (await listInvoices()).invoices}
      rowKey={(i) => i.id}
      renderRow={(i) => (
        <EntityRow
          title={i.invoice_number}
          subtitle={`Total ₹${i.total_amount} · Paid ₹${i.amount_paid} · Due ₹${i.balance_due}`}
          badge={{ label: i.status, tone: STATUS_TONE[i.status] ?? "neutral" }}
        />
      )}
      emptyTitle="No invoices"
    />
  );
}

function BillingScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <BillingHome />, invoices: <InvoicesScreen /> }}
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
