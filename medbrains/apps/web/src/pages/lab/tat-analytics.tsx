// Lab TatAnalyticsSection — split from lab.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { LabTatAnalyticsRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";
import { labService } from "@/services/lab.service";

export function TatAnalyticsSection() {
  const { t } = useTranslation("lab");
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["lab-tat-analytics"],
    queryFn: () => labService.getLabTatAnalytics(),
  });

  const columns = [
    {
      key: "test_name",
      label: "Test",
      render: (row: LabTatAnalyticsRow) => <Text fw={500}>{row.test_name}</Text>,
    },
    {
      key: "total_orders",
      label: "Total Completed",
      render: (row: LabTatAnalyticsRow) => <Text size="sm">{row.total_orders}</Text>,
    },
    {
      key: "avg_tat",
      label: "Avg TAT (hrs)",
      render: (row: LabTatAnalyticsRow) => (
        <Text size="sm" fw={500}>
          {row.avg_tat_minutes != null ? (row.avg_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "p95_tat",
      label: "P95 TAT (hrs)",
      render: (row: LabTatAnalyticsRow) => (
        <Text
          size="sm"
          c={row.p95_tat_minutes != null && row.p95_tat_minutes > 1440 ? "danger" : undefined}
        >
          {row.p95_tat_minutes != null ? (row.p95_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "within_sla",
      label: "Within SLA",
      render: (row: LabTatAnalyticsRow) => {
        const rate =
          row.total_orders > 0 ? ((row.within_sla / row.total_orders) * 100).toFixed(1) : "0.0";
        const tone: BadgeTone =
          Number(rate) >= 90 ? "success" : Number(rate) >= 70 ? "warning" : "danger";
        return (
          <Badge tone={tone} size="sm">
            {rate}% ({row.within_sla}/{row.total_orders})
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>{t("turnaroundTimeAnalytics")}</Text>
        <Text c="dimmed" size="sm">
          {tatData.length} test type(s)
        </Text>
      </Group>
      <DataTable
        columns={columns}
        data={tatData}
        loading={isLoading}
        rowKey={(row) => row.test_name}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Specialized Reports Tab (Phase 3)
// ══════════════════════════════════════════════════════════
