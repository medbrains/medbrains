// Scheduling AnalyticsTab — split from scheduling.tsx (pure move).

import { BarChart } from "@mantine/charts";
import { Card, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import type { NoshowRateRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { schedulingService } from "@/services/scheduling.service";
import { formatPercent, truncateId } from "./shared";

export function AnalyticsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: noshowRates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ["scheduling-analytics-noshow-rates"],
    queryFn: () => schedulingService.noshowRates(),
  });

  const { data: accuracy } = useQuery({
    queryKey: ["scheduling-analytics-prediction-accuracy"],
    queryFn: () => schedulingService.predictionAccuracy(),
  });

  const { data: waitlistStatsData } = useQuery({
    queryKey: ["scheduling-analytics-waitlist-stats"],
    queryFn: () => schedulingService.waitlistStats(),
  });

  const { data: schedAnalytics } = useQuery({
    queryKey: ["scheduling-analytics-schedule", dateFrom, dateTo],
    queryFn: () =>
      schedulingService.scheduleAnalytics({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
  });

  const rateColumns: Column<NoshowRateRow>[] = [
    {
      key: "doctor_id",
      label: "Doctor",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.doctor_id ? truncateId(r.doctor_id) : "—"}
        </Text>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.department_id ? truncateId(r.department_id) : "—"}
        </Text>
      ),
    },
    {
      key: "total_appointments",
      label: "Total Appts",
      render: (r) => <Text size="sm">{r.total_appointments}</Text>,
    },
    {
      key: "noshow_count",
      label: "No-Shows",
      render: (r) => <Text size="sm">{r.noshow_count}</Text>,
    },
    {
      key: "noshow_rate",
      label: "No-Show Rate",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.noshow_rate != null ? formatPercent(r.noshow_rate) : "—"}
        </Text>
      ),
    },
  ];

  // Prepare chart data for schedule analytics
  const chartData = schedAnalytics
    ? [
        { metric: "Total Slots", value: schedAnalytics.total_slots },
        { metric: "Utilized", value: schedAnalytics.utilized_slots },
        { metric: "No-Shows", value: schedAnalytics.no_show_count },
      ]
    : [];

  return (
    <Stack gap="lg">
      {/* Schedule Analytics with BarChart */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            Schedule Analytics
          </Text>
          <Group gap="xs">
            <TextInput
              placeholder="From (YYYY-MM-DD)"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.currentTarget.value)}
              style={{ width: 160 }}
              size="xs"
            />
            <TextInput
              placeholder="To (YYYY-MM-DD)"
              value={dateTo}
              onChange={(e) => setDateTo(e.currentTarget.value)}
              style={{ width: 160 }}
              size="xs"
            />
          </Group>
        </Group>
        {schedAnalytics && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
              <StatCard label="Total Slots" value={schedAnalytics.total_slots} color="primary" />
              <StatCard
                label="Utilization Rate"
                value={formatPercent(schedAnalytics.utilization_rate)}
                color="success"
              />
              <StatCard
                label="No-Show Rate"
                value={formatPercent(schedAnalytics.no_show_rate)}
                color="danger"
              />
              <StatCard
                label="Avg Wait (min)"
                value={(schedAnalytics.avg_wait_minutes ?? 0).toFixed(1)}
                color="orange"
              />
            </SimpleGrid>
            {chartData.length > 0 && (
              <BarChart
                h={250}
                data={chartData}
                dataKey="metric"
                series={[{ name: "value", label: "Count", color: "primary" }]}
              />
            )}
          </>
        )}
      </div>

      {/* Waitlist Stats */}
      {waitlistStatsData && (
        <div>
          <Text fw={600} size="lg" mb="sm">
            Waitlist Overview
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <StatCard label="Waiting" value={waitlistStatsData.total_waiting} color="warning" />
            <StatCard label="Offered" value={waitlistStatsData.total_offered} color="primary" />
            <StatCard label="Booked" value={waitlistStatsData.total_booked} color="success" />
            <StatCard
              label="Avg Wait (days)"
              value={
                waitlistStatsData.avg_wait_days != null
                  ? waitlistStatsData.avg_wait_days.toFixed(1)
                  : "—"
              }
              color="slate"
            />
          </SimpleGrid>
        </div>
      )}

      {/* Prediction Accuracy */}
      {accuracy && (
        <div>
          <Text fw={600} size="lg" mb="sm">
            Prediction Accuracy
          </Text>
          <Card withBorder p="md">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Model Version
                </Text>
                <Text fw={600}>{accuracy.model_version}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Predictions
                </Text>
                <Text fw={600}>{accuracy.total_predictions.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Status
                </Text>
                <Text fw={600}>{accuracy.message}</Text>
              </div>
            </Group>
          </Card>
        </div>
      )}

      {/* No-Show Rates Table */}
      <div>
        <Text fw={600} size="lg" mb="sm">
          No-Show Rates
        </Text>
        <DataTable<NoshowRateRow>
          columns={rateColumns}
          data={noshowRates}
          loading={ratesLoading}
          rowKey={(r) => `${r.doctor_id ?? "all"}-${r.department_id ?? "all"}`}
          emptyTitle="No rate data"
          emptyDescription="No-show rate data will appear once appointments are tracked"
        />
      </div>
    </Stack>
  );
}

// ── Stat Card Helper ──────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card withBorder p="md">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl" c={color}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
    </Card>
  );
}
