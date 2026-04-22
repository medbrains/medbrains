import { useState, useMemo } from "react";
import {
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { BarChart, AreaChart, LineChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { OtUtilizationRow, ErVolumeRow, ClinicalIndicatorRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

function toIso(d: string | null): string | undefined {
  return d ?? undefined;
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Component ────────────────────────────────────────────

export function ClinicalTab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [section, setSection] = useState("ot");

  const params = useMemo(
    () => ({ from: toIso(from), to: toIso(to) }),
    [from, to],
  );

  return (
    <Stack gap="md">
      {/* Filters */}
      <Card withBorder p="sm">
        <Group>
          <DateInput label="From" value={from} onChange={(v) => setFrom(v)} clearable maxDate={to ? new Date(to) : undefined} size="sm" />
          <DateInput label="To" value={to} onChange={(v) => setTo(v)} clearable minDate={from ? new Date(from) : undefined} size="sm" />
          <SegmentedControl
            value={section}
            onChange={setSection}
            data={[
              { label: "OT Utilization", value: "ot" },
              { label: "ER Volume", value: "er" },
              { label: "Clinical Indicators", value: "indicators" },
            ]}
            mt="xl"
          />
        </Group>
      </Card>

      {section === "ot" && <OtSection params={params} />}
      {section === "er" && <ErSection params={params} />}
      {section === "indicators" && <IndicatorsSection params={params} />}
    </Stack>
  );
}

// ── OT Utilization Section ──────────────────────────────

function OtSection({ params }: { params: { from?: string; to?: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "ot-utilization", params],
    queryFn: () => api.getOtUtilization(params),
  });

  const rows = data ?? [];

  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.room_name, "Utilization %": r.utilization_pct })),
    [rows],
  );

  const columns: Column<OtUtilizationRow>[] = [
    { key: "room", label: "Room", render: (r) => <Text size="sm">{r.room_name}</Text> },
    { key: "bookings", label: "Bookings", render: (r) => <Text size="sm">{r.total_bookings}</Text> },
    { key: "completed", label: "Completed", render: (r) => <Text size="sm">{r.completed}</Text> },
    { key: "cancelled", label: "Cancelled", render: (r) => <Text size="sm" c={r.cancelled > 0 ? "danger" : undefined}>{r.cancelled}</Text> },
    { key: "avg_dur", label: "Avg Duration", render: (r) => <Text size="sm">{r.avg_duration_mins}m</Text> },
    {
      key: "util",
      label: "Utilization",
      render: (r) => (
        <Text size="sm" fw={600} c={r.utilization_pct > 85 ? "success" : r.utilization_pct < 50 ? "danger" : undefined}>
          {pct(r.utilization_pct)}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">OT Room Utilization</Text>
          <BarChart
            h={300}
            data={chartData}
            dataKey="name"
            series={[{ name: "Utilization %", color: "violet.6" }]}
            tickLine="y"
          />
        </Card>
      )}
      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(r) => r.room_name} />
    </Stack>
  );
}

// ── ER Volume Section ───────────────────────────────────

function ErSection({ params }: { params: { from?: string; to?: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "er-volume", params],
    queryFn: () => api.getErVolume(params),
  });

  const rows = data ?? [];

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        Immediate: r.immediate,
        Emergent: r.emergent,
        Urgent: r.urgent,
        "Less Urgent": r.less_urgent,
        "Non Urgent": r.non_urgent,
      })),
    [rows],
  );

  const columns: Column<ErVolumeRow>[] = [
    { key: "date", label: "Date", render: (r) => <Text size="sm">{r.date}</Text> },
    { key: "total", label: "Total", render: (r) => <Text size="sm" fw={600}>{r.total_visits}</Text> },
    { key: "imm", label: "Immediate", render: (r) => <Text size="sm" c="danger">{r.immediate}</Text> },
    { key: "emg", label: "Emergent", render: (r) => <Text size="sm" c="orange">{r.emergent}</Text> },
    { key: "urg", label: "Urgent", render: (r) => <Text size="sm" c="yellow.8">{r.urgent}</Text> },
    { key: "less", label: "Less Urgent", render: (r) => <Text size="sm">{r.less_urgent}</Text> },
    { key: "non", label: "Non Urgent", render: (r) => <Text size="sm">{r.non_urgent}</Text> },
    { key: "dtd", label: "Avg D2D (min)", render: (r) => <Text size="sm">{r.avg_door_to_doctor_mins.toFixed(0)}</Text> },
  ];

  return (
    <Stack gap="md">
      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">ER Volume by Triage Level</Text>
          <AreaChart
            h={300}
            data={chartData}
            dataKey="date"
            type="stacked"
            series={[
              { name: "Immediate", color: "red.6" },
              { name: "Emergent", color: "orange.6" },
              { name: "Urgent", color: "yellow.6" },
              { name: "Less Urgent", color: "blue.4" },
              { name: "Non Urgent", color: "gray.4" },
            ]}
            curveType="monotone"
            tickLine="y"
          />
        </Card>
      )}
      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(r) => r.date} />
    </Stack>
  );
}

// ── Clinical Indicators Section ─────────────────────────

function IndicatorsSection({ params }: { params: { from?: string; to?: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "clinical-indicators", params],
    queryFn: () => api.getClinicalIndicators(params),
  });

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        period: r.period,
        "Mortality %": r.mortality_rate,
        "Infection %": r.infection_rate,
        "Readmission %": r.readmission_rate,
        "ALOS (days)": r.avg_los_days,
      })),
    [rows],
  );

  const columns: Column<ClinicalIndicatorRow>[] = [
    { key: "period", label: "Period", render: (r) => <Text size="sm">{r.period}</Text> },
    { key: "mort", label: "Mortality %", render: (r) => <Text size="sm" c={r.mortality_rate > 2 ? "danger" : undefined}>{pct(r.mortality_rate)}</Text> },
    { key: "inf", label: "Infection %", render: (r) => <Text size="sm" c={r.infection_rate > 5 ? "danger" : undefined}>{pct(r.infection_rate)}</Text> },
    { key: "readm", label: "Readmission %", render: (r) => <Text size="sm">{pct(r.readmission_rate)}</Text> },
    { key: "alos", label: "ALOS (days)", render: (r) => <Text size="sm">{r.avg_los_days.toFixed(1)}</Text> },
  ];

  return (
    <Stack gap="md">
      {/* Stat cards */}
      {latest && (
        <SimpleGrid cols={4}>
          <StatCard label="Mortality Rate" value={pct(latest.mortality_rate)} color={latest.mortality_rate > 2 ? "danger" : undefined} />
          <StatCard label="Infection Rate" value={pct(latest.infection_rate)} color={latest.infection_rate > 5 ? "danger" : undefined} />
          <StatCard label="Readmission Rate" value={pct(latest.readmission_rate)} />
          <StatCard label="Avg LOS" value={`${latest.avg_los_days.toFixed(1)} days`} />
        </SimpleGrid>
      )}

      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">Clinical Indicator Trends</Text>
          <LineChart
            h={300}
            data={chartData}
            dataKey="period"
            series={[
              { name: "Mortality %", color: "red.6" },
              { name: "Infection %", color: "orange.6" },
              { name: "Readmission %", color: "blue.6" },
              { name: "ALOS (days)", color: "green.6" },
            ]}
            curveType="monotone"
            tickLine="y"
          />
        </Card>
      )}

      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(r) => r.period} />
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
