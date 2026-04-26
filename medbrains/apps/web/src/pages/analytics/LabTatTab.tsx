import { useState, useMemo } from "react";
import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { BarChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { LabTatRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

function toIso(d: string | null): string | undefined {
  return d ?? undefined;
}

function toRows<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins.toFixed(0)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Component ────────────────────────────────────────────

export function LabTatTab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const params = useMemo(
    () => ({ from: toIso(from), to: toIso(to) }),
    [from, to],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "lab-tat", params],
    queryFn: () => api.getLabTat(params),
  });

  const rows = toRows(data);

  // ── Aggregated stats ──────────────────────────────────

  const stats = useMemo(() => {
    if (rows.length === 0) return { avgTat: 0, p90Tat: 0, totalOrders: 0 };
    let totalWeightedTat = 0;
    let totalOrders = 0;
    let maxP90 = 0;
    for (const r of rows) {
      totalWeightedTat += r.avg_tat_mins * r.order_count;
      totalOrders += r.order_count;
      if (r.p90_tat_mins > maxP90) maxP90 = r.p90_tat_mins;
    }
    return {
      avgTat: totalOrders > 0 ? totalWeightedTat / totalOrders : 0,
      p90Tat: maxP90,
      totalOrders,
    };
  }, [rows]);

  // ── Chart ─────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.avg_tat_mins - a.avg_tat_mins)
        .slice(0, 10)
        .map((r) => ({
          name: r.test_name,
          "Avg TAT": Math.round(r.avg_tat_mins),
          "P90 TAT": Math.round(r.p90_tat_mins),
        })),
    [rows],
  );

  // ── Table columns ─────────────────────────────────────

  const columns: Column<LabTatRow>[] = [
    { key: "test", label: "Test Name", render: (r) => <Text size="sm">{r.test_name}</Text> },
    { key: "orders", label: "Orders", render: (r) => <Text size="sm">{r.order_count.toLocaleString()}</Text> },
    {
      key: "avg",
      label: "Avg TAT",
      render: (r) => (
        <Text size="sm" fw={600} c={r.avg_tat_mins > 120 ? "danger" : undefined}>
          {fmtMins(r.avg_tat_mins)}
        </Text>
      ),
    },
    {
      key: "p90",
      label: "P90 TAT",
      render: (r) => (
        <Text size="sm" c={r.p90_tat_mins > 180 ? "orange" : undefined}>
          {fmtMins(r.p90_tat_mins)}
        </Text>
      ),
    },
    { key: "min", label: "Min", render: (r) => <Text size="sm">{fmtMins(r.min_tat_mins)}</Text> },
    { key: "max", label: "Max", render: (r) => <Text size="sm">{fmtMins(r.max_tat_mins)}</Text> },
  ];

  return (
    <Stack gap="md">
      {/* Date filter */}
      <Card withBorder p="sm">
        <Group>
          <DateInput
            label="From"
            value={from}
            onChange={(v) => setFrom(v)}
            clearable
            maxDate={to ? new Date(to) : undefined}
            size="sm"
          />
          <DateInput
            label="To"
            value={to}
            onChange={(v) => setTo(v)}
            clearable
            minDate={from ? new Date(from) : undefined}
            size="sm"
          />
        </Group>
      </Card>

      {/* Stat cards */}
      <SimpleGrid cols={3}>
        <StatCard label="Weighted Avg TAT" value={fmtMins(stats.avgTat)} />
        <StatCard label="Worst P90 TAT" value={fmtMins(stats.p90Tat)} />
        <StatCard label="Total Orders" value={stats.totalOrders.toLocaleString()} />
      </SimpleGrid>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">Top 10 Tests by Avg TAT</Text>
          <BarChart
            h={300}
            data={chartData}
            dataKey="name"
            series={[
              { name: "Avg TAT", color: "blue.6" },
              { name: "P90 TAT", color: "orange.6" },
            ]}
            tickLine="y"
          />
        </Card>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(r) => r.test_name}
        rowStyle={(r) =>
          r.avg_tat_mins > 120
            ? { backgroundColor: "var(--mantine-color-red-0)" }
            : undefined
        }
      />
    </Stack>
  );
}

// ── Sub-components ───────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder p="lg">
      <Text c="dimmed" size="sm">{label}</Text>
      <Text fw={700} size="xl">{value}</Text>
    </Card>
  );
}
