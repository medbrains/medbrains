import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconEye,
  IconFileAnalytics,
  IconHistory,
  IconShieldLock,
  IconUserSearch,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AccessLogTab } from "./audit/AccessLogTab";
import { AuditLogTab } from "./audit/AuditLogTab";
import { AuditStatsTab } from "./audit/AuditStatsTab";
import { BreakGlassReviewTab } from "./audit/BreakGlassReviewTab";
import { EntityTimelineTab } from "./audit/EntityTimelineTab";
import { UserActivityTab } from "./audit/UserActivityTab";

export function AuditPage() {
  useRequirePermission(P.AUDIT.LOG_VIEW);

  const canViewAccess = useHasPermission(P.AUDIT.ACCESS_VIEW);
  const canReviewBreakGlass = useHasPermission(P.AUDIT.BREAK_GLASS_REVIEW);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="Track all system changes and access"
        icon={<IconFileAnalytics size={28} />}
      />
      <Tabs defaultValue="log">
        <Tabs.List>
          <Tabs.Tab value="log" leftSection={<IconHistory size={16} />}>
            Change Log
          </Tabs.Tab>
          <Tabs.Tab value="user-activity" leftSection={<IconUserSearch size={16} />}>
            User Activity
          </Tabs.Tab>
          {canViewAccess && (
            <Tabs.Tab value="access" leftSection={<IconEye size={16} />}>
              Access Log
            </Tabs.Tab>
          )}
          {canReviewBreakGlass && (
            <Tabs.Tab value="break-glass" leftSection={<IconShieldLock size={16} />}>
              Break-glass
            </Tabs.Tab>
          )}
          <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
            Statistics
          </Tabs.Tab>
          <Tabs.Tab value="timeline" leftSection={<IconHistory size={16} />}>
            Entity Timeline
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="log" pt="md">
          <AuditLogTab />
        </Tabs.Panel>
        <Tabs.Panel value="user-activity" pt="md">
          <UserActivityTab />
        </Tabs.Panel>
        {canViewAccess && (
          <Tabs.Panel value="access" pt="md">
            <AccessLogTab />
          </Tabs.Panel>
        )}
        {canReviewBreakGlass && (
          <Tabs.Panel value="break-glass" pt="md">
            <BreakGlassReviewTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="stats" pt="md">
          <AuditStatsTab />
        </Tabs.Panel>
        <Tabs.Panel value="timeline" pt="md">
          <EntityTimelineTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
