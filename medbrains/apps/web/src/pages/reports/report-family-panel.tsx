// Reports ReportFamilyPanel — split from reports.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Badge } from "@/components/ui";
import styles from "../reports.module.scss";
import { colorToBadgeTone } from "./report-helpers";
import { ReportTile } from "./report-tile";
import type {
  ReportDataById,
  ReportDefinition,
  ReportFamily,
  ReportLoadingState,
  ReportRuntimeData,
} from "./types";

export function ReportFamilyPanel({
  family,
  reports,
  runtimeData,
  loadingState,
  reportDataById,
  loadingByReportId,
  onDetails,
}: {
  family: ReportFamily;
  reports: ReportDefinition[];
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportDataById: ReportDataById;
  loadingByReportId: Record<string, boolean>;
  onDetails: (report: ReportDefinition) => void;
}) {
  const FamilyIcon = family.icon;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start">
            <ThemeIcon color={family.accent} size={44} radius="md">
              <FamilyIcon size={24} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                {family.eyebrow}
              </Text>
              <Title order={3}>{family.title}</Title>
              <Text c="dimmed">{family.description}</Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge tone={colorToBadgeTone(family.accent)} size="lg">
              {reports.length} charts
            </Badge>
            <Badge tone="danger">
              {reports.filter((report) => report.priority === "P1").length} P1
            </Badge>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, xl: 2 }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className={report.id === "nabh-evidence-matrix" ? styles.fullWidth : undefined}
            >
              <ReportTile
                report={report}
                runtimeData={runtimeData}
                loadingState={loadingState}
                reportData={reportDataById[report.id]}
                isReportLoading={loadingByReportId[report.id]}
                onDetails={onDetails}
              />
            </div>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
