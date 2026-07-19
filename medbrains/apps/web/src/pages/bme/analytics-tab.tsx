// IPD AnalyticsTab — split from bme.tsx (pure move).

import { SegmentedControl, Stack, Text } from "@mantine/core";
import type { BmeMtbfRow, BmeUptimeRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/ui";
import { bmeService } from "@/services/bme.service";

function uptimeColor(pct: number | null): BadgeTone {
  if (pct == null) return "neutral";
  if (pct < 90) return "danger";
  if (pct < 95) return "warning";
  return "success";
}

export function AnalyticsTab() {
  const [view, setView] = useState("mtbf");

  const { data: mtbfData = [], isLoading: loadingMtbf } = useQuery({
    queryKey: ["bme-mtbf-analytics"],
    queryFn: () => bmeService.getBmeMtbfAnalytics(),
  });

  const { data: uptimeData = [], isLoading: loadingUptime } = useQuery({
    queryKey: ["bme-uptime-analytics"],
    queryFn: () => bmeService.getBmeUptimeAnalytics(),
  });

  const mtbfColumns: Column<BmeMtbfRow>[] = [
    {
      key: "equipment_name",
      label: "Equipment Name",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.equipment_name}
        </Text>
      ),
    },
    {
      key: "equipment_id",
      label: "Equipment ID",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.equipment_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "total_operating_hours",
      label: "Total Operating Hours",
      render: (r) => (
        <Text size="sm">
          {r.total_operating_hours != null ? r.total_operating_hours.toFixed(1) : "—"}
        </Text>
      ),
    },
    {
      key: "breakdown_count",
      label: "Breakdown Count",
      render: (r) => (
        <Text size="sm" c={r.breakdown_count > 0 ? "orange" : undefined}>
          {String(r.breakdown_count)}
        </Text>
      ),
    },
    {
      key: "mtbf_hours",
      label: "MTBF (hours)",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.mtbf_hours != null ? r.mtbf_hours.toFixed(1) : "—"}
        </Text>
      ),
    },
  ];

  const uptimeColumns: Column<BmeUptimeRow>[] = [
    {
      key: "equipment_name",
      label: "Equipment Name",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.equipment_name}
        </Text>
      ),
    },
    {
      key: "equipment_id",
      label: "Equipment ID",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.equipment_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "total_days",
      label: "Total Days",
      render: (r) => <Text size="sm">{r.total_days != null ? r.total_days.toFixed(1) : "—"}</Text>,
    },
    {
      key: "downtime_days",
      label: "Downtime Days",
      render: (r) => (
        <Text size="sm" c={r.downtime_days != null && r.downtime_days > 0 ? "danger" : undefined}>
          {r.downtime_days != null ? r.downtime_days.toFixed(1) : "—"}
        </Text>
      ),
    },
    {
      key: "uptime_percent",
      label: "Uptime %",
      render: (r) => (
        <Badge tone={uptimeColor(r.uptime_percent)} variant="light" size="lg">
          {r.uptime_percent != null ? `${r.uptime_percent.toFixed(1)}%` : "—"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { value: "mtbf", label: "MTBF Analysis" },
          { value: "uptime", label: "Uptime Analysis" },
        ]}
      />

      {view === "mtbf" && (
        <>
          <Text fw={600} size="lg">
            Mean Time Between Failures (MTBF)
          </Text>
          <DataTable
            columns={mtbfColumns}
            data={mtbfData}
            loading={loadingMtbf}
            rowKey={(r) => r.equipment_id}
            emptyTitle="No MTBF data available"
          />
        </>
      )}

      {view === "uptime" && (
        <>
          <Text fw={600} size="lg">
            Equipment Uptime
          </Text>
          <DataTable
            columns={uptimeColumns}
            data={uptimeData}
            loading={loadingUptime}
            rowKey={(r) => r.equipment_id}
            emptyTitle="No uptime data available"
          />
        </>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════
