import { Tabs } from "@mantine/core";
import {
  IconFileAnalytics,
  IconEye,
  IconChartBar,
  IconHistory,
} from "@tabler/icons-react";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { AuditLogTab } from "./audit/AuditLogTab";
import { AccessLogTab } from "./audit/AccessLogTab";
import { AuditStatsTab } from "./audit/AuditStatsTab";
import { EntityTimelineTab } from "./audit/EntityTimelineTab";

export function AuditPage() {
  useRequirePermission(P.AUDIT.LOG_VIEW);

  const canViewAccess = useHasPermission(P.AUDIT.ACCESS_VIEW);

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
          {canViewAccess && (
            <Tabs.Tab value="access" leftSection={<IconEye size={16} />}>
              Access Log
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
        {canViewAccess && (
          <Tabs.Panel value="access" pt="md">
            <AccessLogTab />
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
