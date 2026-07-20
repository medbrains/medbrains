import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconAmbulance, IconChartBar, IconRoute, IconTool, IconUsers } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { DriversTab } from "./ambulance/drivers-tab";
import { FleetTab } from "./ambulance/fleet-tab";
import { MaintenanceTab } from "./ambulance/maintenance-tab";
import { ReportsTab } from "./ambulance/reports-tab";
import { TripsTab } from "./ambulance/trips-tab";

export function AmbulancePage() {
  useRequirePermission(P.AMBULANCE.FLEET_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("fleet");

  return (
    <div>
      <PageHeader
        title="Ambulance Fleet Management"
        subtitle="Fleet, trips, dispatch, drivers & maintenance"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="fleet" leftSection={<IconAmbulance size={16} />}>
            Fleet
          </Tabs.Tab>
          <Tabs.Tab value="trips" leftSection={<IconRoute size={16} />}>
            Trips & Dispatch
          </Tabs.Tab>
          <Tabs.Tab value="drivers" leftSection={<IconUsers size={16} />}>
            Drivers
          </Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<IconTool size={16} />}>
            Maintenance
          </Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>
            Reports
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fleet" pt="md">
          <FleetTab />
        </Tabs.Panel>
        <Tabs.Panel value="trips" pt="md">
          <TripsTab />
        </Tabs.Panel>
        <Tabs.Panel value="drivers" pt="md">
          <DriversTab />
        </Tabs.Panel>
        <Tabs.Panel value="maintenance" pt="md">
          <MaintenanceTab />
        </Tabs.Panel>
        <Tabs.Panel value="reports" pt="md">
          <ReportsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
