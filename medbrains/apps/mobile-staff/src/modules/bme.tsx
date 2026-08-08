/**
 * BME / CMMS module — equipment register, preventive maintenance,
 * calibrations, contracts, breakdowns.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { IntentTone } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { listEquipment } from "../api/bme.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { useModuleCount } from "../components/module-count.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { ReportBreakdownScreen } from "./bme/report-breakdown.js";

const STATUS_TONE: Record<string, IntentTone> = {
  active: "success",
  in_repair: "warn",
  out_of_service: "alert",
  decommissioned: "neutral",
  in_calibration: "info",
};

function BmeHome(): ReactNode {
  const router = useModuleRouter();
  const equipment = useModuleCount(listEquipment);
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="BME / CMMS"
      description="Equipment register, PM, calibrations, AMC."
      tags={["Mobile-BME", "Desktop-DeviceBridge", "assets", "calibration"]}
      summaries={[
        { eyebrow: "PM DUE", count: equipment.count, title: "PMs due this week" },
        { eyebrow: "CAL", count: "—", title: "Calibrations expiring" },
      ]}
      actions={[
        {
          id: "equipment",
          label: "Equipment register",
          description: "Search by tag / location / make-model.",
          permission: P.BME.EQUIPMENT_LIST,
          onPress: () => router.push("equipment"),
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
          onPress: () => router.push("report-breakdown"),
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

function EquipmentScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BME"
      title="Equipment register"
      description="Sorted alphabetically. Critical-risk assets get the copper border."
      fetcher={() => listEquipment()}
      rowKey={(e) => e.id}
      renderRow={(e) => (
        <EntityRow
          title={e.name}
          subtitle={`${e.asset_tag ?? "—"} · ${e.serial_number ?? "no SN"} · next PM ${e.next_pm_date ?? "—"}`}
          badge={{ label: e.status, tone: STATUS_TONE[e.status] ?? "neutral" }}
          accent={e.risk_category === "critical"}
        />
      )}
      emptyTitle="No equipment registered"
    />
  );
}

function BmeScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <BmeHome />,
        equipment: <EquipmentScreen />,
        "report-breakdown": <ReportBreakdownScreen />,
      }}
    />
  );
}

export const bmeModule: Module = {
  id: "bme",
  displayName: "BME",
  icon: () => null,
  requiredPermissions: [P.BME.EQUIPMENT_LIST],
  navigator: BmeScreen,
  appCodes: ["Mobile-BME", "Desktop-DeviceBridge", "Mobile-Vendor"],
  tags: ["bme", "cmms", "assets", "pm", "calibration", "vendor"],
  offlineDocTypes: ["bme_breakdown", "bme_pm_log", "bme_calibration"],
};
