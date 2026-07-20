import { AnalyticsTab } from "./scheduling/analytics-tab";
import { ConflictsTab } from "./scheduling/conflicts-tab";
import { OverbookingTab } from "./scheduling/overbooking-tab";
import { PredictionsTab } from "./scheduling/predictions-tab";
import { RecurringBlocksTab } from "./scheduling/recurring-blocks-tab";
import { WaitlistTab } from "./scheduling/waitlist-tab";
import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBrain,
  IconCalendarPlus,
  IconChartBar,
  IconClockHour4,
  IconSettings,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";

export function SchedulingPage() {
  useRequirePermission(P.SCHEDULING.PREDICTIONS_LIST);

  const canScore = useHasPermission(P.SCHEDULING.PREDICTIONS_CREATE);
  const canViewWaitlist = useHasPermission(P.SCHEDULING.WAITLIST_LIST);
  const canManageWaitlist = useHasPermission(P.SCHEDULING.WAITLIST_MANAGE);
  const canAutoFill = useHasPermission(P.SCHEDULING.AUTO_FILL_MANAGE);
  const canViewOverbooking = useHasPermission(P.SCHEDULING.OVERBOOKING_LIST);
  const canManageOverbooking = useHasPermission(P.SCHEDULING.OVERBOOKING_MANAGE);
  const canViewAnalytics = useHasPermission(P.SCHEDULING.ANALYTICS_VIEW);

  return (
    <div>
      <PageHeader
        title="Scheduling / No-Show AI"
        subtitle="Predictions, waitlist management, overbooking rules, conflicts, and analytics"
      />
      <Tabs defaultValue="predictions">
        <Tabs.List>
          <Tabs.Tab value="predictions" leftSection={<IconBrain size={16} />}>
            No-Show Predictions
          </Tabs.Tab>
          {canViewWaitlist && (
            <Tabs.Tab value="waitlist" leftSection={<IconClockHour4 size={16} />}>
              Waitlist
            </Tabs.Tab>
          )}
          {canViewOverbooking && (
            <Tabs.Tab value="overbooking" leftSection={<IconSettings size={16} />}>
              Overbooking Config
            </Tabs.Tab>
          )}
          <Tabs.Tab value="conflicts" leftSection={<IconAlertTriangle size={16} />}>
            Conflicts
          </Tabs.Tab>
          <Tabs.Tab value="scheduling" leftSection={<IconCalendarPlus size={16} />}>
            Recurring & Blocks
          </Tabs.Tab>
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="predictions" pt="md">
          <PredictionsTab canScore={canScore} />
        </Tabs.Panel>
        <Tabs.Panel value="waitlist" pt="md">
          <WaitlistTab canManage={canManageWaitlist} canAutoFill={canAutoFill} />
        </Tabs.Panel>
        <Tabs.Panel value="overbooking" pt="md">
          <OverbookingTab canManage={canManageOverbooking} />
        </Tabs.Panel>
        <Tabs.Panel value="conflicts" pt="md">
          <ConflictsTab />
        </Tabs.Panel>
        <Tabs.Panel value="scheduling" pt="md">
          <RecurringBlocksTab canManage={canManageWaitlist} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — No-Show Predictions
// ══════════════════════════════════════════════════════════
