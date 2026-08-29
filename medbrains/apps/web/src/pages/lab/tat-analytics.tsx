// Lab TatAnalyticsSection — split from lab.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { LabTatAnalyticsRow, TatMonitoringRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge } from "@/components/ui";
import { labService } from "@/services/lab.service";

export function TatAnalyticsSection() {
  const { t } = useTranslation("lab");
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["lab-tat-analytics"],
    queryFn: () => labService.getLabTatAnalytics(),
  });

  // The aggregate says which tests are slow on average. It cannot say which
  // patient is waiting right now, and that is the one a laboratory can still
  // do something about. `listStatOrders` returns the urgent and STAT orders
  // with their expected turnaround, elapsed minutes and breach flag — the
  // fields the plain order list does not carry — and had no caller.
  const {
    data: urgent = [],
    isLoading: urgentLoading,
    isError: urgentFailed,
  } = useQuery({
    queryKey: ["lab-stat-orders"],
    queryFn: () => labService.listStatOrders(),
    refetchInterval: 60_000,
  });

  const breaching = urgent.filter((row: TatMonitoringRow) => row.is_breached);

  const urgentColumns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: TatMonitoringRow) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "ordered_at",
      label: "Ordered",
      render: (row: TatMonitoringRow) => (
        <Text size="sm">{new Date(row.ordered_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "elapsed",
      label: "Elapsed / expected",
      render: (row: TatMonitoringRow) => (
        <Text size="sm" fw={row.is_breached ? 600 : 400}>
          {row.actual_minutes != null ? `${row.actual_minutes} min` : "—"}
          {row.expected_tat_minutes != null ? ` / ${row.expected_tat_minutes} min` : ""}
        </Text>
      ),
    },
    {
      key: "state",
      label: "State",
      // Not colour alone: the badge says the word, so it survives a printed
      // handover sheet and a reader who cannot distinguish the tones.
      render: (row: TatMonitoringRow) =>
        row.is_breached ? (
          <Badge tone="danger" size="sm">
            Breached
          </Badge>
        ) : row.completed_at ? (
          <Badge tone="success" size="sm">
            Completed
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            In progress
          </Badge>
        ),
    },
  ];

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
      {/* Live before historical: the aggregate below is for improving the
          service, this is for the patient still waiting. */}
      {urgentFailed && (
        <Alert tone="danger" title="Urgent orders could not be loaded">
          Do not read this as nothing being overdue.
        </Alert>
      )}
      {breaching.length > 0 && (
        <Alert tone="danger" title={`${breaching.length} urgent order(s) past their turnaround`}>
          Each of these is a clinician waiting on a result they marked urgent.
        </Alert>
      )}
      <Group justify="space-between">
        <Text fw={600}>Urgent and STAT orders</Text>
        <Text c="dimmed" size="sm">
          {urgent.length} open, {breaching.length} breached
        </Text>
      </Group>
      <DataTable
        columns={urgentColumns}
        data={urgent}
        loading={urgentLoading}
        rowKey={(row: TatMonitoringRow) => row.order_id}
        emptyTitle={urgentFailed ? "Could not load urgent orders" : "Nothing urgent outstanding"}
        emptyDescription={
          urgentFailed
            ? "The list failed to load — this is not a statement that nothing is overdue."
            : "Urgent and STAT orders appear here with their turnaround."
        }
      />

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
