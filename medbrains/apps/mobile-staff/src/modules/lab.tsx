/**
 * Lab module — orders, results, QC, phlebotomy queue. NABL critical-
 * value reporting: results outside critical ranges trigger immediate
 * alerts to the ordering provider.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listLabOrders } from "../api/lab.js";

const STATUS_TONE: Record<string, IntentTone> = {
  ordered: "warn",
  collected: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "alert",
  rejected: "alert",
};

function LabHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Lab"
      description="Orders, results, QC, phlebotomy worklist."
      summaries={[
        { eyebrow: "ORDERS", count: "—", title: "Pending result entry" },
        { eyebrow: "CRITICAL", count: "—", title: "Critical alerts open" },
      ]}
      actions={[
        {
          id: "orders",
          label: "Order queue",
          description: "Triage, accept, route to instrument.",
          permission: P.LAB.ORDERS_LIST,
          onPress: () => router.push("orders"),
        },
        {
          id: "results",
          label: "Enter results",
          description: "Delta-check vs prior + critical-value flag.",
          permission: P.LAB.RESULTS_CREATE,
        },
        {
          id: "phlebo",
          label: "Phlebotomy queue",
          description: "Sample collection rounds.",
          permission: P.LAB.PHLEBOTOMY_LIST,
        },
        {
          id: "qc",
          label: "QC / Westgard",
          description: "Levey-Jennings + multi-rule violations.",
          permission: P.LAB.QC_LIST,
        },
        {
          id: "outsourced",
          label: "Outsourced tests",
          description: "External lab tracking + report linkage.",
          permission: P.LAB.OUTSOURCED_LIST,
        },
      ]}
    />
  );
}

function LabOrdersScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="LAB"
      title="Order queue"
      description="STAT orders are flagged with the copper accent."
      fetcher={async () => (await listLabOrders()).orders}
      rowKey={(o) => o.id}
      renderRow={(o) => (
        <EntityRow
          title={`Order ${o.id.slice(0, 8)}`}
          subtitle={`${o.priority} · ${o.is_outsourced ? "outsourced" : "in-house"} · ETA ${o.expected_tat_minutes ?? "—"} min`}
          badge={{ label: o.status, tone: STATUS_TONE[o.status] ?? "neutral" }}
          accent={o.is_stat}
        />
      )}
      emptyTitle="No active orders"
    />
  );
}

function LabScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <LabHome />, orders: <LabOrdersScreen /> }}
    />
  );
}

export const labModule: Module = {
  id: "lab",
  displayName: "Lab",
  icon: () => null,
  requiredPermissions: [P.LAB.ORDERS_LIST],
  navigator: LabScreen,
  offlineDocTypes: ["lab_result", "qc_result"],
};
