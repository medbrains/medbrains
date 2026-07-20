import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconChartBar,
  IconDeviceDesktopAnalytics,
  IconFileDescription,
  IconGauge,
  IconTool,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router";
import { IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AnalyticsTab } from "./bme/analytics-tab";
import { BreakdownsTab } from "./bme/breakdowns-tab";
import { CalibrationTab } from "./bme/calibration-tab";
import { ContractsTab } from "./bme/contracts-tab";
import { EquipmentTab } from "./bme/equipment-tab";
import { PmTab } from "./bme/pm-tab";

// ── Constants ──────────────────────────────────────────

// ── Badge helpers ──────────────────────────────────────

// ── Helpers ────────────────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Equipment Tab
// ══════════════════════════════════════════════════════════

export function BmePage() {
  useRequirePermission(P.BME.EQUIPMENT_LIST);

  const canPm = useHasPermission(P.BME.PM_LIST);
  const canCal = useHasPermission(P.BME.CALIBRATION_LIST);
  const canContracts = useHasPermission(P.BME.CONTRACTS_LIST);
  const canBreakdowns = useHasPermission(P.BME.BREAKDOWNS_LIST);
  const [searchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const requestedTab = searchParams.get("tab");
  const initialTab =
    requestedTab === "breakdowns" && canBreakdowns
      ? "breakdowns"
      : requestedTab === "pm" && canPm
        ? "pm"
        : requestedTab === "calibration" && canCal
          ? "calibration"
          : requestedTab === "contracts" && canContracts
            ? "contracts"
            : "equipment";

  return (
    <div>
      <PageHeader
        title="BME / CMMS"
        subtitle="Biomedical equipment management, maintenance, calibration & contracts"
      />
      <IpdContextStrip context={ipdContext} />
      <Tabs defaultValue={initialTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="equipment" leftSection={<IconDeviceDesktopAnalytics size={16} />}>
            Equipment
          </Tabs.Tab>
          {canPm && (
            <Tabs.Tab value="pm" leftSection={<IconTool size={16} />}>
              Preventive Maintenance
            </Tabs.Tab>
          )}
          {canCal && (
            <Tabs.Tab value="calibration" leftSection={<IconGauge size={16} />}>
              Calibration
            </Tabs.Tab>
          )}
          {canContracts && (
            <Tabs.Tab value="contracts" leftSection={<IconFileDescription size={16} />}>
              Contracts
            </Tabs.Tab>
          )}
          {canBreakdowns && (
            <Tabs.Tab value="breakdowns" leftSection={<IconAlertTriangle size={16} />}>
              Breakdowns
            </Tabs.Tab>
          )}
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="equipment" pt="md">
          <EquipmentTab />
        </Tabs.Panel>
        {canPm && (
          <Tabs.Panel value="pm" pt="md">
            <PmTab />
          </Tabs.Panel>
        )}
        {canCal && (
          <Tabs.Panel value="calibration" pt="md">
            <CalibrationTab />
          </Tabs.Panel>
        )}
        {canContracts && (
          <Tabs.Panel value="contracts" pt="md">
            <ContractsTab />
          </Tabs.Panel>
        )}
        {canBreakdowns && (
          <Tabs.Panel value="breakdowns" pt="md">
            <BreakdownsTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
