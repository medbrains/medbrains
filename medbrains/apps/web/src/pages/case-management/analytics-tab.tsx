// Case-management AnalyticsTab — split from case-management.tsx (pure move).

import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { BarrierAnalyticsRow, DispositionRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { caseManagementService } from "@/services/case-management.service";
import { BARRIER_TYPE_COLORS } from "./shared";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700}>
        {value}
      </Text>
    </Card>
  );
}

export function AnalyticsTab() {
  const { data: dispositions = [], isLoading: dispLoading } = useQuery({
    queryKey: ["case-analytics-dispositions"],
    queryFn: () => caseManagementService.dispositionAnalytics(),
  });

  const { data: barrierData = [], isLoading: barrierLoading } = useQuery({
    queryKey: ["case-analytics-barriers"],
    queryFn: () => caseManagementService.barrierAnalytics(),
  });

  const { data: outcomes } = useQuery({
    queryKey: ["case-analytics-outcomes"],
    queryFn: () => caseManagementService.outcomeAnalytics(),
  });

  const dispositionCols: Column<DispositionRow>[] = [
    {
      key: "disposition",
      label: "Disposition",
      render: (r) => <Text size="sm">{r.disposition ?? "Not set"}</Text>,
    },
    {
      key: "count",
      label: "Count",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.count}
        </Text>
      ),
    },
  ];

  const barrierCols: Column<BarrierAnalyticsRow>[] = [
    {
      key: "barrier_type",
      label: "Barrier Type",
      render: (r) => (
        <Badge tone={BARRIER_TYPE_COLORS[r.barrier_type] ?? "neutral"} variant="light" size="sm">
          {r.barrier_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "count",
      label: "Count",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.count}
        </Text>
      ),
    },
    {
      key: "avg_days_open",
      label: "Avg Days Open",
      render: (r) => (
        <Text size="sm">
          {r.avg_days_open !== undefined && r.avg_days_open !== null
            ? r.avg_days_open.toFixed(1)
            : "\u2014"}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {/* Outcome Summary Cards */}
      {outcomes && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <StatCard
            label="Avg Days to Discharge"
            value={
              outcomes.avg_days_to_discharge !== undefined &&
              outcomes.avg_days_to_discharge !== null
                ? outcomes.avg_days_to_discharge.toFixed(1)
                : "\u2014"
            }
          />
          <StatCard label="Total Discharged" value={outcomes.total_discharged} />
          <StatCard label="Total with Barriers" value={outcomes.total_with_barriers} />
        </SimpleGrid>
      )}

      {/* Disposition Table */}
      <Text fw={600} size="lg">
        Disposition Breakdown
      </Text>
      <DataTable
        columns={dispositionCols}
        data={dispositions}
        loading={dispLoading}
        rowKey={(r) => r.disposition ?? "none"}
      />

      {/* Barrier Breakdown Table */}
      <Text fw={600} size="lg">
        Barrier Breakdown
      </Text>
      <DataTable
        columns={barrierCols}
        data={barrierData}
        loading={barrierLoading}
        rowKey={(r) => r.barrier_type}
      />
    </Stack>
  );
}
