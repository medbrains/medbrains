/**
 * Lab module — orders, results, QC, phlebotomy queue. NABL critical-
 * value reporting: results outside critical ranges trigger immediate
 * alerts to the ordering provider.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function LabScreen() {
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

export const labModule: Module = {
  id: "lab",
  displayName: "Lab",
  icon: () => null,
  requiredPermissions: [P.LAB.ORDERS_LIST],
  navigator: LabScreen,
  offlineDocTypes: ["lab_result", "qc_result"],
};
