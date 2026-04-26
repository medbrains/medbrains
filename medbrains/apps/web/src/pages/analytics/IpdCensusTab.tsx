import { useState, useMemo } from "react";
import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { AreaChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { IpdCensusRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

function toIso(d: string | null): string | undefined {
  return d ?? undefined;
}

function toRows<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

// ── Component ────────────────────────────────────────────

export function IpdCensusTab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const params = useMemo(
    () => ({ from: toIso(from), to: toIso(to) }),
    [from, to],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "ipd-census", params],
    queryFn: () => api.getIpdCensus(params),
  });

  const rows = toRows(data);

  const totals = useMemo(() => {
    let admissions = 0;
    let discharges = 0;
    let deaths = 0;
    let latestActive = 0;
    for (const r of rows) {
      admissions += r.admissions;
      discharges += r.discharges;
      deaths += r.deaths;
      latestActive = r.active;
    }
    return { admissions, discharges, deaths, latestActive };
  }, [rows]);

  // ── Chart data ────────────────────────────────────────

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        Admissions: r.admissions,
        Discharges: r.discharges,
        Deaths: r.deaths,
      })),
    [rows],
  );

  // ── Table columns ─────────────────────────────────────

  const columns: Column<IpdCensusRow>[] = [
    { key: "date", label: "Date", render: (r) => <Text size="sm">{r.date}</Text> },
    { key: "admissions", label: "Admissions", render: (r) => <Text size="sm">{r.admissions}</Text> },
    { key: "discharges", label: "Discharges", render: (r) => <Text size="sm">{r.discharges}</Text> },
    { key: "deaths", label: "Deaths", render: (r) => <Text size="sm" c={r.deaths > 0 ? "danger" : undefined}>{r.deaths}</Text> },
    { key: "active", label: "Active Census", render: (r) => <Text size="sm" fw={600}>{r.active}</Text> },
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
      <SimpleGrid cols={4}>
        <StatCard label="Total Admissions" value={totals.admissions.toLocaleString()} />
        <StatCard label="Total Discharges" value={totals.discharges.toLocaleString()} />
        <StatCard label="Total Deaths" value={totals.deaths.toLocaleString()} color={totals.deaths > 0 ? "danger" : undefined} />
        <StatCard label="Current Census" value={totals.latestActive.toLocaleString()} />
      </SimpleGrid>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">IPD Census Trend</Text>
          <AreaChart
            h={300}
            data={chartData}
            dataKey="date"
            series={[
              { name: "Admissions", color: "blue.6" },
              { name: "Discharges", color: "green.6" },
              { name: "Deaths", color: "red.6" },
            ]}
            curveType="monotone"
            tickLine="y"
          />
        </Card>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(r) => r.date}
      />
    </Stack>
  );
}

// ── Sub-components ───────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card withBorder p="lg">
      <Text c="dimmed" size="sm">{label}</Text>
      <Text fw={700} size="xl" c={color}>{value}</Text>
    </Card>
  );
}
