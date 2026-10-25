import { Code, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ErrorTrackingSnapshot } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBug,
  IconExternalLink,
  IconHeartbeat,
  IconListDetails,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { errorTrackingService } from "@/services/errorTracking.service";

/** The software's own failures, from the hospital's self-hosted error tracker. */
export function ErrorTrackingSettings() {
  const canView = useHasPermission(P.ADMIN.ERROR_TRACKING.VIEW);
  const summary = useQuery({
    queryKey: ["error-tracking-summary"],
    queryFn: () => errorTrackingService.getSummary(),
    enabled: canView,
    staleTime: 60_000,
  });

  if (!canView) return null;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={3}>Error tracking</Title>
          <Text size="sm" c="dimmed">
            Crashes and errors in this software, reported to the error tracker on this hospital's
            own server. Reports carry no patient data.
          </Text>
        </Stack>
        <Button
          tone="secondary"
          size="xs"
          onClick={() => void summary.refetch()}
          loading={summary.isFetching}
        >
          Refresh
        </Button>
      </Group>
      <SummaryBody isLoading={summary.isLoading} isError={summary.isError} data={summary.data} />
    </Stack>
  );
}

interface SummaryBodyProps {
  isLoading: boolean;
  isError: boolean;
  data: Awaited<ReturnType<typeof errorTrackingService.getSummary>> | undefined;
}

function SummaryBody({ isLoading, isError, data }: SummaryBodyProps) {
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading error tracking…
      </Text>
    );
  }
  if (isError || !data) {
    return <UnavailableNotice reason="This server did not answer." dashboardUrl={null} />;
  }
  if (data.status === "off") {
    return (
      <Alert tone="info" title="Error tracking is off">
        <Text size="sm">
          Nothing is being reported ({data.reason}). The install script sets it up on this server
          when <Code>INSTALL_RUSTRAK=1</Code> is given.
        </Text>
      </Alert>
    );
  }
  if (data.status === "unavailable") {
    return <UnavailableNotice reason={data.reason} dashboardUrl={data.dashboard_url} />;
  }
  return <Snapshot snapshot={data} />;
}

/** An outage is never shown as zero errors: the counts are unknown, and it says so. */
function UnavailableNotice({
  reason,
  dashboardUrl,
}: {
  reason: string;
  dashboardUrl: string | null;
}) {
  return (
    <Alert
      tone="warning"
      icon={<IconAlertTriangle size={16} />}
      title="Error tracker unavailable — error counts are unknown"
    >
      <Stack gap="xs">
        <Text size="sm">{reason}</Text>
        {dashboardUrl && <OpenTrackerButton url={dashboardUrl} />}
      </Stack>
    </Alert>
  );
}

function OpenTrackerButton({ url }: { url: string }) {
  return (
    <Button
      tone="secondary"
      size="xs"
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      leftSection={<IconExternalLink size={16} />}
    >
      Open error tracker
    </Button>
  );
}

function crashFreeLabel(rate: number | null): string {
  return rate === null ? "No sessions yet" : `${(rate * 100).toFixed(2)}%`;
}

function Snapshot({ snapshot }: { snapshot: ErrorTrackingSnapshot }) {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard
          label="New issues, last 24 h"
          value={snapshot.new_issues_24h}
          icon={<IconBug size={20} />}
        />
        <StatCard
          label={`Crash-free sessions · ${snapshot.release.slice(0, 12)}`}
          value={crashFreeLabel(snapshot.crash_free_rate)}
          icon={<IconHeartbeat size={20} />}
        />
        <StatCard
          label="Open issues"
          value={snapshot.open_issues}
          icon={<IconListDetails size={20} />}
        />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {snapshot.events_24h} error events and {snapshot.sessions_24h} sessions on this release in
        the last 24 hours ({snapshot.environment}).
      </Text>
      <RecentIssues issues={snapshot.recent_issues} />
      {snapshot.dashboard_url && <OpenTrackerButton url={snapshot.dashboard_url} />}
    </Stack>
  );
}

function RecentIssues({ issues }: { issues: ErrorTrackingSnapshot["recent_issues"] }) {
  if (issues.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No open issues.
      </Text>
    );
  }
  return (
    <Table>
      <Table.Caption>Most recent open issues</Table.Caption>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Issue</Table.Th>
          <Table.Th>Level</Table.Th>
          <Table.Th>Events</Table.Th>
          <Table.Th>Last seen</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {issues.map((issue) => (
          <Table.Tr key={issue.short_id}>
            <Table.Td>
              <Text size="sm" ff="monospace">
                {issue.short_id}
              </Text>
              <Text size="sm">{issue.title}</Text>
            </Table.Td>
            <Table.Td>
              <Badge tone={issue.level === "fatal" ? "danger" : "warning"} size="sm">
                {issue.level ?? "error"}
              </Badge>
            </Table.Td>
            <Table.Td>{issue.event_count}</Table.Td>
            <Table.Td>{new Date(issue.last_seen).toLocaleString()}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
