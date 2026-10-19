import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
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

const TAB_PERMISSIONS = {
  mgps: P.FACILITIES.GAS_LIST,
  fire: P.FACILITIES.FIRE_LIST,
  water: P.FACILITIES.WATER_LIST,
  energy: P.FACILITIES.ENERGY_LIST,
  "work-orders": P.FACILITIES.WORK_ORDERS_LIST,
} as const;
type FacilitiesTab = keyof typeof TAB_PERMISSIONS;
const TABS = Object.keys(TAB_PERMISSIONS) as FacilitiesTab[];

export function FacilitiesPage() {
  // Any one tab opens the page; each tab is shown — and fetches — only for its holder,
  // so a maintenance technician reaches their work orders without the gas register.
  useRequirePermission(Object.values(TAB_PERMISSIONS));
  const canMgps = useHasPermission(TAB_PERMISSIONS.mgps);
  const canFire = useHasPermission(TAB_PERMISSIONS.fire);
  const canWater = useHasPermission(TAB_PERMISSIONS.water);
  const canEnergy = useHasPermission(TAB_PERMISSIONS.energy);
  const canWorkOrders = useHasPermission(TAB_PERMISSIONS["work-orders"]);
  const allowed: Record<FacilitiesTab, boolean> = {
    mgps: canMgps,
    fire: canFire,
    water: canWater,
    energy: canEnergy,
    "work-orders": canWorkOrders,
  };
  const [searchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const requestedTab = searchParams.get("tab");
  const initialTab =
    TABS.find((t) => t === requestedTab && allowed[t]) ?? TABS.find((t) => allowed[t]) ?? null;
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
          {canMgps && (
            <Tabs.Tab value="mgps" leftSection={<IconBuildingFactory2 size={16} />}>
              MGPS
            </Tabs.Tab>
          )}
          {canFire && (
            <Tabs.Tab value="fire" leftSection={<IconFlame size={16} />}>
              Fire Safety
            </Tabs.Tab>
          )}
          {canWater && (
            <Tabs.Tab value="water" leftSection={<IconDroplet size={16} />}>
              Water Quality
            </Tabs.Tab>
          )}
          {canEnergy && (
            <Tabs.Tab value="energy" leftSection={<IconBolt size={16} />}>
              Energy
            </Tabs.Tab>
          )}
          {canWorkOrders && (
            <Tabs.Tab value="work-orders" leftSection={<IconTool size={16} />}>
              Work Orders
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canMgps && (
          <Tabs.Panel value="mgps" pt="md">
            <MgpsTab />
          </Tabs.Panel>
        )}
        {canFire && (
          <Tabs.Panel value="fire" pt="md">
            <FireSafetyTab />
          </Tabs.Panel>
        )}
        {canWater && (
          <Tabs.Panel value="water" pt="md">
            <WaterQualityTab />
          </Tabs.Panel>
        )}
        {canEnergy && (
          <Tabs.Panel value="energy" pt="md">
            <EnergyTab />
          </Tabs.Panel>
        )}
        {canWorkOrders && (
          <Tabs.Panel value="work-orders" pt="md">
            <WorkOrdersTab />
          </Tabs.Panel>
        )}
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
