/**
 * Facilities module — MGPS, fire safety, water, energy, work orders.
 * Compliance bodies: PESO (gas), AERB (water), local fire NOC.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { IntentTone } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { listWorkOrders } from "../api/facilities.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { useModuleCount } from "../components/module-count.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { RaiseWorkOrderScreen } from "./facilities/raise-work-order.js";

const STATUS_TONE: Record<string, IntentTone> = {
  open: "warn",
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "alert",
};
const PRIORITY_TONE: Record<string, IntentTone> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "alert",
};

function FacilitiesHome(): ReactNode {
  const router = useModuleRouter();
  // on_hold counts as open: it is still the team's problem, and excluding it
  // would let a backlog be hidden by parking tickets rather than closing them.
  const openWorkOrders = useModuleCount(listWorkOrders, (w) =>
    ["open", "assigned", "in_progress", "on_hold"].includes(w.status),
  );
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Facilities"
      description="MGPS, fire safety, water, energy, work orders."
      tags={["Mobile-BME", "Mobile-Housekeeping", "MGPS", "fire-safety"]}
      summaries={[
        { eyebrow: "OPEN", count: openWorkOrders.count, title: "Work orders" },
        { eyebrow: "INSP", count: "—", title: "Inspections due" },
      ]}
      actions={[
        {
          id: "work-orders",
          label: "Work orders",
          description: "Open / dispatch / close + cost capture.",
          permission: P.FACILITIES.WORK_ORDERS_LIST,
          onPress: () => router.push("work-orders"),
        },
        {
          id: "create-wo",
          label: "Create work order",
          description: "Site, asset, urgency, assignee.",
          permission: P.FACILITIES.WORK_ORDERS_CREATE,
          onPress: () => router.push("raise"),
        },
        {
          id: "gas",
          label: "MGPS readings",
          description: "Gas pressures + PESO compliance log.",
          permission: P.FACILITIES.GAS_LIST,
        },
        {
          id: "fire",
          label: "Fire safety",
          description: "Equipment, drills, NOC tracking.",
          permission: P.FACILITIES.FIRE_LIST,
        },
        {
          id: "water",
          label: "Water tests",
          description: "Schedules + results capture.",
          permission: P.FACILITIES.WATER_LIST,
        },
      ]}
    />
  );
}

function WorkOrdersScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="FACILITIES"
      title="Work orders"
      fetcher={() => listWorkOrders()}
      rowKey={(w) => w.id}
      renderRow={(w) => (
        <EntityRow
          title={w.title}
          subtitle={`${w.work_order_number} · ${w.category} · ${w.scheduled_date ?? "unscheduled"}`}
          badge={{ label: w.status, tone: STATUS_TONE[w.status] ?? "neutral" }}
          accent={PRIORITY_TONE[w.priority] === "alert"}
        />
      )}
      emptyTitle="No work orders"
    />
  );
}

function FacilitiesScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <FacilitiesHome />,
        "work-orders": <WorkOrdersScreen />,
        raise: <RaiseWorkOrderScreen />,
      }}
    />
  );
}

export const facilitiesModule: Module = {
  id: "facilities",
  displayName: "Facilities",
  icon: () => null,
  requiredPermissions: [P.FACILITIES.WORK_ORDERS_LIST],
  navigator: FacilitiesScreen,
  appCodes: ["Mobile-BME", "Mobile-Housekeeping", "TV-Wayfinding"],
  tags: ["facilities", "mgps", "fire", "water", "work-orders"],
  offlineDocTypes: ["fms_work_order", "fms_gas_reading"],
};
