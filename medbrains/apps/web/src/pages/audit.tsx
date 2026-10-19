import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconChartBar,
  IconEye,
  IconFileAnalytics,
  IconHistory,
  IconShieldCheck,
  IconShieldLock,
  IconUserSearch,
  IconUserShield,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AccessAlertsTab } from "./audit/AccessAlertsTab";
import { AccessLogTab } from "./audit/AccessLogTab";
import { AuditLogTab } from "./audit/AuditLogTab";
import { AuditStatsTab } from "./audit/AuditStatsTab";
import { BreakGlassReviewTab } from "./audit/BreakGlassReviewTab";
import { ChainIntegrityTab } from "./audit/ChainIntegrityTab";
import { DataProcessorsTab } from "./audit/DataProcessorsTab";
import { EntityTimelineTab } from "./audit/EntityTimelineTab";
import { PrivacyRequestsTab } from "./audit/PrivacyRequestsTab";
import { UserActivityTab } from "./audit/UserActivityTab";

export function AuditPage() {
  useRequirePermission(P.AUDIT.LOG_VIEW);

  const canViewAccess = useHasPermission(P.AUDIT.ACCESS_VIEW);
  const canReviewBreakGlass = useHasPermission(P.AUDIT.BREAK_GLASS_REVIEW);
  const canSeePrivacyRequests = useHasPermission(P.PATIENTS.PRIVACY_REQUESTS_LIST);
  const canSeeProcessors = useHasPermission(P.AUDIT.PROCESSORS_LIST);

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
          {canViewAccess && (
            <Tabs.Tab value="access-alerts" leftSection={<IconAlertTriangle size={16} />}>
              Access alerts
            </Tabs.Tab>
          )}
          {canReviewBreakGlass && (
            <Tabs.Tab value="break-glass" leftSection={<IconShieldLock size={16} />}>
              Break-glass
            </Tabs.Tab>
          )}
          {canSeePrivacyRequests && (
            <Tabs.Tab value="privacy-requests" leftSection={<IconUserShield size={16} />}>
              Privacy requests
            </Tabs.Tab>
          )}
          {canSeeProcessors && (
            <Tabs.Tab value="processors" leftSection={<IconBuildingStore size={16} />}>
              Data processors
            </Tabs.Tab>
          )}
          <Tabs.Tab value="integrity" leftSection={<IconShieldCheck size={16} />}>
            Chain Integrity
          </Tabs.Tab>
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
        {canViewAccess && (
          <Tabs.Panel value="access-alerts" pt="md">
            <AccessAlertsTab />
          </Tabs.Panel>
        )}
        {canReviewBreakGlass && (
          <Tabs.Panel value="break-glass" pt="md">
            <BreakGlassReviewTab />
          </Tabs.Panel>
        )}
        {canSeeProcessors && (
          <Tabs.Panel value="processors" pt="md">
            <DataProcessorsTab />
          </Tabs.Panel>
        )}
        {canSeePrivacyRequests && (
          <Tabs.Panel value="privacy-requests" pt="md">
            <PrivacyRequestsTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="integrity" pt="md">
          <ChainIntegrityTab />
        </Tabs.Panel>
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
