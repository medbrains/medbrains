import { Tabs } from "@mantine/core";
import {
  IconChartBar,
  IconBed,
  IconFlask,
  IconHeartbeat,
  IconCurrencyRupee,
} from "@tabler/icons-react";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { RevenueTab } from "./analytics/RevenueTab";
import { IpdCensusTab } from "./analytics/IpdCensusTab";
import { LabTatTab } from "./analytics/LabTatTab";
import { ClinicalTab } from "./analytics/ClinicalTab";
import { OpdBedTab } from "./analytics/OpdBedTab";

export function AnalyticsPage() {
  useRequirePermission(P.ANALYTICS.VIEW);

  return (
    <div>
      <PageHeader
        title="Analytics & Dashboards"
        subtitle="Hospital performance analytics"
        icon={<IconChartBar size={28} />}
      />
      <Tabs defaultValue="revenue">
        <Tabs.List>
          <Tabs.Tab value="revenue" leftSection={<IconCurrencyRupee size={16} />}>
            Revenue
          </Tabs.Tab>
          <Tabs.Tab value="ipd" leftSection={<IconBed size={16} />}>
            IPD Census
          </Tabs.Tab>
          <Tabs.Tab value="lab" leftSection={<IconFlask size={16} />}>
            Lab TAT
          </Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconHeartbeat size={16} />}>
            Clinical
          </Tabs.Tab>
          <Tabs.Tab value="opd-bed" leftSection={<IconChartBar size={16} />}>
            OPD & Beds
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="revenue" pt="md">
          <RevenueTab />
        </Tabs.Panel>
        <Tabs.Panel value="ipd" pt="md">
          <IpdCensusTab />
        </Tabs.Panel>
        <Tabs.Panel value="lab" pt="md">
          <LabTatTab />
        </Tabs.Panel>
        <Tabs.Panel value="clinical" pt="md">
          <ClinicalTab />
        </Tabs.Panel>
        <Tabs.Panel value="opd-bed" pt="md">
          <OpdBedTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
