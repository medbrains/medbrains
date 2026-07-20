import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconBolt,
  IconBuildingFactory2,
  IconDroplet,
  IconFlame,
  IconTool,
} from "@tabler/icons-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { EnergyTab } from "./facilities/energy-tab";
import { FireSafetyTab } from "./facilities/fire-safety-tab";
import { MgpsTab } from "./facilities/mgps-tab";
import { WaterQualityTab } from "./facilities/water-quality-tab";
import { WorkOrdersTab } from "./facilities/work-orders-tab";

// ── Constants ──────────────────────────────────────────

// ── Main Page ─────────────────────────────────────────

export function FacilitiesPage() {
  useRequirePermission(P.FACILITIES.GAS_LIST);
  const [searchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const requestedTab = searchParams.get("tab");
  const initialTab =
    requestedTab === "fire" ||
    requestedTab === "water" ||
    requestedTab === "energy" ||
    requestedTab === "work-orders"
      ? requestedTab
      : "mgps";
  const [tab, setTab] = useState<string | null>(initialTab);

  return (
    <div>
      <PageHeader
        title="Facilities Management"
        subtitle="MGPS, Fire Safety, Water Quality, Energy, Work Orders"
      />
      <IpdContextStrip context={ipdContext} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="mgps" leftSection={<IconBuildingFactory2 size={16} />}>
            MGPS
          </Tabs.Tab>
          <Tabs.Tab value="fire" leftSection={<IconFlame size={16} />}>
            Fire Safety
          </Tabs.Tab>
          <Tabs.Tab value="water" leftSection={<IconDroplet size={16} />}>
            Water Quality
          </Tabs.Tab>
          <Tabs.Tab value="energy" leftSection={<IconBolt size={16} />}>
            Energy
          </Tabs.Tab>
          <Tabs.Tab value="work-orders" leftSection={<IconTool size={16} />}>
            Work Orders
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="mgps" pt="md">
          <MgpsTab />
        </Tabs.Panel>
        <Tabs.Panel value="fire" pt="md">
          <FireSafetyTab />
        </Tabs.Panel>
        <Tabs.Panel value="water" pt="md">
          <WaterQualityTab />
        </Tabs.Panel>
        <Tabs.Panel value="energy" pt="md">
          <EnergyTab />
        </Tabs.Panel>
        <Tabs.Panel value="work-orders" pt="md">
          <WorkOrdersTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: MGPS (Medical Gas Pipeline System)
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Tab: Work Orders
// ══════════════════════════════════════════════════════════
