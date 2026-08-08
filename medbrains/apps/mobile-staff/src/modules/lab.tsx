/**
 * Lab module — orders, results, QC, phlebotomy queue. NABL critical-
 * value reporting: results outside critical ranges trigger immediate
 * alerts to the ordering provider.
 */

import type { Module } from "@medbrains/mobile-shell";
import type { LabOrder, LabPhlebotomyQueueItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import type { IntentTone } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { Button } from "react-native-paper";
import {
  acknowledgeCriticalAlert,
  getLabTatAnalytics,
  listCriticalAlerts,
  listLabOrders,
  listPhlebotomyQueue,
  updatePhlebotomyStatus,
} from "../api/lab.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { useModuleCount } from "../components/module-count.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { QcStatusScreen } from "./lab/qc-status.js";
import { ScanSampleScreen } from "./lab/scan-sample.js";

const STATUS_TONE: Record<string, IntentTone> = {
  ordered: "warn",
  sample_collected: "info",
  processing: "info",
  completed: "success",
  verified: "success",
  cancelled: "alert",
};

const PHLEBO_TONE: Record<string, IntentTone> = {
  waiting: "warn",
  in_progress: "info",
  completed: "success",
  skipped: "alert",
};

function LabHome(): ReactNode {
  const router = useModuleRouter();
  const openCritical = useModuleCount(listCriticalAlerts, (a) => !a.acknowledged_at);
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Lab"
      description="Orders, results, QC, phlebotomy worklist."
      tags={["Mobile-LabTech", "Mobile-Phlebo", "NABL", "critical-values"]}
      summaries={[
        { eyebrow: "ORDERS", count: "—", title: "Pending result entry" },
        { eyebrow: "CRITICAL", count: openCritical.count, title: "Critical alerts open" },
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
          onPress: () => router.push("orders"),
        },
        {
          id: "scan",
          label: "Scan a specimen",
          description: "Read the tube label instead of typing it.",
          permission: P.LAB.ORDERS_LIST,
          onPress: () => router.push("scan"),
        },
        {
          id: "phlebo",
          label: "Phlebotomy queue",
          description: "Sample collection rounds.",
          permission: P.LAB.PHLEBOTOMY_LIST,
          onPress: () => router.push("phlebotomy"),
        },
        {
          id: "qc",
          label: "QC / Westgard",
          description: "Levey-Jennings + multi-rule violations.",
          permission: P.LAB.QC_LIST,
          onPress: () => router.push("qc-status"),
        },
        {
          id: "outsourced",
          label: "Outsourced tests",
          description: "External lab tracking + report linkage.",
          permission: P.LAB.OUTSOURCED_LIST,
        },
        {
          id: "critical",
          label: "Critical alerts",
          description: "Doctor notification and acknowledgement register.",
          permission: P.LAB.REPORTS_VIEW,
          onPress: () => router.push("critical-alerts"),
        },
        {
          id: "tat",
          label: "TAT analytics",
          description: "NABL turnaround-time watch by test.",
          permission: P.LAB.REPORTS_VIEW,
          onPress: () => router.push("tat"),
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
      renderRow={(o) => <LabOrderRow order={o} />}
      emptyTitle="No active orders"
    />
  );
}

function LabOrderRow({ order }: { order: LabOrder }): ReactNode {
  return (
    <EntityRow
      title={`Order ${order.id.slice(0, 8)} · ${order.priority.toUpperCase()}`}
      subtitle={`${order.patient_id.slice(0, 8)} · ${order.is_outsourced ? "outsourced" : "in-house"} · ETA ${
        order.expected_tat_minutes ?? "—"
      } min`}
      badge={{ label: order.status, tone: STATUS_TONE[order.status] ?? "neutral" }}
      accent={order.is_stat}
    />
  );
}

function PhlebotomyQueueScreen(): ReactNode {
  const renderActions = (row: LabPhlebotomyQueueItem): ReactNode => {
    if (row.status === "waiting") {
      return (
        <Button
          compact
          mode="contained-tonal"
          onPress={() => updatePhlebotomyStatus(row.id, "in_progress")}
        >
          Start
        </Button>
      );
    }
    if (row.status === "in_progress") {
      return (
        <Button
          compact
          mode="contained-tonal"
          onPress={() => updatePhlebotomyStatus(row.id, "completed")}
        >
          Complete
        </Button>
      );
    }
    return null;
  };

  return (
    <EntityListScreen
      eyebrow="LAB"
      title="Phlebotomy queue"
      description="Blood/sample collection with chain-of-custody timestamps."
      fetcher={listPhlebotomyQueue}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`Queue ${row.queue_number ?? row.id.slice(0, 8)}`}
          subtitle={`${row.priority} · patient ${row.patient_id.slice(0, 8)} · order ${row.order_id.slice(0, 8)}`}
          badge={{ label: row.status, tone: PHLEBO_TONE[row.status] ?? "neutral" }}
          accent={row.priority === "stat"}
          trailing={renderActions(row)}
        />
      )}
      emptyTitle="No phlebotomy queue"
    />
  );
}

function CriticalAlertsScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="LAB"
      title="Critical alerts"
      description="Critical values must be notified and acknowledged, not silently auto-released."
      fetcher={listCriticalAlerts}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`${row.parameter_name}: ${row.value}`}
          subtitle={`Patient ${row.patient_id.slice(0, 8)} · ${new Date(row.created_at).toLocaleString()}`}
          badge={{
            label: row.acknowledged_at ? "acknowledged" : row.flag,
            tone: row.acknowledged_at ? "success" : "alert",
          }}
          trailing={
            row.acknowledged_at ? null : (
              <Button
                compact
                mode="contained-tonal"
                onPress={() => acknowledgeCriticalAlert(row.id)}
              >
                Ack
              </Button>
            )
          }
        />
      )}
      emptyTitle="No critical alerts"
    />
  );
}

function TatAnalyticsScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="LAB"
      title="TAT analytics"
      description="Turnaround-time watch for camp blood tests and routine lab service."
      fetcher={getLabTatAnalytics}
      rowKey={(row) => row.test_name}
      renderRow={(row) => (
        <EntityRow
          title={row.test_name}
          subtitle={`${row.total_orders} orders · avg ${Math.round(row.avg_tat_minutes ?? 0)} min · p95 ${Math.round(
            row.p95_tat_minutes ?? 0,
          )} min`}
          badge={{ label: `${row.within_sla} in SLA`, tone: "info" }}
        />
      )}
      emptyTitle="No TAT data"
    />
  );
}

function LabScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <LabHome />,
        orders: <LabOrdersScreen />,
        phlebotomy: <PhlebotomyQueueScreen />,
        "critical-alerts": <CriticalAlertsScreen />,
        tat: <TatAnalyticsScreen />,
        scan: <ScanSampleScreen />,
        "qc-status": <QcStatusScreen />,
      }}
    />
  );
}

export const labModule: Module = {
  id: "lab",
  displayName: "Lab",
  icon: () => null,
  requiredPermissions: [P.LAB.ORDERS_LIST],
  navigator: LabScreen,
  appCodes: ["Mobile-LabTech", "Mobile-Phlebo"],
  tags: ["lab", "phlebotomy", "qc", "critical-values", "nabl"],
  offlineDocTypes: ["lab_result", "qc_result"],
};
