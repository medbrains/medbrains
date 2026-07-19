// IPD QueueMetricsTab — split from front-office.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { QueueMetrics } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { frontOfficeService } from "@/services/frontOffice.service";

export function QueueMetricsTab() {
  const { data: metrics = [], isLoading } = useQuery<QueueMetrics[]>({
    queryKey: ["front-office", "queue-metrics"],
    queryFn: () => frontOfficeService.queueMetrics(),
  });

  const cols: Column<QueueMetrics>[] = [
    {
      key: "department",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department}
        </Text>
      ),
    },
    {
      key: "current_waiting",
      label: "Currently Waiting",
      render: (r) => (
        <Badge
          tone={r.current_waiting > 10 ? "danger" : r.current_waiting > 5 ? "warning" : "success"}
        >
          {r.current_waiting}
        </Badge>
      ),
    },
    {
      key: "avg_wait_minutes",
      label: "Avg Wait (min)",
      render: (r) => <Text size="sm">{Math.round(r.avg_wait_minutes)}</Text>,
    },
    {
      key: "longest_wait_minutes",
      label: "Longest Wait (min)",
      render: (r) => (
        <Text size="sm" c={r.longest_wait_minutes > 30 ? "danger" : undefined}>
          {Math.round(r.longest_wait_minutes)}
        </Text>
      ),
    },
    {
      key: "throughput_per_hour",
      label: "Throughput/hr",
      render: (r) => <Text size="sm">{r.throughput_per_hour.toFixed(1)}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Real-time queue performance metrics by department
      </Text>
      <DataTable columns={cols} data={metrics} loading={isLoading} rowKey={(r) => r.department} />
    </Stack>
  );
}
