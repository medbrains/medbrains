/**
 * BME / CMMS module — equipment register, preventive maintenance,
 * calibrations, contracts, breakdowns.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function BmeScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="BME / CMMS"
      description="Equipment register, PM, calibrations, AMC."
      summaries={[
        { eyebrow: "PM DUE", count: "—", title: "PMs due this week" },
        { eyebrow: "CAL", count: "—", title: "Calibrations expiring" },
      ]}
      actions={[
        {
          id: "equipment",
          label: "Equipment register",
          description: "Search by tag / location / make-model.",
          permission: P.BME.EQUIPMENT_LIST,
        },
        {
          id: "pm",
          label: "Preventive maintenance",
          description: "Scheduled PM checklist execution.",
          permission: P.BME.PM_LIST,
        },
        {
          id: "calibration",
          label: "Calibrations",
          description: "Capture readings + cert upload.",
          permission: P.BME.CALIBRATION_LIST,
        },
        {
          id: "breakdown",
          label: "Log breakdown",
          description: "Open ticket + dispatch service.",
          permission: P.BME.BREAKDOWNS_CREATE,
        },
        {
          id: "contracts",
          label: "AMC contracts",
          description: "Vendor SLA + escalation.",
          permission: P.BME.CONTRACTS_LIST,
        },
      ]}
    />
  );
}

export const bmeModule: Module = {
  id: "bme",
  displayName: "BME",
  icon: () => null,
  requiredPermissions: [P.BME.EQUIPMENT_LIST],
  navigator: BmeScreen,
  offlineDocTypes: ["bme_breakdown", "bme_pm_log", "bme_calibration"],
};
