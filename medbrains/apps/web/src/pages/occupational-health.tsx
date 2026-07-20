import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBiohazard,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconReportMedical,
  IconShieldCheck,
  IconVaccine,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ExposuresPanel } from "@/pages/occupational-health/ExposuresPanel";
import { OccHealthAnalyticsPanel } from "./occupational-health/analytics-panel";
import { DrugScreensPanel } from "./occupational-health/drug-screens-panel";
import { HazardRegistryPanel } from "./occupational-health/hazard-registry-panel";
import { InjuriesPanel } from "./occupational-health/injuries-panel";
import { ReturnToWorkPanel } from "./occupational-health/return-to-work-panel";
import { ScreeningsPanel } from "./occupational-health/screenings-panel";
import { VaccinationsPanel } from "./occupational-health/vaccinations-panel";

// ── Constants ──────────────────────────────────────────

// ── Main Page ──────────────────────────────────────────

export function OccupationalHealthPage() {
  useRequirePermission(P.OCC_HEALTH.SCREENINGS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("screenings");

  return (
    <div>
      <PageHeader
        title="Occupational Health"
        subtitle="Employee health screenings, vaccinations, and injury tracking"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="screenings" leftSection={<IconShieldCheck size={16} />}>
            Health Screenings
          </Tabs.Tab>
          <Tabs.Tab value="drug-screens" leftSection={<IconReportMedical size={16} />}>
            Drug Screening
          </Tabs.Tab>
          <Tabs.Tab value="vaccinations" leftSection={<IconVaccine size={16} />}>
            Vaccinations
          </Tabs.Tab>
          <Tabs.Tab value="injuries" leftSection={<IconAlertTriangle size={16} />}>
            Injuries & RTW
          </Tabs.Tab>
          <Tabs.Tab value="exposures" leftSection={<IconBiohazard size={16} />}>
            Sharps & Exposures
          </Tabs.Tab>
          <Tabs.Tab value="hazards" leftSection={<IconChecklist size={16} />}>
            Hazard Registry
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
          <Tabs.Tab value="rtw-clearance" leftSection={<IconCertificate size={16} />}>
            RTW Clearance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="drug-screens" pt="md">
          <DrugScreensPanel />
        </Tabs.Panel>
        <Tabs.Panel value="vaccinations" pt="md">
          <VaccinationsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="injuries" pt="md">
          <InjuriesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="exposures" pt="md">
          <ExposuresPanel />
        </Tabs.Panel>
        <Tabs.Panel value="hazards" pt="md">
          <HazardRegistryPanel />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <OccHealthAnalyticsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="rtw-clearance" pt="md">
          <ReturnToWorkPanel />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Health Screenings
// ══════════════════════════════════════════════════════════
