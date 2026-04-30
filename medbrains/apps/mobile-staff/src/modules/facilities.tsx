/**
 * Facilities module — MGPS, fire safety, water, energy, work orders.
 * Compliance bodies: PESO (gas), AERB (water), local fire NOC.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function FacilitiesScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Facilities"
      description="MGPS, fire safety, water, energy, work orders."
      summaries={[
        { eyebrow: "OPEN", count: "—", title: "Work orders" },
        { eyebrow: "INSP", count: "—", title: "Inspections due" },
      ]}
      actions={[
        {
          id: "work-orders",
          label: "Work orders",
          description: "Open / dispatch / close + cost capture.",
          permission: P.FACILITIES.WORK_ORDERS_LIST,
        },
        {
          id: "create-wo",
          label: "Create work order",
          description: "Site, asset, urgency, assignee.",
          permission: P.FACILITIES.WORK_ORDERS_CREATE,
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

export const facilitiesModule: Module = {
  id: "facilities",
  displayName: "Facilities",
  icon: () => null,
  requiredPermissions: [P.FACILITIES.WORK_ORDERS_LIST],
  navigator: FacilitiesScreen,
  offlineDocTypes: ["fms_work_order", "fms_gas_reading"],
};
