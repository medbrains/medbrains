import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconBed,
  IconBellRinging,
  IconDashboard,
  IconDoorExit,
  IconTruck,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AlertsThresholdsTab } from "./command-center/alerts-thresholds-tab";
import { BedManagementTab } from "./command-center/bed-management-tab";
import { DischargeCoordinatorTab } from "./command-center/discharge-coordinator-tab";
import { OverviewTab } from "./command-center/overview-tab";
import { TransportTab } from "./command-center/transport-tab";

export function CommandCenterPage() {
  useRequirePermission(P.COMMAND_CENTER.VIEW);
  const [tab, setTab] = useState<string | null>("overview");

  return (
    <div>
      <PageHeader
        title="Command Center"
        subtitle="Real-time hospital operations monitoring and control"
        icon={<IconDashboard size={20} stroke={1.5} />}
        color="danger"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="beds" leftSection={<IconBed size={16} />}>
            Bed Management
          </Tabs.Tab>
          <Tabs.Tab value="discharge" leftSection={<IconDoorExit size={16} />}>
            Discharge Coordinator
          </Tabs.Tab>
          <Tabs.Tab value="transport" leftSection={<IconTruck size={16} />}>
            Transport
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconBellRinging size={16} />}>
            Alerts & Thresholds
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <OverviewTab />
        </Tabs.Panel>
        <Tabs.Panel value="beds" pt="md">
          <BedManagementTab />
        </Tabs.Panel>
        <Tabs.Panel value="discharge" pt="md">
          <DischargeCoordinatorTab />
        </Tabs.Panel>
        <Tabs.Panel value="transport" pt="md">
          <TransportTab />
        </Tabs.Panel>
        <Tabs.Panel value="alerts" pt="md">
          <AlertsThresholdsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1: Overview
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Tab 2: Bed Management
// ══════════════════════════════════════════════════════════
