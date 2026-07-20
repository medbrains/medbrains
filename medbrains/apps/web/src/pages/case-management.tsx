import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconArrowRight,
  IconBarrierBlock,
  IconChartBar,
  IconClipboardList,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AnalyticsTab } from "./case-management/analytics-tab";
import { CaseBoardTab } from "./case-management/case-board-tab";
import { DischargeBarriersTab } from "./case-management/discharge-barriers-tab";
import { ReferralsTab } from "./case-management/referrals-tab";

export function CaseManagementPage() {
  useRequirePermission(P.CASE_MGMT.ASSIGNMENTS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("board");

  return (
    <div>
      <PageHeader
        title="Case Management"
        subtitle="Case assignments, discharge barriers, referrals, and analytics"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="board" leftSection={<IconClipboardList size={16} />}>
            Case Board
          </Tabs.Tab>
          <Tabs.Tab value="barriers" leftSection={<IconBarrierBlock size={16} />}>
            Discharge Barriers
          </Tabs.Tab>
          <Tabs.Tab value="referrals" leftSection={<IconArrowRight size={16} />}>
            Referrals
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="board" pt="md">
          <CaseBoardTab />
        </Tabs.Panel>
        <Tabs.Panel value="barriers" pt="md">
          <DischargeBarriersTab />
        </Tabs.Panel>
        <Tabs.Panel value="referrals" pt="md">
          <ReferralsTab />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Case Board Tab
// ══════════════════════════════════════════════════════════
