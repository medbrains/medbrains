// Reports ReportTile — split from reports.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { ReportDataResponse } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconFileAnalytics } from "@tabler/icons-react";
import { NabhIndicatorMatrix } from "@/components/Reports/NabhIndicatorMatrix";
import { ReportChart } from "@/components/Reports/ReportChart";
import { Badge, Button } from "@/components/ui";
import { optionForReport } from "./chart-options";
import {
  colorToBadgeTone,
  loadingForReport,
  PRIORITY_META,
  READINESS_META,
  reportStatusLabel,
} from "./report-helpers";
import type { ReportDefinition, ReportLoadingState, ReportRuntimeData } from "./types";

export function ReportTile({
  report,
  runtimeData,
  loadingState,
  reportData,
  isReportLoading,
  onDetails,
}: {
  report: ReportDefinition;
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportData?: ReportDataResponse<unknown>;
  isReportLoading?: boolean;
  onDetails: (report: ReportDefinition) => void;
}) {
  const canView = usePermissionStore((state) =>
    report.permissions.some((permission) => state.hasPermission(permission)),
  );
  const readiness = READINESS_META[report.readiness];
  const priority = PRIORITY_META[report.priority];

  if (report.id === "nabh-evidence-matrix") {
    return (
      <Card withBorder radius="md" padding="md" h="100%">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={3}>
              <Group gap={6}>
                <Badge tone={colorToBadgeTone(priority.color)}>{priority.label}</Badge>
                <Badge tone={colorToBadgeTone(readiness.color)}>{readiness.label}</Badge>
              </Group>
              <Text fw={800}>{report.title}</Text>
              <Text size="sm" c="dimmed">
                {report.purpose}
              </Text>
            </Stack>
          </Group>
          {canView ? (
            <div style={{ position: "relative" }}>
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconFileAnalytics size={14} />}
                onClick={() => onDetails(report)}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                View details
              </Button>
              <NabhIndicatorMatrix />
            </div>
          ) : (
            <Text size="sm" c="dimmed">
              Restricted by permission: {report.permissions.join(", ")}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  const option = report.dataEndpoint
    ? optionForReport(report, runtimeData, reportData?.rows)
    : null;
  return (
    <ReportChart
      title={report.title}
      description={report.purpose}
      permission={report.permissions[0] ?? P.ANALYTICS.VIEW}
      option={option}
      emptyMessage={emptyMessageFor(report, reportData)}
      status={`${reportStatusLabel(report)}${
        reportData ? ` · ${reportData.summary.row_count} rows` : ""
      }`}
      isLoading={loadingForReport(report, loadingState) || isReportLoading}
      disabledActions={option === null}
      sourceHref={undefined}
      onViewDetails={() => onDetails(report)}
    />
  );
}

/** Why a report shows no chart — never a sample in its place. */
function emptyMessageFor(
  report: ReportDefinition,
  reportData: ReportDataResponse<unknown> | undefined,
): string {
  if (!report.dataEndpoint) {
    return "This report is not connected to data yet, so it has no chart. Its readiness above says what it needs.";
  }
  if (reportData && reportData.rows.length === 0) return "No data in the last 30 days.";
  if (reportData)
    return "This report's data has no figures to chart; open the details for the rows.";
  return "No data to show.";
}
