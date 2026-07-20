// Radiology TatAnalyticsTab — split from radiology.tsx (pure move).

import { Text } from "@mantine/core";
import type { RadiologyTatRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader } from "@/components";
import { Badge } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

export function TatAnalyticsTab() {
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["radiology-tat"],
    queryFn: () => radiologyService.getRadiologyTat(),
  });

  const columns = [
    {
      key: "modality_name" as const,
      label: "Modality",
      render: (r: RadiologyTatRow) => <Text fw={600}>{r.modality_name}</Text>,
    },
    {
      key: "total_orders" as const,
      label: "Total Orders",
      render: (r: RadiologyTatRow) => String(r.total_orders),
    },
    {
      key: "completed_count" as const,
      label: "Total Completed",
      render: (r: RadiologyTatRow) => String(r.completed_count),
    },
    {
      key: "avg_tat_hours" as const,
      label: "Avg TAT (hours)",
      render: (r: RadiologyTatRow) =>
        r.avg_tat_hours !== null ? (
          <Badge
            tone={r.avg_tat_hours <= 24 ? "success" : r.avg_tat_hours <= 48 ? "warning" : "danger"}
          >
            {r.avg_tat_hours.toFixed(1)}h
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Turnaround Time Analytics"
        subtitle="Average turnaround times by modality"
      />
      <DataTable
        columns={columns}
        data={tatData}
        rowKey={(r) => r.modality_name}
        loading={isLoading}
      />
    </>
  );
}
